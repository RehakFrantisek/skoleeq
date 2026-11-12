/* Robotí dílna – UI: přehled misí, editor bloků, mapa, běh/krokování, vyhodnocení.
   Simulace a vyhodnocení jsou v engine.js (deterministické, testované). Animace jen zobrazuje
   události interpretu – logika na časování nezávisí. Žádné eval, text přes textContent. */
import * as E from './engine.js';
import { MISSIONS, CHAPTERS } from './missions.js';

const STORE_KEY = 'vyukovy-portal:roboti-dilna:v1';
const SVG_NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const MAX_BLOCKS = 40;
const SPEEDS = [0, 800, 500, 280, 140, 50];
const SPEED_LABELS = ['', 'velmi pomalu', 'pomalu', 'střední', 'rychle', 'velmi rychle'];
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
function loadStore() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    return d && typeof d === 'object' && d.missions ? d : { missions: {}, unlockAll: false };
  } catch { return { missions: {}, unlockAll: false }; }
}
function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* hraje se dál */ } }
let store = loadStore();

/* ================= Stav ================= */
let uid = 0;
const newId = () => `b${++uid}`;
const S = {
  mission: null, program: [], insert: { key: 'root', index: 0 }, selected: null,
  variant: 0, map: null, run: null, timer: null, hints: 0, resets: 0, completed: false, log: []
};

/** Program z dat mise dostane nová id, aby se dal upravovat. */
function cloneProgram(nodes) {
  return nodes.map(n => {
    const c = { id: newId(), op: n.op };
    if (n.op === 'repeat') { c.n = n.n; c.body = cloneProgram(n.body); }
    if (n.op === 'if') { c.cond = n.cond; c.then = cloneProgram(n.then); c.else = cloneProgram(n.else || []); }
    return c;
  });
}

/** Najde pole (kontejner) podle klíče: root | <id>:body | <id>:then | <id>:else */
function container(key) {
  if (key === 'root') return S.program;
  const [id, slot] = key.split(':');
  const n = findNode(id);
  return n ? n[slot] : null;
}
function findNode(id, nodes = S.program) {
  for (const n of nodes) {
    if (n.id === id) return n;
    const kids = n.op === 'repeat' ? [n.body] : n.op === 'if' ? [n.then, n.else] : [];
    for (const k of kids) { const f = findNode(id, k); if (f) return f; }
  }
  return null;
}
/** Kontejner a index, ve kterém uzel leží. */
function locate(id, nodes = S.program, key = 'root') {
  const i = nodes.findIndex(n => n.id === id);
  if (i >= 0) return { key, list: nodes, index: i };
  for (const n of nodes) {
    const slots = n.op === 'repeat' ? ['body'] : n.op === 'if' ? ['then', 'else'] : [];
    for (const s of slots) { const r = locate(id, n[s], `${n.id}:${s}`); if (r) return r; }
  }
  return null;
}
function depthOfKey(key) {
  let d = 0;
  while (key !== 'root') {
    d++;
    const id = key.split(':')[0];
    key = locate(id).key;
  }
  return d;
}

/* ================= Přehled misí ================= */
const isUnlocked = i => store.unlockAll || new URLSearchParams(location.search).has('vse') || i === 0 || !!store.missions[MISSIONS[i - 1].id]?.done;

