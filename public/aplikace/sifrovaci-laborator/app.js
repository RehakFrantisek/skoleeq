/* Šifrovací laboratoř – UI. Průběh podle docs/GAME_DESIGN_SYSTEM.md:
   titulní obrazovka → ukázka → úrovně (s úvodem) → závěr. Úlohy a vyhodnocení jsou v logic.js
   (deterministické, testované). Každý typ úlohy má vlastní „nástroj“ s metodami get/set/lock.
   Text vkládáme jen přes textContent, žádné eval, localStorage jen pod vlastním klíčem. */
import * as L from './logic.js';

const STORE_KEY = 'vyukovy-portal:sifrovaci-laborator:v1';
const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
function svg(tag, attrs = {}, ...children) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) { if (k === 'text') n.textContent = v; else n.setAttribute(k, v); }
  for (const c of children.flat()) if (c) n.append(c);
  return n;
}

/* ================= Úložiště ================= */
function load() {
  try { const d = JSON.parse(localStorage.getItem(STORE_KEY)); return d && typeof d === 'object' ? d : {}; } catch { return {}; }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* hraje se dál */ } }
let store = load();

/* ================= Stav ================= */
const S = { variant: 'A', mode: 'cela', tasks: [], i: 0, tutorial: false, attempts: 0, hints: 0, totalHints: 0, done: false, results: [], start: 0, tick: null, tool: null, level: -1 };
const current = () => (S.tutorial ? L.tutorialTask() : S.tasks[S.i]);

function show(id) {
  for (const s of ['s-title', 's-intro', 's-play', 's-end']) $(s).hidden = s !== id;
  $('hud').hidden = id === 's-title' || id === 's-end';
  window.scrollTo({ top: 0 });
}
const fmt = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const MODE_LABEL = { cela: 'celá mise', rychly: 'rychlá mise' };

function renderBest() {
  const parts = Object.entries(store.best || {}).map(([m, b]) => `${MODE_LABEL[m]}: napoprvé ${b.firstTry} z ${b.total}, nápovědy ${b.hints}${b.ms != null ? `, čas ${fmt(b.ms)}` : ''}`);
  $('best').textContent = parts.length ? `Tvůj nejlepší výsledek – ${parts.join(' · ')}.` : 'Zatím žádný výsledek. Hodně štěstí!';
}

/* ================= Průběh ================= */
function readOptions() {
  S.mode = document.querySelector('input[name="mode"]:checked').value;
  S.variant = document.querySelector('input[name="variant"]:checked').value;
}
function start(withTutorial) {
  readOptions();
  S.tasks = L.buildGame(S.variant, S.mode);
  S.i = 0; S.results = []; S.totalHints = 0; S.level = -1; S.start = Date.now();
  $('hint-count').textContent = '0';
  clearInterval(S.tick);
  $('timer').hidden = !$('opt-timer').checked;
  if ($('opt-timer').checked) {
    $('timer').querySelector('b').textContent = '0:00';
    S.tick = setInterval(() => { $('timer').querySelector('b').textContent = fmt(Date.now() - S.start); }, 1000);
  }
  buildPhoto($('photo'), S.tasks.length);
  S.tutorial = !!withTutorial;
  if (S.tutorial) { show('s-play'); renderTask(); } else nextOrIntro();
}

function nextOrIntro() {
  const t = S.tasks[S.i];
  if (t.level !== S.level) {
    S.level = t.level;
    const info = L.LEVEL_INFO[t.level];
    const count = S.tasks.filter(x => x.level === t.level).length;
    $('intro-num').textContent = `Úroveň ${t.level + 1} z ${L.LEVEL_INFO.length}`;
    $('intro-h').textContent = info.name;
    $('intro-focus').textContent = info.focus;
    $('intro-count').textContent = `${count} ${count === 1 ? 'úloha' : count < 5 ? 'úlohy' : 'úloh'} · varianta ${S.variant}`;
    show('s-intro');
    $('intro-h').focus();
    return;
  }
  show('s-play');
  renderTask();
}

function renderTask() {
  const t = current();
  S.attempts = 0; S.hints = 0; S.done = false;
  $('task-level').textContent = S.tutorial ? 'Ukázka' : L.LEVEL_INFO[t.level].name;
  $('task-meta').textContent = S.tutorial ? 'nepočítá se do výsledku' : `Úloha ${S.i + 1} z ${S.tasks.length}`;
  $('hud-task').textContent = S.tutorial ? 'Ukázka' : `${S.i + 1}/${S.tasks.length}`;
  $('task-h').textContent = t.title;
  $('task-prompt').textContent = t.prompt;
  $('hints').replaceChildren();
  if (S.tutorial) $('hints').append(el('p', { class: 'hint hint--tour' }, el('b', { text: 'Jak to funguje: ' }), 'Pracuj s nástrojem pod zadáním, pak stiskni Zkontrolovat. Když si nevíš rady, vezmi si nápovědu – výsledek nesnižuje. Po dvou pokusech můžeš zobrazit řešení.'));
  setFeedback(null);
  $('btn-reveal').hidden = true; $('btn-next').hidden = true;
  $('btn-check').disabled = false; $('btn-hint').disabled = false;
  $('btn-hint').textContent = '🔍 Nápověda';
  $('progress').max = S.tasks.length; $('progress').value = S.tutorial ? 0 : S.i;
  $('photo-note').textContent = S.tutorial ? 'Za každou rozluštěnou zprávu se odkryje kousek fotky.' : `Odkryto ${S.results.length} z ${S.tasks.length} dílků.`;
  S.tool = TOOLS[t.type](t);
  $('tool').replaceChildren(S.tool.node);
  $('task-h').focus();
}

