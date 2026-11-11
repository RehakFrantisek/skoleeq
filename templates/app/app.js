'use strict';
/* {{TITLE}} – ukázková kostra hry. Nahraď otázky a logiku vlastní hrou.
   Pravidla: žádné importy z jiných her, žádné externí knihovny/CDN,
   localStorage jen pod vlastním klíčem níže. */

const STORE_KEY = 'vyukovy-portal:{{ID}}:v1'; // unikátní klíč – všechny hry sdílejí jeden origin!

const QUESTIONS = [
  { q: 'Kolik je 2 + 2?', answers: ['3', '4', '5'], correct: 1 },
  { q: 'Která klávesa maže znak vlevo od kurzoru?', answers: ['Delete', 'Backspace', 'Enter'], correct: 1 },
  { q: 'Kolik bitů má jeden bajt?', answers: ['8', '10', '16'], correct: 0 }
];

const $ = id => document.getElementById(id);
const state = { i: 0, score: 0 };

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { best: null }; } catch { return { best: null }; }
}
function save(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* hraje se dál i bez úložiště */ }
}
const data = load();

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
}

function renderBest() {
  $('best').textContent = data.best == null ? 'Zatím žádný výsledek.' : `Tvůj nejlepší výsledek: ${data.best} z ${QUESTIONS.length}`;
}

function start() {
  state.i = 0; state.score = 0;
  show('play-screen');
  next();
}

function next() {
  if (state.i >= QUESTIONS.length) return finish();
  const item = QUESTIONS[state.i];
  $('progress').textContent = `Otázka ${state.i + 1} z ${QUESTIONS.length}`;
  $('question').textContent = item.q;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  $('answers').replaceChildren(...item.answers.map((text, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    b.textContent = text;
    b.addEventListener('click', () => answer(idx));
    return b;
  }));
  $('answers').querySelector('button').focus();
}

function answer(idx) {
  const ok = idx === QUESTIONS[state.i].correct;
  if (ok) state.score++;
  $('feedback').textContent = ok ? '✓ Správně!' : '✗ Tentokrát ne.';
  $('feedback').className = 'feedback ' + (ok ? 'good' : 'bad');
  for (const b of $('answers').querySelectorAll('button')) b.disabled = true;
  state.i++;
  setTimeout(next, 700);
}

function finish() {
  if (data.best == null || state.score > data.best) { data.best = state.score; save(data); }
  $('result').textContent = `Správně: ${state.score} z ${QUESTIONS.length}.`;
  show('done');
  $('again').focus();
}

$('play').addEventListener('click', start);
$('again').addEventListener('click', start);
renderBest();
