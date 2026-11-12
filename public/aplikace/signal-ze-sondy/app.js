/* Signál ze sondy – UI. Průběh podle docs/GAME_DESIGN_SYSTEM.md:
   titulní obrazovka → ukázka → úrovně (s úvodem) → závěr. Úlohy a vyhodnocení jsou v logic.js
   (deterministické, testované). Každý typ úlohy má vlastní „nástroj“ s metodami get/set/lock.
   Text vkládáme jen přes textContent, žádné eval, localStorage jen pod vlastním klíčem. */
import * as L from './logic.js';

const STORE_KEY = 'vyukovy-portal:signal-ze-sondy:v1';
const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = rgb => `rgb(${rgb.join(',')})`;
const colorOf = i => css(L.PALETTE[i].rgb);

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
const prenosy = n => (n === 1 ? 'přenos' : n >= 2 && n <= 4 ? 'přenosy' : 'přenosů');

function renderBest() {
  const parts = Object.entries(store.best || {}).filter(([m]) => MODE_LABEL[m]).map(([m, b]) => `${MODE_LABEL[m]}: napoprvé ${b.firstTry} z ${b.total}, nápovědy ${b.hints}${b.ms != null ? `, čas ${fmt(b.ms)}` : ''}`);
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
  buildAlbum($('album'), S.tasks);
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
    $('intro-count').textContent = `${count} ${prenosy(count)} · varianta ${S.variant}`;
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
  $('task-meta').textContent = S.tutorial ? 'nepočítá se do výsledku' : `Přenos ${S.i + 1} z ${S.tasks.length}`;
  $('hud-task').textContent = S.tutorial ? 'Ukázka' : `${S.i + 1}/${S.tasks.length}`;
  $('task-h').textContent = t.title;
  $('task-prompt').textContent = t.prompt;
  $('hints').replaceChildren();
  if (S.tutorial) $('hints').append(el('p', { class: 'hint hint--tour' }, el('b', { text: 'Jak to funguje: ' }), 'Sestav zápis pod zadáním a sleduj měřidlo okna spojení. Pak stiskni Odeslat a zkontrolovat. Když si nevíš rady, vezmi si nápovědu – výsledek nesnižuje. Po dvou pokusech můžeš zobrazit řešení.'));
  setFeedback(null);
  $('btn-reveal').hidden = true; $('btn-next').hidden = true;
  $('btn-check').disabled = false; $('btn-hint').disabled = false;
  $('btn-hint').textContent = '🔍 Nápověda';
  $('progress').max = S.tasks.length; $('progress').value = S.tutorial ? 0 : S.i;
  $('album-note').textContent = S.tutorial ? 'Každý doručený snímek přibude v albu.' : `Doručeno ${S.results.length} z ${S.tasks.length}.`;
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
  const head = { good: 'Doručeno. ', bad: 'Ještě ne. ', solution: 'Řešení: ' }[kind];
  fb.replaceChildren(el('b', { text: `${icon} ${head}` }), text);
}

function check() {
  if (S.done) return;
  const t = current();
  const r = L.check(t, S.tool.get());
  setFeedback(r.ok ? 'good' : 'bad', r.msg);
  if (r.incomplete) return; // nevyplněná odpověď se nepočítá jako pokus
  S.attempts++;
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
    photoOn($('album'), S.i, revealed);
    $('album-note').textContent = `Doručeno ${S.results.length} z ${S.tasks.length}.`;
    $('progress').value = S.i + 1;
  }
  $('btn-next').textContent = S.tutorial ? 'Spustit misi →' : S.i + 1 >= S.tasks.length ? 'Ukončit spojení →' : 'Další přenos →';
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
  $('result').textContent = `Zvládl(a) jsi ${solved} z ${total} přenosů, ${firstTry} napoprvé.` + (isNew && firstTry > 0 ? ' To je tvůj nový osobní rekord!' : '');
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
  buildAlbum($('album-end'), S.tasks);
  S.results.forEach((r, i) => photoOn($('album-end'), i, r.revealed));
  show('s-end');
  $('end-h').focus();
  renderBest();
}