function hint() {
  const t = current();
  if (S.hints >= t.hints.length) return;
  $('hints').append(el('p', { class: 'hint' }, el('b', { text: `Nápověda ${S.hints + 1}: ` }), t.hints[S.hints]));
  S.hints++;
  if (!S.tutorial) { S.totalHints++; $('hint-count').textContent = String(S.totalHints); }
  if (S.hints >= t.hints.length) { $('btn-hint').disabled = true; $('btn-hint').textContent = 'Všechny nápovědy použity'; }
}

function setFeedback(kind, text) {
  const fb = $('feedback');
  if (!kind) { fb.className = 'feedback'; fb.replaceChildren(); return; }
  fb.className = `feedback is-${kind}`;
  const icon = { good: '✓', bad: '!', solution: 'i' }[kind];
  const head = { good: 'Správně. ', bad: 'Ještě ne. ', solution: 'Řešení: ' }[kind];
  fb.replaceChildren(el('b', { text: `${icon} ${head}` }), text);
}

function check() {
  if (S.done) return;
  const t = current();
  const r = L.check(t, S.tool.get());
  S.attempts++;
  setFeedback(r.ok ? 'good' : 'bad', r.msg);
  if (r.ok) finish(true);
  else {
    S.tool.node.classList.remove('is-shake');
    if (!reducedMotion()) { void S.tool.node.offsetWidth; S.tool.node.classList.add('is-shake'); }
    if (S.attempts >= 2) $('btn-reveal').hidden = false;
  }
}

function reveal() {
  if (S.done) return;
  const t = current();
  S.tool.set(L.solution(t));
  setFeedback('solution', L.check(t, L.solution(t)).msg);
  finish(false, true);
}

function finish(solved, revealed = false) {
  S.done = true;
  S.tool.lock();
  $('btn-check').disabled = true; $('btn-hint').disabled = true; $('btn-reveal').hidden = true;
  if (!S.tutorial) {
    const t = current();
    S.results.push({ id: t.id, skill: t.skill, solved, revealed, firstTry: solved && S.attempts === 1, hints: S.hints });
    revealTile($('photo'), S.i, revealed);
    $('photo-note').textContent = `Odkryto ${S.results.length} z ${S.tasks.length} dílků.`;
    $('progress').value = S.i + 1;
  }
  $('btn-next').textContent = S.tutorial ? 'Spustit misi →' : S.i + 1 >= S.tasks.length ? 'Dokončit přenos →' : 'Další úkol →';
  $('btn-next').hidden = false;
  $('btn-next').focus();
}

function next() {
  if (S.tutorial) { S.tutorial = false; S.i = 0; return nextOrIntro(); }
  if (++S.i >= S.tasks.length) return end();
  nextOrIntro();
}

function end() {
  clearInterval(S.tick);
  const total = S.results.length;
  const firstTry = S.results.filter(r => r.firstTry).length;
  const solved = S.results.filter(r => r.solved).length;
  const hints = S.results.reduce((s, r) => s + r.hints, 0);
  const ms = $('opt-timer').checked ? Date.now() - S.start : null;
  const rec = { firstTry, total, hints, ms, variant: S.variant };
  store.best = store.best || {};
  const isNew = L.isBetter(rec, store.best[S.mode]);
  if (isNew) { store.best[S.mode] = rec; save(); }
  $('result').textContent = `Rozluštil(a) jsi ${solved} z ${total} zpráv, ${firstTry} napoprvé.` + (isNew && firstTry > 0 ? ' To je tvůj nový osobní rekord!' : '');
  const dl = $('stats');
  dl.replaceChildren();
  const stat = (k, v) => dl.append(el('div', {}, el('dt', { text: k }), el('dd', { text: v })));
  stat('Napoprvé', `${firstTry} z ${total}`);
  stat('Nápovědy', String(hints));
  stat('Varianta', `${S.variant} · ${MODE_LABEL[S.mode]}`);
  if (ms != null) stat('Čas', fmt(ms));
  const ul = $('skills');
  ul.replaceChildren();
  for (const [k, text] of Object.entries(L.SKILLS)) {
    const rs = S.results.filter(r => r.skill === k);
    if (!rs.length) continue;
    const good = rs.every(r => r.solved);
    ul.append(el('li', { class: good ? 'ok' : 'again' }, el('span', { 'aria-hidden': 'true', text: good ? '✓ ' : '↻ ' }), text, good ? '' : ' – procvič ještě'));
  }
  buildPhoto($('photo-end'), 1);
  revealTile($('photo-end'), 0);
  show('s-end');
  $('end-h').focus();
  renderBest();
}

