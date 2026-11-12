/* Phishingová hlídka – UI. Průběh podle docs/GAME_DESIGN_SYSTEM.md:
   titulní obrazovka → ukázka → 4 úrovně (s úvodem) → závěr. Obsah a vyhodnocení jsou v logic.js
   (deterministické, testované). Každý typ úlohy má vlastní „nástroj“ s metodami get/set/lock.
   Text vkládáme jen přes textContent, žádné eval, localStorage jen pod vlastním klíčem. */
import * as L from './logic.js';

const STORE_KEY = 'vyukovy-portal:phishingova-hlidka:v1';
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
const S = { variant: 'A', mode: 'cela', tasks: [], i: 0, tutorial: false, attempts: 0, hints: 0, totalHints: 0, done: false, results: [], start: 0, tick: null, tool: null, level: -1 };
const current = () => (S.tutorial ? L.tutorialTask() : S.tasks[S.i]);

function show(id) {
  for (const s of ['s-title', 's-intro', 's-play', 's-end']) $(s).hidden = s !== id;
  $('hud').hidden = id === 's-title' || id === 's-end';
  window.scrollTo({ top: 0 });
}
const fmt = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const MODE_LABEL = { cela: 'celá služba', rychly: 'rychlá služba' };
const KIND_ICON = { email: '✉️', sms: '📱', chat: '💬', post: '📣', password: '🔑', choice: '❓' };
const kindOf = t => (t.type === 'inspect' ? t.msg.kind : t.type);
const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

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
  S.tutorial = !!withTutorial;
  if (S.tutorial) { show('s-play'); renderTask(); } else nextOrIntro();
}

