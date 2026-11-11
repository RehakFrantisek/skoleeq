// Unit testy validátoru registru (node --test). Bez prohlížeče, bez závislostí.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateApp, validateRegistry } from '../../public/assets/registry.js';
import { checkRegistry } from '../../scripts/validate-apps.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const good = () => ({
  id: 'binarni-vyzva', title: 'Binární výzva', subtitle: 'Nuly a jedničky',
  description: 'Převáděj čísla do dvojkové soustavy.', url: '/aplikace/binarni-vyzva/',
  subject: 'Informatika', grades: [7, 8], topics: ['Číselné soustavy'], difficulty: 'stredni',
  durationMinutes: 15, icon: 'binary', color: 'teal', featured: false, requiresKeyboard: false, status: 'published'
});

test('platný záznam projde', () => {
  assert.deepEqual(validateApp(good()), []);
});

test('skutečný public/apps.json je platný', async () => {
  const json = JSON.parse(await readFile(path.join(ROOT, 'public/apps.json'), 'utf8'));
  const { errors } = await checkRegistry(path.join(ROOT, 'public'), json);
  assert.deepEqual(errors, []);
});

const bad = {
  'chybějící pole': a => { delete a.title; },
  'neznámé pole (překlep)': a => { a.titel = 'x'; },
  'id s diakritikou': a => { a.id = 'binární'; a.url = '/aplikace/binární/'; },
  'url s ..': a => { a.url = '/aplikace/../tajne/'; },
  'externí url': a => { a.url = 'https://example.com/'; },
  'url neodpovídá id': a => { a.url = '/aplikace/jina-hra/'; },
  'url bez koncového lomítka': a => { a.url = '/aplikace/binarni-vyzva'; },
  'prázdný titulek': a => { a.title = '   '; },
  'HTML v popisu': a => { a.description = '<img src=x onerror=alert(1)>'; },
  'ročník 0': a => { a.grades = [0, 1]; },
  'ročník 10': a => { a.grades = [10]; },
  'ročník jako text': a => { a.grades = ['7']; },
  'ročník desetinný': a => { a.grades = [7.5]; },
  'prázdné ročníky': a => { a.grades = []; },
  'duplicitní ročník': a => { a.grades = [7, 7]; },
  'záporná délka': a => { a.durationMinutes = -5; },
  'nulová délka': a => { a.durationMinutes = 0; },
  'obtížnost mimo whitelist': a => { a.difficulty = 'hard'; },
  'status mimo whitelist': a => { a.status = 'live'; },
  'barva mimo whitelist': a => { a.color = 'red; background:url(x)'; },
  'ikona mimo whitelist': a => { a.icon = 'skull'; },
  'requiresKeyboard jako text': a => { a.requiresKeyboard = 'ano'; },
  'thumbnail s cestou': a => { a.thumbnail = '../../favicon.svg'; },
  'prázdná témata': a => { a.topics = []; }
};
for (const [name, mutate] of Object.entries(bad)) {
  test(`odmítne: ${name}`, () => {
    const a = good();
    mutate(a);
    assert.ok(validateApp(a).length > 0, `očekávána chyba pro: ${name}`);
  });
}

test('duplicitní id v registru', () => {
  const { apps, problems } = validateRegistry({ schemaVersion: 1, apps: [good(), good()] });
  assert.equal(apps.length, 1);
  assert.match(problems[0].errors.join(), /duplicitní id/);
});

test('špatná verze schématu a chybějící pole apps', () => {
  assert.ok(validateRegistry({ schemaVersion: 2, apps: [] }).problems.length > 0);
  assert.ok(validateRegistry({ schemaVersion: 1 }).problems.length > 0);
  assert.ok(validateRegistry(null).problems.length > 0);
});

test('chybějící index.html hry je chyba, složka bez záznamu je varování', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'skoleeq-'));
  try {
    await mkdir(path.join(dir, 'aplikace', 'sirotek'), { recursive: true });
    await writeFile(path.join(dir, 'aplikace', 'sirotek', 'index.html'), '<!doctype html>');
    const { errors, warnings } = await checkRegistry(dir, { schemaVersion: 1, apps: [good()] });
    assert.match(errors.join(), /chybí soubor public\/aplikace\/binarni-vyzva\/index.html/);
    assert.match(warnings.join(), /sirotek/);

    await mkdir(path.join(dir, 'aplikace', 'binarni-vyzva'));
    await writeFile(path.join(dir, 'aplikace', 'binarni-vyzva', 'index.html'), '<!doctype html>');
    assert.deepEqual((await checkRegistry(dir, { schemaVersion: 1, apps: [good()] })).errors, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('validate-apps.mjs skončí chybou (exit 1) při neplatném registru', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'skoleeq-'));
  const run = () => execFileSync(process.execPath, [path.join(ROOT, 'scripts/validate-apps.mjs'), '--public', dir], { stdio: 'pipe' });
  try {
    await mkdir(path.join(dir, 'aplikace', 'binarni-vyzva'), { recursive: true });
    await writeFile(path.join(dir, 'aplikace', 'binarni-vyzva', 'index.html'), '<!doctype html>');
    await writeFile(path.join(dir, 'apps.json'), JSON.stringify({ schemaVersion: 1, apps: [good()] }));
    run(); // platný registr => exit 0
    await writeFile(path.join(dir, 'apps.json'), JSON.stringify({ schemaVersion: 1, apps: [good(), { ...good(), id: 'neexistuje', url: '/aplikace/neexistuje/' }] }));
    assert.throws(run, e => e.status === 1);
    await writeFile(path.join(dir, 'apps.json'), '{ neplatný json');
    assert.throws(run, e => e.status === 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