/* ================= Fotka ze sondy ================= */
let sceneId = 0;
function scene() {
  const id = ++sceneId; // každá kopie fotky má vlastní id přechodů (skrytá kopie by je jinak „vypnula“)
  return svg('svg', { viewBox: '0 0 300 180', class: 'scene', 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid slice' },
    svg('defs', {},
      svg('linearGradient', { id: `sky${id}`, x1: 0, y1: 0, x2: 0, y2: 1 }, svg('stop', { offset: 0, 'stop-color': '#1b0f4a' }), svg('stop', { offset: 1, 'stop-color': '#c4527a' })),
      svg('linearGradient', { id: `ground${id}`, x1: 0, y1: 0, x2: 0, y2: 1 }, svg('stop', { offset: 0, 'stop-color': '#e07a3f' }), svg('stop', { offset: 1, 'stop-color': '#7a2e2a' }))),
    svg('rect', { width: 300, height: 180, fill: `url(#sky${id})` }),
    ...[[30, 20], [80, 40], [140, 15], [210, 30], [260, 12], [110, 60], [240, 62], [20, 70]].map(([x, y]) => svg('circle', { cx: x, cy: y, r: 1.2, fill: '#fff', opacity: '.8' })),
    svg('circle', { cx: 230, cy: 50, r: 24, fill: '#ffd36b' }), svg('circle', { cx: 222, cy: 44, r: 5, fill: '#e8b54a' }), svg('circle', { cx: 238, cy: 58, r: 3.5, fill: '#e8b54a' }),
    svg('circle', { cx: 70, cy: 45, r: 9, fill: '#9de6da' }),
    svg('path', { d: 'M0 120 L40 95 L75 110 L120 80 L160 105 L200 90 L240 108 L300 92 V180 H0Z', fill: '#5b2e6e' }),
    svg('path', { d: 'M0 138 Q60 120 120 134 T240 128 T300 132 V180 H0Z', fill: `url(#ground${id})` }),
    svg('ellipse', { cx: 205, cy: 156, rx: 40, ry: 9, fill: '#6a2622' }), svg('ellipse', { cx: 205, cy: 154, rx: 32, ry: 6, fill: '#3e1414' }),
    svg('g', { transform: 'translate(70 118)' },
      svg('path', { d: 'M0 22 L8 0 H32 L40 22Z', fill: '#d6dce8' }), svg('rect', { x: 12, y: 4, width: 16, height: 8, rx: 2, fill: '#2b3b6b' }),
      svg('path', { d: 'M20 0 V-16 M12 -22 Q20 -30 28 -22', stroke: '#d6dce8', 'stroke-width': 2.5, fill: 'none' }),
      svg('path', { d: 'M4 22 L-6 32 M36 22 L46 32', stroke: '#d6dce8', 'stroke-width': 3 })),
    svg('g', { transform: 'translate(140 132)' },
      svg('rect', { x: 0, y: 0, width: 20, height: 16, rx: 5, fill: '#ff8a3d', stroke: '#fff', 'stroke-width': 1.5 }),
      svg('rect', { x: 4, y: 4, width: 12, height: 6, rx: 2, fill: '#231247' }), svg('circle', { cx: 8, cy: 7, r: 1.4, fill: '#5ee6d0' }), svg('circle', { cx: 12, cy: 7, r: 1.4, fill: '#5ee6d0' }),
      svg('rect', { x: 2, y: 16, width: 16, height: 4, rx: 2, fill: '#3a2378' })),
    svg('path', { d: 'M150 132 Q175 110 190 150', stroke: '#ffd36b', 'stroke-width': 1.5, 'stroke-dasharray': '3 4', fill: 'none' }));
}

function buildPhoto(box, n) {
  const cols = n <= 1 ? 1 : n <= 6 ? 3 : 6;
  const rows = Math.ceil(n / cols);
  const tiles = el('div', { class: 'tiles', 'aria-hidden': 'true' });
  tiles.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  tiles.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  for (let i = 0; i < cols * rows; i++) tiles.append(el('span', { class: 'tile', 'data-i': String(i) }, el('span', { text: i < n ? '?' : '' })));
  box.replaceChildren(scene(), tiles);
  box.setAttribute('aria-label', `Fotka ze sondy: odkryto 0 z ${n} dílků.`);
}
function revealTile(box, i, dim = false) {
  const tiles = box.querySelectorAll('.tile');
  const total = box.querySelectorAll('.tile span:not(:empty)').length || 1;
  tiles[i]?.classList.add('is-open');
  if (dim) tiles[i]?.classList.add('is-dim');
  // poslední dílek odkryje i případné výplňové dílky mřížky
  const open = box.querySelectorAll('.tile.is-open').length;
  if (open >= total) tiles.forEach(t => t.classList.add('is-open'));
  box.setAttribute('aria-label', open >= total ? 'Fotka ze sondy: krajina cizí planety se dvěma měsíci, sonda a robot u kráteru.' : `Fotka ze sondy: odkryto ${open} z ${total} dílků.`);
}

/* ================= Nástroje úloh ================= */
/** Mřížka tlačítek s roving tabindex (Tab vstoupí do mřížky jednou, šipky se pohybují). */
function gridOf(rows, cols, make, label) {
  const g = el('div', { class: 'grid', role: 'group', 'aria-label': label });
  g.style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;
  const cells = [];
  let active = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const b = make(x, y);
    b.tabIndex = cells.length === 0 ? 0 : -1;
    const idx = cells.length;
    b.addEventListener('focus', () => { cells[active].tabIndex = -1; active = idx; b.tabIndex = 0; });
    b.addEventListener('keydown', e => {
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols, Home: -(idx % cols), End: cols - 1 - (idx % cols) }[e.key];
      if (d == null) return;
      e.preventDefault();
      const j = idx + d;
      if (j >= 0 && j < cells.length) cells[j].focus();
    });
    cells.push(b);
    g.append(b);
  }
  return { node: g, cells };
}

