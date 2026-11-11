#!/usr/bin/env node
// Jednoduchý statický server nad public/ bez závislostí.
// Napodobuje chování Cloudflare Pages tam, kde na tom záleží pro vývoj:
//  - složka => index.html, /slozka bez lomítka => přesměrování na /slozka/
//  - neexistující cesta => 404.html se stavem 404 (žádný SPA fallback)
//  - hlavičky z public/_headers (podpora vzorů s * na konci)
// Použití: node scripts/serve.mjs [--port 8080]   (nebo PORT=8080)

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const argPort = process.argv.indexOf('--port');
const PORT = Number(argPort > -1 ? process.argv[argPort + 1] : process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2'
};

// Pravidla z _headers: [{ pattern, headers: [[name, value]] }]
function loadHeaderRules() {
  const file = path.join(ROOT, '_headers');
  if (!existsSync(file)) return [];
  const rules = [];
  let cur = null;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) { cur = { pattern: raw.trim(), headers: [] }; rules.push(cur); continue; }
    const m = raw.trim().match(/^([^:]+):\s*(.*)$/);
    if (cur && m) cur.headers.push([m[1].trim(), m[2].trim()]);
  }
  return rules;
}
function matches(pattern, urlPath) {
  // `*` = cokoli (splat), `:jmeno` = jeden segment cesty – stejně jako Cloudflare Pages
  const esc = s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z]\w*/g, '[^/]+');
  const re = new RegExp('^' + pattern.split('*').map(esc).join('.*') + '$');
  return re.test(urlPath);
}

async function resolveFile(urlPath) {
  const safe = path.normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const full = path.join(ROOT, safe);
  if (!full.startsWith(ROOT)) return { status: 403 };
  try {
    const st = await stat(full);
    if (st.isDirectory()) {
      if (!urlPath.endsWith('/')) return { redirect: urlPath + '/' };
      const idx = path.join(full, 'index.html');
      if (existsSync(idx)) return { file: idx };
      return { status: 404 };
    }
    return { file: full };
  } catch {
    return { status: 404 };
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rules = loadHeaderRules(); // čteme pokaždé, ať změny _headers platí hned
  for (const r of rules) if (matches(r.pattern, url.pathname)) for (const [k, v] of r.headers) res.setHeader(k, v);
  res.setHeader('Cache-Control', 'no-store');

  const r = await resolveFile(url.pathname);
  if (r.redirect) { res.writeHead(308, { Location: r.redirect + url.search }); res.end(); return; }
  let file = r.file, status = 200;
  if (!file) { status = r.status || 404; file = path.join(ROOT, '404.html'); }
  try {
    const body = await readFile(file);
    res.writeHead(status, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nenalezeno');
  }
  if (!process.env.QUIET) console.log(`${status} ${req.method} ${url.pathname}`);
});

server.listen(PORT, () => {
  console.log(`\n  Školeeq běží na  http://localhost:${PORT}/`);
  console.log(`  Klávesová mise:  http://localhost:${PORT}/aplikace/klavesova-mise/`);
  console.log(`  Test hry:        http://localhost:${PORT}/aplikace/klavesova-mise/test.html\n`);
});
