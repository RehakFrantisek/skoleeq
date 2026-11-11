#!/usr/bin/env node
// Kontrola interních odkazů: projde všechny .html v public/ a ověří, že lokální
// href/src (absolutní "/..." i relativní) vedou na existující soubor nebo složku s index.html.
// Externí odkazy (http:, https:, mailto:, data:, #kotvy) se přeskakují.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

async function* walk(dir) {
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function resolveTarget(fromFile, ref) {
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return null;
  const abs = clean.startsWith('/') ? path.join(PUBLIC, decodeURIComponent(clean)) : path.resolve(path.dirname(fromFile), decodeURIComponent(clean));
  return abs;
}
function exists(target) {
  if (!existsSync(target)) return false;
  if (statSync(target).isDirectory()) return existsSync(path.join(target, 'index.html'));
  return true;
}

const problems = [];
let count = 0;
for await (const file of walk(PUBLIC)) {
  if (!file.endsWith('.html')) continue;
  const html = await readFile(file, 'utf8');
  // odstraníme <script> obsah a komentáře, ať nechytáme řetězce z JS
  const markup = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, m => m.replace(/>[\s\S]*<\/script>/i, '></script>'));
  for (const m of markup.matchAll(/\s(?:href|src)\s*=\s*"([^"]*)"/gi)) {
    const ref = m[1].trim();
    if (!ref || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref)) continue;
    count++;
    const target = resolveTarget(file, ref);
    if (target && !target.startsWith(PUBLIC)) problems.push(`${path.relative(PUBLIC, file)}: "${ref}" míří mimo public/`);
    else if (target && !exists(target)) problems.push(`${path.relative(PUBLIC, file)}: "${ref}" neexistuje`);
  }
}

if (problems.length) {
  console.error(`✗ Nefunkční interní odkazy (${problems.length}):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`✓ Interní odkazy v pořádku (zkontrolováno: ${count})`);