function textInput(id, label, opts = {}) {
  const inp = el('input', { id, type: 'text', class: 'answer', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', inputmode: opts.numeric ? 'numeric' : null, placeholder: opts.placeholder || null });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  return { input: inp, node: el('label', { class: 'answer-field', for: id }, el('span', { text: label }), inp) };
}

function lampsView(on, interactive, onChange) {
  const box = el('div', { class: 'lamps' });
  const buttons = L.LAMPS.map((v, i) => {
    const b = el(interactive ? 'button' : 'span', { class: 'lamp' + (on[i] ? ' is-on' : ''), type: interactive ? 'button' : null, 'aria-pressed': interactive ? String(!!on[i]) : null, 'aria-label': interactive ? `Světlo s hodnotou ${v}` : null },
      el('span', { class: 'lamp__bulb', 'aria-hidden': 'true' }), el('b', { class: 'lamp__value', text: String(v) }), el('span', { class: 'lamp__bit', 'aria-hidden': 'true', text: on[i] ? '1' : '0' }));
    if (interactive) b.addEventListener('click', () => { on[i] = !on[i]; b.classList.toggle('is-on', on[i]); b.setAttribute('aria-pressed', String(on[i])); b.querySelector('.lamp__bit').textContent = on[i] ? '1' : '0'; onChange?.(); });
    box.append(b);
    return b;
  });
  return { node: box, buttons };
}

function choiceList(options, name) {
  const fs = el('fieldset', { class: 'choices' }, el('legend', { class: 'sr-only', text: 'Možnosti' }));
  const inputs = options.map((text, i) => {
    const inp = el('input', { type: 'radio', name, value: String(i) });
    fs.append(el('label', { class: 'choice' }, inp, el('span', { text })));
    return inp;
  });
  return { node: fs, inputs };
}

function letterTable() {
  return el('details', { class: 'ref', open: true }, el('summary', { text: 'Tabulka: pořadí písmen (A = 1 … Z = 26)' }),
    el('div', { class: 'ref__grid' }, [...L.ALPHABET].map((ch, i) => el('span', { class: 'ref__cell' }, el('b', { text: ch }), el('small', { text: String(i + 1) })))));
}
function asciiTable() {
  return el('details', { class: 'ref', open: true }, el('summary', { text: 'Znaková sada laboratoře (výřez ASCII)' }),
    el('div', { class: 'ref__grid' }, el('span', { class: 'ref__cell' }, el('b', { text: '␣' }), el('small', { text: '32 = mezera' })),
      [...L.ALPHABET].map(ch => el('span', { class: 'ref__cell' }, el('b', { text: ch }), el('small', { text: String(L.charCode(ch)) })))));
}
function morseTable() {
  return el('details', { class: 'ref', open: true }, el('summary', { text: 'Morseova abeceda (· krátce, – dlouze)' }),
    el('div', { class: 'ref__grid ref__grid--morse' }, Object.entries(L.MORSE).map(([ch, code]) => el('span', { class: 'ref__cell' }, el('b', { text: ch }), el('small', { class: 'mono', text: code.replace(/\./g, '·').replace(/-/g, '–') })))));
}

/** Šifrovací kolo: vnější kruh = zašifrovaná písmena (pevný), vnitřní = původní text (otáčí se o klíč). */
function wheel(t, { preview }) {
  let shift = 0;
  const R1 = 92, R2 = 66;
  const inner = svg('g', { class: 'wheel__inner' });
  const outer = svg('g', { class: 'wheel__outer' });
  [...L.ALPHABET].forEach((ch, i) => {
    const a = (i / 26) * 2 * Math.PI - Math.PI / 2;
    outer.append(svg('text', { x: Math.cos(a) * R1, y: Math.sin(a) * R1 + 5, 'text-anchor': 'middle', text: ch }));
    inner.append(svg('text', { x: Math.cos(a) * R2, y: Math.sin(a) * R2 + 5, 'text-anchor': 'middle', text: ch, transform: `rotate(${(i / 26) * 360} ${Math.cos(a) * R2} ${Math.sin(a) * R2})` }));
  });
  const pic = svg('svg', { viewBox: '-110 -110 220 220', class: 'wheel', 'aria-hidden': 'true' },
    svg('circle', { r: 104, class: 'wheel__ring-out' }), svg('circle', { r: 80, class: 'wheel__ring-in' }), svg('circle', { r: 50, class: 'wheel__hub' }),
    outer, inner, svg('rect', { x: -12, y: -110, width: 24, height: 56, rx: 10, class: 'wheel__mark' }));
  const num = el('output', { class: 'wheel__num', 'aria-live': 'polite' });
  const strip = el('div', { class: 'strip', tabindex: '0', role: 'region', 'aria-label': 'Převodní tabulka šifra → text' });
  const pv = el('p', { class: 'wheel__preview', 'aria-live': 'polite' });
  const update = () => {
    inner.style.transform = `rotate(${(shift / 26) * 360}deg)`;
    num.textContent = `Posun ${shift}`;
    strip.replaceChildren(el('div', { class: 'strip__row' }, el('b', { text: 'Šifra' }), [...L.ALPHABET].map(ch => el('span', { text: ch }))),
      el('div', { class: 'strip__row' }, el('b', { text: 'Text' }), [...L.ALPHABET].map(ch => el('span', { text: L.caesar(ch, -shift) }))));
    if (preview) pv.replaceChildren(el('span', { class: 'muted', text: 'Náhled rozluštění: ' }), el('b', { class: 'mono', text: L.caesar(t.cipher, -shift) }));
  };
  const btnL = el('button', { type: 'button', class: 'btn btn--ghost btn--round', 'aria-label': 'Posun o 1 méně', onclick: () => { shift = (shift + 25) % 26; update(); } }, '↺');
  const btnR = el('button', { type: 'button', class: 'btn btn--ghost btn--round', 'aria-label': 'Posun o 1 více', onclick: () => { shift = (shift + 1) % 26; update(); } }, '↻');
  const controls = el('div', { class: 'wheel__controls' }, btnL, num, btnR);
  update();
  return {
    node: el('div', { class: 'wheel-box' }, el('div', { class: 'wheel-wrap' }, pic, controls), el('div', { class: 'wheel-side' }, el('p', { class: 'cipher' }, el('span', { class: 'muted', text: 'Šifra: ' }), el('b', { class: 'mono', text: t.cipher })), pv, strip)),
    get shift() { return shift; },
    set shift(v) { shift = ((v % 26) + 26) % 26; update(); },
    buttons: [btnL, btnR]
  };
}

const TOOLS = {
  lamps(t) {
    const on = [false, false, false, false, false];
    const sum = el('p', { class: 'lamps__sum', 'aria-live': 'polite' });
    const upd = () => { sum.textContent = `Vysíláš: ${on.map(x => (x ? 1 : 0)).join('')} = ${L.lampsValue(on)}`; };
    let view = lampsView(on, true, upd);
    upd();
    const node = el('div', { class: 'tool-lamps' }, view.node, sum);
    return {
      node, get: () => ({ lamps: [...on] }),
      set: a => { a.lamps.forEach((v, i) => { on[i] = v; }); const nv = lampsView(on, true, upd); view.node.replaceWith(nv.node); view = nv; upd(); },
      lock: () => node.querySelectorAll('button').forEach(b => { b.disabled = true; })
    };
  },
  read(t) {
    const view = lampsView([...t.bits].map(b => b === '1'), false);
    const f = textInput('ans', 'Desítkové číslo', { numeric: true, placeholder: 'např. 13' });
    return { node: el('div', {}, view.node, f.node), get: () => ({ value: f.input.value }), set: a => { f.input.value = a.value; }, lock: () => { f.input.readOnly = true; } };
  },
  number(t) {
    const f = textInput('ans', 'Odpověď (číslo)', { numeric: true });
    return { node: el('div', {}, f.node), get: () => ({ value: f.input.value }), set: a => { f.input.value = a.value; }, lock: () => { f.input.readOnly = true; } };
  },
  text(t) {
    const parts = [];
    if (t.tool === 'letters') parts.push(el('p', { class: 'chips' }, t.groups.map(g => el('span', { class: 'code-chip mono', text: g }))), letterTable());
    if (t.tool === 'ascii') parts.push(el('p', { class: 'chips' }, t.codes.map(c => el('span', { class: 'code-chip mono', text: String(c) }))), asciiTable());
    if (t.tool === 'morse') parts.push(el('p', { class: 'chips' }, t.morse.split(' ').map(c => el('span', { class: 'code-chip mono', text: c.replace(/\./g, '·').replace(/-/g, '–') }))), morseTable());
    let w = null;
    if (t.tool === 'wheel') { w = wheel(t, { preview: false }); parts.push(w.node); }
    const f = textInput('ans', 'Rozluštěná zpráva', { placeholder: 'sem napiš zprávu' });
    parts.push(f.node);
    return {
      node: el('div', { class: 'tool-stack' }, parts), get: () => ({ value: f.input.value }), set: a => { f.input.value = a.value; if (w) w.shift = t.key; },
      lock: () => { f.input.readOnly = true; }
    };
  },
  codes(t) {
    const f = textInput('ans', `Čísla pro ${t.word}`, { numeric: true, placeholder: 'např. 65 66 67' });
    return { node: el('div', { class: 'tool-stack' }, el('p', { class: 'chips' }, [...t.word].map(ch => el('span', { class: 'code-chip code-chip--big', text: ch }))), asciiTable(), f.node), get: () => ({ value: f.input.value }), set: a => { f.input.value = a.value; }, lock: () => { f.input.readOnly = true; } };
  },
  crack(t) {
    const w = wheel(t, { preview: true });
    return { node: el('div', { class: 'tool-stack' }, w.node, el('p', { class: 'small muted', text: 'Zkontrolovat odešle klíč, na který je kolo právě nastavené.' })), get: () => ({ shift: w.shift }), set: a => { w.shift = a.shift; }, lock: () => w.buttons.forEach(b => { b.disabled = true; }) };
  },
  choice(t) {
    const parts = [];
    const c = choiceList(t.options, `opt-${t.id}`);
    parts.push(c.node);
    if (t.messages) { const tb = letterTable(); tb.open = false; parts.push(tb); }
    return {
      node: el('div', {}, parts), get: () => { const i = c.inputs.findIndex(x => x.checked); return { option: i < 0 ? null : i }; },
      set: a => { c.inputs[a.option].checked = true; }, lock: () => { c.node.disabled = true; }
    };
  },
  paint(t) {
    const grid = Array.from({ length: t.size }, () => Array(t.size).fill(0));
    const g = gridOf(t.size, t.size, (x, y) => {
      const b = el('button', { type: 'button', class: 'px', 'aria-pressed': 'false', 'aria-label': `Řádek ${y + 1}, sloupec ${x + 1}` });
      b.addEventListener('click', () => { grid[y][x] ^= 1; paintCell(b, grid[y][x]); });
      return b;
    }, 'Mřížka 8 × 8 k vybarvení');
    const paintCell = (b, v) => { b.classList.toggle('is-on', !!v); b.setAttribute('aria-pressed', String(!!v)); };
    const codes = el('ol', { class: 'row-codes', 'aria-label': 'Čísla řádků' }, t.codes.map(c => el('li', { class: 'mono', text: c.join(' ') })));
    const clear = el('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => { grid.forEach((r, y) => r.forEach((_, x) => { grid[y][x] = 0; paintCell(g.cells[y * t.size + x], 0); })); } }, 'Vymazat mřížku');
    return {
      node: el('div', { class: 'tool-stack' }, el('div', { class: 'paint' }, codes, g.node), el('div', { class: 'row row--tight' }, clear)),
      get: () => ({ grid: grid.map(r => [...r]) }),
      set: a => a.grid.forEach((r, y) => r.forEach((v, x) => { grid[y][x] = v; paintCell(g.cells[y * t.size + x], v); })),
      lock: () => { g.cells.forEach(c => { c.disabled = true; }); clear.disabled = true; }
    };
  },
  encode(t) {
    const pic = el('div', { class: 'grid grid--static', 'aria-hidden': 'true' });
    pic.style.gridTemplateColumns = 'repeat(8, var(--cell))';
    t.grid.forEach((r, y) => r.forEach(v => pic.append(el('span', { class: 'px' + (v ? ' is-on' : '') + (t.rows.includes(y) ? ' is-marked' : '') }))));
    const nums = el('ol', { class: 'row-codes row-codes--marks', 'aria-hidden': 'true' }, t.grid.map((_, y) => el('li', { class: t.rows.includes(y) ? 'is-marked' : '', text: t.rows.includes(y) ? `→ ${y + 1}` : String(y + 1) })));
    const desc = el('p', { class: 'sr-only', text: `Obrázek ${t.picName}. ` + t.rows.map(y => `Řádek ${y + 1}: ${t.grid[y].map(v => (v ? 'černá' : 'bílá')).join(', ')}.`).join(' ') });
    const fields = t.rows.map((y, i) => textInput(`ans-${i}`, `Řádek ${y + 1}`, { numeric: true, placeholder: 'např. 3 2 3' }));
    return {
      node: el('div', { class: 'tool-stack' }, el('div', { class: 'paint' }, nums, pic), desc, el('div', { class: 'fields' }, fields.map(f => f.node))),
      get: () => ({ values: fields.map(f => f.input.value) }), set: a => fields.forEach((f, i) => { f.input.value = a.values[i]; }),
      lock: () => fields.forEach(f => { f.input.readOnly = true; })
    };
  },
  rgb(t) {
    const val = [0, 0, 0];
    const names = ['Červená', 'Zelená', 'Modrá'];
    const mine = el('span', { class: 'swatch' });
    const code = el('p', { class: 'mono rgb-code', 'aria-live': 'polite' });
    const upd = () => { mine.style.background = `rgb(${val.join(',')})`; code.textContent = `(${val.join(', ')}) = ${L.hex(val)}`; };
    const groups = names.map((n, ch) => {
      const fs = el('fieldset', { class: `seg seg--rgb seg--ch${ch}` }, el('legend', { text: n }));
      const inputs = L.LEVELS.map(lv => {
        const inp = el('input', { type: 'radio', name: `ch${ch}`, value: String(lv), checked: lv === 0 ? true : null });
        inp.addEventListener('change', () => { val[ch] = lv; upd(); });
        fs.append(el('label', {}, inp, el('span', { text: String(lv) })));
        return inp;
      });
      return { fs, inputs };
    });
    upd();
    const target = el('span', { class: 'swatch' });
    target.style.background = `rgb(${t.answer.join(',')})`;
    return {
      node: el('div', { class: 'tool-rgb' },
        el('div', { class: 'swatches' }, el('figure', {}, target, el('figcaption', { text: `Vzorek: ${t.colorName}` })), el('figure', {}, mine, el('figcaption', { text: 'Tvoje barva' }))),
        el('div', { class: 'rgb-groups' }, groups.map(g => g.fs)), code),
      get: () => ({ rgb: [...val] }),
      set: a => { a.rgb.forEach((v, ch) => { val[ch] = v; groups[ch].inputs.forEach(i => { i.checked = Number(i.value) === v; }); }); upd(); },
      lock: () => groups.forEach(g => { g.fs.disabled = true; })
    };
  },
  vector(t) {
    const v = { cx: 2, cy: 2, r: 1, x: 0, y: 0, w: 2, h: 1 };
    const S10 = 24;
    const lines = [];
    for (let i = 0; i <= 10; i++) lines.push(svg('path', { d: `M${i * S10} 0V${10 * S10}M0 ${i * S10}H${10 * S10}`, class: 'vgrid' }));
    const nums = [];
    for (let i = 0; i <= 10; i += 2) nums.push(svg('text', { x: i * S10, y: -6, 'text-anchor': 'middle', class: 'vaxis', text: String(i) }), svg('text', { x: -8, y: i * S10 + 4, 'text-anchor': 'end', class: 'vaxis', text: String(i) }));
    const a = t.answer;
    const tc = svg('circle', { cx: a.cx * S10, cy: a.cy * S10, r: a.r * S10, class: 'vtarget' });
    const tr = svg('rect', { x: a.x * S10, y: a.y * S10, width: a.w * S10, height: a.h * S10, class: 'vtarget' });
    const mc = svg('circle', { class: 'vmine vmine--c' });
    const mr = svg('rect', { class: 'vmine vmine--r' });
    const pic = svg('svg', { viewBox: `-26 -20 ${10 * S10 + 34} ${10 * S10 + 28}`, class: 'vector', 'aria-hidden': 'true' }, lines, nums, tc, tr, mr, mc);
    const upd = () => {
      mc.setAttribute('cx', v.cx * S10); mc.setAttribute('cy', v.cy * S10); mc.setAttribute('r', Math.max(0, v.r) * S10);
      mr.setAttribute('x', v.x * S10); mr.setAttribute('y', v.y * S10); mr.setAttribute('width', Math.max(0, v.w) * S10); mr.setAttribute('height', Math.max(0, v.h) * S10);
    };
    const inputs = {};
    const field = (k, label, min, max) => {
      const inp = el('input', { type: 'number', id: `v-${k}`, min: String(min), max: String(max), step: '1', value: String(v[k]), inputmode: 'numeric' });
      inp.addEventListener('input', () => { const n = parseInt(inp.value, 10); if (!Number.isNaN(n)) { v[k] = Math.max(min, Math.min(max, n)); upd(); } });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
      inputs[k] = inp;
      return el('label', { class: 'vfield', for: `v-${k}` }, el('span', { text: label }), inp);
    };
    upd();
    return {
      node: el('div', { class: 'tool-vector' }, pic, el('div', { class: 'vforms' },
        el('fieldset', { class: 'vset' }, el('legend', {}, el('span', { class: 'dot dot--c', 'aria-hidden': 'true' }), ' Planeta = kruh'), field('cx', 'střed x', 0, 10), field('cy', 'střed y', 0, 10), field('r', 'poloměr', 1, 5)),
        el('fieldset', { class: 'vset' }, el('legend', {}, el('span', { class: 'dot dot--r', 'aria-hidden': 'true' }), ' Plocha = obdélník'), field('x', 'roh x', 0, 10), field('y', 'roh y', 0, 10), field('w', 'šířka', 1, 10), field('h', 'výška', 1, 10)),
        el('p', { class: 'small muted', text: 'Souřadnice čti z mřížky: x roste doprava, y dolů, políčko má velikost 1.' }))),
      get: () => ({ shape: { ...v } }),
      set: s => { Object.assign(v, s.shape); for (const [k, inp] of Object.entries(inputs)) inp.value = String(v[k]); upd(); },
      lock: () => Object.values(inputs).forEach(i => { i.readOnly = true; })
    };
  },
  'parity-find'(t) {
    let sel = null;
    const n = t.grid.length;
    const g = gridOf(n, n, (x, y) => {
      const b = el('button', { type: 'button', class: 'px' + (t.grid[y][x] ? ' is-on' : '') + (x === n - 1 || y === n - 1 ? ' is-parity' : ''), 'aria-pressed': 'false', 'aria-label': `Řádek ${y + 1}, sloupec ${x + 1}: ${t.grid[y][x] ? 'černé' : 'bílé'}${x === n - 1 || y === n - 1 ? ', kontrolní' : ''}` });
      b.addEventListener('click', () => pick(x, y));
      return b;
    }, 'Přijatá mřížka s kontrolními bity');
    const pick = (x, y) => {
      sel = { x, y };
      g.cells.forEach((c, i) => { const on = i === y * n + x; c.classList.toggle('is-picked', on); c.setAttribute('aria-pressed', String(on)); });
    };
    return { node: el('div', { class: 'tool-stack' }, g.node, el('p', { class: 'small muted', text: 'Poslední řádek a sloupec (s tečkovaným okrajem) jsou kontrolní.' })), get: () => ({ cell: sel }), set: a => pick(a.cell.x, a.cell.y), lock: () => g.cells.forEach(c => { c.disabled = true; }) };
  },
  'parity-add'(t) {
    const n = t.data.length + 1;
    const grid = Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => (y < n - 1 && x < n - 1 ? t.data[y][x] : 0)));
    const isPar = (x, y) => x === n - 1 || y === n - 1;
    const g = gridOf(n, n, (x, y) => {
      const par = isPar(x, y);
      const b = el('button', { type: 'button', class: 'px' + (grid[y][x] ? ' is-on' : '') + (par ? ' is-parity' : ' is-fixed'), 'aria-pressed': par ? 'false' : null, 'aria-disabled': par ? null : 'true', 'aria-label': par ? `Kontrolní políčko, řádek ${y + 1}, sloupec ${x + 1}` : `Data, řádek ${y + 1}, sloupec ${x + 1}: ${grid[y][x] ? 'černé' : 'bílé'}` });
      if (par) b.addEventListener('click', () => { grid[y][x] ^= 1; paint(b, grid[y][x]); });
      return b;
    }, 'Data s kontrolními políčky');
    const paint = (b, v) => { b.classList.toggle('is-on', !!v); b.setAttribute('aria-pressed', String(!!v)); };
    return {
      node: el('div', { class: 'tool-stack' }, g.node, el('p', { class: 'small muted', text: 'Klikej jen na kontrolní políčka (tečkovaný okraj). Data se nemění.' })),
      get: () => ({ grid: grid.map(r => [...r]) }),
      set: a => a.grid.forEach((r, y) => r.forEach((v, x) => { if (isPar(x, y)) { grid[y][x] = v; paint(g.cells[y * n + x], v); } })),
      lock: () => g.cells.forEach(c => { c.disabled = true; })
    };
  }
};

/* ================= Události ================= */
$('btn-start').addEventListener('click', () => start(true));
$('btn-skip').addEventListener('click', () => start(false));
$('btn-intro').addEventListener('click', () => { show('s-play'); renderTask(); });
$('btn-hint').addEventListener('click', hint);
$('btn-check').addEventListener('click', check);
$('btn-reveal').addEventListener('click', reveal);
$('btn-next').addEventListener('click', next);
$('btn-again').addEventListener('click', () => {
  const order = ['A', 'B', 'C'];
  const nextV = order[(order.indexOf(S.variant) + 1) % 3];
  document.querySelector(`input[name="variant"][value="${nextV}"]`).checked = true;
  start(false);
});
$('btn-home').addEventListener('click', () => { show('s-title'); renderBest(); $('title-h').focus(); });

function askReset() {
  $('reset-box').replaceChildren(
    el('p', { class: 'warn', text: 'Opravdu smazat výsledky Šifrovací laboratoře v tomto prohlížeči? Ostatní hry zůstanou beze změny.' }),
    el('button', { class: 'btn btn--warn btn--small', type: 'button', id: 'btn-reset-yes', onclick: () => {
      store = {};
      try { localStorage.removeItem(STORE_KEY); } catch { /* nic */ }
      restoreReset(); renderBest(); $('btn-reset').focus();
    } }, 'Ano, smazat'),
    el('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => { restoreReset(); $('btn-reset').focus(); } }, 'Ne'));
  $('btn-reset-yes').focus();
}
function restoreReset() {
  $('reset-box').replaceChildren(el('button', { class: 'btn btn--ghost btn--small', id: 'btn-reset', type: 'button', onclick: askReset }, 'Smazat moje výsledky'));
}
$('btn-reset').addEventListener('click', askReset);

/* Parametry URL: ?varianta=B&rezim=rychly (pro učitele – stejné zadání pro celou třídu) */
const params = new URLSearchParams(location.search);
const pv = (params.get('varianta') || '').toUpperCase();
if (L.VARIANTS[pv]) document.querySelector(`input[name="variant"][value="${pv}"]`).checked = true;
if (params.get('rezim') === 'rychly') document.querySelector('input[name="mode"][value="rychly"]').checked = true;
renderBest();
