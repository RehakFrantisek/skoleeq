'use strict';
/* {{TITLE}} – kostra hry podle docs/GAME_DESIGN_SYSTEM.md.
   Nahraď data v TUTORIAL a LEVELS vlastními úlohami. Zbytek (průběh, nápovědy, oprava chyb,
   hodnocení, lokální rekord) obvykle stačí jen upravit.
   Pravidla: žádné importy z jiných her, žádné externí knihovny/CDN, text vkládej přes textContent,
   localStorage jen pod vlastním klíčem níže a vždy v try/catch. */

const STORE_KEY = 'vyukovy-portal:{{ID}}:v1'; // unikátní klíč – všechny hry sdílejí jeden origin!

/* ---------- 1) Data úloh ----------
   Každá úloha: prompt (zadání), options (možnosti), correct (index), why (vysvětlení ke každé možnosti),
   hints (aspoň 2, od obecné po konkrétní), skill (klíč dovednosti pro závěrečný přehled). */
const TUTORIAL = {
  prompt: 'Ukázka: Kolik bitů má jeden bajt?', options: ['4', '8', '10'], correct: 1,
  why: ['4 bity jsou půl bajtu.', 'Ano, 1 bajt = 8 bitů.', '10 je „kulaté“ desítkové číslo, ale bajt má 8 bitů.'],
  hints: ['Bajt je skupina bitů.', 'Je to mocnina dvou mezi 4 a 16.'], skill: 'zaklad'
};
const LEVELS = [
  { name: 'Úroveň 1', tasks: [
    { prompt: 'Kolik je 2 + 2?', options: ['3', '4', '5'], correct: 1, why: ['Zkus to spočítat na prstech.', 'Správně.', 'O jednu méně.'], hints: ['Sčítání.', '2 + 2 = 2 × 2'], skill: 'zaklad' }
  ] },
  { name: 'Úroveň 2', tasks: [
    { prompt: 'Která klávesa maže znak vlevo od kurzoru?', options: ['Delete', 'Backspace', 'Enter'], correct: 1, why: ['Delete maže vpravo.', 'Ano, Backspace maže vlevo.', 'Enter zalamuje řádek.'], hints: ['Je nad klávesou Enter.', 'Má šipku doleva.'], skill: 'klavesnice' }
  ] }
];
const SKILLS = { zaklad: 'DOPLŇ: popis dovednosti 1', klavesnice: 'DOPLŇ: popis dovednosti 2' };

/* ---------- 2) Úložiště ---------- */
function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
function save(d) { try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch { /* hraje se dál */ } }
let store = load();

