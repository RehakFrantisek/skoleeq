// Jednotlivé scény výkladu. Text z dat vkládáme přes textContent.
(function () {
  'use strict';
  const O = window.OBSAH;
  const V = window.Vyklad;
  const { seg, clamp } = V;
  const SVGNS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs = {}, text) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'style') n.style.cssText = v;
      else n.setAttribute(k, v);
    }
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function svg(tag, attrs = {}, text) {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    return n;
  }
  // Deterministický generátor náhody, aby scéna vypadala pokaždé stejně
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const typeById = Object.fromEntries(O.types.map((t) => [t.id, t]));
  const fmt = (n) => n.toLocaleString('cs-CZ');

  /* ---------- 0 · Úvod ---------- */
  (function hero() {
    const field = document.getElementById('heroField');
    for (let i = 0; i < 26; i++) {
      const x = -200 + i * 80;
      field.appendChild(svg('line', { x1: 800 + (x - 800) * 0.35, y1: 700, x2: x, y2: 800 }));
    }
    const layers = Array.from(document.querySelectorAll('.hero__layer'));
    const ground = document.querySelector('.hero__ground');
    const sun = document.querySelector('.hero__sun');
    const text = document.querySelector('.hero__text');
    V.on('uvod', {
      update(p) {
        const dive = seg(p, 0.25, 1);
        layers.forEach((l) => {
          const d = Number(l.dataset.depth);
          l.setAttribute('transform', `translate(0 ${(-p * d * 500).toFixed(1)})`);
        });
        ground.setAttribute('transform', `translate(0 ${(-dive * 800).toFixed(1)})`);
        sun.setAttribute('transform', `translate(0 ${(p * 120).toFixed(1)})`);
        text.style.opacity = String(1 - seg(p, 0.05, 0.45));
        text.style.transform = `translateY(${(-p * 60).toFixed(1)}px)`;
      },
    });
  })();

  /* ---------- 1 · Vznik ---------- */
  (function vznik() {
    const rand = rng(7);
    const rain = document.getElementById('rain');
    for (let i = 0; i < 34; i++) {
      const x = rand() * 400, y = rand() * 190;
      rain.appendChild(svg('line', { x1: x, y1: y, x2: x, y2: y + 16, style: `animation-delay:${(-rand()).toFixed(2)}s` }));
    }
    const frost = document.getElementById('frost');
    for (let i = 0; i < 9; i++) {
      frost.appendChild(svg('text', { x: 20 + rand() * 360, y: 30 + rand() * 150, 'font-size': 18 + rand() * 14, stroke: 'none', fill: '#ffffff' }, '❄'));
    }
    const cracks = document.getElementById('cracks');
    const crackPaths = [
      'M60 200 L75 250 L62 300 L80 360', 'M150 200 L140 240 L160 280 L150 330 L170 410',
      'M250 200 L262 235 L245 270 L268 320', 'M340 200 L330 260 L350 300 L338 380',
      'M75 250 L110 262', 'M160 280 L200 290 L215 330', 'M245 270 L215 285',
    ];
    const crackEls = crackPaths.map((d) => {
      const pth = svg('path', { d, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 });
      cracks.appendChild(pth);
      return pth;
    });
    const grains = document.getElementById('grains');
    const grainEls = [];
    for (let i = 0; i < 60; i++) {
      const g = svg('circle', { cx: rand() * 400, cy: 186 + rand() * 18, r: 2 + rand() * 5, fill: ['#9d9c95', '#77766f', '#b3a58a'][i % 3], opacity: 0 });
      grains.appendChild(g);
      grainEls.push(g);
    }
    const roots = document.getElementById('roots');
    const rootEls = ['M70 200 C72 230 60 250 66 290', 'M180 200 C176 240 196 260 186 310 M186 250 L210 270',
      'M290 200 C296 225 282 250 292 285', 'M120 200 C118 220 130 235 124 255'].map((d) => {
      const pth = svg('path', { d, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 });
      roots.appendChild(pth);
      return pth;
    });
    const plants = document.getElementById('plants');
    const plantEls = [];
    [40, 70, 120, 150, 180, 230, 260, 290, 330, 365].forEach((x, i) => {
      const g = svg('g', { transform: `translate(${x} 200) scale(0)`, 'data-x': x });
      const h = 22 + (i % 3) * 10;
      g.appendChild(svg('path', { d: `M0 0 C-4 ${-h / 2} 2 ${-h * 0.8} -6 ${-h}`, stroke: '#4f8f34', 'stroke-width': 3, fill: 'none' }));
      g.appendChild(svg('path', { d: `M0 0 C4 ${-h / 2} 0 ${-h * 0.7} 8 ${-h * 0.9}`, stroke: '#64a843', 'stroke-width': 3, fill: 'none' }));
      if (i % 3 === 0) g.appendChild(svg('circle', { cx: -6, cy: -h, r: 5, fill: '#f2c94c' }));
      plants.appendChild(g);
      plantEls.push(g);
    });
    const critters = document.getElementById('critters');
    const critterEls = [['🪱', 90], ['🐜', 210], ['🪱', 320], ['🍄', 160]].map(([e, x]) => {
      const t = svg('text', { x, y: 192, opacity: 0, 'text-anchor': 'middle' }, e);
      critters.appendChild(t);
      return t;
    });
    const soil = document.getElementById('soilLayer');
    const steps = Array.from(document.querySelectorAll('#vznikSteps li'));
    const cm = document.getElementById('cm');
    const years = document.getElementById('years');

    V.on('vznik', {
      update(p) {
        rain.style.opacity = String(seg(p, 0, 0.12) * (1 - seg(p, 0.35, 0.45)) + seg(p, 0.85, 1) * 0.4);
        frost.setAttribute('opacity', String(seg(p, 0.28, 0.36) * (1 - seg(p, 0.5, 0.58))));
        crackEls.forEach((c, i) => c.setAttribute('stroke-dashoffset', String(1 - seg(p, 0.08 + i * 0.04, 0.4 + i * 0.03))));
        grainEls.forEach((g, i) => g.setAttribute('opacity', String(seg(p, 0.3 + (i % 10) * 0.02, 0.5 + (i % 10) * 0.02))));
        const grow = seg(p, 0.4, 1);
        const h = grow * 60;
        soil.setAttribute('y', String(200 - h));
        soil.setAttribute('height', String(h));
        grains.setAttribute('transform', `translate(0 ${-h})`);
        roots.setAttribute('transform', `translate(0 ${-h})`);
        rootEls.forEach((r, i) => r.setAttribute('stroke-dashoffset', String(1 - seg(p, 0.55 + i * 0.04, 0.8 + i * 0.03))));
        plantEls.forEach((g, i) => {
          const s = seg(p, 0.5 + (i % 5) * 0.03, 0.7 + (i % 5) * 0.03);
          g.setAttribute('transform', `translate(${g.dataset.x} ${200 - h}) scale(${s.toFixed(3)})`);
        });
        critterEls.forEach((c, i) => {
          c.setAttribute('opacity', String(seg(p, 0.74 + i * 0.04, 0.84 + i * 0.04)));
          c.setAttribute('y', String(200 - h * 0.35));
        });
        const idx = p < 0.28 ? 0 : p < 0.52 ? 1 : p < 0.74 ? 2 : 3;
        steps.forEach((li, i) => li.classList.toggle('is-active', i === idx));
        const c = Math.round(grow * 100) / 10;
        cm.textContent = c.toLocaleString('cs-CZ', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        years.textContent = c === 0 ? '0' : `${fmt(Math.round(c * 100))}–${fmt(Math.round(c * 150))}`;
      },
    });
  })();

  /* ---------- 2 · Půdní profil ---------- */
  (function profil() {
    const shaft = document.getElementById('shaft');
    const track = el('div', { class: 'shaft__track' });
    shaft.appendChild(track);
    const rand = rng(42);
    const parts = O.horizons.map((h, idx) => {
      const part = el('div', { class: `horizon horizon--${h.id}` });
      part.style.setProperty('--h', h.height);
      if (h.id === 'povrch') {
        part.appendChild(el('div', { class: 'horizon__sky' }));
        const grass = el('div', { class: 'horizon__grass' });
        part.appendChild(grass);
        const guide = el('div', { class: 'guide' }, '🪱');
        part.appendChild(guide);
      } else {
        part.style.background = h.color;
        const n = h.id === 'hornina' ? 9 : h.id === 'hrabanka' ? 0 : h.id === 'humus' ? 10 : 26;
        for (let i = 0; i < n; i++) {
          const size = h.id === 'hornina' ? 60 + rand() * 120 : 6 + rand() * (h.id === 'spodni' ? 34 : 18);
          const pebble = el('span', { class: h.id === 'hornina' ? 'rock' : 'pebble' });
          pebble.style.cssText = `left:${(rand() * 100).toFixed(1)}%;top:${(rand() * 92).toFixed(1)}%;width:${size.toFixed(0)}px;height:${(size * (0.6 + rand() * 0.4)).toFixed(0)}px;--r:${(rand() * 40).toFixed(0)}deg`;
          part.appendChild(pebble);
        }
        if (h.id === 'hrabanka') {
          for (let i = 0; i < 28; i++) {
            const leaf = el('span', { class: 'leaf' });
            leaf.style.cssText = `left:${(rand() * 100).toFixed(1)}%;top:${(rand() * 90).toFixed(1)}%;--r:${(rand() * 360).toFixed(0)}deg;background:${['#c07a2c', '#9a5b20', '#d79a3c', '#7c4a1c'][i % 4]}`;
            part.appendChild(leaf);
          }
        }
        (h.critters || []).forEach((c, i) => {
          const cr = el('span', { class: 'critter' }, c);
          cr.style.cssText = `left:${(8 + rand() * 80).toFixed(1)}%;top:${(15 + rand() * 65).toFixed(1)}%;animation-delay:${(-rand() * 4).toFixed(2)}s`;
          part.appendChild(cr);
        });
        part.appendChild(el('span', { class: 'horizon__tag' }, h.name));
      }
      track.appendChild(part);
      return { h, part, idx };
    });
    // Kořeny přes hrabanku, humus a vrchní minerální vrstvu
    const rootSvg = svg('svg', { class: 'roots', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    ['M12 0 C14 20 8 35 13 60 C15 75 10 85 12 100', 'M30 0 C28 18 34 30 30 45', 'M70 0 C72 25 64 40 70 70 C72 80 68 90 71 98',
      'M86 0 C84 15 90 22 87 35', 'M70 40 C76 46 82 48 88 56', 'M13 60 C20 64 22 70 28 72'].forEach((d) => {
      rootSvg.appendChild(svg('path', { d, 'vector-effect': 'non-scaling-stroke' }));
    });
    track.appendChild(rootSvg);

    const nameEl = document.getElementById('horizonName');
    const textEl = document.getElementById('horizonText');
    const chipsEl = document.getElementById('horizonChips');
    const needle = document.getElementById('depthNeedle');
    const depthLabel = document.getElementById('depthLabel');
    let stageH = 0, total = 0, offsets = [], current = -1;

    function resize() {
      stageH = shaft.clientHeight;
      parts.forEach(({ part, h }) => { part.style.height = `${h.height * stageH}px`; });
      offsets = parts.map(({ part }) => part.offsetTop);
      total = track.scrollHeight;
      const first = parts[1].part.offsetTop;
      const end = parts[3].part.offsetTop + parts[3].part.offsetHeight;
      rootSvg.style.top = `${first}px`;
      rootSvg.style.height = `${end - first}px`;
    }
    function show(i) {
      if (i === current) return;
      current = i;
      const { h } = parts[i];
      nameEl.textContent = h.name;
      textEl.textContent = h.text;
      chipsEl.replaceChildren(...(h.chips || []).map((c) => el('li', {}, c)));
      depthLabel.textContent = `· ${i + 1}/${parts.length}`;
      parts.forEach(({ part }, j) => part.classList.toggle('is-current', j === i));
    }
    V.on('profil', {
      resize,
      // Jedna zastávka na každou vrstvu: vrstva se zastaví kousek pod horním okrajem
      stops() {
        if (!stageH) resize();
        const run = Math.max(1, total - stageH);
        return offsets.map((o, i) => (i === 0 ? 0 : i === offsets.length - 1 ? 1 : clamp((o - stageH * 0.15) / run)));
      },
      update(p) {
        if (!stageH) resize();
        const y = p * Math.max(0, total - stageH);
        track.style.transform = `translate3d(0, ${(-y).toFixed(1)}px, 0)`;
        const mid = y + stageH * 0.35;
        let i = 0;
        offsets.forEach((o, j) => { if (mid >= o) i = j; });
        show(i);
        needle.style.top = `${(p * 100).toFixed(1)}%`;
      },
    });
  })();

  /* ---------- 3 · Složení ---------- */
  (function slozeni() {
    const clump = document.getElementById('clump');
    const info = document.getElementById('composeInfo');
    const count = document.getElementById('foundCount');
    const found = new Set();
    const pos = [[18, 30], [50, 12], [80, 28], [84, 66], [55, 84], [20, 72], [48, 48]];
    O.composition.forEach((c, i) => {
      const b = el('button', { class: 'hotspot', type: 'button', 'aria-pressed': 'false' });
      b.style.left = `${pos[i][0]}%`;
      b.style.top = `${pos[i][1]}%`;
      b.appendChild(el('span', { class: 'hotspot__icon', 'aria-hidden': 'true' }, c.icon));
      b.appendChild(el('span', { class: 'hotspot__label' }, c.name));
      b.addEventListener('click', () => {
        clump.querySelectorAll('.hotspot').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
        b.classList.add('is-found');
        found.add(c.id);
        count.textContent = String(found.size);
        info.replaceChildren(
          el('p', { class: 'compose__icon', 'aria-hidden': 'true' }, c.icon),
          el('h3', {}, c.name),
          el('p', {}, c.text),
        );
        if (found.size === O.composition.length) {
          info.appendChild(el('p', { class: 'success' }, '🎉 Hotovo! Všech 7 složek půdy je objeveno.'));
        }
      });
      clump.appendChild(b);
    });
  })();

  /* ---------- 4 · Půdní druhy: pokus ---------- */
  (function druhy() {
    const wrap = document.getElementById('jars');
    const pour = document.getElementById('pour');
    const reset = document.getElementById('pourReset');
    const q = document.getElementById('druhyQ');
    const rand = rng(3);
    const jars = O.textures.map((t) => {
      const fig = el('figure', { class: 'jar' });
      fig.style.setProperty('--speed', `${t.speed}s`);
      fig.style.setProperty('--drain', t.drain);
      const glass = el('div', { class: 'jar__glass' });
      const g = svg('svg', { viewBox: '0 0 100 120', preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' });
      g.appendChild(svg('rect', { width: 100, height: 120, fill: t.color }));
      const r = t.grain;
      for (let y = r; y < 120 + r; y += r * 1.7) {
        for (let x = (Math.round(y / r) % 2) * r; x < 100 + r; x += r * 2) {
          g.appendChild(svg('circle', { cx: x + (rand() - 0.5) * r * 0.5, cy: y, r: r * (0.75 + rand() * 0.3), fill: t.color, stroke: 'rgba(0,0,0,.18)', 'stroke-width': 0.6 }));
        }
      }
      glass.appendChild(g);
      glass.appendChild(el('div', { class: 'jar__wet' }));
      glass.appendChild(el('div', { class: 'jar__water' }));
      fig.appendChild(glass);
      fig.appendChild(el('div', { class: 'jar__drip', 'aria-hidden': 'true' }));
      const cup = el('div', { class: 'jar__cup' });
      cup.appendChild(el('div', { class: 'jar__cupfill' }));
      fig.appendChild(cup);
      const cap = el('figcaption');
      cap.appendChild(el('strong', {}, `${t.name} půda`));
      const res = el('p', { class: 'jar__result' }, 'Zatím nezalito.');
      cap.appendChild(res);
      const txt = el('p', { class: 'jar__text' }, t.text);
      txt.hidden = true;
      cap.appendChild(txt);
      fig.appendChild(cap);
      wrap.appendChild(fig);
      return { t, fig, res, txt };
    });
    const timers = [];
    pour.addEventListener('click', () => {
      pour.disabled = true;
      const fast = V.reduceMotion();
      jars.forEach(({ t, fig, res, txt }) => {
        fig.classList.remove('is-poured');
        void fig.offsetWidth;
        fig.classList.add('is-poured');
        res.textContent = 'Voda se vsakuje…';
        timers.push(setTimeout(() => {
          const kept = Math.round((1 - t.drain) * 10);
          res.textContent = t.drain > 0.7 ? 'Voda rychle protekla, v půdě zůstalo málo.' : t.drain > 0.3 ? 'Část vody protekla, část půda udržela.' : 'Voda se vsakuje pomalu, půda ji skoro celou drží.';
          res.dataset.kept = String(kept);
          txt.hidden = false;
          fig.classList.add('is-done');
        }, fast ? 0 : (t.speed + 0.4) * 1000));
      });
      timers.push(setTimeout(() => {
        reset.hidden = false;
        q.hidden = false;
      }, fast ? 0 : (Math.max(...O.textures.map((t) => t.speed)) + 0.5) * 1000));
    });
    reset.addEventListener('click', () => {
      timers.splice(0).forEach(clearTimeout);
      jars.forEach(({ fig, res, txt }) => {
        fig.classList.remove('is-poured', 'is-done');
        res.textContent = 'Zatím nezalito.';
        txt.hidden = true;
      });
      pour.disabled = false;
      reset.hidden = true;
      pour.focus();
    });
    const opts = document.getElementById('druhyOpts');
    const fb = document.getElementById('druhyFb');
    O.textures.forEach((t) => {
      const b = el('button', { class: 'btn', type: 'button' }, t.name);
      b.addEventListener('click', () => {
        opts.querySelectorAll('button').forEach((x) => x.classList.remove('is-right', 'is-wrong'));
        if (t.id === 'hlinita') {
          b.classList.add('is-right');
          fb.textContent = 'Správně! Hlinitá půda udrží vodu i živiny, a přitom není moc těžká.';
        } else {
          b.classList.add('is-wrong');
          fb.textContent = t.id === 'piscita' ? 'Ne tak docela: písčitá půda vodu nepodrží, musí se zalévat. Zkus to znovu.' : 'Ne tak docela: jílovitá půda je těžká a ulehlá, musí se kypřit. Zkus to znovu.';
        }
      });
      opts.appendChild(b);
    });
  })();

  /* ---------- 5 · Půdní typy: 3D blok ---------- */
  (function typy() {
    const tabs = document.getElementById('typeTabs');
    const info = document.getElementById('typeInfo');
    const block = document.getElementById('block');
    const scene = document.getElementById('blockScene');
    const sides = block.querySelectorAll('.face--front, .face--back, .face--left, .face--right');
    const top = block.querySelector('.face--top');
    const bottom = block.querySelector('.face--bottom');
    scene.setAttribute('data-own-keys', '');
    let angle = -32, tilt = -16, lastUser = 0, raf = 0, visible = false;

    function profileGradient(t) {
      let acc = 0;
      const stops = t.layers.map(([c, h]) => {
        const s = `${c} ${acc}% ${acc + h}%`;
        acc += h;
        return s;
      });
      return `linear-gradient(to bottom, ${stops.join(', ')})`;
    }
    const stonesBg = 'radial-gradient(circle at 20% 70%, rgba(120,118,110,.9) 0 6px, transparent 7px), radial-gradient(circle at 65% 55%, rgba(140,138,130,.9) 0 9px, transparent 10px), radial-gradient(circle at 80% 85%, rgba(110,108,100,.9) 0 7px, transparent 8px), radial-gradient(circle at 35% 90%, rgba(150,148,140,.9) 0 11px, transparent 12px)';

    function select(t, btn, focus) {
      tabs.querySelectorAll('[role=tab]').forEach((b) => {
        const on = b === btn;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      if (focus) btn.focus();
      const bg = (t.stones ? stonesBg + ', ' : '') + profileGradient(t);
      sides.forEach((f) => { f.style.background = bg; });
      top.style.background = `radial-gradient(circle at 30% 30%, rgba(255,255,255,.18), transparent 40%), repeating-linear-gradient(45deg, ${t.top} 0 6px, color-mix(in srgb, ${t.top} 80%, #000) 6px 9px)`;
      bottom.style.background = t.layers[t.layers.length - 1][0];
      scene.setAttribute('aria-label', `3D blok půdy: ${t.name}. Vrstvy shora dolů: ${t.layers.map((l) => l[2]).join(', ')}.`);
      block.classList.remove('is-pop');
      void block.offsetWidth;
      block.classList.add('is-pop');

      const legend = el('ul', { class: 'legend' });
      t.layers.forEach(([c, , label]) => {
        const li = el('li');
        const sw = el('span', { class: 'swatch' });
        sw.style.background = c;
        li.append(sw, document.createTextNode(label));
        legend.appendChild(li);
      });
      const facts = el('ul', { class: 'facts' });
      t.facts.forEach((f) => facts.appendChild(el('li', {}, f)));
      const kids = [el('h3', {}, t.name), el('p', { class: 'where' }, `📍 ${t.where}`), facts];
      if (t.grows) kids.push(el('p', {}, `Pěstuje se: ${t.grows}`));
      if (t.animals) kids.push(el('p', {}, `Chovají se: ${t.animals}`));
      kids.push(el('p', { class: 'muted small' }, 'Vrstvy v řezu (shora dolů):'), legend);
      info.replaceChildren(...kids);
      info.setAttribute('aria-labelledby', btn.id);
    }

    O.types.forEach((t, i) => {
      const b = el('button', { role: 'tab', type: 'button', id: `tab-${t.id}`, 'aria-selected': 'false', 'aria-controls': 'typeInfo', class: 'tab' });
      const sw = el('span', { class: 'tab__swatch', 'aria-hidden': 'true' });
      sw.style.background = t.layers[0][0];
      b.append(sw, document.createTextNode(t.name));
      b.addEventListener('click', () => select(t, b, false));
      tabs.appendChild(b);
      if (i === 0) select(t, b, false);
    });
    tabs.setAttribute('data-own-keys', '');
    tabs.addEventListener('keydown', (e) => {
      const list = Array.from(tabs.querySelectorAll('[role=tab]'));
      let i = list.indexOf(document.activeElement);
      if (i < 0) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = (i + 1) % list.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = (i - 1 + list.length) % list.length;
      else if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = list.length - 1;
      else return;
      e.preventDefault();
      list[i].click();
      list[i].focus();
    });

    function apply() {
      block.style.transform = `rotateX(${tilt}deg) rotateY(${angle}deg)`;
    }
    apply();
    let drag = null;
    scene.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, a: angle, t: tilt };
      scene.setPointerCapture(e.pointerId);
      scene.classList.add('is-dragging');
    });
    scene.addEventListener('pointermove', (e) => {
      if (!drag) return;
      angle = drag.a + (e.clientX - drag.x) * 0.5;
      tilt = clamp(drag.t - (e.clientY - drag.y) * 0.3, -50, 10);
      lastUser = performance.now();
      apply();
    });
    const end = () => { drag = null; scene.classList.remove('is-dragging'); lastUser = performance.now(); };
    scene.addEventListener('pointerup', end);
    scene.addEventListener('pointercancel', end);
    scene.addEventListener('keydown', (e) => {
      const map = { ArrowLeft: [-15, 0], ArrowRight: [15, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] };
      const m = map[e.key];
      if (!m) return;
      e.preventDefault();
      angle += m[0];
      tilt = clamp(tilt - m[1], -50, 10);
      lastUser = performance.now();
      apply();
    });
    // Pomalé samovolné otáčení, když se na blok nikdo nesahá
    function spin(now) {
      raf = 0;
      if (!visible || V.reduceMotion()) return;
      if (!drag && now - lastUser > 2500) {
        angle += 0.15;
        apply();
      }
      raf = requestAnimationFrame(spin);
    }
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(spin);
    }).observe(scene);
  })();

  /* ---------- 6 · Krajina ---------- */
  (function krajina() {
    const W = 2400, H = 700;
    const pts = [[0, 210], [110, 150], [210, 215], [320, 120], [440, 230], [560, 330], [690, 310], [800, 350], [900, 340],
      [960, 360], [990, 300], [1060, 290], [1130, 320], [1180, 380], [1300, 410], [1450, 425], [1600, 450], [1700, 490],
      [1900, 495], [2100, 500], [2180, 510], [2240, 525], [2330, 525], [2400, 515]];
    function surf(x) {
      for (let i = 1; i < pts.length; i++) {
        if (x <= pts[i][0]) {
          const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
          const t = (x - x0) / (x1 - x0);
          const s = t * t * (3 - 2 * t);
          return y0 + (y1 - y0) * s + Math.sin(x / 37) * 3;
        }
      }
      return pts[pts.length - 1][1];
    }
    const root = document.getElementById('landSvg');
    const CROP_Y = 20, CROP_H = 640;
    root.setAttribute('viewBox', `0 ${CROP_Y} ${W} ${CROP_H}`);
    root.setAttribute('preserveAspectRatio', 'xMinYMin meet');
    const defs = svg('defs');
    const grad = svg('linearGradient', { id: 'landSky', x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.append(svg('stop', { offset: 0, 'stop-color': '#a9d8f2' }), svg('stop', { offset: 1, 'stop-color': '#f6ecd2' }));
    defs.appendChild(grad);
    root.appendChild(defs);
    root.appendChild(svg('rect', { width: W, height: H, fill: 'url(#landSky)' }));
    root.appendChild(svg('path', { d: 'M0 260 L180 90 L330 200 L470 60 L640 230 L820 160 L1000 280 L1200 230 L1600 330 L2400 360 L2400 700 L0 700Z', fill: '#b6c6d2', opacity: 0.6 }));
    const line = (from, to, dy = 0, step = 10) => {
      const a = [];
      for (let x = from; x <= to; x += step) a.push(`${x} ${(surf(x) + dy).toFixed(1)}`);
      a.push(`${to} ${(surf(to) + dy).toFixed(1)}`);
      return a;
    };
    // podloží
    root.appendChild(svg('path', { d: `M${line(0, W).join(' L')} L${W} ${H} L0 ${H}Z`, fill: '#77746c' }));
    const zoneEls = O.zones.map((z) => {
      const t = typeById[z.soil];
      const g = svg('g', { class: 'zone', 'data-zone': z.id });
      const top = line(z.from, z.to);
      const bottom = line(z.from, z.to, 70).reverse();
      g.appendChild(svg('path', { d: `M${top.join(' L')} L${bottom.join(' L')}Z`, fill: t.layers[0][0], class: 'zone__soil' }));
      const top2 = line(z.from, z.to, 30);
      const bottom2 = line(z.from, z.to, 70).reverse();
      g.appendChild(svg('path', { d: `M${top2.join(' L')} L${bottom2.join(' L')}Z`, fill: t.layers[1][0], opacity: 0.9 }));
      g.appendChild(svg('path', { d: `M${top.join(' L')}`, stroke: t.top, 'stroke-width': 10, fill: 'none', 'stroke-linejoin': 'round' }));
      const mid = (z.from + z.to) / 2;
      g.appendChild(svg('text', { x: mid, y: Math.max(75, Math.min(...top.map((s) => Number(s.split(' ')[1]))) - 60), 'text-anchor': 'middle', class: 'zone__name' }, z.name));
      const label = svg('text', { x: mid, y: surf(mid) + 120, 'text-anchor': 'middle', class: 'zone__soilname' }, t.name);
      g.appendChild(label);
      z.icons.forEach((ic, i) => {
        const x = z.from + ((i + 0.6) / (z.icons.length + 0.2)) * (z.to - z.from);
        g.appendChild(svg('text', { x, y: surf(x) - 6, 'text-anchor': 'middle', class: 'zone__icon' }, ic));
      });
      root.appendChild(g);
      return { z, g };
    });
    // vápencové skály v krasu
    root.appendChild(svg('path', { d: 'M985 300 L1000 250 L1030 240 L1045 290 Z M1070 292 L1085 235 L1110 228 L1122 310 Z', fill: '#ece8dc', stroke: '#c9c4b5', 'stroke-width': 3 }));
    // řeka
    root.appendChild(svg('path', { d: `M2230 ${surf(2230) + 2} Q2285 ${surf(2285) + 22} 2340 ${surf(2340) + 2} Z`, fill: '#4f9bd1' }));

    const vp = document.querySelector('.land__viewport');
    const card = document.getElementById('landCard');
    let svgW = 0, vpW = 0, current = null;
    function resize() {
      // Výška krajiny = výška okna; zobrazujeme jen pás od vrcholků po podloží.
      const h = vp.clientHeight;
      vpW = vp.clientWidth;
      svgW = (h * W) / CROP_H;
      root.style.width = `${svgW}px`;
      root.style.height = `${h}px`;
    }
    function show(entry) {
      if (current === entry) return;
      current = entry;
      const t = typeById[entry.z.soil];
      zoneEls.forEach((e) => e.g.classList.toggle('is-active', e === entry));
      card.replaceChildren(
        el('p', { class: 'eyebrow' }, entry.z.name),
        el('h3', {}, t.name),
        el('p', {}, t.where),
        el('p', { class: 'muted' }, entry.z.note),
      );
    }
    V.on('krajina', {
      resize,
      update(p) {
        if (!svgW) resize();
        const x = p * Math.max(0, svgW - vpW);
        root.style.transform = `translate3d(${(-x).toFixed(1)}px,0,0)`;
        const centerX = ((x + vpW / 2) / svgW) * W;
        const entry = zoneEls.find(({ z }) => centerX >= z.from && centerX < z.to) || zoneEls[zoneEls.length - 1];
        show(entry);
      },
    });
  })();

  /* ---------- 7 · Mise ---------- */
  (function mise() {
    const pool = document.getElementById('pool');
    const zonesEl = document.getElementById('zones');
    const fb = document.getElementById('missionFb');
    const placed = new Map(); // zoneId -> soilId
    let selected = null;
    const chips = new Map();
    const order = ['rendzina', 'cernozem', 'podzol', 'fluvizem', 'kambizem', 'hnedozem'];
    order.forEach((id) => {
      const t = typeById[id];
      const b = el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false' });
      const sw = el('span', { class: 'tab__swatch', 'aria-hidden': 'true' });
      sw.style.background = t.layers[0][0];
      b.append(sw, document.createTextNode(t.name));
      b.addEventListener('click', () => {
        selected = selected === id ? null : id;
        chips.forEach((c, cid) => c.setAttribute('aria-pressed', String(cid === selected)));
        fb.textContent = selected ? `Vybráno: ${t.name}. Teď klikni na místo v krajině.` : '';
      });
      chips.set(id, b);
      pool.appendChild(b);
    });
    const zoneBtns = new Map();
    O.zones.forEach((z) => {
      const b = el('button', { class: `zone-card zone-card--${z.id}`, type: 'button' });
      b.appendChild(el('span', { class: 'zone-card__icons', 'aria-hidden': 'true' }, z.icons.slice(0, 3).join('')));
      b.appendChild(el('span', { class: 'zone-card__name' }, z.name));
      const slot = el('span', { class: 'zone-card__slot' }, '?');
      b.appendChild(slot);
      b.addEventListener('click', () => {
        b.classList.remove('is-ok', 'is-bad');
        if (selected) {
          const prev = placed.get(z.id);
          if (prev) chips.get(prev).hidden = false;
          for (const [zid, sid] of placed) if (sid === selected) { placed.delete(zid); render(zid); }
          placed.set(z.id, selected);
          chips.get(selected).hidden = true;
          chips.get(selected).setAttribute('aria-pressed', 'false');
          selected = null;
          fb.textContent = '';
        } else if (placed.has(z.id)) {
          chips.get(placed.get(z.id)).hidden = false;
          placed.delete(z.id);
        } else {
          fb.textContent = 'Nejdřív vyber kartičku s půdou.';
        }
        render(z.id);
        const first = pool.querySelector('.chip:not([hidden])');
        if (first && !pool.contains(document.activeElement)) { /* fokus necháváme na zóně */ }
      });
      zoneBtns.set(z.id, { b, slot, z });
      zonesEl.appendChild(b);
    });
    function render(zid) {
      const { b, slot, z } = zoneBtns.get(zid);
      const sid = placed.get(zid);
      slot.textContent = sid ? typeById[sid].name : '?';
      b.classList.toggle('has-soil', !!sid);
      b.setAttribute('aria-label', `${z.name}: ${sid ? typeById[sid].name : 'zatím prázdné'}`);
      if (sid) b.style.setProperty('--soil', typeById[sid].layers[0][0]);
    }
    O.zones.forEach((z) => render(z.id));

    document.getElementById('checkMission').addEventListener('click', () => {
      let ok = 0;
      zoneBtns.forEach(({ b, z }) => {
        const sid = placed.get(z.id);
        b.classList.toggle('is-ok', sid === z.soil);
        b.classList.toggle('is-bad', !!sid && sid !== z.soil);
        if (sid === z.soil) ok++;
      });
      if (ok === O.zones.length) fb.textContent = '🎉 Výborně, všech 6 půd je na správném místě!';
      else fb.textContent = `Správně máš ${ok} ze ${O.zones.length}. Červeně označená místa oprav: klikni na ně a kartička se vrátí.`;
    });
    document.getElementById('hintMission').addEventListener('click', () => {
      const z = O.zones.find((zz) => placed.get(zz.id) !== zz.soil);
      if (!z) { fb.textContent = 'Všechno sedí, nápověda už není potřeba.'; return; }
      const t = typeById[z.soil];
      fb.textContent = `Nápověda (${z.name}): hledej půdu, o které platí „${t.where}“`;
    });
  })();

  /* ---------- 8 · Eroze ---------- */
  (function eroze() {
    const rand = rng(11);
    const rain = document.getElementById('erRain');
    for (let i = 0; i < 46; i++) {
      const x = 6 + rand() * 388, y = 55 + rand() * 120;
      rain.appendChild(svg('line', { x1: x, y1: y, x2: x, y2: y + 14, style: `animation-delay:${(-rand()).toFixed(2)}s` }));
    }
    const L = document.getElementById('erLeft');
    const R = document.getElementById('erRight');
    // Mírný svah: nahoře vlevo, dole vpravo přechází v rovinu
    const PANEL = 188, TOP = 205, DROP = 55, SOIL = 26;
    const smooth = (a, b, u) => { const t = clamp((u - a) / (b - a)); return t * t * (3 - 2 * t); };
    const ground = (u) => TOP + DROP * smooth(0, 0.8, u);
    const N = 40;
    const xs = (x0) => Array.from({ length: N + 1 }, (_, i) => [x0 + 6 + (i / N) * PANEL, i / N]);
    function band(x0, topFn, bottomFn) {
      const pts = xs(x0);
      const top = pts.map(([x, u]) => `${x.toFixed(1)} ${topFn(u).toFixed(1)}`);
      const bot = pts.reverse().map(([x, u]) => `${x.toFixed(1)} ${bottomFn(u).toFixed(1)}`);
      return `M${top.join(' L')} L${bot.join(' L')}Z`;
    }
    function rock(x0) {
      return svg('path', { d: band(x0, ground, () => 410), fill: '#86847d' });
    }
    L.appendChild(rock(0));
    R.appendChild(rock(200));
    const leftSoil = svg('path', { fill: '#4a3322' });
    const deposit = svg('path', { fill: '#9a7048' });
    L.append(leftSoil, deposit);
    const furrows = svg('g', { stroke: '#2e2016', 'stroke-width': 2, 'stroke-linecap': 'round' });
    L.appendChild(furrows);
    const runoff = svg('g', { stroke: '#8a6440', 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none', class: 'runoff' });
    L.appendChild(runoff);

    R.appendChild(svg('path', { d: band(200, (u) => ground(u) - SOIL, ground), fill: '#4a3322' }));
    const roots = svg('g', { stroke: '#e8d7b0', 'stroke-width': 1.5, fill: 'none' });
    const grass = svg('g', { stroke: '#4f8f34', 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' });
    for (let i = 0; i <= 26; i++) {
      const u = i / 26, x = 206 + u * PANEL, y = ground(u) - SOIL;
      grass.appendChild(svg('path', { d: `M${x} ${y} l-4 -12 M${x} ${y} l2 -15 M${x} ${y} l7 -9` }));
      if (i % 2) roots.appendChild(svg('path', { d: `M${x} ${y + 2} q-3 9 1 ${SOIL - 6}` }));
    }
    R.append(roots, grass);
    ['🌾', '🌼', '🌾'].forEach((e, i) => {
      const u = 0.15 + i * 0.32;
      R.appendChild(svg('text', { x: 206 + u * PANEL, y: ground(u) - SOIL - 6, 'text-anchor': 'middle', 'font-size': 22 }, e));
    });

    const meterL = document.getElementById('meterLeft');
    const meterR = document.getElementById('meterRight');
    V.on('eroze', {
      update(p) {
        rain.style.opacity = String(seg(p, 0, 0.12));
        const loss = seg(p, 0.1, 0.9);
        // Na svahu voda odnáší nejvíc, na rovině dole se bláto usazuje
        const thick = (u) => SOIL * Math.max(0.12, 1 - loss * 0.9 * (1 - smooth(0.6, 0.85, u)));
        const soilTop = (u) => ground(u) - thick(u);
        leftSoil.setAttribute('d', band(0, soilTop, ground));
        const dep = (u) => loss * 12 * smooth(0.7, 0.95, u);
        deposit.setAttribute('d', band(0, (u) => soilTop(u) - dep(u), soilTop));
        furrows.replaceChildren();
        runoff.replaceChildren();
        for (let i = 1; i < 9; i++) {
          const u = i / 10, x = 6 + u * PANEL, y = soilTop(u);
          furrows.appendChild(svg('line', { x1: x - 3, y1: y + 3, x2: x + 3, y2: y + 3 }));
        }
        for (let i = 0; i < 4; i++) {
          const u0 = 0.05 + i * 0.18, u1 = u0 + 0.16;
          const x0 = 6 + u0 * PANEL, x1 = 6 + u1 * PANEL;
          runoff.appendChild(svg('path', { d: `M${x0} ${soilTop(u0) - 2} L${x1} ${soilTop(u1) - 2}`, 'stroke-dasharray': '6 8', class: 'stream' }));
        }
        runoff.style.opacity = String(seg(p, 0.1, 0.25) * (1 - seg(p, 0.92, 1)));
        meterL.style.transform = `scaleX(${(1 - loss * 0.85).toFixed(3)})`;
        meterR.style.transform = 'scaleX(1)';
      },
    });
  })();

  /* ---------- 9 · Kvíz ---------- */
  (function kviz() {
    const box = document.getElementById('quiz');
    let i = 0, score = 0;
    function render() {
      if (i >= O.quiz.length) {
        const msg = score === O.quiz.length ? '🏆 Bezchybně! Půdu máš v malíčku.' : score >= O.quiz.length - 2 ? '👏 Skvělý výsledek!' : '🌱 Dobrý začátek. Projdi si výklad ještě jednou.';
        const again = el('button', { class: 'btn btn--primary', type: 'button' }, 'Zkusit znovu');
        again.addEventListener('click', () => { i = 0; score = 0; render(); });
        box.replaceChildren(el('p', { class: 'quiz__score' }, `${score} / ${O.quiz.length}`), el('p', {}, msg), again);
        again.focus();
        return;
      }
      const item = O.quiz[i];
      const fb = el('p', { class: 'feedback' });
      const next = el('button', { class: 'btn btn--primary', type: 'button' }, i === O.quiz.length - 1 ? 'Výsledek' : 'Další otázka');
      next.hidden = true;
      next.addEventListener('click', () => { i++; render(); });
      const opts = el('div', { class: 'options options--big' });
      item.a.forEach((a, k) => {
        const b = el('button', { class: 'btn', type: 'button' }, a);
        b.addEventListener('click', () => {
          opts.querySelectorAll('button').forEach((x) => { x.disabled = true; });
          if (k === item.ok) {
            score++;
            b.classList.add('is-right');
            fb.textContent = 'Správně!';
          } else {
            b.classList.add('is-wrong');
            opts.children[item.ok].classList.add('is-right');
            fb.textContent = `Správná odpověď: ${item.a[item.ok]}.`;
          }
          next.hidden = false;
          next.focus();
        });
        opts.appendChild(b);
      });
      box.replaceChildren(
        el('p', { class: 'quiz__count' }, `Otázka ${i + 1} z ${O.quiz.length}`),
        el('p', { class: 'quiz__q' }, item.q),
        opts, fb, next,
      );
    }
    render();
  })();

  V.start();
})();