function nextOrIntro() {
  const t = S.tasks[S.i];
  if (t.level !== S.level) {
    S.level = t.level;
    const info = L.LEVEL_INFO[t.level];
    const count = S.tasks.filter(x => x.level === t.level).length;
    $('intro-icon').textContent = info.icon;
    $('intro-num').textContent = `Úroveň ${t.level + 1} z ${L.LEVEL_INFO.length}`;
    $('intro-h').textContent = info.name;
    $('intro-focus').textContent = info.focus;
    $('intro-count').textContent = `${count} ${plural(count, 'úloha', 'úlohy', 'úloh')} · varianta ${S.variant}`;
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
  $('tour').replaceChildren();
  if (S.tutorial) {
    $('tour').append(
      el('p', { class: 'hint hint--tour' }, el('b', { text: '1. Stopy: ' }), 'Klikni na podezřelou část zprávy (adresu, větu, odkaz, přílohu). Označí se vlaječkou 🚩. Dalším kliknutím označení zrušíš.'),
      el('p', { class: 'hint hint--tour' }, el('b', { text: '2. Odkazy: ' }), 'Když najedeš myší na odkaz nebo na něj přejdeš klávesou Tab, pod zprávou uvidíš, kam opravdu vede.'),
      el('p', { class: 'hint hint--tour' }, el('b', { text: '3. Verdikt: ' }), 'Vyber, jestli je zpráva bezpečná, podvod, nebo je potřeba ji ověřit jinou cestou. Pak stiskni Zkontrolovat.'));
  }
  setFeedback(null);
  $('debrief').replaceChildren();
  $('btn-reveal').hidden = true; $('btn-next').hidden = true;
  $('btn-check').disabled = false; $('btn-hint').disabled = false;
  $('btn-hint').textContent = '🔍 Nápověda';
  $('progress').max = S.tasks.length; $('progress').value = S.tutorial ? 0 : S.i;
  S.tool = TOOLS[t.type](t);
  $('tool').replaceChildren(S.tool.node);
  renderInbox();
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
  if (r.incomplete) { setFeedback('bad', r.msg); return; }
  S.attempts++;
  setFeedback(r.ok ? 'good' : 'bad', r.msg);
  if (r.ok) finish(true);
  else {
    S.tool.flag?.(r.wrong || []);
    S.tool.node.classList.remove('is-shake');
    if (!reducedMotion()) { void S.tool.node.offsetWidth; S.tool.node.classList.add('is-shake'); }
    if (S.attempts >= 2) $('btn-reveal').hidden = false;
  }
}

function reveal() {
  if (S.done) return;
  const t = current();
  const sol = L.solution(t);
  S.tool.set(sol);
  setFeedback('solution', L.check(t, sol).msg);
  finish(false, true);
}

function finish(solved, revealed = false) {
  S.done = true;
  S.tool.lock();
  S.tool.debrief?.();
  $('btn-check').disabled = true; $('btn-hint').disabled = true; $('btn-reveal').hidden = true;
  if (!S.tutorial) {
    const t = current();
    S.results.push({ id: t.id, skill: t.skill, solved, revealed, firstTry: solved && S.attempts === 1, hints: S.hints, scam: t.type === 'inspect' && !t.accept.some(v => ['bezpecne', 'zverejnit', 'overit'].includes(v)) });
    $('progress').value = S.i + 1;
  }
  renderInbox();
  $('btn-next').textContent = S.tutorial ? 'Nastoupit do služby →' : S.i + 1 >= S.tasks.length ? 'Ukončit službu →' : 'Další úkol →';
  $('btn-next').hidden = false;
  $('btn-next').focus();
}

function next() {
  if (S.tutorial) { S.tutorial = false; S.i = 0; return nextOrIntro(); }
  if (++S.i >= S.tasks.length) return end();
  nextOrIntro();
}

/* ================= Panel „Hlášení hlídky“ ================= */
function stampOf(t, r) {
  if (!r) return '';
  if (r.revealed) return 'ukázané řešení';
  if (t.type === 'inspect') return L.VERDICTS[t.accept[0]].label.toLowerCase();
  return 'vyřešeno';
}
function renderInbox() {
  const list = S.tutorial ? [L.tutorialTask()] : S.tasks;
  const ol = $('inbox');
  ol.replaceChildren();
  list.forEach((t, idx) => {
    const r = S.tutorial ? (S.done ? { revealed: false } : null) : S.results[idx];
    const isCur = S.tutorial || idx === S.i;
    const li = el('li', { class: `inbox__item${isCur ? ' is-current' : ''}${r ? ' is-done' : ''}`, 'aria-current': isCur ? 'step' : null },
      el('span', { class: 'inbox__icon', 'aria-hidden': 'true', text: KIND_ICON[kindOf(t)] }),
      el('span', { class: 'inbox__title', text: t.title }),
      r ? el('span', { class: `inbox__stamp${r.revealed ? ' is-dim' : ''}`, text: stampOf(t, r) }) : el('span', { class: 'sr-only', text: isCur ? 'právě řešíš' : 'čeká' }));
    ol.append(li);
  });
  const done = S.results.length;
  $('inbox-note').textContent = S.tutorial ? 'Ukázka se do výsledku nepočítá.' : `Vyřízeno ${done} z ${S.tasks.length}.`;
}

/* ================= Závěr ================= */
function end() {
  clearInterval(S.tick);
  const total = S.results.length;
  const firstTry = S.results.filter(r => r.firstTry).length;
  const solved = S.results.filter(r => r.solved).length;
  const hints = S.results.reduce((s, r) => s + r.hints, 0);
  const scams = S.results.filter(r => r.scam && r.solved).length;
  const ms = $('opt-timer').checked ? Date.now() - S.start : null;
  const rec = { firstTry, total, hints, ms, variant: S.variant };
  store.best = store.best || {};
  const isNew = L.isBetter(rec, store.best[S.mode]);
  if (isNew) { store.best[S.mode] = rec; save(); }
  const ratio = total ? firstTry / total : 0;
  $('badge-title').textContent = ratio >= 0.9 ? 'Velitel(ka) hlídky' : ratio >= 0.6 ? 'Zkušený člen hlídky' : 'Člen hlídky v tréninku';
  $('badge-sub').textContent = `${MODE_LABEL[S.mode]} · varianta ${S.variant}`;
  $('badge-card').dataset.rank = ratio >= 0.9 ? 'gold' : ratio >= 0.6 ? 'silver' : 'bronze';
  $('result').textContent = `Vyřešil(a) jsi ${solved} z ${total} úloh, ${firstTry} napoprvé.` + (isNew && firstTry > 0 ? ' To je tvůj nový osobní rekord!' : '');
  const dl = $('stats');
  dl.replaceChildren();
  const stat = (k, v) => dl.append(el('div', {}, el('dt', { text: k }), el('dd', { text: v })));
  stat('Napoprvé', `${firstTry} z ${total}`);
  stat('Odhalené podvody', String(scams));
  stat('Nápovědy', String(hints));
  if (ms != null) stat('Čas', fmt(ms));
  const ul = $('skills');
  ul.replaceChildren();
  for (const [k, text] of Object.entries(L.SKILLS)) {
    const rs = S.results.filter(r => r.skill === k);
    if (!rs.length) continue;
    const good = rs.every(r => r.solved);
    ul.append(el('li', { class: good ? 'ok' : 'again' }, el('span', { 'aria-hidden': 'true', text: good ? '✓ ' : '↻ ' }), text, good ? '' : ' – procvič ještě'));
  }
  show('s-end');
  $('end-h').focus();
  renderBest();
}

/* ================= Nástroje ================= */
const DEFAULT_STATUS = 'Najeď myší na odkaz nebo na něj přejdi klávesou Tab – tady uvidíš, kam opravdu vede.';

/** Zpráva s klikacími částmi (e-mail, SMS, chat, příspěvek) + verdikt. */
function inspectTool(t) {
  const marks = new Set();
  const spotEls = new Map();
  let verdict = null;
  let locked = false;
  let userMarks = null; // co žák označil sám (před „Ukázat řešení“)
  const m = t.msg;
  const hasLinks = L.spotsOf(t).some(s => s.href);

  const counter = el('p', { class: 'counter', 'aria-live': 'polite' });
  const status = el('p', { class: 'statusbar', id: 'statusbar' });
  const setStatus = s => {
    status.replaceChildren();
    if (s?.href) status.append(el('span', { class: 'statusbar__k', text: 'Odkaz vede na: ' }), el('span', { class: 'statusbar__url', text: s.href }));
    else status.textContent = DEFAULT_STATUS;
  };
  setStatus(null);

  function updateCounter() {
    counter.replaceChildren(el('span', { 'aria-hidden': 'true', text: '🚩 ' }), `Označeno: ${marks.size}`);
  }
  function toggle(s) {
    if (locked) return;
    const node = spotEls.get(s.id);
    if (marks.has(s.id)) marks.delete(s.id); else marks.add(s.id);
    const on = marks.has(s.id);
    node.classList.toggle('is-marked', on);
    node.classList.remove('is-wrong');
    node.setAttribute('aria-pressed', String(on));
    updateCounter();
  }
  function spot(s, extraClass = '') {
    const node = el('span', { class: `spot${s.href ? ' spot--link' : ''}${extraClass ? ' ' + extraClass : ''}`, role: 'button', tabindex: '0', 'aria-pressed': 'false', 'data-id': s.id }, s.text);
    if (s.href) node.append(el('span', { class: 'sr-only', text: ` (odkaz, vede na ${s.href})` }));
    node.addEventListener('click', () => { toggle(s); if (s.href) setStatus(s); });
    node.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(s); }
    });
    if (s.href) {
      node.addEventListener('mouseenter', () => setStatus(s));
      node.addEventListener('focus', () => setStatus(s));
      node.addEventListener('mouseleave', () => { if (document.activeElement !== node) setStatus(null); });
      node.addEventListener('blur', () => setStatus(null));
    }
    spotEls.set(s.id, node);
    return node;
  }
  const paragraph = (spots, cls) => el('p', { class: cls }, spots.flatMap((s, i) => (i ? [' ', spot(s)] : [spot(s)])));

  let frame;
  if (m.kind === 'email') {
    frame = el('div', { class: 'mail' },
      el('div', { class: 'mail__bar', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'), el('span', { text: 'Školní pošta' })),
      el('dl', { class: 'mail__head' },
        el('div', {}, el('dt', { text: 'Od:' }), el('dd', {}, spot(m.from))),
        m.subject ? el('div', {}, el('dt', { text: 'Předmět:' }), el('dd', { class: 'mail__subject' }, spot(m.subject))) : null,
        el('div', {}, el('dt', { text: 'Přijato:' }), el('dd', { class: 'muted', text: m.time }))),
      el('div', { class: 'mail__body' }, m.body.map(p => paragraph(p))),
      m.attachments?.length ? el('div', { class: 'mail__att' }, el('span', { class: 'mail__att-k', text: 'Příloha:' }), m.attachments.map(a => spot(a, 'spot--file'))) : null);
  } else if (m.kind === 'sms' || m.kind === 'chat') {
    frame = el('div', { class: `phone phone--${m.kind}` },
      el('div', { class: 'phone__top' },
        el('span', { class: 'phone__avatar', 'aria-hidden': 'true', text: m.kind === 'sms' ? '✉' : '👤' }),
        el('span', { class: 'phone__from' }, spot(m.from)),
        el('span', { class: 'phone__time', text: m.time })),
      el('div', { class: 'phone__msgs' }, m.body.map(p => paragraph(p, 'bubble'))));
  } else {
    frame = el('div', { class: 'post' },
      el('div', { class: 'post__head' }, el('span', { class: 'post__avatar', 'aria-hidden': 'true', text: '🙂' }), el('span', { class: 'post__from' }, spot(m.from)), el('span', { class: 'post__time', text: m.time })),
      el('div', { class: 'post__body' }, m.body.map(p => paragraph(p))),
      m.photo ? el('figure', { class: 'post__photo' },
        el('figcaption', {}, el('span', { 'aria-hidden': 'true', text: '📷 ' }), m.photo.label),
        el('div', { class: 'post__items' }, m.photo.items.map(s => spot(s, 'spot--item')))) : null,
      el('div', { class: 'post__foot' }, (m.footer || []).map(s => spot(s, 'spot--setting'))));
  }

  const choices = el('fieldset', { class: 'choices verdicts' }, el('legend', { text: 'Tvůj verdikt' }),
    t.verdicts.map(v => {
      const input = el('input', { type: 'radio', name: 'verdict', value: v });
      input.addEventListener('change', () => { verdict = v; });
      return el('label', { class: `choice choice--${v}` }, input, el('span', {}, el('b', { text: L.VERDICTS[v].label }), el('small', { text: L.VERDICTS[v].desc })));
    }));

  updateCounter();
  const node = el('div', { class: 'tool-stack' }, counter, frame, hasLinks ? status : null, choices);
  return {
    node,
    get: () => ({ marks: [...marks], verdict }),
    set(sol) {
      userMarks = new Set(marks);
      for (const id of [...marks]) toggle({ id });
      for (const id of sol.marks) toggle({ id });
      verdict = sol.verdict;
      const r = choices.querySelector(`input[value="${sol.verdict}"]`);
      if (r) r.checked = true;
    },
    flag(ids) { for (const id of ids) spotEls.get(id)?.classList.add('is-wrong'); },
    lock() {
      locked = true;
      choices.disabled = true;
      node.classList.add('is-locked');
      for (const n of spotEls.values()) n.setAttribute('aria-disabled', 'true');
    },
    debrief() {
      const clues = L.cluesOf(t);
      for (const s of clues) spotEls.get(s.id)?.classList.add('is-clue');
      const box = el('section', { class: 'debrief', 'aria-label': 'Rozbor zprávy' });
      if (clues.length) {
        box.append(el('h3', { text: `Stopy v této zprávě (${clues.length})` }));
        box.append(el('ul', { class: 'debrief__list' }, clues.map(s => {
          const got = (userMarks ?? marks).has(s.id);
          return el('li', { class: got ? 'is-found' : 'is-missed' },
            el('span', { class: 'debrief__mark', text: got ? '✓ našel(a) jsi' : '○ další stopa' }),
            el('b', { text: s.text }), el('span', { text: s.clue }));
        })));
      } else {
        const reasons = L.spotsOf(t).filter(s => s.ok && s.ok !== 'Tahle část sama o sobě nic podezřelého neobsahuje.');
        box.append(el('h3', { text: 'Proč je to v pořádku' }));
        box.append(el('ul', { class: 'debrief__list' }, reasons.map(s => el('li', { class: 'is-found' }, el('b', { text: s.text }), el('span', { text: s.ok })))));
      }
      if (t.lesson) box.append(el('p', { class: 'small muted', text: t.lesson }));
      $('debrief').replaceChildren(box);
    }
  };
}

/** Výběr z možností (skutečné radio). */
function choiceTool(t) {
  let option = null;
  const fs = el('fieldset', { class: 'choices' }, el('legend', { class: 'sr-only', text: t.title }),
    t.options.map((text, idx) => {
      const input = el('input', { type: 'radio', name: 'opt', value: String(idx) });
      input.addEventListener('change', () => { option = idx; });
      return el('label', { class: 'choice' }, input, el('span', { text }));
    }));
  return {
    node: el('div', { class: 'tool-stack' }, fs),
    get: () => ({ option }),
    set(sol) { option = sol.option; fs.querySelector(`input[value="${sol.option}"]`).checked = true; },
    lock() { fs.disabled = true; },
    debrief() {
      $('debrief').replaceChildren(el('section', { class: 'debrief', 'aria-label': 'Rozbor možností' },
        el('h3', { text: 'Proč ano a proč ne' }),
        el('ul', { class: 'debrief__list' }, t.options.map((o, i) => el('li', { class: i === t.correct ? 'is-found' : 'is-missed' },
          el('span', { class: 'debrief__mark', text: i === t.correct ? '✓ správně' : '✗' }), el('b', { text: o }), el('span', { text: t.why[i] }))))));
    }
  };
}

/** Stavba hesla s živým měřákem síly. */
function passwordTool(t) {
  const input = el('input', { id: 'pw', class: 'answer', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-describedby': 'pw-note pw-label' });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  const bar = el('span', { class: 'meter__fill' });
  const label = el('span', { id: 'pw-label', class: 'meter__label', 'aria-live': 'polite' });
  const crack = el('p', { class: 'small' });
  const items = {
    long: el('li'), noCommon: el('li'), noPersonal: el('li'), strong: el('li')
  };
  const texts = {
    long: 'Aspoň 12 znaků (délka pomáhá nejvíc)',
    noCommon: 'Žádné běžné heslo ani řada (heslo, 123, qwertz)',
    noPersonal: 'Nic z profilu',
    strong: 'Síla: silné'
  };
  function update() {
    const r = L.passwordReport(input.value, t.personal);
    const empty = !input.value;
    bar.style.width = empty ? '0%' : `${Math.min(100, Math.max(6, (r.bits / 80) * 100))}%`;
    bar.dataset.level = String(r.level);
    label.textContent = empty ? 'Síla: zatím nic' : `Síla: ${r.label.toLowerCase()} (${r.length} ${plural(r.length, 'znak', 'znaky', 'znaků')})`;
    crack.textContent = empty ? 'Odhad prolomení se ukáže, až začneš psát.' : `Útočník, který zkouší 10 miliard hesel za sekundu, by ho prolomil: ${r.crack}.`;
    for (const [k, li] of Object.entries(items)) {
      const okK = !empty && r.checks[k];
      li.className = okK ? 'is-ok' : 'is-no';
      li.replaceChildren(el('span', { 'aria-hidden': 'true', text: okK ? '✓ ' : '○ ' }), texts[k], el('span', { class: 'sr-only', text: okK ? ' – splněno' : ' – zatím ne' }));
    }
  }
  input.addEventListener('input', update);
  const profile = el('dl', { class: 'profile' }, t.profile.map(([k, v]) => el('div', {}, el('dt', { text: k }), el('dd', { text: v }))));
  const node = el('div', { class: 'tool-pw' },
    el('section', { class: 'profile-card', 'aria-label': 'Tvůj veřejný profil' }, el('h3', {}, el('span', { 'aria-hidden': 'true', text: '👤 ' }), 'Tvůj veřejný profil'), profile, el('p', { class: 'small muted', text: 'Tohle o tobě vidí kdokoli – útočník taky.' })),
    el('div', { class: 'pw-side' },
      el('label', { class: 'answer-field', for: 'pw' }, 'Nové heslo'),
      input,
      el('p', { id: 'pw-note', class: 'small warn-note', text: '⚠ Nepiš sem svoje skutečné heslo – je to jen trénink. Nic se neukládá ani neodesílá.' }),
      el('div', { class: 'meter', 'aria-hidden': 'true' }, bar),
      label, crack,
      el('ul', { class: 'checklist' }, Object.values(items))));
  update();
  return {
    node,
    get: () => ({ value: input.value }),
    set(sol) { input.value = sol.value; update(); },
    lock() { input.readOnly = true; },
    debrief() {
      $('debrief').replaceChildren(el('section', { class: 'debrief', 'aria-label': 'Tip' },
        el('h3', { text: 'Tip hlídky' }),
        el('p', { text: 'Silné heslo = dlouhá fráze z nesouvisejících slov. Pro každý účet jiné heslo a všude, kde to jde, zapni druhý krok přihlášení (kód z SMS nebo z aplikace).' })));
    }
  };
}

const TOOLS = { inspect: inspectTool, choice: choiceTool, password: passwordTool };

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
    el('p', { class: 'warn', text: 'Opravdu smazat výsledky Phishingové hlídky v tomto prohlížeči? Ostatní hry zůstanou beze změny.' }),
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

/* Návrat do menu hry – když už je něco vyřešené, nejdřív se zeptá (rozehraná služba se neukládá). */
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
