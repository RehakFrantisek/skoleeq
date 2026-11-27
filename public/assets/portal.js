// Katalog her a výkladů – načte /apps.json, zvaliduje, vykreslí karty a lokálně filtruje.
// Bezpečnost: veškerý text z registru jde do DOM přes textContent / atributy,
// innerHTML se používá jen pro konstantní SVG ikony z whitelistu níže.
import { validateRegistry, DIFFICULTIES, KINDS, kindOf } from './registry.js';

const $ = sel => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* ---------- Ikony (konstantní, důvěryhodné SVG) ---------- */
const P = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICON_SVG = {
  keyboard: `<rect x="2.5" y="6" width="19" height="12" rx="2.5" ${P}/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" ${P}/>`,
  mouse: `<rect x="6" y="3" width="12" height="18" rx="6" ${P}/><path d="M12 7v4" ${P}/>`,
  binary: `<rect x="4" y="4" width="5" height="7" rx="2.5" ${P}/><path d="M15 4v7M13.5 5.5 15 4M15 13v7M13.5 14.5 15 13" ${P}/><rect x="4" y="13" width="5" height="7" rx="2.5" ${P}/>`,
  code: `<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" ${P}/>`,
  lock: `<rect x="5" y="10.5" width="14" height="10" rx="2.5" ${P}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5" ${P}/>`,
  network: `<circle cx="12" cy="5" r="2.5" ${P}/><circle cx="5" cy="19" r="2.5" ${P}/><circle cx="19" cy="19" r="2.5" ${P}/><path d="M12 7.5v4.5M12 12l-5.5 4.8M12 12l5.5 4.8" ${P}/>`,
  globe: `<circle cx="12" cy="12" r="9" ${P}/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" ${P}/>`,
  puzzle: `<path d="M5 8h3a2 2 0 1 1 4 0h3v3a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H5v-4a2 2 0 1 0 0-4z" ${P}/>`,
  book: `<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" ${P}/>`,
  calculator: `<rect x="5" y="2.5" width="14" height="19" rx="2.5" ${P}/><path d="M8.5 6.5h7M9 11h.01M12 11h.01M15 11h.01M9 14.5h.01M12 14.5h.01M15 14.5h.01M9 18h.01M12 18h.01M15 18h.01" ${P}/>`,
  chart: `<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" ${P}/>`,
  robot: `<rect x="4.5" y="8" width="15" height="11" rx="3" ${P}/><path d="M12 4v4M9.5 13h.01M14.5 13h.01M9.5 16h5M2.5 13v2M21.5 13v2" ${P}/><circle cx="12" cy="3.5" r="1" ${P}/>`,
  slides: `<rect x="3" y="4" width="18" height="12" rx="2" ${P}/><path d="M12 16v4M8 20h8M7 12l3-3 2 2 4-4" ${P}/>`,
  document: `<path d="M6 3h8l4 4v14H6z" ${P}/><path d="M14 3v4h4M9 11h6M9 14.5h6M9 18h4" ${P}/>`
};
function icon(name, cls = 'icon') {
  const span = el('span', cls);
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24">${ICON_SVG[name] || ICON_SVG.puzzle}</svg>`;
  return span;
}

/* ---------- Pomocné funkce ---------- */
// Bez diakritiky a bez ohledu na velikost písmen: "sifry" najde "šifry".
export const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function gradesLabel(grades) {
  const g = [...grades].sort((a, b) => a - b);
  if (g.length === 1) return `${g[0]}. ročník`;
  const contiguous = g.every((n, i) => i === 0 || n === g[i - 1] + 1);
  if (contiguous) return `${g[0]}.–${g[g.length - 1]}. ročník`;
  return g.slice(0, -1).map(n => n + '.').join(', ') + ` a ${g[g.length - 1]}. ročník`;
}
function itemsLabel(n) {
  if (n === 1) return '1 položka';
  if (n >= 2 && n <= 4) return `${n} položky`;
  return `${n} položek`;
}
// Text tlačítka a popisek pro čtečky podle druhu položky
const LAUNCH = {
  hra: { text: 'Spustit', aria: 'Spustit hru' },
  vyklad: { text: 'Spustit výklad', aria: 'Spustit výklad' },
  nastroj: { text: 'Otevřít', aria: 'Otevřít nástroj' }
};

/* ---------- Stav filtrů (synchronizovaný s URL) ---------- */
const FILTERS = [
  { key: 'q', input: '#q' },
  { key: 'druh', input: '#f-druh' },
  { key: 'rocnik', input: '#f-rocnik' },
  { key: 'predmet', input: '#f-predmet' },
  { key: 'tema', input: '#f-tema' },
  { key: 'obtiznost', input: '#f-obtiznost' }
];
let APPS = [];
let PLANNED = [];

function readUrl() {
  const p = new URLSearchParams(location.search);
  const s = {};
  for (const f of FILTERS) s[f.key] = (p.get(f.key) || '').slice(0, 100);
  return s;
}
function readForm() {
  const s = {};
  for (const f of FILTERS) s[f.key] = $(f.input).value;
  return s;
}
function writeUrl(state) {
  const p = new URLSearchParams();
  for (const f of FILTERS) if (state[f.key]) p.set(f.key, state[f.key]);
  const qs = p.toString();
  const url = location.pathname + (qs ? '?' + qs : '') + location.hash;
  if (url !== location.pathname + location.search + location.hash) history.replaceState(null, '', url);
}
const isActive = s => FILTERS.some(f => s[f.key]);