function renderHome() {
  const box = $('mission-groups');
  box.replaceChildren();
  for (const [ch, label] of Object.entries(CHAPTERS)) {
    const list = el('ol', { class: 'missions' });
    MISSIONS.forEach((m, i) => {
      if (String(m.chapter) !== ch) return;
      const rec = store.missions[m.id];
      const open = isUnlocked(i);
      list.append(el('li', { class: 'mcard' + (rec?.done ? ' is-done' : '') + (open ? '' : ' is-locked') },
        el('span', { class: 'mcard__num', 'aria-hidden': 'true', text: String(i + 1) }),
        el('span', { class: 'mcard__body' },
          el('b', { class: 'mcard__title', text: m.title }),
          el('span', { class: 'mcard__story', text: m.task }),
          el('span', { class: 'mcard__status' },
            rec?.done ? el('span', { class: 'mcard__stars', 'aria-hidden': 'true', text: '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars) }) : null,
            ' ', rec?.done ? `Hotovo, ${rec.stars} z 3 hvězd` : open ? `Odemčeno · ${m.grades.join('., ')}. roč.` : 'Zamčeno – nejdřív dokonči předchozí misi')),
        open
          ? el('button', { class: 'btn btn--run btn--small', type: 'button', 'aria-label': `${rec?.done ? 'Zahrát znovu' : 'Spustit'} misi ${i + 1}: ${m.title}`, onclick: () => openMission(m.id) }, rec?.done ? 'Znovu' : 'Spustit')
          : el('span', { class: 'lock', 'aria-hidden': 'true', text: '🔒' })));
    });
    box.append(el('section', { class: 'group' }, el('h2', { text: label }), list));
  }
  const done = MISSIONS.filter(m => store.missions[m.id]?.done);
  const st = done.reduce((s, m) => s + store.missions[m.id].stars, 0);
  const pt = done.reduce((s, m) => s + store.missions[m.id].points, 0);
  $('progress-summary').textContent = `Dokončeno ${done.length} z ${MISSIONS.length} misí · hvězdy ${st} z ${MISSIONS.length * 3} · body ${pt}.`;
  $('hud-stars').textContent = String(st);
  $('hud-points').textContent = String(pt);
  $('opt-unlock').checked = !!store.unlockAll;
}

function showHome() {
  stopRun();
  $('s-home').hidden = false;
  $('s-mission').hidden = true;
  $('hud-mission').hidden = true;
  $('btn-overview').hidden = true;
  S.mission = null;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  renderHome();
  window.scrollTo({ top: 0 });
}

/* ================= Mise ================= */
function openMission(id) {
  const i = MISSIONS.findIndex(m => m.id === id);
  if (i < 0 || !isUnlocked(i)) return showHome();
  stopRun();
  const m = MISSIONS[i];
  S.mission = m;
  S.program = cloneProgram(m.initialProgram || []);
  S.insert = { key: 'root', index: S.program.length };
  S.selected = null;
  S.variant = 0; S.hints = 0; S.resets = 0; S.completed = false; S.log = [];
  history.replaceState(null, '', `#${m.id}`);

  $('s-home').hidden = true;
  $('s-mission').hidden = false;
  $('btn-overview').hidden = false;
  $('hud-mission').hidden = false;
  $('hud-mission').textContent = `Mise ${i + 1}/${MISSIONS.length}`;
  $('m-chapter').textContent = CHAPTERS[m.chapter].split(' – ')[1];
  $('m-num').textContent = `Mise ${i + 1} z ${MISSIONS.length}`;
  $('m-title').textContent = m.title;
  $('m-story').textContent = m.story;
  $('m-task').textContent = m.task;
  $('hints').replaceChildren();
  $('btn-hint').disabled = false;
  $('btn-hint').textContent = 'Ukázat nápovědu';
  $('results').replaceChildren(el('p', { class: 'muted small', text: m.maps.length > 1 ? `Program se ověří na všech ${m.maps.length} mapách. Na kterékoli z nich ho můžeš spustit nebo krokovat.` : 'Sestav program a stiskni Spustit, nebo ho projdi krok po kroku.' }));
  renderVariants();
  renderPalette();
  renderProgram();
  resetRun(false);
  window.scrollTo({ top: 0 });
  $('m-title').focus();
}

function renderVariants() {
  const box = $('variants');
  box.replaceChildren();
  const maps = S.mission.maps;
  box.hidden = maps.length < 2;
  maps.forEach((def, i) => box.append(el('button', {
    type: 'button', class: 'variant', 'aria-pressed': String(i === S.variant),
    onclick: () => { S.variant = i; renderVariants(); resetRun(false); }
  }, def.name || `Mapa ${i + 1}`)));
}

/* ================= Mapa ================= */
const C = 52; // velikost políčka v SVG
function drawMap() {
  const map = S.map;
  const s = $('map');
  const st = S.run?.state;
  s.replaceChildren();
  s.setAttribute('viewBox', `-22 -22 ${map.w * C + 26} ${map.h * C + 26}`);
  s.setAttribute('aria-label', mapLabel(map, st));
  // osy (čísla sloupců a řádků od 1)
  for (let x = 0; x < map.w; x++) s.append(svg('text', { x: x * C + C / 2, y: -7, class: 'axis', 'text-anchor': 'middle', text: String(x + 1) }));
  for (let y = 0; y < map.h; y++) s.append(svg('text', { x: -8, y: y * C + C / 2 + 5, class: 'axis', 'text-anchor': 'end', text: String(y + 1) }));
  const items = st ? st.items : map.items;
  const visited = new Set(st ? st.visited : []);
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const c = map.cells[y][x];
      const g = svg('g', { transform: `translate(${x * C} ${y * C})` });
      if (c === '#') {
        g.append(svg('rect', { width: C, height: C, class: 'wall' }));
        g.append(svg('path', { d: `M0 ${C / 2}h${C}M${C / 2} 0v${C / 2}M${C / 4} ${C / 2}v${C / 2}M${C * 3 / 4} ${C / 2}v${C / 2}`, class: 'wall-line' }));
      } else {
        g.append(svg('rect', { width: C, height: C, class: 'floor' + (visited.has(E.pos(x, y)) ? ' is-visited' : '') }));
        if (c === 'o') g.append(svg('path', { d: 'M10 40 L16 18 L30 10 L42 20 L44 40 Z', class: 'rock' }));
        if (c === 'G') g.append(svg('g', { class: 'goal' }, svg('rect', { x: 6, y: 6, width: C - 12, height: C - 12, rx: 6 }), svg('path', { d: 'M20 40V12l16 7-16 7' })));
        if (c === 'A') g.append(svg('g', { class: 'antenna' }, svg('path', { d: 'M26 44V22M14 44h24M16 12a14 14 0 0 1 20 0M20 17a8 8 0 0 1 12 0' }), svg('circle', { cx: 26, cy: 22, r: 3 })));
        if (c === 'K') g.append(svg('g', { class: 'check' + (visited.has(E.pos(x, y)) ? ' is-done' : '') }, svg('circle', { cx: C / 2, cy: C / 2, r: 14 }), svg('path', { d: 'M19 26l5 5 9-10' })));
        if (c === 'D') g.append(svg('g', { class: 'dock' }, svg('rect', { x: 8, y: 14, width: 36, height: 26, rx: 5 }), svg('path', { d: 'M14 14l6-8h12l6 8M18 27h16' })));
        const it = items[E.pos(x, y)];
        if (it === 'B') g.append(svg('g', { class: 'battery' }, svg('rect', { x: 16, y: 13, width: 20, height: 30, rx: 4 }), svg('rect', { x: 22, y: 9, width: 8, height: 5, rx: 1 }), svg('path', { d: 'M27 18l-5 9h7l-5 9' })));
        if (it === 'V') g.append(svg('g', { class: 'sample' }, svg('path', { d: 'M20 12h12M22 12v20a4 4 0 0 0 8 0V12' }), svg('rect', { x: 23, y: 24, width: 6, height: 10, rx: 2 })));
      }
      s.append(g);
    }
  }
  // stopa
  if (S.run?.trace?.length > 1) {
    s.append(svg('polyline', { points: S.run.trace.map(t => `${t.x * C + C / 2},${t.y * C + C / 2}`).join(' '), class: 'trail' }));
  }
  // robot
  const r = st || { x: map.start.x, y: map.start.y, dir: map.start.dir, error: null };
  const rot = { N: 0, E: 90, S: 180, W: 270 }[r.dir];
  const robot = svg('g', { class: 'robot' + (r.error ? ' is-error' : ''), transform: `translate(${r.x * C + C / 2} ${r.y * C + C / 2})` },
    svg('g', { transform: `rotate(${rot})` },
      svg('rect', { x: -15, y: -13, width: 30, height: 28, rx: 8, class: 'robot__body' }),
      svg('rect', { x: -9, y: -7, width: 18, height: 10, rx: 3, class: 'robot__face' }),
      svg('path', { d: 'M-8 -13 L0 -24 L8 -13 Z', class: 'robot__nose' }),
      svg('circle', { cx: -4, cy: -2, r: 2.2, class: 'robot__eye' }), svg('circle', { cx: 4, cy: -2, r: 2.2, class: 'robot__eye' })));
  s.append(robot);
  if (r.error?.x != null) s.append(svg('g', { class: 'crash', transform: `translate(${r.error.x * C + C / 2} ${r.error.y * C + C / 2})` }, svg('path', { d: 'M-12 -12L12 12M12 -12L-12 12' })));
}

