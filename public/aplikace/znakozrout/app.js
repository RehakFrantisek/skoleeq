/* Znakožrout – UI. Průběh podle docs/GAME_DESIGN_SYSTEM.md:
   titulní obrazovka → ukázka → úrovně (s úvodem) → závěr. Úlohy a vyhodnocení jsou v logic.js
   (deterministické, testované). Každý typ úlohy má vlastní „nástroj“ s metodami get/set/lock.
   Pod úlohou je klávesnice se třemi vrstvami: ukazuje stisknutou klávesu a vrstvu (Shift / AltGr)
   a na dotyku do pole vkládá znaky. Text vkládáme jen přes textContent, žádné eval,
   localStorage jen pod vlastním klíčem. Hesla z trezoru se nikam neukládají. */
import * as L from './logic.js';

const STORE_KEY = 'vyukovy-portal:znakozrout:v1';
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

/* ================= Úložiště ================= */
function load() {
  try { const d = JSON.parse(localStorage.getItem(STORE_KEY)); return d && typeof d === 'object' ? d : {}; } catch { return {}; }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* hraje se dál */ } }
let store = load();

/* ================= Stav ================= */
const S = { variant: 'A', mode: 'cela', tasks: [], i: 0, tutorial: false, attempts: 0, hints: 0, totalHints: 0, done: false, results: [], start: 0, tick: null, tool: null, kbd: null, level: -1 };
const current = () => (S.tutorial ? L.tutorialTask() : S.tasks[S.i]);

function show(id) {
  for (const s of ['s-title', 's-intro', 's-play', 's-end']) $(s).hidden = s !== id;
  $('hud').hidden = id === 's-title' || id === 's-end';
  window.scrollTo({ top: 0 });
}
const fmt = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const MODE_LABEL = { cela: 'celá hra', rychly: 'rychlá hra' };
const ulohy = n => (n === 1 ? 'úloha' : n >= 2 && n <= 4 ? 'úlohy' : 'úloh');

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
  buildBelly($('belly'), S.tasks);
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
    $('intro-count').textContent = `${count} ${ulohy(count)} · varianta ${S.variant}`;
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
  if (S.tutorial) $('hints').append(el('p', { class: 'hint hint--tour' }, el('b', { text: 'Jak to funguje: ' }), 'Klikni do mezery a napiš znak na klávesnici. Klávesnice pod úlohou ukáže, co jsi zmáčkl(a). Pak stiskni Zkontrolovat (nebo Enter). Nápověda výsledek nesnižuje a po dvou pokusech můžeš zobrazit řešení.'));
  setFeedback(null);
  $('btn-reveal').hidden = true; $('btn-next').hidden = true;
  $('btn-check').disabled = false; $('btn-hint').disabled = false;
  $('btn-hint').textContent = '🔍 Nápověda';
  $('progress').max = S.tasks.length; $('progress').value = S.tutorial ? 0 : S.i;
  $('belly-note').textContent = S.tutorial ? 'Každá vyřešená úloha vytáhne znaky ze žaludku.' : `Zachráněno ${S.results.length} z ${S.tasks.length}.`;
  S.kbd = keyboard(t.type === 'where' ? 'pick' : 'type');
  S.tool = TOOLS[t.type](t, S.kbd);
  $('tool').replaceChildren(S.tool.node);
  $('kbd-box').replaceChildren(S.kbd.node);
  $('task-h').focus();
}

