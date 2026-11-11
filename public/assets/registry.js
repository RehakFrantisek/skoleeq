// Sdílené schéma registru aplikací (public/apps.json).
// Používá ho katalog v prohlížeči (portal.js) i validátor v Node (scripts/validate-apps.mjs),
// takže pravidla jsou na jednom místě. Žádné závislosti, čistý ES modul.

export const SCHEMA_VERSION = 1;

export const DIFFICULTIES = { lehka: 'Lehká', stredni: 'Střední', narocna: 'Náročná' };
export const STATUSES = ['published', 'draft', 'hidden'];
export const COLORS = ['violet', 'blue', 'teal', 'green', 'orange', 'red', 'pink', 'yellow'];
export const ICONS = ['keyboard', 'mouse', 'binary', 'code', 'lock', 'network', 'globe', 'puzzle', 'book', 'calculator', 'chart', 'robot'];
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const REQUIRED = ['id', 'title', 'description', 'url', 'subject', 'grades', 'topics', 'difficulty', 'durationMinutes', 'icon', 'color', 'requiresKeyboard', 'status'];
const OPTIONAL = ['subtitle', 'featured', 'thumbnail'];
const KNOWN = new Set([...REQUIRED, ...OPTIONAL]);

const isText = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[<>]/.test(v);

/** Vrátí pole chybových hlášek (česky). Prázdné pole = záznam je v pořádku. */
export function validateApp(app) {
  const e = [];
  if (!app || typeof app !== 'object' || Array.isArray(app)) return ['záznam musí být objekt'];
  for (const k of REQUIRED) if (!(k in app)) e.push(`chybí povinné pole "${k}"`);
  for (const k of Object.keys(app)) if (!KNOWN.has(k)) e.push(`neznámé pole "${k}" (překlep?)`);

  if ('id' in app && (typeof app.id !== 'string' || !SLUG_RE.test(app.id) || app.id.length > 60)) e.push('"id" musí být slug: malá písmena bez diakritiky, číslice a pomlčky (např. "binarni-vyzva")');
  if ('url' in app) {
    if (typeof app.url !== 'string' || app.url.includes('..') || app.url.includes('\\') || !/^\/aplikace\/[a-z0-9-]+\/$/.test(app.url)) e.push('"url" musí mít tvar /aplikace/<slug>/ (začíná i končí lomítkem, bez "..")');
    else if (typeof app.id === 'string' && app.url !== `/aplikace/${app.id}/`) e.push(`"url" musí odpovídat id: /aplikace/${app.id}/`);
  }
  if ('title' in app && !isText(app.title, 60)) e.push('"title" musí být neprázdný text do 60 znaků (bez < >)');
  if ('subtitle' in app && !isText(app.subtitle, 80)) e.push('"subtitle" musí být neprázdný text do 80 znaků');
  if ('description' in app && !isText(app.description, 300)) e.push('"description" musí být neprázdný text do 300 znaků');
  if ('subject' in app && !isText(app.subject, 40)) e.push('"subject" musí být neprázdný text do 40 znaků');
  if ('grades' in app) {
    const g = app.grades;
    if (!Array.isArray(g) || !g.length || !g.every(n => Number.isInteger(n) && n >= 1 && n <= 9)) e.push('"grades" musí být neprázdné pole celých čísel 1–9');
    else if (new Set(g).size !== g.length) e.push('"grades" obsahuje duplicitu');
  }
  if ('topics' in app && (!Array.isArray(app.topics) || !app.topics.length || app.topics.length > 8 || !app.topics.every(t => isText(t, 40)))) e.push('"topics" musí být pole 1–8 neprázdných textů do 40 znaků');
  if ('difficulty' in app && !Object.hasOwn(DIFFICULTIES, app.difficulty)) e.push(`"difficulty" musí být jedno z: ${Object.keys(DIFFICULTIES).join(', ')}`);
  if ('durationMinutes' in app && !(Number.isInteger(app.durationMinutes) && app.durationMinutes > 0 && app.durationMinutes <= 240)) e.push('"durationMinutes" musí být kladné celé číslo (max. 240)');
  if ('icon' in app && !ICONS.includes(app.icon)) e.push(`"icon" musí být jedno z: ${ICONS.join(', ')}`);
  if ('color' in app && !COLORS.includes(app.color)) e.push(`"color" musí být jedno z: ${COLORS.join(', ')}`);
  if ('featured' in app && typeof app.featured !== 'boolean') e.push('"featured" musí být true/false');
  if ('requiresKeyboard' in app && typeof app.requiresKeyboard !== 'boolean') e.push('"requiresKeyboard" musí být true/false');
  if ('status' in app && !STATUSES.includes(app.status)) e.push(`"status" musí být jedno z: ${STATUSES.join(', ')}`);
  if ('thumbnail' in app && (typeof app.thumbnail !== 'string' || !/^[a-z0-9][a-z0-9._-]*\.(svg|png|jpe?g|webp|avif)$/i.test(app.thumbnail) || app.thumbnail.includes('..'))) e.push('"thumbnail" musí být název souboru ve složce aplikace (např. "nahled.svg")');
  return e;
}

/**
 * Zkontroluje celý registr. Vrací { apps, problems }:
 *  apps     – záznamy bez chyb (ve stejném pořadí),
 *  problems – [{ index, id, errors[] }] pro chybné záznamy a globální chyby (index -1).
 */
export function validateRegistry(json) {
  const problems = [];
  if (!json || typeof json !== 'object' || !Array.isArray(json.apps)) {
    return { apps: [], problems: [{ index: -1, id: null, errors: ['registr musí být objekt s polem "apps"'] }] };
  }
  if (json.schemaVersion !== SCHEMA_VERSION) problems.push({ index: -1, id: null, errors: [`"schemaVersion" musí být ${SCHEMA_VERSION}`] });
  const seen = new Set();
  const apps = [];
  json.apps.forEach((app, index) => {
    const errors = validateApp(app);
    const id = app && typeof app.id === 'string' ? app.id : null;
    if (id && seen.has(id)) errors.push(`duplicitní id "${id}"`);
    if (id) seen.add(id);
    if (errors.length) problems.push({ index, id, errors });
    else apps.push(app);
  });
  return { apps, problems };
}