function mapLabel(map, st) {
  const r = st || map.start;
  return `Mapa ${map.w}×${map.h}. Robot na ${E.human(r.x, r.y)}, směr ${E.DIR_LABELS[r.dir]}.` +
    (map.marks.G[0] ? ` Cíl na ${E.human(map.marks.G[0].x, map.marks.G[0].y)}.` : '') +
    (map.marks.A.length ? ` Anténa na ${map.marks.A.map(a => E.human(a.x, a.y)).join(', ')}.` : '') +
    (map.marks.D.length ? ` Dok sondy na ${E.human(map.marks.D[0].x, map.marks.D[0].y)}.` : '') +
    (Object.keys((st || map).items).length ? ` Předměty: ${Object.entries((st || map).items).map(([k, t]) => `${t === 'B' ? 'baterie' : 'vzorek'} ${E.human(...k.split(',').map(Number))}`).join(', ')}.` : '');
}

function renderLegend() {
  const marks = new Set(S.mission.maps.flatMap(m => m.rows.join('').split('')));
  const L = { G: 'G = cíl', A: 'anténa', B: 'baterie', V: 'vzorek', K: 'kontrolní bod', D: 'dok sondy', o: 'kámen (překážka)' };
  $('legend').textContent = 'Na mapě: ' + Object.entries(L).filter(([k]) => marks.has(k)).map(([, v]) => v).join(' · ') + '. Souřadnice [sloupec, řádek].';
}

