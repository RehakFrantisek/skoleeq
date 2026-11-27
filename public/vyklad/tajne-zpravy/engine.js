// Malý „scrollytelling“ engine bez knihoven.
// - Každá <section class="scene"> má vlastní průběh --p (0..1) podle scrollu.
// - Sekce s .scene--sticky jsou vysoké data-length (v % výšky okna) a jejich .stage drží na místě.
// - data-stops určují zastávky pro prezentaci (šipky ←/→, PageUp/PageDown, klikr).
(function () {
  'use strict';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = Array.from(document.querySelectorAll('.scene'));
  const handlers = new Map();
  const bar = document.querySelector('.progress span');
  let vh = window.innerHeight;
  let stops = [];
  let ticking = false;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  function layout() {
    vh = window.innerHeight;
    scenes.forEach((s) => {
      if (s.classList.contains('scene--sticky')) {
        const len = Number(s.dataset.length || 200);
        s.style.height = `${(len / 100) * vh}px`;
      }
    });
    handlers.forEach((h) => h.resize && h.resize());
    stops = [];
    scenes.forEach((s) => {
      const top = s.offsetTop;
      const run = Math.max(0, s.offsetHeight - vh);
      s._top = top;
      s._run = run;
      // Scéna může zastávky spočítat sama (např. podle výšky vrstev), jinak data-stops
      const h = handlers.get(s.id);
      const list = h && h.stops ? h.stops() : (s.dataset.stops || '0').split(/\s+/).map(Number);
      list.forEach((p) => stops.push(Math.round(top + p * run)));
    });
    stops = Array.from(new Set(stops)).sort((a, b) => a - b);
    update(true);
  }

  function update(force) {
    ticking = false;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - vh;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    let current = scenes[0];
    scenes.forEach((s) => {
      if (y + vh * 0.5 >= s._top) current = s;
      const visible = y + vh > s._top - vh * 0.5 && y < s._top + s.offsetHeight + vh * 0.5;
      if (!visible && !force) return;
      const p = s._run > 0 ? clamp((y - s._top) / s._run) : clamp((y + vh - s._top) / (s.offsetHeight + vh));
      if (p === s._p && !force) return;
      s._p = p;
      s.style.setProperty('--p', p.toFixed(4));
      const h = handlers.get(s.id);
      if (h && h.update) h.update(p, s);
    });
    setCurrent(current);
  }

  // Navigační tečky
  const dotList = document.getElementById('dots');
  const dots = scenes.map((s) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${s.id}`;
    a.setAttribute('aria-label', s.dataset.title || s.id);
    const tip = document.createElement('span');
    tip.textContent = s.dataset.title || s.id;
    a.appendChild(tip);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      go(s._top);
    });
    li.appendChild(a);
    dotList.appendChild(li);
    return a;
  });
  let lastCurrent = null;
  function setCurrent(s) {
    if (s === lastCurrent) return;
    lastCurrent = s;
    dots.forEach((d, i) => {
      if (scenes[i] === s) d.setAttribute('aria-current', 'step');
      else d.removeAttribute('aria-current');
    });
  }

  function go(y) {
    window.scrollTo({ top: y, behavior: reduce.matches ? 'auto' : 'smooth' });
  }

  function step(dir) {
    const y = Math.round(window.scrollY);
    const target = dir > 0 ? stops.find((s) => s > y + 4) : [...stops].reverse().find((s) => s < y - 4);
    if (target !== undefined) go(target);
    else if (dir > 0) go(document.documentElement.scrollHeight);
  }

  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t.closest && t.closest('input, textarea, select, [data-own-keys]')) return;
    const next = e.key === 'ArrowRight' || e.key === 'PageDown';
    const prev = e.key === 'ArrowLeft' || e.key === 'PageUp';
    if (!next && !prev) return;
    e.preventDefault();
    step(next ? 1 : -1);
    document.getElementById('keysHint')?.classList.add('is-gone');
  });

  // Tlačítka ◀ ▶ na obrazovce (interaktivní tabule: dotyk/pero se chová jako klik myší)
  document.getElementById('stepPrev')?.addEventListener('click', () => step(-1));
  document.getElementById('stepNext')?.addEventListener('click', () => step(1));

  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => update(false));
    }
  }, { passive: true });

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(layout, 120);
  });

  window.Vyklad = {
    reduceMotion: () => reduce.matches,
    clamp,
    // Mapuje p z intervalu [a, b] na 0..1
    seg: (p, a, b) => clamp((p - a) / (b - a)),
    on(id, handler) {
      handlers.set(id, handler);
    },
    start() {
      layout();
      window.addEventListener('load', layout);
    },
  };
})();
