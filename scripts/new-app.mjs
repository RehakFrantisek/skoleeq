#!/usr/bin/env node
// Založí novou hru ze šablony templates/app/ a přidá záznam do public/apps.json se stavem "draft".
// Použití: npm run new-app -- <slug> "Název hry"
//   např.: npm run new-app -- binarni-vyzva "Binární výzva"
// Pak doplň metadata v apps.json, naprogramuj hru a změň "status" na "published".

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { SLUG_RE } = await import(pathToFileURL(path.join(ROOT, 'public/assets/registry.js')).href);

const [slug, ...titleParts] = process.argv.slice(2);
const title = titleParts.join(' ').trim();
if (!slug || !title) {
  console.error('Použití: npm run new-app -- <slug> "Název hry"\n  např.: npm run new-app -- binarni-vyzva "Binární výzva"');
  process.exit(1);
}
if (!SLUG_RE.test(slug)) { console.error(`✗ "${slug}" není platný slug (malá písmena bez diakritiky, číslice, pomlčky).`); process.exit(1); }
if (title.length > 60 || /[<>]/.test(title)) { console.error('✗ Název musí mít max. 60 znaků a nesmí obsahovat < >.'); process.exit(1); }

const target = path.join(ROOT, 'public', 'aplikace', slug);
if (existsSync(target)) { console.error(`✗ Složka public/aplikace/${slug}/ už existuje.`); process.exit(1); }

const registryPath = path.join(ROOT, 'public', 'apps.json');
const registry = JSON.parse(await readFile(registryPath, 'utf8'));
if (registry.apps.some(a => a.id === slug)) { console.error(`✗ Id "${slug}" už v apps.json je.`); process.exit(1); }

// 1) zkopírovat šablonu s nahrazením {{ID}} a {{TITLE}}
const tpl = path.join(ROOT, 'templates', 'app');
await mkdir(target, { recursive: true });
for (const f of await readdir(tpl)) {
  const text = await readFile(path.join(tpl, f), 'utf8');
  await writeFile(path.join(target, f), text.replaceAll('{{ID}}', slug).replaceAll('{{TITLE}}', title));
}

// 2) přidat záznam (draft => katalog ho zatím nezobrazí)
registry.apps.push({
  id: slug,
  title,
  description: 'DOPLŇ: jedna až dvě věty pro žáky a učitele – co se ve hře dělá a co se procvičí.',
  url: `/aplikace/${slug}/`,
  subject: 'Informatika',
  grades: [6, 7],
  topics: ['DOPLŇ téma'],
  difficulty: 'lehka',
  durationMinutes: 10,
  icon: 'puzzle',
  color: 'teal',
  featured: false,
  requiresKeyboard: false,
  status: 'draft'
});
// pole čísel/textů na jednom řádku, jako ve zbytku souboru
const pretty = JSON.stringify(registry, null, 2)
  .replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, inner) => '[' + inner.split(/,\s*\n\s*/).join(', ') + ']');
await writeFile(registryPath, pretty + '\n');

console.log(`✓ Vytvořeno public/aplikace/${slug}/ a přidán záznam do apps.json (status "draft").
Další kroky:
  1. Naprogramuj hru v public/aplikace/${slug}/ (localStorage klíč: vyukovy-portal:${slug}:v1).
  2. V apps.json doplň popis, předmět, ročníky, témata, obtížnost, ikonu, barvu.
  3. Změň "status" na "published".
  4. npm run check   a vizuálně ověř 320 px i desktop (npm run dev).`);
