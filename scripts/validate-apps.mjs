#!/usr/bin/env node
// Validace registru public/apps.json:
//  - schéma každého záznamu (sdílené s katalogem: public/assets/registry.js)
//  - unikátní id, URL /aplikace/<id>/ (hry) nebo /vyklad/<id>/ (výklady a nástroje)
//  - existuje public/<složka>/<id>/index.html (+ případný thumbnail)
//  - složka v public/aplikace/ nebo public/vyklad/ bez záznamu v registru = varování
// Návratový kód 1 při chybě => CI selže.

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { validateRegistry, appDir, KINDS } = await import(pathToFileURL(path.join(ROOT, 'public/assets/registry.js')).href);

/** Čistá funkce kvůli unit testům: vrací { errors[], warnings[], apps[] }. */
export async function checkRegistry(publicDir, registryJson) {
  const errors = [];
  const warnings = [];
  const { apps, problems } = validateRegistry(registryJson);
  for (const p of problems) {
    const who = p.id ? `"${p.id}"` : p.index >= 0 ? `záznam #${p.index}` : 'registr';
    for (const e of p.errors) errors.push(`${who}: ${e}`);
  }
  for (const app of apps) {
    const sub = appDir(app);
    const dir = path.join(publicDir, sub, app.id);
    if (app.status === 'planned') continue; // připravovaná hra: složka zatím nemusí existovat
    if (!existsSync(path.join(dir, 'index.html'))) errors.push(`"${app.id}": chybí soubor public/${sub}/${app.id}/index.html`);
    if (app.thumbnail && !existsSync(path.join(dir, app.thumbnail))) errors.push(`"${app.id}": chybí náhled public/${sub}/${app.id}/${app.thumbnail}`);
  }
  for (const sub of new Set(Object.values(KINDS).map(k => k.dir))) {
    const appsDir = path.join(publicDir, sub);
    if (!existsSync(appsDir)) continue;
    const ids = new Set((registryJson?.apps || []).filter(a => a && appDir(a) === sub).map(a => a.id));
    for (const d of await readdir(appsDir, { withFileTypes: true })) {
      if (d.isDirectory() && !ids.has(d.name)) warnings.push(`složka public/${sub}/${d.name}/ nemá záznam v apps.json (v katalogu se nezobrazí)`);
    }
  }
  if (!apps.some(a => a.status === 'published') && !errors.length) warnings.push('v registru není žádná publikovaná aplikace');
  return { errors, warnings, apps };
}

async function main() {
  // --public <složka> umožní validovat jinou kopii (používají unit testy)
  const i = process.argv.indexOf('--public');
  const publicDir = i > -1 ? path.resolve(process.argv[i + 1]) : path.join(ROOT, 'public');
  let json;
  try {
    json = JSON.parse(await readFile(path.join(publicDir, 'apps.json'), 'utf8'));
  } catch (e) {
    console.error(`✗ public/apps.json nelze načíst nebo není platný JSON: ${e.message}`);
    process.exit(1);
  }
  const { errors, warnings, apps } = await checkRegistry(publicDir, json);
  for (const w of warnings) console.warn(`⚠ ${w}`);
  if (errors.length) {
    console.error(`✗ apps.json: ${errors.length} chyb(a):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  const pub = apps.filter(a => a.status === 'published').length;
  console.log(`✓ apps.json v pořádku – aplikace: ${apps.length}, z toho publikované: ${pub}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