/* ================= Paleta a program ================= */
const BLOCK_CLASS = { forward: 'move', left: 'turn', right: 'turn', pick: 'act', drop: 'act', repeat: 'loop', if: 'cond' };

function renderPalette() {
  const pal = $('palette');
  pal.replaceChildren();
  const depthHere = depthOfKey(S.insert.key);
  for (const op of S.mission.blocks) {
    const tooDeep = (op === 'repeat' || op === 'if') && depthHere >= E.MAX_DEPTH;
    pal.append(el('button', { type: 'button', class: `pal pal--${BLOCK_CLASS[op]}`, 'data-op': op, disabled: tooDeep || E.countBlocks(S.program) >= MAX_BLOCKS ? true : null, onclick: () => addBlock(op) },
      el('span', { 'aria-hidden': 'true', text: '+ ' }), op === 'if' ? 'Když …' : op === 'repeat' ? 'Opakuj …×' : E.OPS[op]));
  }
  renderLegend();
}

function addBlock(op) {
  const list = container(S.insert.key);
  if (!list) return;
  const n = { id: newId(), op };
  if (op === 'repeat') { n.n = 3; n.body = []; }
  if (op === 'if') { n.cond = 'wallAhead'; n.then = []; n.else = []; }
  list.splice(S.insert.index, 0, n);
  // po vložení cyklu/podmínky se vkládá dovnitř, jinak za nový blok
  S.insert = op === 'repeat' ? { key: `${n.id}:body`, index: 0 } : op === 'if' ? { key: `${n.id}:then`, index: 0 } : { key: S.insert.key, index: S.insert.index + 1 };
  S.selected = n.id;
  programChanged(`Přidán blok ${E.OPS[op]}.`);
  focusNode(n.id);
}

function programChanged(msg) {
  resetRun(false);
  renderProgram();
  renderPalette();
  if (msg) $('insert-hint').dataset.msg = msg;
}

function renderProgram() {
  const root = $('program');
  root.replaceChildren(renderList(S.program, 'root', 0));
  const n = E.countBlocks(S.program);
  const max = S.mission.requires?.maxBlocks;
  $('prog-count').textContent = `Bloků: ${n}${max ? ` (nejvýš ${max})` : ''}`;
  const where = S.insert.key === 'root' ? 'do hlavního programu' : (() => {
    const [id, slot] = S.insert.key.split(':');
    const node = findNode(id);
    return slot === 'body' ? `do bloku Opakuj ${node.n}×` : slot === 'then' ? 'do větve „pak“ bloku Když' : 'do větve „jinak“ bloku Když';
  })();
  $('insert-hint').textContent = `${$('insert-hint').dataset.msg ? $('insert-hint').dataset.msg + ' ' : ''}Nový blok se vloží ${where} na pozici ${S.insert.index + 1}.`;
  delete $('insert-hint').dataset.msg;
}

