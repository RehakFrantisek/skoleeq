// Unit testy psaní vlastní sadou písmen (handwriting.js): kontrola souboru, rozvržení, napojení a složená písmena.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../../public/aplikace/psaci-azbuka/handwriting.js';
import { makeSet } from '../fixtures/glyph-set.mjs';

test('kontrola sady: platná projde, nesmysl ne', () => {
  assert.deepEqual(H.validateSet(makeSet()), []);
  assert.ok(H.validateSet(null).length);
  assert.ok(H.validateSet({ format: 'x' }).length);
  const bad = makeSet(); bad.glyphs.а[0].paths = [[1, 2, 'x']];
  assert.ok(H.validateSet(bad).length);
});

test('stejné semínko = stejný rukopis, jiné semínko = jiný', () => {
  const set = makeSet();
  const a = JSON.stringify(H.layout('мама', set, { seed: 5 }));
  assert.equal(JSON.stringify(H.layout('мама', set, { seed: 5 })), a);
  assert.notEqual(JSON.stringify(H.layout('мама', set, { seed: 6 })), a);
});

test('písmena jdou zleva doprava a nepřekrývají se; mezera dělá mezeru', () => {
  const set = makeSet();
  const { lines } = H.layout('мама папа', set, { jitter: 0 });
  const g = lines[0].items.filter(i => i.type === 'glyph');
  assert.equal(g.length, 8);
  for (let i = 1; i < g.length; i++) assert.ok(g[i].x >= g[i - 1].x + g[i - 1].g.w - 0.03, `písmeno ${i}`);
  const gap = g[4].x - (g[3].x + g[3].g.w);
  assert.ok(gap > 0.4, `mezera mezi slovy ${gap}`);
});

test('znaky mimo sadu kreslí záložní písmo, řádky se dělí Enterem', () => {
  const set = makeSet();
  const { lines } = H.layout('мама, 12!\nпапа', set, { fallbackWidth: () => 0.5 });
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0].items.filter(i => i.type === 'text').map(i => i.ch), [',', '1', '2', '!']);
  assert.ok(lines[0].width > 4);
});

test('ё a й se skládají z е a и s diakritikou', () => {
  const set = makeSet();
  const { lines } = H.layout('ёй', set, { jitter: 0 });
  const [e, j] = lines[0].items.filter(i => i.type === 'glyph');
  assert.equal(e.mark, 'dots');
  assert.equal(j.mark, 'breve');
  assert.equal(H.markShapes(e).dots.length, 2);
  assert.equal(H.markShapes(j).arc.length, 3);
  assert.equal(H.variantsFor(set, 'ж'), null);
});

test('napojení: písmeno s koncovým tahem dole navazuje, vysoko končící ne', () => {
  assert.equal(H.canJoin({ w: 1, exit: [0.98, -0.25] }), true);
  assert.equal(H.canJoin({ w: 1, exit: [0.98, -0.65] }), false); // о, в
  assert.equal(H.canJoin({ w: 1, exit: [0.6, -0.25] }), false);  // tah končí uvnitř písmene
});

test('bez odchylek je bod písmene jen posunutý; s odchylkami se mírně liší', () => {
  const set = makeSet();
  const flat = H.layout('а', set, { jitter: 0 }).lines[0].items[0];
  assert.deepEqual(H.transformPoint(0.5, -0.5, { ...flat, x: 2 }), [2.5, -0.5]);
  const wob = H.layout('а', set, { jitter: 1, seed: 3 }).lines[0].items[0];
  const [x, y] = H.transformPoint(0.5, -0.5, wob);
  assert.ok(Math.abs(x - 0.5) < 0.1 && Math.abs(y + 0.5) < 0.1);
  assert.ok(Math.abs(x - 0.5) + Math.abs(y + 0.5) > 0);
});