function matches(app, s) {
  if (s.druh && kindOf(app) !== s.druh) return false;
  if (s.rocnik && !app.grades.includes(Number(s.rocnik))) return false;
  if (s.predmet && app.subject !== s.predmet) return false;
  if (s.tema && !app.topics.includes(s.tema)) return false;
  if (s.obtiznost && app.difficulty !== s.obtiznost) return false;
  if (s.q) {
    const hay = fold([app.title, app.subtitle || '', app.description, app.subject, ...app.topics].join(' '));
    return fold(s.q).split(/\s+/).filter(Boolean).every(w => hay.includes(w));
  }
  return true;
}

/* ---------- Naplnění výběrů z registru ---------- */
function fillSelect(sel, values, labelOf = v => v) {
  const select = $(sel);
  const first = select.options[0];
  select.replaceChildren(first);
  for (const v of values) {
    const o = el('option', null, labelOf(v));
    o.value = String(v);
    select.append(o);
  }
}
function buildFilterOptions() {
  const cs = (a, b) => a.localeCompare(b, 'cs');
  const kinds = new Set(APPS.map(kindOf));
  fillSelect('#f-druh', Object.keys(KINDS).filter(k => kinds.has(k)), k => KINDS[k].plural);
  fillSelect('#f-rocnik', [1, 2, 3, 4, 5, 6, 7, 8, 9], n => `${n}. ročník`);
  fillSelect('#f-predmet', [...new Set(APPS.map(a => a.subject))].sort(cs));
  fillSelect('#f-tema', [...new Set(APPS.flatMap(a => a.topics))].sort(cs));
  const used = new Set(APPS.map(a => a.difficulty));
  fillSelect('#f-obtiznost', Object.keys(DIFFICULTIES).filter(d => used.has(d)), d => DIFFICULTIES[d]);
}
function applyStateToForm(s) {
  for (const f of FILTERS) {
    const input = $(f.input);
    input.value = s[f.key];
    // neplatná hodnota v URL (např. smazané téma) => select se vrátí na „vše“
    if (input.tagName === 'SELECT' && input.value !== s[f.key]) input.value = '';
  }
}

/* ---------- Vykreslení ---------- */
function card(app) {
  const a = el('article', 'app-card');
  a.dataset.color = app.color;
  a.dataset.id = app.id;
  const kind = kindOf(app);
  a.dataset.kind = kind;

  const media = el('div', 'app-card__media');
  if (app.thumbnail) {
    const img = el('img');
    img.src = app.url + app.thumbnail;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 320; img.height = 180;
    img.addEventListener('error', () => img.replaceWith(icon(app.icon, 'app-card__icon')));
    media.append(img);
  } else {
    media.append(icon(app.icon, 'app-card__icon'));
  }
  media.append(el('span', 'app-card__subject', app.subject));

  const body = el('div', 'app-card__body');
  const grades = el('p', 'app-card__grades');
  if (kind !== 'hra') grades.append(el('span', 'app-card__kind', KINDS[kind].label), document.createTextNode(' · '));
  grades.append(document.createTextNode(gradesLabel(app.grades)));
  body.append(grades);
  body.append(el('h3', 'app-card__title', app.title));
  if (app.subtitle) body.append(el('p', 'app-card__subtitle', app.subtitle));
  body.append(el('p', 'app-card__desc', app.description));

  const tags = el('ul', 'tags');
  tags.setAttribute('aria-label', 'Témata');
  for (const t of app.topics) tags.append(el('li', 'tag', t));
  body.append(tags);

  const meta = el('ul', 'meta');
  const time = el('li', 'meta__item');
  time.append(el('span', 'meta__ico', '⏱'), document.createTextNode(`asi ${app.durationMinutes} min`));
  time.firstChild.setAttribute('aria-hidden', 'true');
  meta.append(time);
  if (kind === 'hra') meta.append(el('li', 'meta__item', `Obtížnost: ${DIFFICULTIES[app.difficulty]}`));
  if (app.requiresKeyboard) {
    const kb = el('li', 'meta__item meta__item--kb');
    kb.append(icon('keyboard', 'meta__svg'), document.createTextNode('Vyžaduje klávesnici'));
    meta.append(kb);
  }
  body.append(meta);

  const foot = el('div', 'app-card__foot');
  const link = el('a', 'btn btn--primary app-card__link', LAUNCH[kind].text);
  link.href = app.url;
  link.setAttribute('aria-label', `${LAUNCH[kind].aria} ${app.title}`);
  foot.append(link);
  if (app.teacher) foot.append(teacherLink(app));
  body.append(foot);

  a.append(media, body);
  return a;
}

function teacherLink(app) {
  const t = el('a', 'teacher-link', 'Pro učitele');
  t.href = `/pro-ucitele/#${app.id}`;
  t.setAttribute('aria-label', `Pro učitele: ${app.title}`);
  return t;
}