function insertMarker() {
  return el('li', { class: 'ins', 'aria-hidden': 'true' }, el('span', { text: 'sem se vloží další blok' }));
}

function renderList(nodes, key, depth) {
  const ol = el('ol', { class: 'plist' + (key === 'root' ? ' plist--root' : ''), 'data-key': key });
  nodes.forEach((n, i) => {
    if (S.insert.key === key && S.insert.index === i) ol.append(insertMarker());
    ol.append(renderNode(n, key, i, nodes.length, depth));
  });
  if (S.insert.key === key && S.insert.index === nodes.length) ol.append(insertMarker());
  ol.append(el('li', { class: 'slot-end' }, el('button', { type: 'button', class: 'slot-btn', 'aria-label': key === 'root' ? 'Vkládat na konec programu' : `Vkládat na konec této části (${key.endsWith('else') ? 'jinak' : key.endsWith('then') ? 'pak' : 'opakování'})`, onclick: () => { S.insert = { key, index: nodes.length }; renderProgram(); } }, nodes.length ? '＋ vkládat sem' : '＋ vkládat sem (prázdné)')));
  return ol;
}

function renderNode(n, key, i, len, depth) {
  const li = el('li', { class: `pn pn--${BLOCK_CLASS[n.op]}` + (S.selected === n.id ? ' is-selected' : ''), 'data-id': n.id });
  const head = el('div', { class: 'pn__head' });
  const label = n.op === 'repeat' ? 'Opakuj' : n.op === 'if' ? 'Když' : E.OPS[n.op];
  head.append(el('button', {
    type: 'button', class: 'pn__label', 'data-node': n.id, 'aria-label': `${i + 1}. ${describe(n)}. Vybrat – další blok se vloží za něj.`,
    onclick: () => { S.selected = n.id; S.insert = { key, index: i + 1 }; renderProgram(); focusNode(n.id); }
  }, label));
  if (n.op === 'repeat') {
    const id = `rep-${n.id}`;
    const inp = el('input', { id, type: 'number', min: '1', max: '10', value: String(n.n), class: 'num', 'aria-label': `Počet opakování bloku ${i + 1}` });
    inp.addEventListener('change', () => { n.n = Math.max(1, Math.min(10, parseInt(inp.value, 10) || 1)); inp.value = String(n.n); programChanged(); $(id)?.focus(); });
    head.append(inp, el('span', { class: 'pn__x', text: '×' }));
  }
  if (n.op === 'if') {
    const id = `cond-${n.id}`;
    const conds = Object.entries(E.CONDS).filter(([c]) => c !== 'onBattery' || S.mission.blocks.includes('pick'));
    const sel = el('select', { id, class: 'cond', 'aria-label': `Podmínka bloku ${i + 1}` }, conds.map(([c, t]) => el('option', { value: c, text: t, selected: c === n.cond ? true : null })));
    sel.addEventListener('change', () => { n.cond = sel.value; programChanged(); $(id)?.focus(); });
    head.append(sel);
  }
  const tools = el('span', { class: 'pn__tools' },
    el('button', { type: 'button', class: 'mini', 'aria-label': `Posunout blok ${i + 1} nahoru`, title: 'Nahoru', disabled: i === 0 ? true : null, onclick: () => moveNode(n.id, -1) }, '↑'),
    el('button', { type: 'button', class: 'mini', 'aria-label': `Posunout blok ${i + 1} dolů`, title: 'Dolů', disabled: i === len - 1 ? true : null, onclick: () => moveNode(n.id, 1) }, '↓'),
    el('button', { type: 'button', class: 'mini mini--del', 'aria-label': `Smazat blok ${i + 1} (${label})`, title: 'Smazat', onclick: () => deleteNode(n.id) }, '✕'));
  head.append(tools);
  li.append(head);
  if (n.op === 'repeat') li.append(el('div', { class: 'pn__body' }, renderList(n.body, `${n.id}:body`, depth + 1)));
  if (n.op === 'if') {
    li.append(el('div', { class: 'pn__body' }, el('p', { class: 'branch', text: 'pak:' }), renderList(n.then, `${n.id}:then`, depth + 1)));
    li.append(el('div', { class: 'pn__body' }, el('p', { class: 'branch', text: 'jinak:' }), renderList(n.else, `${n.id}:else`, depth + 1)));
  }
  return li;
}