function hint() {
  const t = current();
  if (S.hints >= t.hints.length) return;
  $('hints').append(el('p', { class: 'hint' }, el('b', { text: `Nápověda ${S.hints + 1}: ` }), t.hints[S.hints]));
  S.hints++;
  if (!S.tutorial) { S.totalHints++; $('hint-count').textContent = String(S.totalHints); }
  if (S.hints >= t.hints.length) {
    $('btn-hint').disabled = true; $('btn-hint').textContent = 'Všechny nápovědy použity';
    if (t.type !== 'where' && t.type !== 'password') S.kbd.mark(hintChars(t));
  }
}
function hintChars(t) {
  if (t.type === 'blanks') return t.answers.flatMap(a => [...a]);
  if (t.type === 'rule' || t.type === 'fix') return L.specials(t.answer);
  return [];
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
  setFeedback(r.ok ? 'good' : 'bad', r.msg);
  if (S.tool.mark) S.tool.mark(r);
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
  const msg = t.type === 'password'
    ? `Například ${t.example} – ale tohle heslo už je veřejné, tak ho nikde nepoužívej. Vymysli si vlastní podle stejných pravidel.`
    : L.check(t, L.solution(t)).msg;
  setFeedback('solution', msg);
  finish(false, true);
}

function finish(solved, revealed = false) {
  S.done = true;
  S.tool.lock();
  S.kbd.lock();
  $('btn-check').disabled = true; $('btn-hint').disabled = true; $('btn-reveal').hidden = true;
  if (!S.tutorial) {
    const t = current();
    S.results.push({ id: t.id, skill: t.skill, solved, revealed, firstTry: solved && S.attempts === 1, hints: S.hints });
    rescue($('belly'), S.i, revealed);
    $('belly-note').textContent = `Zachráněno ${S.results.length} z ${S.tasks.length}.`;
    $('progress').value = S.i + 1;
  }
  $('btn-next').textContent = S.tutorial ? 'Spustit hru →' : S.i + 1 >= S.tasks.length ? 'Vyhnat Znakožrouta →' : 'Další úloha →';
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
  $('result').textContent = `Zvládl(a) jsi ${solved} z ${total} úloh, ${firstTry} napoprvé.` + (isNew && firstTry > 0 ? ' To je tvůj nový osobní rekord!' : '');
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
  buildBelly($('belly-end'), S.tasks);
  S.results.forEach((r, i) => rescue($('belly-end'), i, r.revealed));
  show('s-end');
  $('end-h').focus();
  renderBest();
}

/* ================= Žaludek se snědenými znaky ================= */
function buildBelly(box, tasks) {
  box.replaceChildren(...tasks.map((t, i) => el('span', { class: 'slot', 'data-i': String(i) }, el('span', { class: 'slot__q', 'aria-hidden': 'true', text: '?' }))));
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', `Zachráněno 0 z ${tasks.length} skupin znaků.`);
}
function rescue(box, i, dim = false) {
  const slot = box.querySelectorAll('.slot')[i];
  if (!slot) return;
  slot.replaceChildren(el('span', { class: 'slot__chars', text: S.tasks[i].chars.join(' ') }));
  slot.classList.add('is-done');
  if (dim) slot.classList.add('is-dim');
  const done = box.querySelectorAll('.slot.is-done').length;
  box.setAttribute('aria-label', `Zachráněno ${done} z ${box.querySelectorAll('.slot').length} skupin znaků.`);
}

/* ================= Klávesnice se třemi vrstvami ================= */
/* mode 'type': ukazuje všechny vrstvy, zvýrazní stisk, ťuknutím vkládá znak do posledního pole.
   mode 'pick': jen natištěné písmeno / základní znak – žák hledá znak na své skutečné klávesnici;
   klik klávesu vybere (onPick). */
