/* Grafový navigátor – UI. Průběh podle docs/GAME_DESIGN_SYSTEM.md:
   titulní obrazovka → ukázka → úrovně (s úvodem) → závěr. Úlohy a vyhodnocení jsou v logic.js
   (deterministické, testované). Každý typ úlohy má vlastní „nástroj“ s metodami get/set/lock.
   Text vkládáme jen přes textContent, žádné eval, localStorage jen pod vlastním klíčem. */
import * as L from './logic.js';

const STORE_KEY = 'vyukovy-portal:grafovy-navigator:v1';
const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let uid = 0;

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
/** SVG prvek jako tlačítko: Enter i mezerník, role a popisek pro čtečky. */
function svgButton(g, label, onClick) {
  g.setAttribute('role', 'button');
  g.setAttribute('tabindex', '0');
  g.setAttribute('aria-label', label);
  g.addEventListener('click', onClick);
  g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } });
}

/* ================= Úložiště ================= */
function load() {
  try { const d = JSON.parse(localStorage.getItem(STORE_KEY)); return d && typeof d === 'object' ? d : {}; } catch { return {}; }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* hraje se dál */ } }
let store = load();

/* ================= Stav a průběh ================= */
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

function start(withTutorial) {
  S.mode = document.querySelector('input[name="mode"]:checked').value;
  S.variant = document.querySelector('input[name="variant"]:checked').value;
  S.tasks = L.buildGame(S.variant, S.mode);
  S.i = 0; S.results = []; S.totalHints = 0; S.level = -1; S.start = Date.now();
  $('hint-count').textContent = '0';
  clearInterval(S.tick);
  $('timer').hidden = !$('opt-timer').checked;
  if ($('opt-timer').checked) {
    $('timer').querySelector('b').textContent = '0:00';
    S.tick = setInterval(() => { $('timer').querySelector('b').textContent = fmt(Date.now() - S.start); }, 1000);
  }
  buildNet($('photo'), S.tasks.length);
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
    $('intro-count').textContent = `${L.plural(count, 'úloha', 'úlohy', 'úloh')} · varianta ${S.variant}`;
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
  if (S.tutorial) $('hints').append(el('p', { class: 'hint hint--tour' }, el('b', { text: 'Jak to funguje: ' }), 'Pracuj s mapou pod zadáním, pak stiskni Zkontrolovat. Když si nevíš rady, vezmi si nápovědu – výsledek nesnižuje. Po dvou pokusech můžeš zobrazit řešení.'));
  setFeedback(null);
  $('btn-reveal').hidden = true; $('btn-next').hidden = true;
  $('btn-check').disabled = false; $('btn-hint').disabled = false;
  $('btn-hint').textContent = '🔍 Nápověda';
  $('progress').max = S.tasks.length; $('progress').value = S.tutorial ? 0 : S.i;
  $('photo-note').textContent = S.tutorial ? 'Za každou vyřešenou úlohu se rozsvítí další základna.' : `Svítí ${S.results.length} z ${S.tasks.length} základen.`;
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
    lightNet($('photo'), S.i, revealed);
    $('photo-note').textContent = `Svítí ${S.results.length} z ${S.tasks.length} základen.`;
    $('progress').value = S.i + 1;
  }
  $('btn-next').textContent = S.tutorial ? 'Spustit misi →' : S.i + 1 >= S.tasks.length ? 'Dokončit misi →' : 'Další úkol →';
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
  $('result').textContent = `Vyřešil(a) jsi ${solved} z ${total} úloh, ${firstTry} napoprvé.` + (isNew && firstTry > 0 ? ' To je tvůj nový osobní rekord!' : '');
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
  buildNet($('photo-end'), S.tasks.length);
  S.results.forEach((r, i) => lightNet($('photo-end'), i, r.revealed));
  show('s-end');
  $('end-h').focus();
  renderBest();
}