function describe(n) {
  if (n.op === 'repeat') return `Opakuj ${n.n}× (${n.body.length} bloků uvnitř)`;
  if (n.op === 'if') return `Když ${E.CONDS[n.cond]}`;
  return E.OPS[n.op];
}

function focusNode(id) { $('program').querySelector(`[data-node="${id}"]`)?.focus(); }

function moveNode(id, delta) {
  const loc = locate(id);
  const j = loc.index + delta;
  if (j < 0 || j >= loc.list.length) return;
  [loc.list[loc.index], loc.list[j]] = [loc.list[j], loc.list[loc.index]];
  S.selected = id;
  S.insert = { key: loc.key, index: j + 1 };
  programChanged(`Blok posunut ${delta < 0 ? 'nahoru' : 'dolů'}.`);
  const btn = $('program').querySelector(`[data-id="${id}"] > .pn__head [aria-label^="Posunout blok"][aria-label$="${delta < 0 ? 'nahoru' : 'dolů'}"]`);
  (btn && !btn.disabled ? btn : $('program').querySelector(`[data-node="${id}"]`))?.focus();
}

function deleteNode(id) {
  const loc = locate(id);
  loc.list.splice(loc.index, 1);
  // pokud se vkládalo dovnitř smazaného bloku, vrátíme vkládání na jeho místo
  if (!container(S.insert.key) || S.insert.key.startsWith(id + ':')) S.insert = { key: loc.key, index: loc.index };
  else if (S.insert.key === loc.key && S.insert.index > loc.index) S.insert.index--;
  S.selected = null;
  programChanged('Blok smazán.');
  const next = loc.list[loc.index] || loc.list[loc.index - 1];
  if (next) focusNode(next.id); else $('program').querySelector('.slot-btn')?.focus();
}

$('btn-clear').addEventListener('click', () => {
  if (!S.program.length) return;
  S.program = [];
  S.insert = { key: 'root', index: 0 };
  S.selected = null;
  programChanged('Program je prázdný.');
});

/* ================= Běh a krokování ================= */
function resetRun(countReset = true) {
  stopRun();
  if (countReset) S.resets++;
  S.map = E.parseMap(S.mission.maps[S.variant]);
  const state = E.createState(S.map);
  S.run = { state, gen: null, trace: [{ x: state.x, y: state.y, dir: state.dir }], current: null, finished: false };
  S.log = [];
  drawMap();
  renderState();
  renderLog();
  highlight(null);
  $('btn-pause').disabled = true;
}

function ensureGen() {
  if (!S.run.gen) S.run.gen = E.execute(S.program, S.map, S.run.state);
}

/** Provede jednu událost interpretu. Vrací false, když program skončil. */
function stepOnce() {
  if (S.run.finished) return false;
  ensureGen();
  const { value, done } = S.run.gen.next();
  if (done || !value) { finishRun(); return false; }
  const st = S.run.state;
  if (value.kind === 'step') {
    S.run.trace.push({ x: st.x, y: st.y, dir: st.dir });
    addLog(st.error ? `✕ ${E.OPS[value.node.op]}: ${st.error.msg}` : `${E.OPS[value.node.op]} → ${E.human(st.x, st.y)}, ${E.DIR_LABELS[st.dir].split(' ')[0]}`);
  } else if (value.kind === 'cond') {
    addLog(`Senzor: ${E.CONDS[value.node.cond]}? ${value.value ? 'ANO' : 'NE'}`);
    S.run.lastCond = `${E.CONDS[value.node.cond]}: ${value.value ? 'ano' : 'ne'}`;
  }
  if (value.kind === 'end') { highlight(null); finishRun(); drawMap(); renderState(); return false; }
  highlight(value.path[value.path.length - 1]);
  drawMap();
  renderState();
  if (st.error) { finishRun(); return false; }
  return true;
}

function startRun() {
  if (S.run.finished) resetRun(false);
  if (!S.program.length) { showResults(null, 'Program je prázdný. Přidej bloky z nabídky nad programem.'); return; }
  $('btn-pause').disabled = false;
  $('btn-run').disabled = true;
  const speed = Number($('speed').value);
  const tick = () => {
    if (!stepOnce()) return;
    S.timer = setTimeout(tick, reducedMotion() ? Math.max(SPEEDS[speed], 150) : SPEEDS[speed]);
  };
  tick();
}
function stopRun() {
  clearTimeout(S.timer);
  S.timer = null;
  $('btn-run').disabled = false;
  $('btn-pause').disabled = true;
}

