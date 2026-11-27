// Unit testy psaní vlastní sadou písmen (handwriting.js): kontrola souboru, rozvržení, napojení a složená písmena.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../../public/vyklad/psaci-azbuka/handwriting.js';
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
  assert.equal(H.markShapes(j).breve.length, 4);
  assert.equal(H.variantsFor(set, 'ж'), null);
});

test('napojení: typy podle písanky, odhad u starších sad', () => {
  assert.equal(H.canJoin({ w: 1, in: 'low', out: 'none', entry: [0, -0.2], exit: [0.9, -0.5] }), false);
  assert.deepEqual(H.joinTypes({ w: 1, entry: [0, -0.25], exit: [0.98, -0.25] }), { in: 'low', out: 'low' });
  assert.deepEqual(H.joinTypes({ w: 1, entry: [0.5, -0.95], exit: [0.98, -0.7] }), { in: 'high', out: 'high' });
  assert.equal(H.joinTypes({ w: 1, entry: [0, -0.25], exit: [0.6, -0.25] }).out, 'none');
});

test('в na konci slova je bez obloučku, uvnitř slova se napojuje', () => {
  const set = makeSet();
  const items = l => l.items.filter(i => i.type === 'glyph' && i.ch === 'в');
  for (let seed = 1; seed < 20; seed++) {
    const { lines } = H.layout('кв вот', set, { seed });
    const [end, inside] = items(lines[0]);
    assert.equal(end.g.out, 'none', 'na konci slova');
    assert.equal(inside.g.out, 'high', 'před о');
  }
});

test('spojovací tahy: dole se písmena dotknou, jinde se nakreslí tah', () => {
  const set = makeSet();
  const kinds = t => H.layout(t, set, { jitter: 0 }).lines[0].items.filter(i => i.type === 'join').length;
  assert.equal(kinds('мм'), 0);   // dolní tah → dolní začátek: dotyk
  assert.equal(kinds('ма'), 1);   // dolní tah → а začíná nahoře
  assert.equal(kinds('ом'), 1);   // о končí nahoře
  assert.equal(kinds('Ам'), 0);   // velké А končí dolním tahem → dotyk
  const { lines } = H.layout('ма', set, { jitter: 0 });
  const [m, a] = lines[0].items.filter(i => i.type === 'glyph');
  assert.ok(a.x >= m.x + m.g.w, 'а nezasahuje do м');
  const join = lines[0].items.find(i => i.type === 'join');
  assert.ok(join.p[3][1] < join.p[0][1], 'tah do а stoupá nahoru');
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

test('každé písmeno nese svou pozici v textu (kvůli barvám), i přes konce řádků', () => {
  const set = makeSet();
  const { lines } = H.layout('ма па\nам', set, { jitter: 0 });
  const pos = lines.map(l => l.items.filter(i => i.type === 'glyph').map(i => i.i));
  assert.deepEqual(pos, [[0, 1, 3, 4], [6, 7]]);
});

test('bez odchylek je rukopis vždy stejný, sklon navíc posune vršek písmene', () => {
  const set = makeSet();
  const flat = H.layout('м', set, { jitter: 0 }).lines[0].items[0];
  assert.equal(flat.jit, null);
  const leaned = H.layout('м', set, { jitter: 0, slant: -0.1 }).lines[0].items[0];
  const [x0] = H.transformPoint(0, -1, flat), [x1] = H.transformPoint(0, -1, leaned);
  assert.ok(x1 > x0, 'záporný sklon = víc nakloněné doprava');
});
