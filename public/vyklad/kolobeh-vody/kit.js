// Pomocné funkce a znovupoužitelné komponenty výkladu. Kopíruje se do každého výkladu (žádné sdílené jádro).
// Text z dat vkládej přes textContent (el/svg to dělají), nikdy přes innerHTML.
(function () {
  'use strict';
  const SVGNS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'style') n.style.cssText = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => {
      if (c === null || c === undefined || c === false) return;
      n.append(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return n;
  }
  function svg(tag, attrs = {}, text) {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    return n;
  }
  // Deterministická náhoda: scéna vypadá při každém načtení stejně
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const fmt = (n) => n.toLocaleString('cs-CZ');

  /** Otázka s výběrem odpovědi a vysvětlením. Bez trestu: špatná odpověď jde opravit. */
  function choice(container, { question, options, correct, explain = [], success = 'Správně!' }) {
    const fb = el('p', { class: 'feedback', 'aria-live': 'polite' });
    const opts = el('div', { class: 'options' });
    options.forEach((o, i) => {
      const b = el('button', { class: 'btn', type: 'button' }, o);
      b.addEventListener('click', () => {
        opts.querySelectorAll('button').forEach((x) => x.classList.remove('is-right', 'is-wrong'));
        const ok = i === correct;
        b.classList.add(ok ? 'is-right' : 'is-wrong');
        fb.textContent = ok ? `${success} ${explain[i] || ''}`.trim() : `${explain[i] || 'Ne tak docela.'} Zkus to znovu.`;
      });
      opts.append(b);
    });
    container.replaceChildren(el('p', { class: 'question__q' }, question), opts, fb);
  }

  /** Třídění kartiček do kategorií. items: [{ text, answer, why }], categories: [{ id, label }] */
  function sort(container, { items, categories, done = 'Všechno roztříděno správně!' }) {
    const status = el('p', { class: 'feedback', 'aria-live': 'polite' });
    let solved = 0;
    const list = el('ul', { class: 'sort' });
    items.forEach((it) => {
      const why = el('p', { class: 'sort__why' });
      const btns = el('div', { class: 'sort__btns', role: 'group', 'aria-label': `Zařaď: ${it.text}` });
      const li = el('li', { class: 'sort__item' }, el('span', { class: 'sort__text' }, it.text), btns, why);
      categories.forEach((c) => {
        const b = el('button', { type: 'button', class: 'btn btn--sm' }, c.label);
        b.addEventListener('click', () => {
          if (li.classList.contains('is-right')) return;
          if (c.id === it.answer) {
            li.classList.remove('is-wrong');
            li.classList.add('is-right');
            b.classList.add('is-right');
            why.textContent = `✔ ${it.why || ''}`;
            solved++;
            status.textContent = solved === items.length ? `🎉 ${done}` : `Hotovo ${solved} z ${items.length}.`;
          } else {
            li.classList.add('is-wrong');
            why.textContent = 'Ještě jednou: zkus druhou možnost.';
          }
        });
        btns.append(b);
      });
      list.append(li);
    });
    container.replaceChildren(list, status);
  }

  /** Rozhodovačka po jedné otázce: [{ q, a: [..], ok }] */
  function quiz(container, items) {
    let i = 0, score = 0;
    function render() {
      if (i >= items.length) {
        const msg = score === items.length ? '🏆 Bezchybně!' : score >= items.length - 2 ? '👏 Skvělý výsledek!' : '🌱 Dobrý začátek. Projdi si výklad ještě jednou.';
        const again = el('button', { class: 'btn btn--primary', type: 'button' }, 'Zkusit znovu');
        again.addEventListener('click', () => { i = 0; score = 0; render(); });
        container.replaceChildren(el('p', { class: 'quiz__score' }, `${score} / ${items.length}`), el('p', {}, msg), again);
        again.focus();
        return;
      }
      const item = items[i];
      const fb = el('p', { class: 'feedback' });
      const next = el('button', { class: 'btn btn--primary', type: 'button', hidden: true }, i === items.length - 1 ? 'Výsledek' : 'Další otázka');
      next.addEventListener('click', () => { i++; render(); });
      const opts = el('div', { class: 'options options--big' });
      item.a.forEach((a, k) => {
        const b = el('button', { class: 'btn', type: 'button' }, a);
        b.addEventListener('click', () => {
          opts.querySelectorAll('button').forEach((x) => { x.disabled = true; });
          if (k === item.ok) { score++; b.classList.add('is-right'); fb.textContent = 'Správně!'; }
          else { b.classList.add('is-wrong'); opts.children[item.ok].classList.add('is-right'); fb.textContent = `Správná odpověď: ${item.a[item.ok]}.`; }
          next.hidden = false;
          next.focus();
        });
        opts.append(b);
      });
      container.replaceChildren(el('p', { class: 'quiz__count' }, `Otázka ${i + 1} z ${items.length}`), el('p', { class: 'quiz__q' }, item.q), opts, fb, next);
    }
    render();
  }

  window.Kit = { el, svg, rng, fmt, choice, sort, quiz };
})();
