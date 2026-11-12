/* Datoví detektivové – uživatelské rozhraní.
   Logika úloh a vyhodnocení je v logic.js (testovaná zvlášť). Tady jen DOM.
   Pravidla: text z dat vždy přes textContent, žádné innerHTML s daty, žádné externí zdroje,
   localStorage jen pod vlastním klíčem a v try/catch. */
import {
  VARIANTS, MODES, LEVELS, SKILLS, buildMission, tasksForMode, tutorialTask, checkAnswer,
  sortRows, sortColumnOnly, filterRows, cellAddress, colLetter, niceTicks, summarize, isBetter, formatCz, OPS
} from './logic.js';

const STORE_KEY = 'vyukovy-portal:datovi-detektivove:v1';
const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);

/* ---------- Pomocníci pro DOM ---------- */
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
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c) n.append(c);
  return n;
}
let uid = 0;
const nextId = p => `${p}-${++uid}`;

/* ---------- Úložiště (jen lokálně) ---------- */
function loadStore() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    return d && typeof d === 'object' ? { best: {}, ...d } : { best: {} };
  } catch { return { best: {} }; }
}
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* hraje se i bez úložiště */ }
}
let store = loadStore();

/* ---------- Stav hry ---------- */
const S = {
  mode: 'standard', variant: 'A', seed: VARIANTS.A, timer: false,
  tasks: [], i: 0, results: [], tutorial: false,
  task: null, answer: {}, attempts: 0, hintsShown: 0, done: false, revealed: false,
  totalHints: 0, startedAt: 0, tick: null
};

function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  $('hud').hidden = id !== 's-play' && id !== 's-level';
  window.scrollTo({ top: 0 });
}

/* ================= Titulní obrazovka ================= */

function initTitle() {
  const p = new URLSearchParams(location.search);
  const pref = store.prefs || {};
  const mode = MODES[p.get('rezim')] ? p.get('rezim') : MODES[pref.mode] ? pref.mode : 'standard';
  const variant = ['A', 'B', 'C', 'N'].includes((p.get('varianta') || '').toUpperCase()) ? p.get('varianta').toUpperCase() : 'A';
  document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
  document.querySelector(`input[name="variant"][value="${variant}"]`).checked = true;
  $('opt-timer').checked = !!pref.timer;
  renderRecords();

  $('setup').addEventListener('submit', e => { e.preventDefault(); startGame(true); });
  $('btn-skip').addEventListener('click', () => startGame(false));
  $('btn-reset').addEventListener('click', askReset);
  $('btn-level-go').addEventListener('click', () => { showScreen('s-play'); renderTask(); });
  $('btn-hint').addEventListener('click', showHint);
  $('btn-check').addEventListener('click', check);
  $('btn-reveal').addEventListener('click', reveal);
  $('btn-next').addEventListener('click', next);
  $('btn-again').addEventListener('click', () => {
    const order = ['A', 'B', 'C'];
    const v = order[(order.indexOf(S.variant) + 1) % 3] || 'A';
    document.querySelector(`input[name="variant"][value="${v}"]`).checked = true;
    startGame(false);
  });
  $('btn-home').addEventListener('click', () => { showScreen('s-title'); renderRecords(); $('title-h').focus?.(); });
  document.addEventListener('keydown', onKey);
}

function renderRecords() {
  const list = $('records');
  list.replaceChildren();
  let any = false;
  for (const [id, m] of Object.entries(MODES)) {
    const b = store.best?.[id];
    if (!b) continue;
    any = true;
    const time = b.timeMs != null ? `, čas ${fmtTime(b.timeMs)}` : '';
    list.append(el('li', {}, el('b', { text: m.label + ': ' }), `napoprvé ${b.firstTry} z ${b.total}, nápovědy ${b.hints}${time}`));
  }
  if (!any) list.append(el('li', { class: 'muted', text: 'Zatím žádný výsledek. Po první misi se tu objeví.' }));
  $('btn-reset').hidden = !any && !store.tutorialDone;
}