function finishRun() {
  if (S.run.finished) return;
  S.run.finished = true;
  stopRun();
  const st = S.run.state;
  const result = E.evaluateMission(S.mission, S.program);
  const here = result.variants[S.variant];
  showResults(result, st.error ? st.error.msg : null);
  addLog(here.ok ? `✓ Program skončil po ${st.steps} krocích.` : `Program skončil po ${st.steps} krocích.`);
  if (result.success && !S.completed) complete(result);
}

function highlight(id) {
  for (const n of $('program').querySelectorAll('.is-running')) n.classList.remove('is-running');
  if (id) {
    const li = $('program').querySelector(`li[data-id="${id}"]`);
    li?.classList.add('is-running');
    li?.scrollIntoView({ block: 'nearest' });
  }
}

function renderState() {
  const st = S.run.state;
  const dl = $('state');
  dl.replaceChildren();
  const row = (k, v) => dl.append(el('div', {}, el('dt', { text: k }), el('dd', { text: v })));
  row('Pozice', E.human(st.x, st.y));
  row('Směr', E.DIR_LABELS[st.dir]);
  row('Nese', `${st.carrying.B} bat. · ${st.carrying.V} vz.`);
  if (S.map.marks.D.length) row('Doručeno', String(st.delivered));
  row('Kroků', `${st.steps} / ${E.LIMIT}`);
  if (S.run.lastCond) row('Senzor', S.run.lastCond);
}

function addLog(text) {
  S.log.push(text);
  renderLog();
}
function renderLog() {
  const ol = $('log');
  ol.replaceChildren(...S.log.slice(-10).map(t => el('li', { text: t, class: t.startsWith('✕') ? 'is-error' : '' })));
  if (!S.log.length) ol.append(el('li', { class: 'muted', text: 'Zatím nic. Spusť nebo krokuj program.' }));
  ol.start = Math.max(1, S.log.length - 9);
}

function showResults(result, errorMsg) {
  const box = $('results');
  box.replaceChildren();
  if (!result) { box.append(el('p', { class: 'score is-bad', text: errorMsg })); return; }
  box.append(el('p', { class: 'score ' + (result.success ? 'is-good' : 'is-bad') },
    el('span', { 'aria-hidden': 'true', text: result.success ? '✓ ' : '! ' }),
    el('b', { text: result.success ? 'Mise splněna!' : 'Ještě ne.' })));
  const ul = el('ul', { class: 'res' });
  for (const v of result.variants) {
    if (result.variants.length > 1) ul.append(el('li', { class: v.ok ? 'ok' : 'bad' }, el('b', { text: `${v.name}: ` }), v.ok ? 'robot úlohu splnil.' : v.failures.join(' ')));
    else for (const f of v.failures) ul.append(el('li', { class: 'bad', text: f }));
  }
  for (const r of result.requirements.filter(r => !r.ok)) ul.append(el('li', { class: 'bad', text: r.msg }));
  if (ul.childElementCount) box.append(ul);
  box.append(el('p', { class: 'small muted', text: `Bloků v programu: ${result.blocks}. Vykonaných kroků: ${result.steps}. Resetů: ${S.resets}.` }));
}

$('btn-run').addEventListener('click', startRun);
$('btn-pause').addEventListener('click', () => { stopRun(); addLog('⏸ Pozastaveno.'); });
$('btn-step').addEventListener('click', () => {
  stopRun();
  if (S.run.finished) resetRun(false);
  if (!S.program.length) return showResults(null, 'Program je prázdný. Přidej bloky z nabídky nad programem.');
  stepOnce();
});
$('btn-reset-run').addEventListener('click', () => { resetRun(true); $('results').replaceChildren(el('p', { class: 'muted small', text: 'Robot je zpátky na startu.' })); });
$('speed').addEventListener('input', e => e.target.setAttribute('aria-valuetext', SPEED_LABELS[e.target.value]));