function keyboard(mode) {
  let target = null, onPick = null, locked = false, sticky = null, lastKey = null;
  const keys = {};
  const readout = el('p', { class: 'kbd__readout small', text: mode === 'pick' ? 'Klikni na klávesu, kde je znak natištěný.' : 'Stiskni klávesu – tady uvidíš, co píše.' });
  const shiftBtn = el('button', { type: 'button', class: 'kmod', 'aria-pressed': 'false', text: 'Shift' });
  const altBtn = el('button', { type: 'button', class: 'kmod kmod--alt', 'aria-pressed': 'false', text: 'AltGr' });
  const setSticky = v => {
    sticky = sticky === v ? null : v;
    shiftBtn.setAttribute('aria-pressed', String(sticky === 'shift'));
    altBtn.setAttribute('aria-pressed', String(sticky === 'altgr'));
    board.dataset.layer = sticky || '';
  };
  shiftBtn.addEventListener('click', () => setSticky('shift'));
  altBtn.addEventListener('click', () => setSticky('altgr'));

  const board = el('div', { class: `kbd__board kbd--${mode}` });
  L.KEYBOARD.forEach((row, r) => {
    const rowEl = el('div', { class: `kbd__row kbd__row--${r}` });
    for (const k of row) {
      const isLetter = /^Key/.test(k.code);
      let b;
      if (mode === 'pick') {
        b = el('button', { type: 'button', class: 'key', 'data-code': k.code, 'aria-label': `Klávesa ${L.keyName(k.code)}` },
          el('span', { class: 'key__bl', text: isLetter || /^Digit/.test(k.code) ? L.keyCap(k.code) : k.base }));
      } else {
        const tl = isLetter ? '' : k.shift;
        const bl = isLetter ? k.shift : k.base;
        b = el('button', { type: 'button', class: `key${isLetter ? ' key--letter' : ''}`, 'data-code': k.code, tabindex: '-1',
          'aria-label': `Klávesa ${L.keyName(k.code)}: ${[k.base, k.shift, k.altgr].filter(Boolean).join(', ')}` },
        el('span', { class: 'key__tl', 'aria-hidden': 'true', text: tl }),
        el('span', { class: 'key__bl', 'aria-hidden': 'true', text: bl }),
        el('span', { class: 'key__br', 'aria-hidden': 'true', text: k.altgr || '' }));
      }
      b.addEventListener('mousedown', e => { if (mode === 'type') e.preventDefault(); }); // focus zůstane v poli
      b.addEventListener('click', () => press(k));
      keys[k.code] = b;
      rowEl.append(b);
    }
    board.append(rowEl);
  });
  if (mode === 'pick') {
    // Roving tabindex: v pořadí Tab je jen jedna klávesa, mezi klávesami se chodí šipkami.
    const grid = L.KEYBOARD.map(row => row.map(k => keys[k.code]));
    grid.flat().forEach((b, i) => { b.tabIndex = i === 0 ? 0 : -1; });
    board.addEventListener('keydown', e => {
      const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
      if (!d) return;
      const r = grid.findIndex(row => row.includes(document.activeElement));
      if (r < 0) return;
      e.preventDefault();
      const c = grid[r].indexOf(document.activeElement);
      const nr = Math.max(0, Math.min(grid.length - 1, r + d[0]));
      const nc = Math.max(0, Math.min(grid[nr].length - 1, c + d[1]));
      const nb = grid[nr][nc];
      grid.flat().forEach(b => { b.tabIndex = b === nb ? 0 : -1; });
      nb.focus();
    });
  }
  const legend = mode === 'type'
    ? el('p', { class: 'kbd__legend small' }, el('span', { class: 'lg lg--tl', text: 'vlevo nahoře' }), ' = se Shiftem · ', el('span', { class: 'lg lg--bl', text: 'vlevo dole' }), ' = klávesa sama · ', el('span', { class: 'lg lg--br', text: 'vpravo dole' }), ' = s pravým Altem (AltGr)')
    : el('p', { class: 'kbd__legend small', text: 'Na obrazovce jsou jen hlavní znaky – ostatní najdeš v rozích kláves na své skutečné klávesnici.' });
  const tools = mode === 'type' ? el('div', { class: 'kbd__mods' }, el('span', { class: 'small', text: 'Ťukání:' }), shiftBtn, altBtn) : null;
  const node = el('section', { class: 'kbd', 'aria-label': 'Klávesnice' }, el('div', { class: 'kbd__head' }, readout, tools), el('div', { class: 'kbd__scroll' }, board), legend);

  function flash(code) {
    const b = keys[code];
    if (!b) return;
    b.classList.remove('is-down'); void b.offsetWidth; b.classList.add('is-down');
    setTimeout(() => b.classList.remove('is-down'), 260);
  }
  function press(k) {
    if (locked) return;
    if (mode === 'pick') {
      for (const b of Object.values(keys)) b.classList.remove('is-picked');
      keys[k.code].classList.add('is-picked');
      if (onPick) onPick(k.code);
      return;
    }
    const layer = sticky || 'base';
    const ch = k[layer];
    if (sticky) setSticky(sticky);
    flash(k.code);
    if (!ch) { readout.textContent = `${L.keyName(k.code)} s ${layer === 'altgr' ? 'AltGr' : 'Shiftem'} tu nic nepíše.`; return; }
    readout.textContent = describe(ch, layer, k.code);
    if (target && document.contains(target) && !target.readOnly) {
      const s = target.selectionStart ?? target.value.length, e = target.selectionEnd ?? s;
      const max = target.maxLength > 0 ? target.maxLength : Infinity;
      if (target.value.length - (e - s) + ch.length > max) return;
      target.setRangeText(ch, s, e, 'end');
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.focus();
    }
  }
  function describe(ch, layer, code) {
    const how = layer === 'base' ? `klávesa ${L.keyName(code)}` : `${layer === 'shift' ? 'Shift' : 'pravý Alt (AltGr)'} + ${L.keyName(code)}`;
    return `${how} → ${ch}${L.CHAR_NAME[ch] ? ` (${L.CHAR_NAME[ch]})` : ''}`;
  }
  return {
    node,
    mode,
    /** Fyzická klávesa: zvýrazni ji a ukaž, co napsala. */
    physical(e) {
      if (mode !== 'type' || locked) return;
      const altgr = e.getModifierState?.('AltGraph') || (e.ctrlKey && e.altKey);
      board.dataset.layer = altgr ? 'altgr' : e.shiftKey ? 'shift' : (sticky || '');
      if (!keys[e.code]) return;
      flash(e.code);
      lastKey = e.code;
      const layer = altgr ? 'altgr' : e.shiftKey ? 'shift' : 'base';
      if (e.key && e.key.length === 1) readout.textContent = describe(e.key, layer, e.code);
    },
    release() { if (mode === 'type') board.dataset.layer = sticky || ''; },
    setTarget(inp) { target = inp; },
    onPick(fn) { onPick = fn; },
    showPicked(code) {
      for (const b of Object.values(keys)) b.classList.toggle('is-picked', b.dataset.code === code);
    },
    mark(chars) {
      for (const ch of chars) { const w = L.WHERE[ch]; if (w && keys[w.code]) keys[w.code].classList.add('is-hint'); }
    },
    lock() { locked = true; node.classList.add('is-locked'); for (const b of Object.values(keys)) b.disabled = mode === 'pick'; shiftBtn.disabled = altBtn.disabled = true; },
    get last() { return lastKey; }
  };
}
document.addEventListener('keydown', e => { if (!$('s-play').hidden && S.kbd) S.kbd.physical(e); });
document.addEventListener('keyup', () => { if (S.kbd) S.kbd.release(); });