function askReset() {
  const box = $('reset-box');
  box.replaceChildren(
    el('p', { class: 'warn', text: 'Opravdu smazat uložené výsledky v tomto prohlížeči?' }),
    el('button', { class: 'btn btn--warn btn--small', type: 'button', id: 'btn-reset-yes', onclick: () => {
      store = { best: {} };
      try { localStorage.removeItem(STORE_KEY); } catch { /* nic */ }
      restoreResetBox(); renderRecords(); $('btn-reset').focus();
    } }, 'Ano, smazat'),
    el('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => { restoreResetBox(); $('btn-reset').focus(); } }, 'Ne, ponechat')
  );
  $('btn-reset-yes').focus();
}
function restoreResetBox() {
  const b = el('button', { class: 'btn btn--ghost btn--small', id: 'btn-reset', type: 'button', onclick: askReset }, 'Smazat moje výsledky');
  $('reset-box').replaceChildren(b);
}

/* ================= Průběh mise ================= */

function startGame(withTutorial) {
  const f = new FormData($('setup'));
  S.mode = f.get('mode') || 'standard';
  S.variant = f.get('variant') || 'A';
  S.timer = $('opt-timer').checked;
  S.seed = S.variant === 'N' ? (Math.floor(Math.random() * 1e9) + 1) : VARIANTS[S.variant];
  store.prefs = { mode: S.mode, timer: S.timer };
  saveStore();

  S.tasks = tasksForMode(buildMission(S.seed), S.mode);
  S.i = 0; S.results = []; S.totalHints = 0;
  S.startedAt = Date.now();
  clearInterval(S.tick);
  $('timer').hidden = !S.timer;
  if (S.timer) S.tick = setInterval(updateTimer, 1000);
  updateTimer(); updateHud();

  if (withTutorial) {
    S.tutorial = true;
    showScreen('s-play');
    renderTask();
  } else {
    S.tutorial = false;
    openLevelOrTask();
  }
}

function currentTask() { return S.tutorial ? tutorialTask() : S.tasks[S.i]; }

function openLevelOrTask() {
  const t = S.tasks[S.i];
  const prev = S.tasks[S.i - 1];
  if (!prev || prev.level !== t.level) {
    const lv = LEVELS[t.level];
    const inLevel = S.tasks.filter(x => x.level === t.level).length;
    $('level-num').textContent = t.level === 4 ? 'Bonus' : `Úroveň ${t.level}`;
    $('level-h').textContent = lv.name;
    $('level-focus').textContent = lv.focus;
    $('level-note').textContent = `Úloh v tomto spisu: ${inLevel}. Varianta zadání ${S.variant === 'N' ? 'náhodná' : S.variant}.`;
    showScreen('s-level');
    updateHud();
    $('level-h').focus();
  } else {
    showScreen('s-play');
    renderTask();
  }
}

function updateHud() {
  const n = S.tasks.length || 1;
  const done = S.tutorial ? 0 : S.i;
  $('progress').max = n;
  $('progress').value = done;
  $('progress-text').textContent = S.tutorial ? 'Ukázka' : `Úloha ${Math.min(S.i + 1, n)} z ${n}`;
  $('hint-count').querySelector('b').textContent = String(S.totalHints);
}
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function updateTimer() { $('timer').querySelector('b').textContent = fmtTime(Date.now() - S.startedAt); }

/* ================= Vykreslení úlohy ================= */

function renderTask() {
  const t = currentTask();
  S.task = t;
  S.answer = {};
  S.attempts = 0; S.hintsShown = 0; S.done = false; S.revealed = false;

  $('coach').hidden = !S.tutorial;
  $('task-level').textContent = S.tutorial ? 'Ukázka' : (t.level === 4 ? 'Velký případ' : `Spis ${t.level}`);
  $('task-num').textContent = S.tutorial ? '' : `Úloha ${S.i + 1} z ${S.tasks.length}`;
  $('task-h').textContent = t.title;
  $('task-prompt').textContent = t.prompt;
  $('hints').replaceChildren();
  $('feedback').replaceChildren();
  $('feedback').className = 'feedback';
  $('after').hidden = true;
  $('btn-reveal').hidden = true;
  $('btn-next').hidden = true;
  $('btn-check').disabled = false;
  $('btn-hint').disabled = false;
  $('btn-hint').lastChild.textContent = ' Nápověda';

  const desk = $('desk');
  const ui = $('answer-ui');
  desk.replaceChildren();
  ui.replaceChildren();
  desk.inert = false; ui.inert = false;
  RENDER[t.type](t, desk, ui);
  updateHud();
  $('task-h').focus();
}

/* ---------- Tabulka (stylizovaný tabulkový editor) ---------- */
/**
 * opts.mode: 'view' | 'one' | 'many' | 'inspect'
 * opts.rows: zobrazené řádky (pro řazení/filtr), opts.edit: { rowId, key, onInput }
 */
function sheet(table, opts = {}) {
  const mode = opts.mode || 'view';
  const rows = opts.rows || table.rows;
  const cols = table.columns;
  const wrap = el('div', { class: 'sheet' });
  const selectable = mode !== 'view';
  const fx = el('div', { class: 'fx', 'aria-hidden': selectable ? null : 'true' },
    el('span', { class: 'fx__addr', text: '–' }), el('span', { class: 'fx__eq', text: 'fx' }), el('span', { class: 'fx__val', text: 'Klikni na buňku' }));
  if (selectable) wrap.append(fx);

  const tbl = el('table', { class: 'sheet__table' });
  tbl.append(el('caption', { text: table.title }));
  const thead = el('thead');
  thead.append(el('tr', { class: 'sheet__letters', 'aria-hidden': 'true' }, el('td', { class: 'corner' }), cols.map((_, i) => el('td', { text: colLetter(i) }))));
  thead.append(el('tr', {}, el('td', { class: 'rownum', 'aria-hidden': 'true', text: '1' }), cols.map(c => el('th', { scope: 'col', text: c.label }))));
  tbl.append(thead);
  const tbody = el('tbody');
  const origIndex = new Map(table.rows.map((r, i) => [r.id, i]));
  const buttons = [];
  rows.forEach((r, ri) => {
    const tr = el('tr', { 'data-id': r.id });
    if (r.broken) tr.classList.add('is-broken');
    tr.append(el('td', { class: 'rownum', 'aria-hidden': 'true', text: String(ri + 2) }));
    cols.forEach((c, ci) => {
      const v = r[c.key];
      const empty = v === null || v === undefined || v === '';
      const shown = empty ? '' : typeof v === 'number' ? formatCz(v) : String(v);
      const cellTag = ci === 0 ? 'th' : 'td';
      const cell = el(cellTag, { class: `${c.type === 'number' ? 'num' : ''}${empty ? ' is-empty' : ''}`.trim() || null, scope: ci === 0 ? 'row' : null });
      const addr = cellAddress(ci, ri);
      if (opts.edit && opts.edit.rowId === r.id && opts.edit.key === c.key) {
        const inp = el('input', { class: 'cell-input', type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': `${addr}: ${c.label} – ${r[cols[0].key]} (doplň hodnotu)`, value: opts.edit.value || '' });
        inp.addEventListener('input', () => opts.edit.onInput(inp.value));
        cell.classList.add('is-edit');
        cell.append(inp);
      } else if (selectable) {
        const label = `${addr}: ${c.label}, ${r[cols[0].key]}, ${empty ? 'prázdná buňka' : shown}`;
        const b = el('button', { type: 'button', class: 'cell', 'aria-label': label, 'aria-pressed': mode === 'inspect' ? null : 'false', tabindex: '-1', 'data-row': String(origIndex.get(r.id)), 'data-col': String(ci) }, shown);
        b.addEventListener('click', () => {
          fx.firstChild.textContent = addr;
          fx.lastChild.textContent = empty ? '(prázdná)' : shown;
          if (opts.onCell) opts.onCell({ row: origIndex.get(r.id), col: ci }, b);
          setRoving(b);
        });
        buttons.push(b);
        cell.append(b);
      } else {
        cell.textContent = shown;
      }
      tr.append(cell);
    });
    tbody.append(tr);
  });
  tbl.append(tbody);
  const scroller = el('div', { class: 'sheet__scroll' }, tbl);
  wrap.append(scroller);

  // roving tabindex + šipky (mřížka buněk)
  const width = cols.length;
  function setRoving(b) { for (const x of buttons) x.tabIndex = -1; b.tabIndex = 0; }
  if (buttons.length) {
    buttons[0].tabIndex = 0;
    tbl.addEventListener('keydown', e => {
      const i = buttons.indexOf(document.activeElement);
      if (i < 0) return;
      const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: width, ArrowUp: -width, Home: -(i % width), End: width - 1 - (i % width) };
      if (!(e.key in moves)) return;
      const j = i + moves[e.key];
      if (j >= 0 && j < buttons.length) { e.preventDefault(); setRoving(buttons[j]); buttons[j].focus(); }
    });
  }
  return wrap;
}

/* ---------- Grafy (SVG, bez knihoven) ---------- */
const PALETTE = ['#1d5fd6', '#0f766e', '#b8480f', '#7a4dd8'];
const PATTERNS = ['', 'url(#pat-dots)', 'url(#pat-lines)', 'url(#pat-cross)'];

function chartDefs() {
  return svg('defs', {},
    svg('pattern', { id: 'pat-dots', width: 8, height: 8, patternUnits: 'userSpaceOnUse' }, svg('circle', { cx: 4, cy: 4, r: 1.6, fill: 'rgba(255,255,255,.75)' })),
    svg('pattern', { id: 'pat-lines', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, svg('rect', { width: 3, height: 8, fill: 'rgba(255,255,255,.6)' })),
    svg('pattern', { id: 'pat-cross', width: 10, height: 10, patternUnits: 'userSpaceOnUse' }, svg('path', { d: 'M0 5h10M5 0v10', stroke: 'rgba(255,255,255,.65)', 'stroke-width': 2 })));
}

/** def: { kind, title, labels, short?, values, axisMin, showValues, unit } ; opts: { onPick, selected, wrong } */
function chart(def, opts = {}) {
  const fig = el('figure', { class: 'chart' });
  const W = 480, H = 300, L = 54, R = 14, T = 34, B = 40;
  const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart__svg', role: opts.onPick ? 'group' : 'img' });
  s.append(chartDefs());
  const vals = def.values;
  const labels = def.short || def.labels;
  const summary = `${def.title}. ` + def.labels.map((l, i) => `${l}: ${vals[i] == null ? 'chybí' : formatCz(vals[i])}${def.unit ? ' ' + def.unit : ''}`).join(', ') + '.';
  s.setAttribute('aria-label', opts.onPick ? `${def.title} – vyber sloupec` : summary);
  s.append(svg('text', { x: W / 2, y: 20, 'text-anchor': 'middle', class: 'chart__title', text: def.title }));

  if (def.kind === 'pie') {
    const total = vals.reduce((a, b) => a + b, 0);
    const cx = 150, cy = 165, r = 112;
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
      const d = `M${cx} ${cy} L${p(a0)} A${r} ${r} 0 ${large} 1 ${p(a1)} Z`;
      s.append(svg('path', { d, fill: PALETTE[i % 4], stroke: '#fff', 'stroke-width': 2 }));
      if (PATTERNS[i]) s.append(svg('path', { d, fill: PATTERNS[i] }));
      const am = (a0 + a1) / 2;
      s.append(svg('text', { x: cx + r * 0.62 * Math.cos(am), y: cy + r * 0.62 * Math.sin(am) + 5, 'text-anchor': 'middle', class: 'chart__pie-label', text: `${v} %` }));
      a0 = a1;
    });
    // legenda (text, ne jen barva)
    labels.forEach((l, i) => {
      const y = 92 + i * 34;
      s.append(svg('rect', { x: 300, y: y - 14, width: 20, height: 20, rx: 4, fill: PALETTE[i % 4] }));
      if (PATTERNS[i]) s.append(svg('rect', { x: 300, y: y - 14, width: 20, height: 20, rx: 4, fill: PATTERNS[i] }));
      s.append(svg('text', { x: 328, y: y + 2, class: 'chart__legend', text: `${l} ${vals[i]} %` }));
    });
    fig.append(s);
    return fig;
  }

  const numeric = vals.filter(v => v != null);
  const axisMin = def.axisMin ?? 0;
  let ticks = niceTicks(axisMin, Math.max(...numeric), 5).filter(t => t >= axisMin);
  if (ticks[0] !== axisMin) ticks.unshift(axisMin);
  const top = ticks[ticks.length - 1];
  const y = v => T + (H - T - B) * (1 - (v - axisMin) / (top - axisMin));
  const slot = (W - L - R) / vals.length;

  // osa Y + mřížka
  for (const t of ticks) {
    s.append(svg('line', { x1: L, x2: W - R, y1: y(t), y2: y(t), class: 'chart__grid' }));
    s.append(svg('text', { x: L - 8, y: y(t) + 5, 'text-anchor': 'end', class: 'chart__tick', text: formatCz(t) }));
  }
  s.append(svg('line', { x1: L, x2: L, y1: T - 4, y2: H - B, class: 'chart__axis' }));
  s.append(svg('line', { x1: L, x2: W - R, y1: H - B, y2: H - B, class: 'chart__axis' }));
  if (axisMin !== 0) {
    // značka „osa nezačíná nulou“ by v reálných novinách často chyběla – záměrně ji nekreslíme
  }

  if (def.kind === 'bar') {
    const bw = Math.min(56, slot * 0.62);
    vals.forEach((v, i) => {
      const x = L + slot * i + (slot - bw) / 2;
      const yy = y(v);
      const g = svg('g', { class: 'cbar' + (opts.selected === i ? ' is-selected' : '') + (opts.wrong === i ? ' is-wrong' : '') });
      g.append(svg('rect', { x: x - 5, y: T - 6, width: bw + 10, height: H - B - T + 30, class: 'cbar__hit' }));
      g.append(svg('rect', { x, y: yy, width: bw, height: Math.max(0, H - B - yy), rx: 3, class: 'cbar__rect' }));
      if (def.showValues) g.append(svg('text', { x: x + bw / 2, y: yy - 6, 'text-anchor': 'middle', class: 'chart__val', text: formatCz(v) }));
      g.append(svg('text', { x: x + bw / 2, y: H - B + 22, 'text-anchor': 'middle', class: 'chart__label', text: labels[i] }));
      if (opts.onPick) {
        g.setAttribute('role', 'button');
        g.setAttribute('tabindex', '0');
        g.setAttribute('aria-pressed', String(opts.selected === i));
        g.setAttribute('aria-label', `Sloupec ${def.labels[i]}, hodnota ${formatCz(v)}`);
        g.addEventListener('click', () => opts.onPick(i));
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onPick(i); } });
      }
      s.append(g);
    });
  } else if (def.kind === 'line') {
    const pts = vals.map((v, i) => [L + slot * i + slot / 2, y(v ?? 0)]);
    s.append(svg('polyline', { points: pts.map(p => p.join(',')).join(' '), class: 'chart__line' }));
    pts.forEach(([px, py], i) => {
      s.append(svg('circle', { cx: px, cy: py, r: 5, class: 'chart__dot' }));
      s.append(svg('text', { x: px, y: H - B + 22, 'text-anchor': 'middle', class: 'chart__label chart__label--sm', text: labels[i] }));
    });
  }
  fig.append(s);
  return fig;
}

