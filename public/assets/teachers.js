// Stránka „Pro učitele“ – vykreslí karty z registru /apps.json (published i planned).
// Každá karta má kotvu #<id>, takže jde otevřít přímým odkazem (/pro-ucitele/#datovi-detektivove).
// Text z registru jde do DOM jen přes textContent.
import { validateRegistry, DIFFICULTIES } from './registry.js';

const $ = sel => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const list = (items, cls) => {
  const ul = el('ul', cls);
  for (const i of items) ul.append(el('li', null, i));
  return ul;
};
function gradesLabel(g) {
  const s = [...g].sort((a, b) => a - b);
  return s.length === 1 ? `${s[0]}. ročník` : `${s.map(n => n + '.').join(', ')} ročník`;
}

function card(app) {
  const t = app.teacher;
  const a = el('article', 't-card');
  a.id = app.id;
  a.dataset.color = app.color;
  a.setAttribute('aria-labelledby', `h-${app.id}`);
  const h = el('h2', null, app.title);
  h.id = `h-${app.id}`;
  h.tabIndex = -1;
  a.append(h);
  const meta = el('p', 't-card__meta');
  const badge = el('span', 't-card__badge' + (app.status === 'planned' ? ' t-card__badge--planned' : ''), app.status === 'planned' ? 'Připravujeme' : 'Hratelné');
  meta.append(badge, ` ${app.subject} · ${gradesLabel(app.grades)} (orientačně) · asi ${app.durationMinutes} min · obtížnost ${DIFFICULTIES[app.difficulty].toLowerCase()}`);
  a.append(meta);
  a.append(el('p', null, app.description));
  if (t.gradeNote) a.append(el('p', 't-note', t.gradeNote));

  if (t.goals) { a.append(el('h3', null, 'Cíle')); a.append(list(t.goals)); }
  if (t.svp) {
    a.append(el('h3', null, 'Návaznost na ŠVP a tematický plán (doslovné citace)'));
    const ul = el('ul', 't-svp');
    for (const c of t.svp) {
      const li = el('li');
      li.append(el('b', null, `${c.grade}. ročník: `), `„${c.text}“`);
      ul.append(li);
    }
    a.append(ul);
  }
  if (t.lesson) { a.append(el('h3', null, 'Ve 45minutové hodině')); a.append(el('p', null, t.lesson)); }
  if (t.prerequisites) { a.append(el('h3', null, 'Co žák potřebuje umět předem')); a.append(list(t.prerequisites)); }
  if (t.reflection) { a.append(el('h3', null, 'Otázky k reflexi')); a.append(list(t.reflection)); }
  if (t.differentiation) { a.append(el('h3', null, 'Rychlí a začínající žáci')); a.append(el('p', null, t.differentiation)); }
  if (app.status === 'published') {
    const p = el('p');
    const go = el('a', 'btn btn--primary', 'Otevřít hru');
    go.href = app.url;
    go.setAttribute('aria-label', `Otevřít hru ${app.title}`);
    p.append(go);
    a.append(p);
  }
  return a;
}

function focusHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  const target = document.getElementById(id);
  if (!target || !target.classList.contains('t-card')) return;
  document.querySelectorAll('.t-card.is-target').forEach(x => x.classList.remove('is-target'));
  target.classList.add('is-target');
  target.scrollIntoView({ block: 'start', behavior: 'instant' });
  target.querySelector('h2').focus({ preventScroll: true });
}

async function load() {
  try {
    const res = await fetch('/apps.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { apps } = validateRegistry(await res.json());
    const shown = apps.filter(a => (a.status === 'published' || a.status === 'planned') && a.teacher)
      .sort((a, b) => (a.status === b.status ? 0 : a.status === 'published' ? -1 : 1));
    const toc = $('#toc');
    for (const app of shown) {
      const li = el('li');
      const l = el('a', null, app.title + (app.status === 'planned' ? ' (připravujeme)' : ''));
      l.href = `#${app.id}`;
      li.append(l);
      toc.append(li);
    }
    $('#cards').replaceChildren(...shown.map(card));
    $('#cards').setAttribute('aria-busy', 'false');
    focusHash();
  } catch (err) {
    console.error('[pro-ucitele] načtení selhalo', err);
    $('#cards').setAttribute('aria-busy', 'false');
    $('#error').hidden = false;
  }
}

window.addEventListener('hashchange', focusHash);
load();