/* ================= Album snímků ================= */
function photoSvg(picKey) {
  const g = L.gridFrom(L.PICTURES[picKey]);
  const cells = [];
  g.forEach((row, y) => row.forEach((c, x) => cells.push(svg('rect', { x: x * 10, y: y * 10, width: 10.4, height: 10.4, fill: colorOf(c) }))));
  return svg('svg', { viewBox: '0 0 80 80', class: 'photo-svg', 'aria-hidden': 'true' }, cells);
}
function buildAlbum(box, tasks) {
  box.replaceChildren(...tasks.map((t, i) => el('span', { class: 'slot', 'data-i': String(i) }, el('span', { class: 'slot__q', 'aria-hidden': 'true', text: '···' }))));
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', `Album na Zemi: doručeno 0 z ${tasks.length} snímků.`);
}
function photoOn(box, i, dim = false) {
  const slot = box.querySelectorAll('.slot')[i];
  if (!slot) return;
  slot.replaceChildren(photoSvg(S.tasks[i].pic));
  slot.classList.add('is-done');
  if (dim) slot.classList.add('is-dim');
  const done = box.querySelectorAll('.slot.is-done').length;
  box.setAttribute('aria-label', `Album na Zemi: doručeno ${done} z ${box.querySelectorAll('.slot').length} snímků.`);
}

/* ================= Společné prvky nástrojů ================= */
/** Mřížka políček (jen k zobrazení). cell(x, y) vrací { color, text, unknown }. */
function pixGrid(w, h, cell, { label, cls = '' } = {}) {
  const g = el('div', { class: `pix ${cls}`, role: label ? 'img' : null, 'aria-label': label || null, 'aria-hidden': label ? null : 'true' });
  g.style.setProperty('--cols', w);
  const cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = el('span', { class: 'pix__c' }); cells.push(c); g.append(c); }
  const paint = () => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = cell(x, y) || {};
      const c = cells[y * w + x];
      c.classList.toggle('is-unknown', !!v.unknown);
      c.style.background = v.unknown ? '' : v.color || '';
      c.textContent = v.text ?? '';
    }
  };
  paint();
  return { node: g, paint };
}
const panel = (title, ...children) => el('figure', { class: 'panel' }, el('figcaption', { class: 'panel__h', text: title }), ...children);

/** Měřidlo okna spojení: kolik bitů přenos zabere a kolik se vejde. */
function meter() {
  const fill = el('span', { class: 'meter__fill' });
  const text = el('p', { class: 'meter__text', 'aria-live': 'polite' });
  const detail = el('p', { class: 'meter__detail small' });
  const node = el('div', { class: 'meter' }, el('div', { class: 'meter__bar', 'aria-hidden': 'true' }, fill), text, detail);
  return {
    node,
    set(cost, budget, how = '') {
      if (cost == null) {
        fill.style.width = '0%'; node.classList.remove('is-over');
        text.textContent = `Okno spojení: ${budget} bitů`;
      } else {
        fill.style.width = `${Math.min(100, (cost / budget) * 100)}%`;
        node.classList.toggle('is-over', cost > budget);
        text.textContent = `Přenos ${cost} z ${budget} bitů${cost > budget ? ' – nevejde se!' : ''}`;
      }
      detail.textContent = how;
    }
  };
}