/* ================= Nápověda a dokončení ================= */
$('btn-hint').addEventListener('click', () => {
  const m = S.mission;
  if (S.hints >= m.hints.length) return;
  const levels = ['Princip', 'Kde se zaměřit', 'Postup'];
  $('hints').append(el('p', { class: 'hint' }, el('b', { text: `${S.hints + 1}. ${levels[S.hints]}: ` }), m.hints[S.hints]));
  S.hints++;
  if (S.hints >= m.hints.length) { $('btn-hint').disabled = true; $('btn-hint').textContent = 'Všechny nápovědy použity'; }
  else $('btn-hint').textContent = 'Další nápověda';
});

function complete(result) {
  S.completed = true;
  const m = S.mission;
  const par = E.countBlocks(m.reference);
  const st = E.stars({ blocks: result.blocks, par, hints: S.hints });
  const pt = E.points({ blocks: result.blocks, par, hints: S.hints });
  const prev = store.missions[m.id];
  if (!prev?.done || st > prev.stars || (st === prev.stars && pt > prev.points)) {
    store.missions[m.id] = { done: true, stars: st, points: pt, blocks: result.blocks, hints: S.hints, resets: S.resets };
  }
  saveStore();
  renderHome();
  $('done-stars').replaceChildren(el('span', { 'aria-hidden': 'true', text: '★'.repeat(st) + '☆'.repeat(3 - st) }), el('span', { class: 'sr-only', text: `${st} ze 3 hvězd` }));
  $('done-stats').textContent = `Body: ${pt}. Bloků: ${result.blocks} (autorské řešení má ${par}). Vykonaných kroků: ${result.steps}. Nápověd: ${S.hints}. Resetů: ${S.resets}.` + (S.hints === 0 ? ' Ocenění: bez nápovědy!' : '');
  $('done-rule').textContent = RULES[m.chapter];
  const i = MISSIONS.indexOf(m);
  $('btn-next').hidden = i >= MISSIONS.length - 1;
  $('dlg-done').showModal();
  ($('btn-next').hidden ? $('btn-done-overview') : $('btn-next')).focus();
}
const RULES = {
  1: 'Algoritmus je přesná posloupnost kroků. Počítač je provede přesně tak, jak jsou napsané – ani víc, ani míň.',
  2: 'Cyklus zkracuje program: co se opakuje, napíšeš jen jednou. Pozor, co patří dovnitř cyklu a co za něj.',
  3: 'Podmínka rozhoduje za běhu podle senzoru. Díky ní funguje jeden program i na různých mapách. Chyby hledej krokováním.'
};

$('btn-next').addEventListener('click', () => { $('dlg-done').close(); openMission(MISSIONS[MISSIONS.indexOf(S.mission) + 1].id); });
$('btn-stay').addEventListener('click', () => $('dlg-done').close());
$('btn-done-overview').addEventListener('click', () => { $('dlg-done').close(); showHome(); });
$('btn-overview').addEventListener('click', showHome);

/* ================= Přehled: nastavení a reset ================= */
$('opt-unlock').addEventListener('change', e => { store.unlockAll = e.target.checked; saveStore(); renderHome(); });
function askReset() {
  $('reset-box').replaceChildren(
    el('p', { class: 'warn', text: 'Opravdu smazat postup Robotí dílny v tomto prohlížeči? Ostatní hry zůstanou beze změny.' }),
    el('button', { class: 'btn btn--warn btn--small', type: 'button', id: 'btn-reset-yes', onclick: () => {
      store = { missions: {}, unlockAll: false };
      try { localStorage.removeItem(STORE_KEY); } catch { /* nic */ }
      restoreReset(); renderHome(); $('btn-reset').focus();
    } }, 'Ano, smazat'),
    el('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => { restoreReset(); $('btn-reset').focus(); } }, 'Ne'));
  $('btn-reset-yes').focus();
}
function restoreReset() {
  $('reset-box').replaceChildren(el('button', { class: 'btn btn--ghost btn--small', id: 'btn-reset', type: 'button', onclick: askReset }, 'Smazat postup této hry'));
}
$('btn-reset').addEventListener('click', askReset);

/* ================= Start ================= */
renderHome();
const fromHash = decodeURIComponent(location.hash.slice(1));
if (fromHash && MISSIONS.some(m => m.id === fromHash)) openMission(fromHash);
window.addEventListener('hashchange', () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id && id !== S.mission?.id && MISSIONS.some(m => m.id === id)) openMission(id);
});