/* ================= Nástroje úloh ================= */
function textField(id, label, { value = '', kbd, wide = false, onInput } = {}) {
  const inp = el('input', { id, type: 'text', class: `answer${wide ? ' answer--wide' : ''}`, autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });
  inp.value = value;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  inp.addEventListener('focus', () => kbd?.setTarget(inp));
  if (onInput) inp.addEventListener('input', onInput);
  kbd?.setTarget(inp);
  return { input: inp, node: el('label', { class: 'answer-field', for: id }, el('span', { text: label }), inp) };
}

const TOOLS = {
  where(t, kbd) {
    const picks = t.chars.map(() => ({ code: null, layer: null }));
    let active = 0;
    const rows = t.chars.map((c, i) => {
      const keyOut = el('span', { class: 'pick__key', text: 'klávesa: —' });
      const btn = el('button', { type: 'button', class: 'pick__btn', 'aria-pressed': 'false', id: `pick-${i}` },
        el('span', { class: 'pick__char', 'aria-hidden': 'true', text: c }), el('span', { class: 'sr-only', text: `Znak ${c} (${L.CHAR_NAME[c]}). ` }), keyOut);
      btn.addEventListener('click', () => setActive(i));
      const layers = el('fieldset', { class: 'seg seg--layer' }, el('legend', { class: 'sr-only', text: `S čím se píše ${c}` }),
        L.LAYERS.map(ly => {
          const inp = el('input', { type: 'radio', name: `ly-${i}`, value: ly });
          inp.addEventListener('change', () => { picks[i].layer = ly; });
          return el('label', {}, inp, el('span', { text: L.LAYER_SHORT[ly] }));
        }));
      return { node: el('li', { class: 'pick' }, btn, layers), btn, keyOut, layers };
    });
    function setActive(i) {
      active = i;
      rows.forEach((r, j) => { r.btn.setAttribute('aria-pressed', String(j === i)); r.node.classList.toggle('is-active', j === i); });
      kbd.showPicked(picks[i].code);
    }
    kbd.onPick(code => {
      picks[active].code = code;
      rows[active].keyOut.textContent = `klávesa: ${L.keyName(code)}`;
      rows[active].node.classList.add('has-key');
      const nextFree = picks.findIndex(p => !p.code);
      if (nextFree >= 0) setActive(nextFree);
    });
    setActive(0);
    const help = el('p', { class: 'small muted', text: '1. Klikni na řádek se znakem. 2. Klikni na klávesu, na které je znak natištěný. 3. Vyber, jestli se píše samotnou klávesou, se Shiftem, nebo s AltGr.' });
    const node = el('div', { class: 'tool-stack' }, help, el('ol', { class: 'picks' }, rows.map(r => r.node)));
    return {
      node,
      get: () => ({ picks: picks.map(p => ({ ...p })) }),
      set(sol) {
        sol.picks.forEach((p, i) => {
          picks[i] = { ...p };
          rows[i].keyOut.textContent = `klávesa: ${L.keyName(p.code)}`;
          rows[i].node.classList.add('has-key');
          rows[i].layers.querySelector(`input[value="${p.layer}"]`).checked = true;
        });
      },
      lock() { rows.forEach(r => { r.btn.disabled = true; r.layers.disabled = true; }); }
    };
  },

  blanks(t, kbd) {
    const inputs = [];
    let n = 0;
    const pileChips = t.pile.map(a => el('span', { class: 'pile__chip mono', text: a }));
    const updatePile = () => {
      const used = inputs.map(i => i.value.trim());
      const left = [...used];
      pileChips.forEach(ch => {
        const k = left.indexOf(ch.textContent);
        ch.classList.toggle('is-used', k >= 0);
        if (k >= 0) left.splice(k, 1);
      });
    };
    const text = el('p', { class: 'note-text' }, t.parts.map(p => {
      if (typeof p === 'string') return p;
      const i = n++;
      const inp = el('input', { type: 'text', class: `blank${p.a.length > 1 ? ' blank--wide' : ''}`, id: `bl-${i}`, maxlength: '4', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': `Mezera ${i + 1}` });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
      inp.addEventListener('focus', () => kbd.setTarget(inp));
      inp.addEventListener('input', () => { inp.classList.remove('is-wrong'); updatePile(); });
      inputs.push(inp);
      return inp;
    }));
    kbd.setTarget(inputs[0]);
    const pile = el('div', { class: 'pile' }, el('span', { class: 'pile__h', text: 'Hromádka vyplivnutých znaků:' }), el('span', { class: 'pile__chips' }, pileChips));
    const node = el('div', { class: 'tool-stack' }, pile, el('div', { class: 'note' }, text));
    return {
      node,
      get: () => ({ values: inputs.map(i => i.value) }),
      set(sol) { sol.values.forEach((v, i) => { inputs[i].value = v; inputs[i].classList.remove('is-wrong'); }); updatePile(); },
      mark(r) { inputs.forEach((inp, i) => inp.classList.toggle('is-wrong', !!r.wrong?.includes(i))); },
      lock() { inputs.forEach(i => { i.readOnly = true; }); }
    };
  },

  rule(t, kbd) {
    const f = textField('ans', t.from, { kbd, wide: true });
    const ex = el('table', { class: 'rule-ex' }, el('caption', { class: 'sr-only', text: 'Příklad' }),
      el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'Zadání' }), el('th', { scope: 'col', text: 'Zápis' }))),
      el('tbody', {}, t.examples.map(([a, b]) => el('tr', {}, el('td', { text: a }), el('td', { class: 'mono', text: b })))));
    const node = el('div', { class: 'tool-stack' }, el('div', { class: 'rule-card' }, el('p', { class: 'rule-card__h', text: 'Pravidlo' }), el('p', { text: t.rule }), ex), f.node);
    return {
      node,
      get: () => ({ value: f.input.value }),
      set(sol) { f.input.value = sol.value; },
      lock() { f.input.readOnly = true; }
    };
  },

  password(t, kbd) {
    const list = el('ul', { class: 'checks', 'aria-live': 'polite' });
    const vault = el('div', { class: 'vault', 'aria-hidden': 'true' }, el('span', { class: 'vault__dial' }), el('span', { class: 'vault__count', text: '0/7' }));
    const upd = () => {
      const cs = L.passwordChecks(t, f.input.value);
      list.replaceChildren(...cs.map(c => el('li', { class: c.ok ? 'is-ok' : '' }, el('span', { 'aria-hidden': 'true', text: c.ok ? '✓ ' : '○ ' }), el('span', { class: 'sr-only', text: c.ok ? 'splněno: ' : 'zatím ne: ' }), c.label)));
      const ok = cs.filter(c => c.ok).length;
      vault.querySelector('.vault__count').textContent = `${ok}/${cs.length}`;
      vault.style.setProperty('--p', String(ok / cs.length));
      vault.classList.toggle('is-open', ok === cs.length);
    };
    const f = textField('ans', 'Heslo k trezoru', { kbd, wide: true, onInput: upd });
    upd();
    const node = el('div', { class: 'tool-stack' }, el('div', { class: 'vault-row' }, vault, el('div', {}, el('p', { class: 'rule-card__h', text: 'Pravidla trezoru' }), list)), f.node);
    return {
      node,
      get: () => ({ value: f.input.value }),
      set(sol) { f.input.value = sol.value; upd(); },
      lock() { f.input.readOnly = true; }
    };
  },

  fix(t, kbd) {
    const f = textField('ans', 'Text k opravě', { kbd, wide: true, value: t.wrong });
    const resetBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--small', text: 'Vrátit původní text', onclick: () => { f.input.value = t.wrong; f.input.focus(); } });
    const node = el('div', { class: 'tool-stack' }, el('p', { class: 'orig small' }, el('b', { text: 'Původně: ' }), el('span', { class: 'mono', text: t.wrong })), f.node, el('div', { class: 'row row--tight' }, resetBtn));
    return {
      node,
      get: () => ({ value: f.input.value }),
      set(sol) { f.input.value = sol.value; },
      lock() { f.input.readOnly = true; resetBtn.disabled = true; }
    };
  }
};

/* ================= Ovládání ================= */
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
    el('p', { class: 'warn', text: 'Opravdu smazat výsledky Znakožrouta v tomto prohlížeči? Ostatní hry zůstanou beze změny.' }),
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