function textInput(id, label, opts = {}) {
  const inp = el('input', { id, type: 'text', class: 'answer', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', inputmode: opts.numeric ? 'numeric' : null, placeholder: opts.placeholder || null });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  return { input: inp, node: el('label', { class: 'answer-field', for: id }, el('span', { text: label }), inp) };
}

function letterLegend(indices) {
  return el('ul', { class: 'legend', 'aria-label': 'Písmena barev' }, indices.map(i => el('li', {},
    el('span', { class: 'sw', style: `background:${colorOf(i)}` }), el('b', { class: 'mono', text: L.PALETTE[i].letter }), ` ${L.PALETTE[i].name}`)));
}

/** Kreslicí plátno 10 × 10 se zápisem tvarů (černý vesmír). */
const U = 24;
function canvas(shapes, { label } = {}) {
  const lines = [];
  for (let i = 0; i <= L.SIZE; i++) lines.push(svg('path', { d: `M${i * U} 0V${L.SIZE * U}M0 ${i * U}H${L.SIZE * U}`, class: 'vgrid' }));
  const nums = [];
  for (let i = 0; i <= L.SIZE; i += 2) nums.push(svg('text', { x: i * U, y: -6, 'text-anchor': 'middle', class: 'vaxis', text: String(i) }), svg('text', { x: -8, y: i * U + 4, 'text-anchor': 'end', class: 'vaxis', text: String(i) }));
  const layer = svg('g', {});
  const node = svg('svg', { viewBox: `-26 -20 ${L.SIZE * U + 34} ${L.SIZE * U + 28}`, class: 'vector', role: 'img', 'aria-label': label },
    svg('rect', { x: 0, y: 0, width: L.SIZE * U, height: L.SIZE * U, fill: '#000' }), layer, lines, nums);
  const draw = list => {
    layer.replaceChildren(...list.map(s => {
      const fill = colorOf(s.c);
      if (s.k === 'rect') return svg('rect', { x: s.x * U, y: s.y * U, width: Math.max(0, s.w) * U, height: Math.max(0, s.h) * U, fill });
      if (s.k === 'circle') return svg('circle', { cx: s.x * U, cy: s.y * U, r: Math.max(0, s.r) * U, fill });
      return svg('line', { x1: s.x1 * U, y1: s.y1 * U, x2: s.x2 * U, y2: s.y2 * U, stroke: fill, 'stroke-width': U * 0.35, 'stroke-linecap': 'round' });
    }));
  };
  draw(shapes);
  return { node, draw };
}

/* ================= Nástroje úloh ================= */
const TOOLS = {
  'palette-build'(t) {
    const w = t.grid[0].length, h = t.grid.length;
    const table = t.order.map(() => null);
    let bpp = null;
    const options = L.PALETTE.map((p, i) => i);
    const shot = pixGrid(w, h, (x, y) => ({ color: colorOf(t.grid[y][x]) }), { label: `Snímek, jak ho vidí sonda: ${t.picName}` });
    const data = pixGrid(w, h, (x, y) => ({ text: String(t.local[y][x]) }), { label: 'Data: čísla barev po řádcích', cls: 'pix--data' });
    const earth = pixGrid(w, h, (x, y) => {
      const li = t.local[y][x];
      if (bpp != null && li >= 2 ** bpp) return { unknown: true };
      return table[li] == null ? { unknown: true } : { color: colorOf(table[li]) };
    }, { label: 'Náhled na Zemi podle tvé tabulky', cls: 'pix--earth' });
    const m = meter();
    const upd = () => {
      earth.paint();
      if (bpp == null) m.set(null, t.budget, `Vyber, kolik bitů zabere jedno políčko. Tabulka barev stojí ${t.k} × ${L.RGB_BITS} bitů.`);
      else m.set(t.px * bpp + t.k * L.RGB_BITS, t.budget, `${t.px} políček × ${bpp} ${L.bitsWord(bpp)} + tabulka ${t.k} × ${L.RGB_BITS} bitů`);
    };
    const selects = t.order.map((_, li) => {
      const sw = el('span', { class: 'sw sw--big is-empty' });
      const s = el('select', { id: `tab-${li}`, class: 'select' }, el('option', { value: '', text: '– kód barvy –' }), options.map(i => el('option', { value: String(i), text: L.hex(L.PALETTE[i].rgb) })));
      s.addEventListener('change', () => {
        table[li] = s.value === '' ? null : Number(s.value);
        sw.classList.toggle('is-empty', table[li] == null);
        sw.style.background = table[li] == null ? '' : colorOf(table[li]);
        upd();
      });
      return { s, sw, node: el('div', { class: 'tab-row' }, el('label', { for: `tab-${li}`, class: 'tab-row__n mono' }, `${li} →`), s, sw) };
    });
    const bits = el('fieldset', { class: 'seg seg--bits' }, el('legend', { text: 'Bitů na jedno políčko' }));
    const bitInputs = [1, 2, 3, 4].map(b => {
      const inp = el('input', { type: 'radio', name: `bpp-${t.id}`, value: String(b) });
      inp.addEventListener('change', () => { bpp = b; upd(); });
      bits.append(el('label', {}, inp, el('span', {}, el('b', { text: String(b) }), el('small', { text: ` ${L.bitsWord(b)} = ${2 ** b} ${2 ** b < 5 ? 'čísla' : 'čísel'}` }))));
      return inp;
    });
    upd();
    const node = el('div', { class: 'tool-stack' },
      el('div', { class: 'panels' }, panel('Sonda vidí', shot.node), panel('Data na cestě', data.node), panel('Země zobrazí', earth.node)),
      el('div', { class: 'console' },
        el('div', { class: 'tab' }, el('p', { class: 'console__h', text: 'Tabulka barev: číslo → kód' }), selects.map(x => x.node)),
        el('div', {}, bits, el('p', { class: 'small muted', text: '1 bit rozliší 2 čísla (0, 1), 2 bity 4 čísla, 3 bity 8 čísel, 4 bity 16 čísel.' }))),
      m.node);
    return {
      node,
      get: () => ({ table: [...table], bpp }),
      set: a => {
        a.table.forEach((v, li) => { selects[li].s.value = String(v); selects[li].s.dispatchEvent(new Event('change')); });
        bpp = a.bpp; bitInputs.forEach(i => { i.checked = Number(i.value) === a.bpp; }); upd();
      },
      lock: () => { selects.forEach(x => { x.s.disabled = true; }); bits.disabled = true; }
    };
  },

  'hex-mix'(t) {
    const val = [0, 0, 0];
    const names = ['Červená', 'Zelená', 'Modrá'];
    const mine = el('span', { class: 'swatch' });
    const code = el('p', { class: 'mono rgb-code', 'aria-live': 'polite' });
    const upd = () => { mine.style.background = css(val); code.textContent = `Země zobrazí: ${L.rgbText(val)}`; };
    const groups = names.map((n, ch) => {
      const fs = el('fieldset', { class: `seg seg--rgb seg--ch${ch}` }, el('legend', { text: n }));
      const inputs = L.HEX_LEVELS.map(lv => {
        const inp = el('input', { type: 'radio', name: `ch${ch}`, value: String(lv), checked: lv === 0 ? true : null });
        inp.addEventListener('change', () => { val[ch] = lv; upd(); });
        fs.append(el('label', {}, inp, el('span', { text: String(lv) })));
        return inp;
      });
      return { fs, inputs };
    });
    upd();
    const table = el('div', { class: 'ref' }, el('p', { class: 'console__h', text: 'Převodník: šestnáctkově → desítkově' }),
      el('div', { class: 'ref__grid' }, L.HEX_LEVELS.map(v => el('span', { class: 'ref__cell' }, el('b', { class: 'mono', text: L.hex2(v) }), el('small', { text: `= ${v}` })))));
    return {
      node: el('div', { class: 'tool-stack' },
        el('div', { class: 'swatches' }, el('figure', {}, el('p', { class: 'code-big mono', text: t.code }), el('figcaption', { text: 'Kód ze spektrometru' })), el('figure', {}, mine, el('figcaption', { text: 'Barva na obrazovce' }))),
        table, el('div', { class: 'rgb-groups' }, groups.map(g => g.fs)), code),
      get: () => ({ rgb: [...val] }),
      set: a => { a.rgb.forEach((v, ch) => { val[ch] = v; groups[ch].inputs.forEach(i => { i.checked = Number(i.value) === v; }); }); upd(); },
      lock: () => groups.forEach(g => { g.fs.disabled = true; })
    };
  },

  'vector-send'(t) {
    const shapes = t.shapes.map(s => ({ ...s }));
    const inputs = [];
    const target = canvas(t.shapes, { label: `Snímek ze sondy: ${t.sceneName}` });
    const blankAt = (si, p) => t.blanks.findIndex(b => b.si === si && b.p === p);
    t.blanks.forEach(b => { shapes[b.si][b.p] = 0; });
    const mine = canvas(shapes, { label: 'Kresba na Zemi podle zápisu' });
    const list = el('ol', { class: 'code-list' }, t.shapes.map((s, si) => el('li', { class: 'mono' },
      `${L.SHAPE_NAME[s.k]}(`,
      L.PARAMS[s.k].flatMap((p, pi) => {
        const bi = blankAt(si, p);
        const sep = pi ? ', ' : '';
        if (bi < 0) return [`${sep}${L.PARAM_LABEL[p]}=${s[p]}`];
        const inp = el('input', { type: 'text', inputmode: 'numeric', class: 'blank', id: `b-${bi}`, 'aria-label': `${L.SHAPE_NAME[s.k]} ${si + 1}: ${L.PARAM_LABEL[p]}`, maxlength: '2', autocomplete: 'off' });
        inp.addEventListener('input', () => { const v = parseInt(inp.value, 10); shapes[si][p] = Number.isNaN(v) ? 0 : Math.max(0, Math.min(L.SIZE, v)); mine.draw(shapes); });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
        inputs[bi] = inp;
        return [`${sep}${L.PARAM_LABEL[p]}=`, inp];
      }),
      `, ${L.PALETTE[s.c].name})`)));
    const m = meter();
    m.set(t.cost, t.budget, `Tvary: ${t.cost} bitů · po pixelech by to bylo ${t.pxCost} bitů`);
    return {
      node: el('div', { class: 'tool-stack' }, el('div', { class: 'figs' }, panel('Sonda vidí', target.node), panel('Země nakreslí', mine.node)), list,
        el('p', { class: 'small muted', text: 'x roste doprava, y dolů. Obdélník: levý horní roh, šířka a výška. Kruh: střed a poloměr. Úsečka: z bodu [x1, y1] do [x2, y2].' }), m.node),
      get: () => ({ values: inputs.map(i => i.value) }),
      set: a => { a.values.forEach((v, i) => { inputs[i].value = v; inputs[i].dispatchEvent(new Event('input')); }); },
      lock: () => inputs.forEach(i => { i.readOnly = true; })
    };
  },

  order(t) {
    let order = [...t.start];
    const target = canvas(t.shapes, { label: `Snímek ze sondy: ${t.sceneName}` });
    const mine = canvas(order.map(i => t.shapes[i]), { label: 'Kresba na Zemi v pořadí paketů' });
    const list = el('ol', { class: 'order-list' });
    const live = el('p', { class: 'sr-only', 'aria-live': 'polite' });
    let locked = false;
    const move = (pos, d, focusDir) => {
      const j = pos + d;
      if (j < 0 || j >= order.length) return;
      [order[pos], order[j]] = [order[j], order[pos]];
      render();
      live.textContent = `${L.shapeText(t.shapes[order[j]])} je teď ${j + 1}. v pořadí.`;
      const btns = list.children[j]?.querySelectorAll('button');
      (btns?.[focusDir] && !btns[focusDir].disabled ? btns[focusDir] : btns?.[1 - focusDir])?.focus();
    };
    const render = () => {
      list.replaceChildren(...order.map((si, pos) => el('li', { class: 'order-item' },
        el('span', { class: 'order-num', text: `${pos + 1}.` }),
        el('span', { class: 'sw', style: `background:${colorOf(t.shapes[si].c)}` }),
        el('code', { class: 'mono', text: L.shapeText(t.shapes[si]) }),
        el('span', { class: 'order-btns' },
          el('button', { type: 'button', class: 'btn btn--ghost btn--icon', 'aria-label': `Posunout dřív: ${L.shapeText(t.shapes[si])}`, disabled: locked || pos === 0, onclick: () => move(pos, -1, 0) }, '↑'),
          el('button', { type: 'button', class: 'btn btn--ghost btn--icon', 'aria-label': `Posunout později: ${L.shapeText(t.shapes[si])}`, disabled: locked || pos === order.length - 1, onclick: () => move(pos, 1, 1) }, '↓')))));
      mine.draw(order.map(i => t.shapes[i]));
    };
    render();
    return {
      node: el('div', { class: 'tool-stack' }, el('div', { class: 'figs' }, panel('Sonda vidí', target.node), panel('Země nakreslí', mine.node)),
        el('p', { class: 'small muted', text: 'Pakety se kreslí shora dolů: 1. tvar nejdřív, poslední navrch.' }), list, live),
      get: () => ({ order: [...order] }),
      set: a => { order = [...a.order]; render(); },
      lock: () => { locked = true; render(); }
    };
  },

  'rle-rows'(t) {
    const w = t.grid[0].length, h = t.grid.length;
    const vals = t.ask.map(() => '');
    const decoded = y => {
      const ai = t.ask.indexOf(y);
      if (ai < 0) return t.grid[y];
      const p = L.rleParse(vals[ai], { colors: true });
      if (p.error) return [];
      const out = [];
      for (const [n, ch] of p.pairs) for (let k = 0; k < n && out.length < w; k++) out.push(L.LETTER_TO[ch] ?? -1);
      return out;
    };
    const shot = pixGrid(w, h, (x, y) => ({ color: colorOf(t.grid[y][x]), text: L.PALETTE[t.grid[y][x]].letter }), { label: 'Pás krajiny, jak ho vidí sonda', cls: 'pix--wide pix--letters' });
    const earth = pixGrid(w, h, (x, y) => { const v = decoded(y)[x]; return v == null || v < 0 ? { unknown: true } : { color: colorOf(v) }; }, { label: 'Náhled na Zemi podle zápisu', cls: 'pix--wide pix--earth' });
    const m = meter();
    const inputs = [];
    const upd = () => {
      earth.paint();
      let n = 0, okAll = true;
      for (let y = 0; y < h; y++) {
        const ai = t.ask.indexOf(y);
        if (ai < 0) { n += L.runs(t.grid[y]).length; continue; }
        const p = L.rleParse(vals[ai], { colors: true });
        if (p.error) okAll = false; else n += p.pairs.length;
      }
      m.set(okAll ? n * (L.COUNT_BITS + t.bpp) : null, t.budget, okAll ? `${n} úseků × (${L.COUNT_BITS} bity počet + ${t.bpp} ${L.bitsWord(t.bpp)} barva) · po pixelech ${t.pxCost} bitů` : `Úsek = ${L.COUNT_BITS} bity na počet + ${t.bpp} ${L.bitsWord(t.bpp)} na barvu.`);
    };
    const rows = el('ol', { class: 'row-list' }, t.grid.map((r, y) => {
      const ai = t.ask.indexOf(y);
      if (ai < 0) return el('li', {}, el('span', { class: 'row-list__n', text: `Řádek ${y + 1}` }), el('code', { class: 'mono row-list__code', text: L.rowCode(r) }));
      const inp = el('input', { id: `r-${ai}`, type: 'text', class: 'answer answer--row', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'např. 3Č2O…' });
      inp.addEventListener('input', () => { vals[ai] = inp.value; upd(); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
      inputs[ai] = inp;
      return el('li', { class: 'is-ask' }, el('label', { for: `r-${ai}`, class: 'row-list__n', text: `Řádek ${y + 1}` }), inp);
    }));
    upd();
    return {
      node: el('div', { class: 'tool-stack' }, el('div', { class: 'panels panels--2' }, panel('Sonda vidí', shot.node), panel('Země zobrazí', earth.node)),
        letterLegend(L.colorsIn(t.grid)), rows, m.node),
      get: () => ({ values: [...vals] }),
      set: a => { a.values.forEach((v, i) => { inputs[i].value = v; vals[i] = v; }); upd(); },
      lock: () => inputs.forEach(i => { i.readOnly = true; })
    };
  },

  rle(t) {
    const chips = el('p', { class: 'chips', role: 'img', 'aria-label': `Zpráva ${t.source}` }, [...t.source].map(ch => el('span', { class: 'code-chip', 'aria-hidden': 'true', text: ch })));
    const f = textInput('ans', 'Zkrácená zpráva', { placeholder: 'např. 3A1B…' });
    const m = meter();
    const upd = () => {
      const n = f.input.value.replace(/\s/g, '').length;
      m.set(n ? n * L.CHAR_BITS : null, t.source.length * L.CHAR_BITS, n ? `${n} znaků × ${L.CHAR_BITS} bitů · původně ${t.source.length} znaků` : `Původní zpráva: ${t.source.length} znaků × ${L.CHAR_BITS} bitů`);
    };
    f.input.addEventListener('input', upd);
    upd();
    return { node: el('div', { class: 'tool-stack' }, chips, f.node, m.node), get: () => ({ value: f.input.value }), set: a => { f.input.value = a.value; upd(); }, lock: () => { f.input.readOnly = true; } };
  },

  number(t) {
    const f = textInput('ans', 'Kontrolní součet (číslo)', { numeric: true });
    return { node: el('div', { class: 'tool-stack' }, el('p', { class: 'code-big mono', text: t.code }), f.node), get: () => ({ value: f.input.value }), set: a => { f.input.value = a.value; }, lock: () => { f.input.readOnly = true; } };
  },

  resend(t) {
    const picked = new Set();
    const m = meter();
    const upd = () => m.set(picked.size ? picked.size * t.rowCost : null, t.energy, `Opakované poslání jednoho řádku stojí ${t.rowCost} bitů.`);
    let locked = false;
    const btns = t.received.map((r, y) => {
      const b = el('button', { type: 'button', class: 'resend', 'aria-pressed': 'false' },
        el('span', { class: 'resend__n', text: `Řádek ${y + 1}` }),
        el('code', { class: 'mono resend__code', text: r.map(([n, c]) => `${n}${L.PALETTE[c].letter}`).join(' ') }),
        el('span', { class: 'resend__tag', text: 'vyžádat znovu' }));
      b.addEventListener('click', () => { if (locked) return; if (picked.has(y)) picked.delete(y); else picked.add(y); b.setAttribute('aria-pressed', String(picked.has(y))); upd(); });
      return b;
    });
    const earthBox = el('div', { class: 'resend-earth' }, el('p', { class: 'small muted', text: 'Snímek se na Zemi složí, až budou všechny řádky celé.' }));
    upd();
    return {
      node: el('div', { class: 'tool-stack' }, letterLegend(L.colorsIn(t.grid)), el('div', { class: 'resend-list', role: 'group', 'aria-label': 'Přijaté řádky' }, btns), m.node, earthBox),
      get: () => ({ rows: [...picked] }),
      set: a => { picked.clear(); a.rows.forEach(y => picked.add(y)); btns.forEach((b, y) => b.setAttribute('aria-pressed', String(picked.has(y)))); upd(); },
      lock: () => {
        locked = true; btns.forEach(b => { b.disabled = true; });
        const g = pixGrid(8, 8, (x, y) => ({ color: colorOf(t.grid[y][x]) }), { label: `Složený snímek: ${t.picName}` });
        earthBox.replaceChildren(panel('Země zobrazí', g.node));
      }
    };
  },

  transfer(t) {
    const choices = t.shots.map(() => null);
    const groups = [];
    const cards = t.shots.map((s, i) => {
      const g = pixGrid(10, 10, (x, y) => ({ color: colorOf(s.grid[y][x]) }), { label: `Snímek ${i + 1}: ${s.name}` });
      const fs = el('fieldset', { class: 'methods' }, el('legend', { class: 'sr-only', text: `Zápis pro snímek ${i + 1}` }));
      const costs = [];
      const inputs = L.METHODS.map((name, mi) => {
        const inp = el('input', { type: 'radio', name: `tr-${i}`, value: String(mi) });
        inp.addEventListener('change', () => { choices[i] = mi; });
        const cost = el('small', { class: 'method__cost' });
        costs.push(cost);
        fs.append(el('label', { class: 'method' }, inp, el('span', { text: name }), cost));
        return inp;
      });
      groups.push({ fs, inputs, costs });
      return el('article', { class: 'shot' }, el('h3', { class: 'shot__h', text: `${i + 1}. ${s.name}` }), g.node,
        el('p', { class: 'small shot__meta', text: `${s.k} ${s.k < 5 ? 'barvy' : 'barev'} → ${s.bpp} ${L.bitsWord(s.bpp)} na barvu` }), fs);
    });
    const price = el('div', { class: 'ref' }, el('p', { class: 'console__h', text: 'Ceník přenosu' }),
      el('ul', { class: 'price' },
        el('li', {}, el('b', { text: 'Po pixelech: ' }), '100 políček × bity na barvu.'),
        el('li', {}, el('b', { text: 'Úseky: ' }), `každý úsek v každém řádku ${L.COUNT_BITS} bity na počet + bity na barvu.`),
        el('li', {}, el('b', { text: 'Tvary: ' }), `každý tvar ${L.KIND_BITS} bity na druh + ${L.NUM_BITS} bity na každé číslo + bity na barvu. Jen pro snímek z tvarů.`)));
    const m = meter();
    m.set(null, t.budget, 'Kolik přenos zabere, se ukáže po odeslání.');
    return {
      node: el('div', { class: 'tool-stack' }, el('div', { class: 'shots' }, cards), price, m.node),
      get: () => ({ choices: [...choices] }),
      set: a => { a.choices.forEach((c, i) => { choices[i] = c; groups[i].inputs.forEach(inp => { inp.checked = Number(inp.value) === c; }); }); },
      lock: () => {
        let total = 0;
        groups.forEach((g, i) => {
          g.fs.disabled = true;
          t.shots[i].costs.forEach((c, mi) => { g.costs[mi].textContent = c == null ? 'nejde' : `${c} bitů`; });
          total += t.shots[i].costs[choices[i]] ?? 0;
        });
        m.set(total, t.budget, 'U každé možnosti je teď vidět její cena.');
      }
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
    el('p', { class: 'warn', text: 'Opravdu smazat výsledky Signálu ze sondy v tomto prohlížeči? Ostatní hry zůstanou beze změny.' }),
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

/* ================= Návrat do menu hry ================= */
function goMenu() {
  clearInterval(S.tick);
  if ($('dlg-menu').open) $('dlg-menu').close();
  show('s-title');
  renderBest();
  $('title-h').focus();
}
$('btn-menu').addEventListener('click', () => {
  if (S.tutorial || !S.results.length) return goMenu();
  $('dlg-menu').showModal();
  $('btn-menu-no').focus();
});
$('btn-menu-yes').addEventListener('click', goMenu);
$('btn-menu-no').addEventListener('click', () => { $('dlg-menu').close(); $('btn-menu').focus(); });

/* Parametry URL: ?varianta=B&rezim=rychly (pro učitele – stejné zadání pro celou třídu) */
const params = new URLSearchParams(location.search);
const pv = (params.get('varianta') || '').toUpperCase();
if (L.VARIANTS[pv]) document.querySelector(`input[name="variant"][value="${pv}"]`).checked = true;
if (params.get('rezim') === 'rychly') document.querySelector('input[name="mode"][value="rychly"]').checked = true;
renderBest();
