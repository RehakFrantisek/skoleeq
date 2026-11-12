#!/usr/bin/env node
// Synchronizace podle site.config.json (jediné místo pro název webu a doménu):
//  - název webu: nahradí dosavadní název (čte se z <meta name="application-name"> v public/index.html)
//    ve všech HTML stránkách v public/ (kromě test.html)
//  - robots.txt: vždy; řádek Sitemap jen pokud je vyplněné siteUrl
//  - sitemap.xml: jen pokud je vyplněné siteUrl (nepoužíváme vymyšlené domény); jinak se smaže
// Použití:  npm run sync            (zapíše změny)
//           npm run sync -- --check (jen kontrola, při rozdílu exit 1 – používá CI)

import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const CHECK = process.argv.includes('--check');

const config = JSON.parse(await readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
const name = String(config.name || '').trim();
const siteUrl = String(process.env.SITE_URL || config.siteUrl || '').trim().replace(/\/+$/, '');
if (!name) { console.error('✗ site.config.json: chybí "name"'); process.exit(1); }
if (siteUrl && !/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(siteUrl)) {
  console.error(`✗ siteUrl "${siteUrl}" musí mít tvar https://domena.cz (bez cesty)`); process.exit(1);
}

const changes = []; // [{ file, content | null(=smazat) }]

async function* walk(dir) {
  for (const d of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk(p); else yield p;
  }
}

// 1) Název webu
const indexHtml = await readFile(path.join(PUBLIC, 'index.html'), 'utf8');
const current = (indexHtml.match(/<meta name="application-name" content="([^"]+)">/) || [])[1];
if (!current) { console.error('✗ public/index.html: chybí <meta name="application-name">'); process.exit(1); }
if (current !== name) {
  for await (const f of walk(PUBLIC)) {
    if (!f.endsWith('.html') || path.basename(f) === 'test.html') continue;
    const html = await readFile(f, 'utf8');
    if (html.includes(current)) changes.push({ file: f, content: html.split(current).join(name) });
  }
}

// 2) robots.txt + sitemap.xml
const robots = `# ${name}\nUser-agent: *\nAllow: /\nDisallow: /aplikace/*/test.html\n` + (siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : '');
const robotsPath = path.join(PUBLIC, 'robots.txt');
if (!existsSync(robotsPath) || (await readFile(robotsPath, 'utf8')) !== robots) changes.push({ file: robotsPath, content: robots });

const sitemapPath = path.join(PUBLIC, 'sitemap.xml');
if (siteUrl) {
  const { validateRegistry } = await import(pathToFileURL(path.join(PUBLIC, 'assets/registry.js')).href);
  const { apps } = validateRegistry(JSON.parse(await readFile(path.join(PUBLIC, 'apps.json'), 'utf8')));
  const urls = ['/', '/pro-ucitele/', '/o-projektu/', ...apps.filter(a => a.status === 'published').map(a => a.url)];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `  <url><loc>${siteUrl}${u}</loc></url>`).join('\n') + '\n</urlset>\n';
  if (!existsSync(sitemapPath) || (await readFile(sitemapPath, 'utf8')) !== xml) changes.push({ file: sitemapPath, content: xml });
} else if (existsSync(sitemapPath)) {
  changes.push({ file: sitemapPath, content: null });
}

const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
if (CHECK) {
  if (changes.length) {
    console.error('✗ Web není synchronizovaný se site.config.json. Spusť "npm run sync" a změny commitni:');
    for (const c of changes) console.error(`  - ${rel(c.file)}`);
    process.exit(1);
  }
  console.log(`✓ site.config.json synchronizován (název "${name}", ${siteUrl ? 'sitemap pro ' + siteUrl : 'bez sitemap – siteUrl zatím nevyplněno'})`);
} else {
  for (const c of changes) {
    if (c.content === null) await rm(c.file); else await writeFile(c.file, c.content);
    console.log(`  ${c.content === null ? 'smazáno' : 'zapsáno'}: ${rel(c.file)}`);
  }
  console.log(changes.length ? `✓ Synchronizováno (změněné soubory: ${changes.length})` : '✓ Vše už bylo synchronizované');
}