/** Připravovaná hra: stejné informace, ale bez odkazu na spuštění. */
function plannedCard(app) {
  const a = el('article', 'plan-card');
  a.dataset.color = app.color;
  a.dataset.id = app.id;
  const head = el('div', 'plan-card__head');
  head.append(icon(app.icon, 'plan-card__icon'));
  const t = el('div');
  t.append(el('p', 'plan-card__badge', 'Připravujeme'));
  t.append(el('h4', 'plan-card__title', app.title));
  head.append(t);
  a.append(head);
  a.append(el('p', 'plan-card__grades', `${gradesLabel(app.grades)} · asi ${app.durationMinutes} min`));
  a.append(el('p', 'plan-card__desc', app.description));
  const tags = el('ul', 'tags');
  tags.setAttribute('aria-label', 'Témata');
  for (const x of app.topics) tags.append(el('li', 'tag', x));
  a.append(tags);
  if (app.teacher) a.append(teacherLink(app));
  return a;
}

function soonTile() {
  const t = el('div', 'soon-tile');
  t.append(icon('puzzle', 'soon-tile__icon'));
  t.append(el('p', 'soon-tile__title', 'Další hry se připravují'));
  t.append(el('p', 'soon-tile__text', 'Katalog postupně roste. Každá nová hra se tu objeví automaticky.'));
  return t;
}

function renderFeatured() {
  const box = $('#featured');
  const app = APPS.find(x => x.featured);
  if (!app) { box.hidden = true; return; }
  box.replaceChildren();
  box.dataset.color = app.color;
  box.append(el('p', 'spot__label', 'Doporučujeme'));
  const head = el('div', 'spot__head');
  head.append(icon(app.icon, 'spot__icon'));
  const t = el('div');
  t.append(el('p', 'spot__title', app.title));
  if (app.subtitle) t.append(el('p', 'spot__subtitle', app.subtitle));
  head.append(t);
  box.append(head);
  box.append(el('p', 'spot__desc', app.description));
  const facts = el('p', 'spot__facts', `${app.subject} · ${gradesLabel(app.grades)} · asi ${app.durationMinutes} min`);
  box.append(facts);
  const go = el('a', 'btn btn--accent', 'Hrát hned');
  go.href = app.url;
  go.setAttribute('aria-label', `Hrát hned: ${app.title}`);
  box.append(go);
  box.hidden = false;
}

function render() {
  const s = readForm();
  writeUrl(s);
  const list = APPS.filter(a => matches(a, s));
  const grid = $('#grid');
  grid.replaceChildren(...list.map(card));
  const planned = PLANNED.filter(a => matches(a, s));
  $('#planned').hidden = planned.length === 0;
  $('#planned-grid').replaceChildren(...planned.map(plannedCard));
  // Malý katalog bez filtrů a bez připravovaných her: dlaždice „připravujeme“, ať jediná karta nepůsobí osaměle
  if (!isActive(s) && list.length > 0 && list.length < 3 && !PLANNED.length) grid.append(soonTile());
  grid.setAttribute('aria-busy', 'false');
  grid.hidden = list.length === 0;
  $('#empty').hidden = list.length !== 0;
  $('#clear-filters').hidden = !isActive(s);
  $('#count').textContent = isActive(s)
    ? `Nalezeno: ${itemsLabel(list.length)} z ${APPS.length}`
    : `${itemsLabel(APPS.length)} v katalogu`;
  $('#touch-hint').hidden = !(isTouchOnly() && list.some(a => a.requiresKeyboard));
}

function isTouchOnly() {
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
}

function resetFilters() {
  $('#filters').reset();
  render();
  $('#q').focus();
}

/* ---------- Načtení registru ---------- */
async function load() {
  $('#error').hidden = true;
  $('#grid').hidden = false;
  $('#grid').setAttribute('aria-busy', 'true');
  try {
    const res = await fetch('/apps.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const { apps, problems } = validateRegistry(await res.json());
    for (const p of problems) console.warn('[katalog] přeskočen neplatný záznam', p.id ?? `#${p.index}`, p.errors);
    APPS = apps.filter(a => a.status === 'published');
    PLANNED = apps.filter(a => a.status === 'planned');
    buildFilterOptions();
    applyStateToForm(readUrl());
    renderFeatured();
    render();
  } catch (err) {
    console.error('[katalog] načtení selhalo', err);
    $('#grid').replaceChildren();
    $('#grid').hidden = true;
    $('#grid').setAttribute('aria-busy', 'false');
    $('#empty').hidden = true;
    $('#count').textContent = '';
    $('#error').hidden = false;
  }
}

function init() {
  const form = $('#filters');
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('input', render);
  form.addEventListener('change', render);
  // type="reset" vyprázdní pole až po události – render spustíme v dalším tiku
  form.addEventListener('reset', () => setTimeout(() => { render(); $('#q').focus(); }, 0));
  document.querySelectorAll('[data-reset]').forEach(b => b.addEventListener('click', resetFilters));
  $('#retry').addEventListener('click', load);
  load();
}

init();