/** Malé ikony typů grafů pro výběr. */
function miniChart(kind) {
  const s = svg('svg', { viewBox: '0 0 80 56', class: 'mini', 'aria-hidden': 'true' });
  if (kind === 'bar') [[8, 30], [26, 18], [44, 38], [62, 10]].forEach(([x, h]) => s.append(svg('rect', { x, y: 50 - h - 2, width: 12, height: h, rx: 2, fill: '#1d5fd6' })));
  if (kind === 'line') s.append(svg('polyline', { points: '6,44 22,30 38,34 54,16 72,10', fill: 'none', stroke: '#0f766e', 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  if (kind === 'pie') {
    s.append(svg('circle', { cx: 40, cy: 28, r: 22, fill: '#1d5fd6' }));
    s.append(svg('path', { d: 'M40 28 L40 6 A22 22 0 0 1 61 34 Z', fill: '#b8480f' }));
    s.append(svg('path', { d: 'M40 28 L61 34 A22 22 0 0 1 30 48 Z', fill: '#0f766e' }));
  }
  if (kind !== 'pie') s.append(svg('path', { d: 'M4 4v46h72', fill: 'none', stroke: '#52656d', 'stroke-width': 2 }));
  return s;
}

/* ---------- Ovládací prvky odpovědí ---------- */
function choiceGroup(legend, options, onChange, { preview = false, name = nextId('opt') } = {}) {
  const fs = el('fieldset', { class: 'choices' + (preview ? ' choices--preview' : '') }, el('legend', { text: legend }));
  for (const o of options) {
    const input = el('input', { type: 'radio', name, value: o.id });
    input.addEventListener('change', () => onChange(o.id));
    fs.append(el('label', { class: 'choice' }, input, preview ? miniChart(o.id) : null, el('span', { text: o.label })));
  }
  return fs;
}
function numberField(label, onInput, unit) {
  const id = nextId('num');
  const inp = el('input', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', class: 'num-input' });
  inp.addEventListener('input', () => onInput(inp.value));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  return el('div', { class: 'field' }, el('label', { for: id, text: label }), el('div', { class: 'num-wrap' }, inp, unit ? el('span', { class: 'unit', text: unit }) : null));
}

/* ---------- Renderery podle typu úlohy ---------- */
const RENDER = {
  cell(t, desk, ui) {
    let current = null;
    desk.append(sheet(t.table, { mode: 'one', onCell: (pos, b) => {
      if (current) current.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true'); current = b;
      S.answer = pos;
      $('sel-info').textContent = `Vybraná buňka: ${cellAddress(pos.col, pos.row)}`;
    } }));
    ui.append(el('p', { class: 'sel-info', id: 'sel-info', text: 'Zatím není vybraná žádná buňka.' }));
  },
  cells(t, desk, ui) {
    const sel = new Map();
    desk.append(sheet(t.table, { mode: 'many', onCell: (pos, b) => {
      const k = `${pos.row}:${pos.col}`;
      if (sel.has(k)) { sel.delete(k); b.setAttribute('aria-pressed', 'false'); } else { sel.set(k, pos); b.setAttribute('aria-pressed', 'true'); }
      S.answer = { cells: [...sel.values()] };
      $('sel-info').textContent = sel.size ? `Označeno buněk: ${sel.size} (${[...sel.values()].map(p => cellAddress(p.col, p.row)).join(', ')}). Opětovným kliknutím označení zrušíš.` : 'Zatím nic neoznačeno.';
    } }));
    ui.append(el('p', { class: 'sel-info', id: 'sel-info', text: 'Klikáním označ jednu nebo více buněk.' }));
  },
  number(t, desk, ui) {
    if (t.tables) for (const tb of t.tables) desk.append(sheet(tb, { mode: 'inspect' }));
    else desk.append(sheet(t.table, { mode: t.inspect ? 'inspect' : 'view' }));
    ui.append(numberField('Tvoje odpověď', v => { S.answer = { value: v }; }, t.unit));
  },
  choice(t, desk, ui) {
    if (t.table) desk.append(sheet(t.table, { mode: 'view' }));
    if (t.chart) desk.append(chart(t.chart));
    if (t.preview === 'charts') desk.append(el('div', { class: 'desk-note' }, el('p', { text: 'Typy grafů:' }),
      el('ul', { class: 'plain' }, el('li', { text: 'Sloupcový – porovnání velikostí.' }), el('li', { text: 'Čárový – vývoj v čase.' }), el('li', { text: 'Kruhový – části jednoho celku.' }))));
    if (!desk.childElementCount) desk.hidden = true; else desk.hidden = false;
    ui.append(choiceGroup('Vyber odpověď', t.options, id => { S.answer = { option: id }; }, { preview: t.preview === 'charts' }));
  },
  sort(t, desk, ui) {
    let rows = t.table.rows.slice();
    let broken = false;
    const history = [];
    const host = el('div');
    const keyId = nextId('sk'), dirId = nextId('sd');
    const rangeName = nextId('range');
    const status = el('p', { class: 'tool-status', role: 'status' });
    const draw = () => { host.replaceChildren(sheet(t.table, { mode: 'view', rows })); S.answer = { ...S.answer, rows, broken }; undoBtn.disabled = !history.length; };
    const keySel = el('select', { id: keyId }, t.table.columns.map(c => el('option', { value: c.key, text: c.label })));
    const dirSel = el('select', { id: dirId }, el('option', { value: 'asc', text: 'Vzestupně (od nejmenšího)' }), el('option', { value: 'desc', text: 'Sestupně (od největšího)' }));
    const range = el('fieldset', { class: 'range' }, el('legend', { text: 'Co se má seřadit?' }),
      el('label', {}, el('input', { type: 'radio', name: rangeName, value: 'rows' }), ' Rozšířit výběr – seřadit celé řádky'),
      el('label', {}, el('input', { type: 'radio', name: rangeName, value: 'col' }), ' Jen vybraný sloupec'));
    const sortBtn = el('button', { type: 'button', class: 'btn btn--action btn--small', onclick: () => {
      const r = range.querySelector('input:checked');
      if (!r) { status.textContent = 'Vyber, jestli se mají řadit celé řádky, nebo jen sloupec.'; range.querySelector('input').focus(); return; }
      history.push({ rows, broken });
      if (r.value === 'rows') rows = sortRows(rows, keySel.value, dirSel.value);
      else { rows = sortColumnOnly(rows, keySel.value, dirSel.value); broken = true; }
      const colLabel = keySel.selectedOptions[0].textContent;
      status.textContent = `Seřazeno podle sloupce ${colLabel}, ${dirSel.value === 'asc' ? 'vzestupně' : 'sestupně'}${r.value === 'col' ? ' (jen tento sloupec)' : ''}.`;
      draw();
    } }, 'Seřadit');
    const undoBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: undo }, '↶ Zpět');
    function undo() {
      if (!history.length) return;
      ({ rows, broken } = history.pop());
      status.textContent = 'Poslední řazení vráceno.';
      draw();
    }
    S.undo = undo;
    desk.append(el('div', { class: 'toolbar', role: 'group', 'aria-label': 'Nástroj Seřadit' },
      el('div', { class: 'field' }, el('label', { for: keyId, text: 'Seřadit podle' }), keySel),
      el('div', { class: 'field' }, el('label', { for: dirId, text: 'Pořadí' }), dirSel),
      range, el('div', { class: 'toolbar__btns' }, sortBtn, undoBtn), status), host);
    draw();
    ui.append(choiceGroup(t.question, t.options, id => { S.answer = { ...S.answer, option: id }; }));
  },
  filter(t, desk, ui) {
    const state = {};
    const host = el('div');
    const info = el('p', { class: 'tool-status', role: 'status' });
    const apply = () => {
      const conds = [];
      for (const [key, f] of Object.entries(state)) {
        if (f.kind === 'select' && f.value) conds.push({ key, op: 'eq', value: f.value });
        if (f.kind === 'number' && f.op && f.value !== '') {
          const n = Number(String(f.value).replace(',', '.'));
          if (!Number.isNaN(n)) conds.push({ key, op: f.op, value: n });
        }
      }
      const rows = filterRows(t.table.rows, conds);
      host.replaceChildren(sheet(t.table, { mode: 'view', rows }));
      info.textContent = conds.length ? `Filtr je zapnutý (podmínek: ${conds.length}).` : 'Filtr je vypnutý – vidíš všechny knihy.';
      S.answer = { ...S.answer, visibleIds: rows.map(r => r.id) };
    };
    const controls = [];
    for (const c of t.table.columns.filter(c => c.filter)) {
      const id = nextId('f');
      if (c.filter === 'select') {
        state[c.key] = { kind: 'select', value: '' };
        const values = [...new Set(t.table.rows.map(r => r[c.key]))].sort((a, b) => a.localeCompare(b, 'cs'));
        const sel = el('select', { id }, el('option', { value: '', text: '(vše)' }), values.map(v => el('option', { value: v, text: v })));
        sel.addEventListener('change', () => { state[c.key].value = sel.value; apply(); });
        controls.push(el('div', { class: 'field' }, el('label', { for: id, text: c.label }), sel));
      } else {
        state[c.key] = { kind: 'number', op: '', value: '' };
        const opSel = el('select', { id, 'aria-label': `${c.label} – podmínka` }, el('option', { value: '', text: '(bez podmínky)' }),
          Object.entries(OPS).map(([k, o]) => el('option', { value: k, text: o.label })));
        const val = el('input', { type: 'text', inputmode: 'numeric', class: 'num-input num-input--sm', 'aria-label': `${c.label} – hodnota`, autocomplete: 'off' });
        opSel.addEventListener('change', () => { state[c.key].op = opSel.value; apply(); });
        val.addEventListener('input', () => { state[c.key].value = val.value.trim(); apply(); });
        controls.push(el('div', { class: 'field' }, el('label', { for: id, text: c.label }), el('div', { class: 'inline' }, opSel, val)));
      }
    }
    desk.append(el('div', { class: 'toolbar', role: 'group', 'aria-label': 'Nástroj Filtr' }, controls, info), host);
    apply();
    ui.append(numberField('Kolik knih zůstalo po filtrování?', v => { S.answer = { ...S.answer, count: v }; }));
  },
  edit(t, desk, ui) {
    desk.append(sheet(t.table, { mode: 'view', rows: t.table.rows.map(r => (r.id === t.editRowId ? { ...r, [t.editKey]: null } : r)), edit: { rowId: t.editRowId, key: t.editKey, onInput: v => { S.answer = { ...S.answer, value: v }; } } }));
    ui.append(choiceGroup(t.question, t.options, id => { S.answer = { ...S.answer, option: id }; }));
  },
  bar(t, desk, ui) {
    const host = el('div');
    const draw = sel => host.replaceChildren(chart(t.chart, { selected: sel, onPick: i => { S.answer = { index: i }; draw(i); $('sel-info').textContent = `Vybraný sloupec: ${t.chart.labels[i]}`; host.querySelectorAll('.cbar')[i].focus(); } }));
    desk.append(el('div', { class: 'split' }, sheet(t.table, { mode: 'view' }), host));
    draw(null);
    ui.append(el('p', { class: 'sel-info', id: 'sel-info', text: 'Klikni na sloupec v grafu (nebo na něj přejdi klávesou Tab a stiskni Enter).' }));
  },
  axis(t, desk, ui) {
    const host = el('div');
    const draw = m => host.replaceChildren(chart({ ...t.chart, axisMin: m }));
    desk.append(host);
    draw(t.chart.axisMin);
    S.answer = { axisMin: t.chart.axisMin };
    const fs = choiceGroup('Osa Y začíná na:', t.axisOptions.map(v => ({ id: String(v), label: String(v) })), id => { S.answer = { axisMin: Number(id) }; draw(Number(id)); });
    fs.classList.add('choices--row');
    fs.querySelector(`input[value="${t.chart.axisMin}"]`).checked = true;
    ui.append(fs);
  },
  compare(t, desk, ui) {
    desk.append(sheet(t.table, { mode: 'view' }));
    const name = nextId('cmp');
    const pair = el('fieldset', { class: 'pair' }, el('legend', { text: 'Který graf klame?' }));
    for (const k of ['A', 'B']) {
      const input = el('input', { type: 'radio', name, value: k });
      input.addEventListener('change', () => { S.answer = { ...S.answer, chart: k }; });
      pair.append(el('label', { class: 'pair__opt' }, el('span', { class: 'pair__head' }, input, ` Graf ${k} klame`), chart(t.charts[k])));
    }
    desk.append(pair);
    ui.append(choiceGroup('Proč klame?', t.reasons, id => { S.answer = { ...S.answer, reason: id }; }));
  }
};

/* ================= Nápověda, kontrola, další ================= */

function showHint() {
  const t = S.task;
  if (S.hintsShown >= t.hints.length) return;
  const text = t.hints[S.hintsShown++];
  if (!S.tutorial) S.totalHints++;
  $('hints').append(el('p', { class: 'hint' }, el('b', { text: `Nápověda ${S.hintsShown}: ` }), text));
  if (S.hintsShown >= t.hints.length) { $('btn-hint').disabled = true; $('btn-hint').lastChild.textContent = ' Další nápověda není'; }
  updateHud();
}

function feedback(ok, msg) {
  const fb = $('feedback');
  fb.className = 'feedback ' + (ok ? 'is-good' : 'is-bad');
  fb.replaceChildren(el('span', { class: 'feedback__icon', 'aria-hidden': 'true', text: ok ? '✓' : '!' }),
    el('span', {}, el('b', { text: ok ? 'Správně. ' : 'Ještě ne. ' }), msg));
}

function check() {
  if (S.done) return;
  const t = S.task;
  const res = checkAnswer(t, S.answer);
  S.attempts++;
  feedback(res.ok, res.msg);
  if (res.ok) {
    finishTask(true);
  } else if (S.attempts >= 2 && !S.tutorial) {
    $('after').hidden = false;
    $('btn-reveal').hidden = false;
  }
}

function reveal() {
  if (S.done) return;
  S.revealed = true;
  const fb = $('feedback');
  fb.className = 'feedback is-solution';
  fb.replaceChildren(el('span', { class: 'feedback__icon', 'aria-hidden': 'true', text: 'i' }), el('span', {}, el('b', { text: 'Řešení: ' }), S.task.solution));
  finishTask(false);
}

function finishTask(solved) {
  if (S.done) return;
  S.done = true;
  $('desk').inert = true;
  $('answer-ui').inert = true;
  $('btn-check').disabled = true;
  $('btn-hint').disabled = true;
  $('after').hidden = false;
  $('btn-reveal').hidden = true;
  $('btn-next').hidden = false;
  if (S.tutorial) {
    $('btn-next').textContent = 'Spustit misi →';
    store.tutorialDone = true; saveStore();
  } else {
    S.results.push({ id: S.task.id, skill: S.task.skill, solved, revealed: S.revealed, firstTry: solved && S.attempts === 1, hints: S.hintsShown });
    $('btn-next').textContent = S.i + 1 >= S.tasks.length ? 'Uzavřít případ →' : 'Další úkol →';
  }
  $('btn-next').focus();
}

function next() {
  if (S.tutorial) { S.tutorial = false; S.i = 0; openLevelOrTask(); return; }
  S.i++;
  if (S.i >= S.tasks.length) return finishGame();
  openLevelOrTask();
}

function finishGame() {
  clearInterval(S.tick);
  const sum = summarize(S.results);
  const timeMs = S.timer ? Date.now() - S.startedAt : null;
  const rec = { firstTry: sum.firstTry, solved: sum.solved, total: sum.total, hints: sum.hints, timeMs, date: new Date().toISOString().slice(0, 10) };
  const prev = store.best[S.mode];
  const better = isBetter(rec, prev);
  if (better) { store.best[S.mode] = rec; saveStore(); }

  $('end-lead').textContent = `${MODES[S.mode].label}, varianta ${S.variant === 'N' ? 'náhodná' : S.variant}. ${sum.firstTry === sum.total ? 'Všechno napoprvé – skvělá detektivní práce!' : 'Každá chyba byla stopa, která tě dovedla k řešení.'}`;
  const stats = $('end-stats');
  stats.replaceChildren();
  const stat = (k, v) => stats.append(el('div', { class: 'stat' }, el('dt', { text: k }), el('dd', { text: v })));
  stat('Vyřešeno napoprvé', `${sum.firstTry} z ${sum.total}`);
  stat('Vyřešeno celkem', `${sum.solved} z ${sum.total}`);
  stat('Použité nápovědy', String(sum.hints));
  if (timeMs != null) stat('Čas', fmtTime(timeMs));

  const ul = $('end-skills');
  ul.replaceChildren();
  for (const [k, text] of Object.entries(SKILLS)) {
    const s = sum.skills[k];
    if (!s) continue;
    const ok = s.solved === s.total;
    ul.append(el('li', { class: ok ? 'is-ok' : 'is-todo' },
      el('span', { class: 'skills__mark', 'aria-hidden': 'true', text: ok ? '✓' : '↻' }),
      el('span', {}, text, el('small', { text: ok ? ' Zvládnuto.' : ` Procvič ještě (${s.solved} z ${s.total}).` }))));
  }
  const rn = $('end-record');
  rn.hidden = !(better && prev);
  rn.textContent = 'Nový osobní rekord v tomto režimu!';
  $('progress').value = $('progress').max;
  showScreen('s-end');
  $('end-h').focus();
}

/* ---------- Klávesové zkratky jen pro aktivní hru ---------- */
function onKey(e) {
  if ($('s-play').hidden) return;
  // Ctrl/⌘ + Z vrací řazení (jen v úloze s řazením, mimo textová pole)
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ') && S.task?.type === 'sort' && !S.done) {
    if (/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName) && document.activeElement.type === 'text') return;
    e.preventDefault();
    S.undo?.();
  }
}

initTitle();