/* ---------- 3) Stav a pomocníci ---------- */
const $ = id => document.getElementById(id);
const S = { tutorial: true, queue: [], i: 0, attempts: 0, hints: 0, totalHints: 0, choice: null, done: false, results: [], start: 0, tick: null };

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  $('hud').hidden = id !== 's-play';
}
function fmt(ms) { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function renderBest() {
  const b = store.best;
  $('best').textContent = b ? `Tvůj nejlepší výsledek: napoprvé ${b.firstTry} z ${b.total}, nápovědy ${b.hints}.` : 'Zatím žádný výsledek.';
}

/* ---------- 4) Průběh ---------- */
function start() {
  S.queue = LEVELS.flatMap((l, li) => l.tasks.map(t => ({ ...t, level: l.name, li })));
  S.i = 0; S.results = []; S.totalHints = 0; S.tutorial = true; S.start = Date.now();
  clearInterval(S.tick);
  $('timer').hidden = !$('opt-timer').checked;
  if ($('opt-timer').checked) S.tick = setInterval(() => { $('timer').querySelector('b').textContent = fmt(Date.now() - S.start); }, 1000);
  show('s-play');
  render();
}
const current = () => (S.tutorial ? TUTORIAL : S.queue[S.i]);

function render() {
  const t = current();
  S.attempts = 0; S.hints = 0; S.choice = null; S.done = false;
  $('task-meta').textContent = S.tutorial ? 'Ukázka' : `${t.level} · úloha ${S.i + 1} z ${S.queue.length}`;
  $('task-h').textContent = t.prompt;
  $('hints').replaceChildren();
  $('feedback').replaceChildren(); $('feedback').className = 'feedback';
  $('btn-reveal').hidden = true; $('btn-next').hidden = true;
  $('btn-check').disabled = false; $('btn-hint').disabled = false;
  const fs = $('choices');
  fs.replaceChildren(fs.querySelector('legend') || document.createElement('legend'));
  t.options.forEach((text, idx) => {
    const label = document.createElement('label');
    label.className = 'choice';
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'opt'; input.value = String(idx);
    input.addEventListener('change', () => { S.choice = idx; });
    const span = document.createElement('span');
    span.textContent = text;
    label.append(input, span);
    fs.append(label);
  });
  fs.disabled = false;
  $('progress').max = S.queue.length; $('progress').value = S.tutorial ? 0 : S.i;
  $('task-h').focus();
}

function hint() {
  const t = current();
  if (S.hints >= t.hints.length) return;
  const p = document.createElement('p');
  p.className = 'hint';
  p.textContent = `Nápověda ${S.hints + 1}: ${t.hints[S.hints]}`;
  $('hints').append(p);
  S.hints++;
  if (!S.tutorial) { S.totalHints++; $('hint-count').textContent = String(S.totalHints); }
  if (S.hints >= t.hints.length) $('btn-hint').disabled = true;
}

function feedback(kind, text) {
  const fb = $('feedback');
  fb.className = `feedback is-${kind}`;
  const icon = { good: '✓', bad: '!', solution: 'i' }[kind];
  const head = { good: 'Správně. ', bad: 'Ještě ne. ', solution: 'Řešení: ' }[kind];
  const b = document.createElement('b');
  b.textContent = `${icon} ${head}`;
  fb.replaceChildren(b, document.createTextNode(text));
}

function check() {
  if (S.done) return;
  const t = current();
  if (S.choice == null) { feedback('bad', 'Nejdřív vyber jednu možnost.'); return; }
  S.attempts++;
  const ok = S.choice === t.correct;
  feedback(ok ? 'good' : 'bad', t.why[S.choice]); // vždy vysvětli „proč“
  if (ok) finish(true);
  else if (S.attempts >= 2 && !S.tutorial) $('btn-reveal').hidden = false; // po 2 pokusech lze ukázat řešení
}

function reveal() {
  if (S.done) return;
  const t = current();
  feedback('solution', `${t.options[t.correct]} – ${t.why[t.correct]}`);
  finish(false, true);
}

function finish(solved, revealed = false) {
  if (S.done) return;
  S.done = true;
  $('choices').disabled = true;
  $('btn-check').disabled = true; $('btn-hint').disabled = true; $('btn-reveal').hidden = true;
  if (!S.tutorial) S.results.push({ skill: current().skill, solved, revealed, firstTry: solved && S.attempts === 1, hints: S.hints });
  $('btn-next').textContent = S.tutorial ? 'Spustit hru →' : S.i + 1 >= S.queue.length ? 'Dokončit →' : 'Další úkol →';
  $('btn-next').hidden = false;
  $('btn-next').focus();
}

function next() {
  if (S.tutorial) { S.tutorial = false; S.i = 0; return render(); }
  if (++S.i >= S.queue.length) return end();
  render();
}

/* ---------- 5) Závěr: přesnost + nápovědy (+ volitelně čas), lokální rekord ---------- */
function end() {
  clearInterval(S.tick);
  const total = S.results.length;
  const firstTry = S.results.filter(r => r.firstTry).length;
  const hints = S.results.reduce((s, r) => s + r.hints, 0);
  const rec = { firstTry, total, hints };
  const b = store.best;
  if (!b || firstTry > b.firstTry || (firstTry === b.firstTry && hints < b.hints)) { store.best = rec; save(store); }
  $('result').textContent = `Napoprvé ${firstTry} z ${total}, použité nápovědy: ${hints}.` + ($('opt-timer').checked ? ` Čas ${fmt(Date.now() - S.start)}.` : '');
  const ul = $('skills');
  ul.replaceChildren();
  for (const [k, text] of Object.entries(SKILLS)) {
    const rs = S.results.filter(r => r.skill === k);
    if (!rs.length) continue;
    const ok = rs.every(r => r.solved);
    const li = document.createElement('li');
    li.textContent = `${ok ? '✓' : '↻'} ${text}${ok ? '' : ' – procvič ještě'}`;
    ul.append(li);
  }
  show('s-end');
  $('end-h').focus();
}

/* ---------- 6) Události ---------- */
$('btn-start').addEventListener('click', start);
$('btn-again').addEventListener('click', start);
$('btn-hint').addEventListener('click', hint);
$('btn-check').addEventListener('click', check);
$('btn-reveal').addEventListener('click', reveal);
$('btn-next').addEventListener('click', next);
$('btn-reset').addEventListener('click', () => {
  store = {};
  try { localStorage.removeItem(STORE_KEY); } catch { /* nic */ }
  renderBest();
});
renderBest();
