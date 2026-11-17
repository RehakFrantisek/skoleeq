/* Znakožrout – UI. Průběh podle docs/GAME_DESIGN_SYSTEM.md:
   titulní obrazovka → ukázka → úrovně (s úvodem) → závěr. Úlohy a vyhodnocení jsou v logic.js
   (deterministické, testované). Každý typ úlohy má vlastní „nástroj“ s metodami get/set/lock.
   Vstup je jen z fyzické klávesnice; pod úlohou je řádek s posledním stiskem (klávesa + Shift / AltGr). Text vkládáme jen přes textContent, žádné eval,
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
  if (S.tutorial) $('hints').append(el('p', { class: 'hint hint--tour' }, el('b', { text: 'Jak to funguje: ' }), 'Klikni do mezery a napiš znak na klávesnici. Řádek „Stisknuto“ pod úlohou ukáže, kterou klávesu a s čím jsi zmáčkl(a). Pak stiskni Zkontrolovat (nebo Enter). Nápověda výsledek nesnižuje a po dvou pokusech můžeš zobrazit řešení.'));
  setFeedback(null);
  $('btn-reveal').hidden = true; $('btn-next').hidden = true;
  $('btn-check').disabled = false; $('btn-hint').disabled = false;
  $('btn-hint').textContent = '🔍 Nápověda';
  $('progress').max = S.tasks.length; $('progress').value = S.tutorial ? 0 : S.i;
  $('belly-note').textContent = S.tutorial ? 'Každá vyřešená úloha vytáhne znaky ze žaludku.' : `Zachráněno ${S.results.length} z ${S.tasks.length}.`;
  S.kbd = readout();
  S.tool = TOOLS[t.type](t);
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
  }
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

/* ================= Co jsi stiskl(a) ================= */
/* Vstup je jen z fyzické klávesnice. Řádek pod úlohou ukazuje poslední stisk:
   „pravý Alt (AltGr) + V → @ (zavináč)“, ať žák vidí, kterou klávesu a vrstvu použil. */
function readout() {
  let locked = false;
  const text = el('p', { class: 'readout__text', text: 'Stiskni klávesu – tady uvidíš, co píše.' });
  const node = el('div', { class: 'readout', 'aria-hidden': 'true' }, el('span', { class: 'readout__h', text: 'Stisknuto:' }), text);
  return {
    node,
    physical(e) {
      if (locked || !e.key || e.key.length !== 1 || e.ctrlKey !== e.altKey) return; // zkratky typu Ctrl+C ne, AltGr = Ctrl+Alt ano
      const altgr = e.getModifierState?.('AltGraph') || (e.ctrlKey && e.altKey);
      const layer = altgr ? 'altgr' : e.shiftKey ? 'shift' : 'base';
      const k = L.KEYS[e.code];
      const keyLabel = k ? L.keyName(e.code) : (L.WHERE[e.key] ? L.keyName(L.WHERE[e.key].code) : e.key.toUpperCase());
      const how = e.key === ' ' ? 'mezerník' : layer === 'base' ? `klávesa ${keyLabel}` : `${layer === 'shift' ? 'Shift' : 'pravý Alt (AltGr)'} + ${keyLabel}`;
      text.textContent = e.key === ' ' ? 'mezerník → mezera' : `${how} → ${e.key}${L.CHAR_NAME[e.key] ? ` (${L.CHAR_NAME[e.key]})` : ''}`;
    },
    lock() { locked = true; }
  };
}
document.addEventListener('keydown', e => { if (!$('s-play').hidden && S.kbd) S.kbd.physical(e); });

/* ================= Nástroje úloh ================= */
function textField(id, label, { value = '', wide = false, onInput } = {}) {
  const inp = el('input', { id, type: 'text', class: `answer${wide ? ' answer--wide' : ''}`, autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });
  inp.value = value;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  if (onInput) inp.addEventListener('input', onInput);
  return { input: inp, node: el('label', { class: 'answer-field', for: id }, el('span', { text: label }), inp) };
}

const TOOLS = {
  where(t) {
    const inputs = t.chars.map((c, i) => {
      const inp = el('input', { type: 'text', class: 'blank blank--big', id: `wh-${i}`, maxlength: '1', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': `Napiš znak ${c} (${L.CHAR_NAME[c]})` });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
      inp.addEventListener('input', () => {
        inp.classList.remove('is-wrong');
        if (inp.value && inputs[i + 1] && !inputs[i + 1].value) inputs[i + 1].focus();
      });
      return inp;
    });
    const rows = t.chars.map((c, i) => el('li', { class: 'pick' },
      el('span', { class: 'pick__char', 'aria-hidden': 'true', text: c }),
      el('span', { class: 'pick__name', text: L.CHAR_NAME[c] }),
      el('span', { class: 'pick__arrow', 'aria-hidden': 'true', text: '→' }), inputs[i]));
    const help = el('p', { class: 'small muted', text: 'Klikni do políčka a stiskni kombinaci kláves, která znak napíše. Do políčka se vejde jen jeden znak – když se spleteš, smaž ho Backspacem.' });
    const node = el('div', { class: 'tool-stack' }, help, el('ol', { class: 'picks' }, rows));
    return {
      node,
      get: () => ({ values: inputs.map(i => i.value) }),
      set(sol) { sol.values.forEach((v, i) => { inputs[i].value = v; inputs[i].classList.remove('is-wrong'); }); },
      mark(r) { inputs.forEach((inp, i) => inp.classList.toggle('is-wrong', !!r.wrong?.includes(i))); },
      lock() { inputs.forEach(i => { i.readOnly = true; }); }
    };
  },

  blanks(t) {
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
      inp.addEventListener('input', () => { inp.classList.remove('is-wrong'); updatePile(); });
      inputs.push(inp);
      return inp;
    }));
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

  rule(t) {
    const f = textField('ans', t.from, { wide: true });
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

  password(t) {
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
    const f = textField('ans', 'Heslo k trezoru', { wide: true, onInput: upd });
    upd();
    const node = el('div', { class: 'tool-stack' }, el('div', { class: 'vault-row' }, vault, el('div', {}, el('p', { class: 'rule-card__h', text: 'Pravidla trezoru' }), list)), f.node);
    return {
      node,
      get: () => ({ value: f.input.value }),
      set(sol) { f.input.value = sol.value; upd(); },
      lock() { f.input.readOnly = true; }
    };
  },

  fix(t) {
    const f = textField('ans', 'Text k opravě', { wide: true, value: t.wrong });
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