/* ================= Síť základen (odměna) ================= */
const NET_POS = [[40, 120], [95, 60], [150, 130], [205, 50], [255, 115], [310, 40], [330, 140], [385, 85], [430, 150], [470, 60], [520, 115]];
function buildNet(box, n) {
  const pos = NET_POS.slice(0, n).map(([x, y], i) => (n <= 5 ? [60 + i * 105, i % 2 ? 60 : 130] : [x, y]));
  const links = pos.slice(1).map(([x, y], i) => svg('line', { x1: pos[i][0], y1: pos[i][1], x2: x, y2: y, class: 'net__link', 'data-i': String(i + 1) }));
  const nodes = pos.map(([x, y], i) => svg('g', { class: 'net__node', 'data-i': String(i), transform: `translate(${x} ${y})` },
    svg('circle', { r: 16, class: 'net__halo' }), svg('circle', { r: 9, class: 'net__core' })));
  const stars = Array.from({ length: 22 }, (_, i) => svg('circle', { cx: (i * 97) % 560, cy: (i * 53) % 190, r: i % 3 ? 1 : 1.6, class: 'net__star' }));
  box.replaceChildren(svg('svg', { viewBox: '0 0 560 190', class: 'scene', 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMid meet' }, stars, links, nodes));
  box.dataset.total = String(n);
  box.setAttribute('aria-label', `Síť základen: svítí 0 z ${n}.`);
}
function lightNet(box, i, dim = false) {
  const node = box.querySelector(`.net__node[data-i="${i}"]`);
  node?.classList.add('is-on');
  if (dim) node?.classList.add('is-dim');
  const prev = box.querySelector(`.net__node[data-i="${i - 1}"]`);
  if (prev?.classList.contains('is-on')) box.querySelector(`.net__link[data-i="${i}"]`)?.classList.add('is-on');
  const nxt = box.querySelector(`.net__node[data-i="${i + 1}"]`);
  if (nxt?.classList.contains('is-on')) box.querySelector(`.net__link[data-i="${i + 1}"]`)?.classList.add('is-on');
  const on = box.querySelectorAll('.net__node.is-on').length;
  box.setAttribute('aria-label', `Síť základen: svítí ${on} z ${box.dataset.total}.`);
}

/* ================= Kreslení grafu ================= */
const R = 20;
/** Úsečka (nebo oblouk, když vede i opačná šipka) mezi uzly, zkrácená o poloměr uzlu. */
function edgeGeometry(p, q, curved) {
  const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const off = curved ? 22 : 0;
  const mx = (p.x + q.x) / 2 - uy * off, my = (p.y + q.y) / 2 + ux * off;
  const sx = p.x + ux * R, sy = p.y + uy * R, ex = q.x - ux * (R + 3), ey = q.y - uy * (R + 3);
  const d = curved ? `M${sx} ${sy} Q${mx * 2 - (sx + ex) / 2} ${my * 2 - (sy + ey) / 2} ${ex} ${ey}` : `M${sx} ${sy} L${ex} ${ey}`;
  // klikací plocha: obdélník 24 px kolem úsečky (i vodorovná/svislá čára má nenulový rozměr)
  const hx = -uy * 12, hy = ux * 12;
  const hit = `M${sx + hx} ${sy + hy} L${ex + hx} ${ey + hy} L${ex - hx} ${ey - hy} L${sx - hx} ${sy - hy} Z`;
  return { d, mx, my, hit };
}

/**
 * Vykreslí graf. opts: nodeLabel(id), onNode(id), onEdge(key), edgeLabel(e).
 * Vrací { svg, nodes: Map(id → g), edges: Map(key → g) }.
 */
function graphView(g, opts = {}) {
  const mid = `arrow${++uid}`;
  const pos = Object.fromEntries(g.nodes.map(n => [n.id, n]));
  const edges = new Map(), nodes = new Map();
  const eLayer = svg('g', { class: 'g-edges' });
  const lLayer = svg('g', { class: 'g-labels' });
  for (const e of g.edges) {
    const key = L.edgeKey(e.a, e.b);
    const geo = edgeGeometry(pos[e.a], pos[e.b], false);
    const grp = svg('g', { class: 'g-edge' + (e.dir ? ' is-dir' : '') },
      svg('path', { d: geo.hit, class: 'g-edge__hit' }),
      svg('path', { d: geo.d, class: 'g-edge__line', 'marker-end': e.dir ? `url(#${mid})` : null }));
    if (opts.onEdge) svgButton(grp, `Kabel ${e.a}–${e.b}, cena ${e.w}`, () => opts.onEdge(key));
    eLayer.append(grp);
    edges.set(key, grp);
    if (e.w != null) lLayer.append(svg('g', { class: 'g-weight', transform: `translate(${geo.mx} ${geo.my})` }, svg('circle', { r: 11 }), svg('text', { y: 4.5, 'text-anchor': 'middle', text: String(e.w) })));
  }
  const nLayer = svg('g', { class: 'g-nodes' });
  for (const n of g.nodes) {
    const grp = svg('g', { class: 'g-node', transform: `translate(${n.x} ${n.y})`, 'data-id': n.id },
      svg('circle', { r: R + 6, class: 'g-node__ring' }), svg('circle', { r: R, class: 'g-node__dot' }), svg('text', { y: 6, 'text-anchor': 'middle', text: n.id }));
    if (opts.onNode) svgButton(grp, opts.nodeLabel ? opts.nodeLabel(n.id) : `Základna ${n.id}`, () => opts.onNode(n.id));
    nLayer.append(grp);
    nodes.set(n.id, grp);
  }
  const [w, h] = g.view;
  const root = svg('svg', { viewBox: `0 0 ${w} ${h}`, class: 'graph', role: 'group', 'aria-label': opts.label || 'Mapa základen' },
    svg('defs', {}, svg('marker', { id: mid, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 16, markerHeight: 16, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', class: 'g-arrow' }))),
    eLayer, lLayer, nLayer);
  return { svg: root, nodes, edges };
}

/** Textový popis grafu pro čtečky (seznam cest). */
function graphText(g) {
  const parts = g.edges.map(e => `${e.a}${e.dir ? ' → ' : ' – '}${e.b}${e.w != null ? ` (${e.w})` : ''}`);
  return el('p', { class: 'sr-only', text: `Cesty v mapě: ${parts.join(', ')}.` });
}
const statusLine = () => el('p', { class: 'status', 'aria-live': 'polite' });

/* ================= Nástroje úloh ================= */
const TOOLS = {
  pick(t) {
    const sel = new Set();
    const st = statusLine();
    const view = graphView(t.graph, {
      label: 'Mapa základen – klikni na základny',
      nodeLabel: id => (id === t.focusNode ? `Základna ${id} (zadaná)` : `Základna ${id}`),
      onNode: id => { if (id === t.focusNode || locked) return; sel.has(id) ? sel.delete(id) : sel.add(id); upd(); }
    });
    let locked = false;
    view.nodes.get(t.focusNode).classList.add('is-focus');
    view.nodes.get(t.focusNode).setAttribute('aria-disabled', 'true');
    const upd = () => {
      for (const [id, n] of view.nodes) { if (id === t.focusNode) continue; n.classList.toggle('is-picked', sel.has(id)); n.setAttribute('aria-pressed', String(sel.has(id))); }
      st.textContent = sel.size ? `Označeno: ${[...sel].sort().join(', ')}` : 'Zatím nic neoznačeno.';
    };
    upd();
    return {
      node: el('div', { class: 'tool-graph' }, el('div', { class: 'graph-wrap' }, view.svg), graphText(t.graph), st),
      get: () => ({ nodes: [...sel] }), set: a => { sel.clear(); a.nodes.forEach(x => sel.add(x)); upd(); },
      lock: () => { locked = true; view.svg.classList.add('is-locked'); }
    };
  },

  path(t) {
    let path = [t.from];
    let locked = false;
    const st = statusLine();
    const meter = t.budget ? el('div', { class: 'energy', 'aria-hidden': 'true' }, el('span')) : null;
    const view = graphView(t.graph, {
      label: 'Mapa základen – klikni na další zastávku',
      onNode: id => {
        if (locked) return;
        const last = path.at(-1);
        if (path.length > 1 && id === path.at(-2)) path.pop();
        else if (id === last) return;
        else if (path.includes(id)) { st.textContent = `Základnou ${id} už trasa vede.`; return; }
        else if (!L.findEdge(t.graph, last, id)) { st.textContent = `Ze ${last} do ${id} ${t.graph.edges.some(e => e.dir) ? 'nevede šipka' : 'nevede přímá cesta'}.`; return; }
        else path.push(id);
        upd();
      }
    });
    const rover = svg('g', { class: 'rover' }, svg('rect', { x: -11, y: -9, width: 22, height: 18, rx: 6 }), svg('rect', { x: -6, y: -4, width: 12, height: 6, rx: 2, class: 'rover__face' }));
    view.svg.append(rover);
    const pos = Object.fromEntries(t.graph.nodes.map(n => [n.id, n]));
    view.nodes.get(t.to).classList.add('is-goal');
    view.nodes.get(t.from).classList.add('is-start');
    const upd = () => {
      const keys = new Set(path.slice(1).map((id, i) => L.edgeKey(path[i], id)));
      for (const [k, e] of view.edges) e.classList.toggle('is-route', keys.has(k));
      for (const [id, n] of view.nodes) {
        n.classList.toggle('is-route', path.includes(id));
        n.classList.toggle('is-next', !locked && !path.includes(id) && !!L.findEdge(t.graph, path.at(-1), id));
      }
      const last = pos[path.at(-1)];
      rover.style.transform = `translate(${last.x}px, ${last.y - 32}px)`;
      const info = L.pathInfo(t.graph, path, t.weighted);
      const what = t.weighted ? `spotřeba ${info.cost}` : L.plural(path.length - 1, 'úsek', 'úseky', 'úseků');
      st.textContent = `Trasa: ${path.join(' → ')} · ${what}${t.budget ? ` · zbývá energie ${t.budget - info.cost}` : ''}`;
      if (meter) {
        meter.firstChild.style.width = `${Math.max(0, Math.min(1, (t.budget - info.cost) / t.budget)) * 100}%`;
        meter.classList.toggle('is-empty', info.cost > t.budget);
      }
      back.disabled = locked || path.length < 2; clear.disabled = back.disabled;
    };
    const back = el('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => { if (path.length > 1) { path.pop(); upd(); } } }, '↶ Krok zpět');
    const clear = el('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: () => { path = [t.from]; upd(); } }, 'Smazat trasu');
    upd();
    return {
      node: el('div', { class: 'tool-graph' }, el('div', { class: 'graph-wrap' }, view.svg), graphText(t.graph), meter, st, el('div', { class: 'row row--tight' }, back, clear)),
      get: () => ({ path: [...path] }), set: a => { path = [...a.path]; upd(); },
      lock: () => { locked = true; view.svg.classList.add('is-locked'); upd(); }
    };
  },

  network(t) {
    const on = new Set();
    let locked = false;
    const st = statusLine();
    const view = graphView(t.graph, {
      label: 'Mapa základen – klikni na kabely',
      onEdge: k => { if (locked) return; on.has(k) ? on.delete(k) : on.add(k); upd(); }
    });
    const upd = () => {
      for (const [k, e] of view.edges) { e.classList.toggle('is-built', on.has(k)); e.setAttribute('aria-pressed', String(on.has(k))); }
      const info = L.networkInfo(t.graph, [...on]);
      const linked = new Set(info.edges.flatMap(e => [e.a, e.b]));
      for (const [id, n] of view.nodes) n.classList.toggle('is-linked', linked.has(id));
      const big = Math.max(...info.groups.map(g => g.length));
      st.textContent = `Kabelů: ${info.edges.length} · cena ${info.cost} · propojeno ${big} z ${t.graph.nodes.length} základen${info.cycle ? ' · pozor, okruh!' : ''}`;
    };
    upd();
    return {
      node: el('div', { class: 'tool-graph' }, el('div', { class: 'graph-wrap' }, view.svg), graphText(t.graph), st),
      get: () => ({ edges: [...on] }), set: a => { on.clear(); a.edges.forEach(k => on.add(k)); upd(); },
      lock: () => { locked = true; view.svg.classList.add('is-locked'); }
    };
  },

  automat(t) {
    const a = t.automaton;
    let pick = null, locked = false;
    const mid = `arrow${++uid}`;
    const pos = Object.fromEntries(a.states.map(s => [s.id, s]));
    const W = 120, H = 52;
    const layer = svg('g');
    for (const tr of a.transitions) {
      const p = pos[tr.from], q = pos[tr.to];
      const dir = q.x > p.x ? 1 : -1;
      const y = p.y + (dir > 0 ? -16 : 16);
      const x1 = p.x + dir * W / 2, x2 = q.x - dir * (W / 2 + 4);
      const bend = dir > 0 ? -34 : 34;
      layer.append(svg('path', { d: `M${x1} ${y} Q${(x1 + x2) / 2} ${y + bend} ${x2} ${y}`, class: 'a-arrow', 'marker-end': `url(#${mid})` }),
        svg('text', { x: (x1 + x2) / 2, y: y + bend / 2 + (dir > 0 ? -6 : 14), 'text-anchor': 'middle', class: 'a-label', text: tr.input }));
    }
    const sts = new Map();
    for (const s of a.states) {
      const g = svg('g', { class: 'a-state' + (s.id === a.start ? ' is-start' : ''), transform: `translate(${s.x} ${s.y})` },
        svg('rect', { x: -W / 2, y: -H / 2, width: W, height: H, rx: 16 }), svg('text', { y: 6, 'text-anchor': 'middle', text: s.name }));
      svgButton(g, `Stav ${s.name}`, () => { if (!locked) { pick = s.id; upd(); } });
      sts.set(s.id, g);
    }
    const startArrow = svg('path', { d: `M${pos[a.start].x} ${pos[a.start].y + 62} V${pos[a.start].y + H / 2 + 4}`, class: 'a-arrow a-arrow--start', 'marker-end': `url(#${mid})` });
    const pic = svg('svg', { viewBox: `0 0 ${a.view[0]} ${a.view[1] + 10}`, class: 'automat', role: 'group', 'aria-label': 'Automat dveří – klikni na konečný stav' },
      svg('defs', {}, svg('marker', { id: mid, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 14, markerHeight: 14, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' }, svg('path', { d: 'M0 0 L10 5 L0 10 z', class: 'g-arrow' }))),
      layer, startArrow, svg('text', { x: pos[a.start].x + 8, y: pos[a.start].y + 66, class: 'a-label', text: 'start' }), [...sts.values()]);
    const st = statusLine();
    const upd = () => {
      for (const [id, g] of sts) { g.classList.toggle('is-picked', pick === id); g.setAttribute('aria-pressed', String(pick === id)); }
      st.textContent = pick ? `Tvoje odpověď: ${L.stateName(a, pick)}` : 'Klikni na stav, ve kterém dveře skončí.';
    };
    upd();
    const desc = el('p', { class: 'sr-only', text: 'Přechody: ' + a.transitions.map(tr => `ze stavu ${L.stateName(a, tr.from)} vstup ${tr.input} vede do stavu ${L.stateName(a, tr.to)}`).join('; ') + '.' });
    return {
      node: el('div', { class: 'tool-graph' },
        el('ol', { class: 'inputs', 'aria-label': 'Vstupy v pořadí' }, t.inputs.map(x => el('li', { text: x }))),
        el('div', { class: 'graph-wrap' }, pic), desc, st),
      get: () => ({ state: pick }), set: v => { pick = v.state; upd(); },
      lock: () => { locked = true; pic.classList.add('is-locked'); }
    };
  },

  schedule(t) {
    const sch = L.defaultSchedule(t.jobs);
    let locked = false;
    const maxT = Math.max(t.jobs.reduce((s, j) => s + j.d, 0) + 1, 12);
    const PX = 40, LX = 74, LH = 46;
    const gantt = svg('svg', { viewBox: `0 0 ${LX + maxT * PX + 10} ${2 * LH + 40}`, class: 'gantt', 'aria-hidden': 'true' });
    const st = statusLine();
    const cards = new Map();
    const COLORS = ['#6d45e0', '#0e7c70', '#b8480f', '#1d5fd6', '#a1307a', '#4d6a12'];
    const draw = () => {
      const info = L.scheduleInfo(t.jobs, sch);
      const bad = new Set(info.problems.flatMap(p => [p.job?.id, p.other?.id].filter(Boolean)));
      const parts = [];
      for (let h = 0; h <= maxT; h++) parts.push(svg('path', { d: `M${LX + h * PX} 8V${8 + 2 * LH}`, class: 'gantt__tick' }), svg('text', { x: LX + h * PX, y: 2 * LH + 26, 'text-anchor': 'middle', class: 'gantt__num', text: String(h) }));
      L.LANES.forEach((lane, i) => parts.push(svg('rect', { x: LX, y: 8 + i * LH, width: maxT * PX, height: LH - 6, rx: 8, class: 'gantt__lane' }), svg('text', { x: 6, y: 8 + i * LH + 26, class: 'gantt__name', text: `Robot ${lane}` })));
      parts.push(svg('path', { d: `M${LX + t.best * PX} 2V${14 + 2 * LH}`, class: 'gantt__goal' }), svg('text', { x: LX + t.best * PX + 4, y: 2 * LH + 38, class: 'gantt__goal-t', text: `cíl ${t.best} h` }));
      t.jobs.forEach((j, k) => {
        const s = sch[j.id];
        const li = L.LANES.indexOf(s.lane);
        parts.push(svg('g', { class: 'gantt__bar' + (bad.has(j.id) ? ' is-bad' : ''), transform: `translate(${LX + s.start * PX} ${8 + li * LH + 3})` },
          svg('rect', { width: j.d * PX - 3, height: LH - 12, rx: 7, fill: COLORS[k % COLORS.length] }),
          svg('text', { x: 6, y: (LH - 12) / 2 + 5, text: j.short })));
      });
      gantt.replaceChildren(...parts);
      st.textContent = `Hotovo za ${info.end} h${info.problems.length ? ' · v plánu je problém (červeně)' : info.end <= t.best ? ' · splněno!' : ` · cíl ${t.best} h`}`;
      for (const [id, c] of cards) { c.out.textContent = `${sch[id].start} h`; c.card.classList.toggle('is-bad', bad.has(id)); c.minus.disabled = locked || sch[id].start <= 0; c.plus.disabled = locked || sch[id].start >= maxT - 1; c.radios.forEach(r => { r.checked = r.value === sch[id].lane; r.disabled = locked; }); }
    };
    const list = el('ul', { class: 'jobs' });
    t.jobs.forEach((j, k) => {
      const out = el('output', { class: 'job__start', 'aria-live': 'polite' });
      const minus = el('button', { type: 'button', class: 'btn btn--ghost btn--round btn--tiny', 'aria-label': `${j.name}: začít o hodinu dřív`, onclick: () => { sch[j.id].start = Math.max(0, sch[j.id].start - 1); draw(); } }, '−');
      const plus = el('button', { type: 'button', class: 'btn btn--ghost btn--round btn--tiny', 'aria-label': `${j.name}: začít o hodinu později`, onclick: () => { sch[j.id].start += 1; draw(); } }, '+');
      const fs = el('fieldset', { class: 'seg seg--lane' }, el('legend', { class: 'sr-only', text: `${j.name}: robot` }));
      const radios = L.LANES.map(lane => {
        const r = el('input', { type: 'radio', name: `lane-${j.id}`, value: lane });
        r.addEventListener('change', () => { sch[j.id].lane = lane; draw(); });
        fs.append(el('label', {}, r, el('span', { text: `Robot ${lane}` })));
        return r;
      });
      const card = el('li', { class: 'job' },
        el('span', { class: 'job__swatch', 'aria-hidden': 'true', style: `background:${COLORS[k % COLORS.length]}` }),
        el('div', { class: 'job__info' }, el('b', { text: j.name }), el('span', { class: 'small muted', text: `${j.d} h` + (j.deps.length ? ` · až po: ${j.deps.map(d => t.jobs.find(x => x.id === d).name.toLowerCase()).join(', ')}` : ' · může začít hned') })),
        fs,
        el('div', { class: 'job__time' }, el('span', { class: 'small', text: 'začátek' }), minus, out, plus));
      cards.set(j.id, { card, out, minus, plus, radios });
      list.append(card);
    });
    draw();
    return {
      node: el('div', { class: 'tool-plan' }, el('div', { class: 'gantt-wrap' }, gantt), st, list),
      get: () => ({ schedule: structuredClone(sch) }),
      set: a => { for (const [id, v] of Object.entries(a.schedule)) sch[id] = { ...v }; draw(); },
      lock: () => { locked = true; draw(); }
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
    el('p', { class: 'warn', text: 'Opravdu smazat výsledky Grafového navigátoru v tomto prohlížeči? Ostatní hry zůstanou beze změny.' }),
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

/* ================= Návrat do menu hry =================
   Tlačítko v liště během hry. Když už je něco vyřešené, nejdřív se zeptá (rozehraná mise se neukládá). */
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
