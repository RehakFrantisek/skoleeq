// Unit testy logiky hry Signál ze sondy (node --test): barvy, ceník přenosu, úseky, tvary, generátor a vyhodnocení.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../public/aplikace/signal-ze-sondy/logic.js';

const ALL = ['A', 'B', 'C'].flatMap(v => ['cela', 'rychly'].map(m => [v, m]));

test('barvy kamery: šestnáctkový zápis, písmena a bity', () => {
  assert.equal(L.hex([255, 128, 0]), '#FF8000');
  assert.equal(L.rgbText([192, 64, 0]), '(192, 64, 0)');
  for (const p of L.PALETTE) for (const v of p.rgb) assert.ok(L.HEX_LEVELS.includes(v), p.name);
  for (const [ch, i] of Object.entries(L.LETTER_TO)) assert.equal(L.PALETTE[i].letter, ch);
  assert.deepEqual([2, 3, 4, 5, 8, 9].map(L.bppFor), [1, 2, 2, 3, 3, 4]);
  assert.equal(L.bppFor(1), 1);
});

test('snímky jsou 8 × 8 a používají jen barvy kamery', () => {
  for (const [k, pic] of Object.entries(L.PICTURES)) {
    assert.equal(pic.length, 8, k);
    for (const row of pic) assert.match(row, new RegExp(`^[0-${L.PALETTE.length - 1}]{8}$`), k);
    assert.ok(L.PICTURE_NAMES[k], k);
  }
  for (const [k, t] of Object.entries(L.TERRAINS)) {
    assert.equal(t.rows.length, 10, k);
    for (const row of t.rows) assert.match(row, /^[0-6]{10}$/, k);
  }
});

test('úseky: kódování, rozbor (i bez háčků a s ×) a rozbalení', () => {
  assert.equal(L.rleEncode('AAAB'), '3A1B');
  assert.equal(L.rowCode([0, 0, 0, 2, 2, 1]), '3Č2O1B');
  assert.deepEqual(L.rleParse('3a 1b').pairs, [[3, 'A'], [1, 'B']]);
  assert.deepEqual(L.rleParse('3×c 2z', { colors: true }).pairs, [[3, 'Č'], [2, 'Ž']]);
  assert.equal(L.rleParse('3AB').error, 'nocount');
  assert.equal(L.rleParse(' ').error, 'empty');
  assert.equal(L.rleParse('3A1').error, 'format');
  for (const w of ['PIIIIIIIIP', 'BZZZZZUUUM']) {
    const p = L.rleParse(L.rleEncode(w)).pairs;
    assert.equal(L.rleDecode(p), w);
    assert.equal(L.rleSum(p), w.length);
  }
});

test('ceník: pixely, úseky a tvary', () => {
  const g = L.gridFrom(['0000', '0110']);
  assert.equal(L.pixelCost(g, 1), 8);
  assert.equal(L.runCount(g), 4);
  assert.equal(L.rleCost(g, 1), 4 * (L.COUNT_BITS + 1));
  assert.equal(L.shapeBits({ k: 'circle', x: 1, y: 1, r: 1, c: 0 }, 2), L.KIND_BITS + 3 * L.NUM_BITS + 2);
  // tvarové scény: tvary jsou levnější než úseky i pixely
  for (const [k, s] of Object.entries(L.SCENES)) {
    const grid = L.sceneGrid(s.shapes);
    const bpp = L.bppFor(L.colorsIn(grid).length);
    assert.ok(L.shapeCost(s.shapes, bpp) < L.rleCost(grid, bpp), k);
    assert.ok(L.shapeCost(s.shapes, bpp) < L.pixelCost(grid, bpp), k);
    for (const sh of s.shapes) for (const p of L.PARAMS[sh.k]) assert.ok(sh[p] >= 0 && sh[p] <= 15, `${k} ${p}`);
  }
  // terén: úseky levnější než pixely
  for (const [k, t] of Object.entries(L.TERRAINS)) {
    const grid = L.gridFrom(t.rows);
    const bpp = L.bppFor(L.colorsIn(grid).length);
    assert.ok(L.rleCost(grid, bpp) < L.pixelCost(grid, bpp), k);
  }
});

test('tvary: rastr, překryv a pořadí kreslení', () => {
  const planet = { k: 'circle', x: 5, y: 6, r: 3, c: 2 };
  const ground = { k: 'rect', x: 0, y: 6, w: 10, h: 4, c: 4 };
  assert.ok(L.overlap(planet, ground));
  assert.ok(!L.sameRaster([planet, ground], [ground, planet]));
  assert.equal(L.shapeText(ground), 'obdélník(x=0, y=6, šířka=10, výška=4, šedá)');
  const g = L.sceneGrid([ground]);
  assert.equal(g[0][0], 0);
  assert.equal(g[9][9], 4);
});

test('generátor: deterministický, správné počty, varianty se liší', () => {
  assert.deepEqual(L.buildGame('B'), L.buildGame('B'));
  assert.equal(L.buildGame('A').length, 9);
  assert.equal(L.buildGame('A', 'rychly').length, 5);
  assert.notDeepEqual(L.buildGame('A'), L.buildGame('C'));
  for (const [v, m] of ALL) {
    const g = L.buildGame(v, m);
    assert.deepEqual(new Set(g.map(t => t.id)).size, g.length, 'jedinečná id');
    for (let i = 1; i < g.length; i++) assert.ok(g[i].level >= g[i - 1].level, 'úrovně jdou po sobě');
    for (const t of g) {
      assert.ok(L.SKILLS[t.skill], t.id);
      assert.ok(t.hints.length >= 1, t.id);
      assert.ok(L.PICTURES[t.pic], t.id);
    }
  }
});

test('každá úloha všech variant jde vyřešit a prázdná odpověď se nepočítá', () => {
  for (const [v, m] of ALL) {
    for (const t of [L.tutorialTask(), ...L.buildGame(v, m)]) {
      const r = L.check(t, L.solution(t));
      assert.ok(r.ok, `${v}/${m}/${t.id}: ${r.msg}`);
      assert.ok(r.msg.length > 10);
      if (t.type === 'hex-mix' || t.type === 'order') continue; // tyto nástroje mají vždy nějaký stav
      const e = L.check(t, {});
      assert.ok(!e.ok && e.incomplete, `${v}/${t.id} prázdná odpověď`);
    }
  }
});

test('tabulka barev: rozpočet pustí jen nejmenší počet bitů', () => {
  for (const v of ['A', 'B', 'C']) {
    const t = L.buildGame(v)[0];
    assert.equal(t.type, 'palette-build');
    assert.ok(t.cost <= t.budget);
    assert.ok(t.px * (t.bpp + 1) + t.k * L.RGB_BITS > t.budget);
    assert.ok(2 ** t.bpp >= t.k && 2 ** (t.bpp - 1) < t.k || t.bpp === 1);
    // data používají lokální čísla 0..k-1 a odpovídají snímku
    t.local.forEach((r, y) => r.forEach((li, x) => assert.equal(t.order[li], t.grid[y][x])));
    const s = L.solution(t);
    assert.ok(!L.check(t, { ...s, bpp: t.bpp + 1 }).ok, 'víc bitů se nevejde');
    if (t.bpp > 1) assert.match(L.check(t, { ...s, bpp: t.bpp - 1 }).msg, /vejdou jen čísla/);
    const bad = [...s.table]; bad[0] = (bad[0] + 1) % L.PALETTE.length;
    if (!t.order.includes(bad[0]) || bad[0] !== t.order[0]) assert.match(L.check(t, { ...s, table: bad }).msg, /Číslo 0/);
  }
});

test('úseky a text: chyby mají konkrétní vysvětlení', () => {
  const g = L.buildGame('A');
  const rs = g.find(t => t.id === 'rle-send');
  assert.ok(rs.cost <= rs.budget && rs.cost < rs.pxCost);
  const bad = [...rs.answers]; bad[1] = '10C';
  const r = L.check(rs, { values: bad });
  assert.ok(!r.ok);
  assert.match(r.msg, new RegExp(`^Řádek ${rs.ask[1] + 1}:`));
  const txt = g.find(t => t.id === 'rle-text');
  assert.match(L.check(txt, { value: txt.source }).msg, /počet/);
  const split = txt.answer.replace(/^(\d+)(\D)/, (_, n, c) => (Number(n) > 1 ? `1${c}${Number(n) - 1}${c}` : `1${c}`));
  if (split !== txt.answer) assert.match(L.check(txt, { value: split }).msg, /kratší|nesedí|dohromady/);
  assert.ok(L.check(txt, { value: txt.answer.toLowerCase() }).ok);
});

test('poškozené řádky: součet prozradí přesně dva, energie na dva', () => {
  for (const [v] of ALL) {
    const t = L.buildGame(v).find(x => x.id === 'resend');
    const sums = t.received.map(r => L.rleSum(r));
    assert.deepEqual(sums.map((s, i) => (s !== 8 ? i : -1)).filter(i => i >= 0), t.damaged);
    assert.equal(t.damaged.length * t.rowCost, t.energy);
    // poškozený řádek nemá vedle sebe dva stejné úseky (chyba se pozná jen součtem)
    for (const i of t.damaged) for (let k = 1; k < t.received[i].length; k++) assert.notEqual(t.received[i][k][1], t.received[i][k - 1][1]);
    const good = sums.findIndex(s => s === 8);
    assert.match(L.check(t, { rows: [t.damaged[0], good] }).msg, /dorazil celý/);
    assert.match(L.check(t, { rows: [...t.damaged, good] }).msg, /nestačí energie/);
  }
});

test('velký přenos: vejde se jen nejlevnější volba u každého snímku', () => {
  for (const [v] of ALL) {
    const t = L.buildGame(v).find(x => x.id === 'transfer');
    assert.equal(t.shots.length, 3);
    assert.deepEqual(t.shots.map(s => s.kind).sort(), ['noise', 'shapes', 'terrain']);
    const best = t.shots.map(s => s.best);
    assert.equal(t.shots.find(s => s.kind === 'noise').best, 0);
    assert.equal(t.shots.find(s => s.kind === 'terrain').best, 1);
    assert.equal(t.shots.find(s => s.kind === 'shapes').best, 2);
    const total = t.shots.reduce((s, x) => s + x.costs[x.best], 0);
    assert.ok(total <= t.budget);
    // jakákoli jiná proveditelná volba přesáhne rozpočet
    t.shots.forEach((s, i) => s.costs.forEach((c, m) => {
      if (m === s.best) return;
      const ch = [...best]; ch[i] = m;
      const r = L.check(t, { choices: ch });
      assert.ok(!r.ok, `${v} snímek ${i} volba ${m}`);
      if (c == null) assert.match(r.msg, /není složený/);
      else assert.ok(total - s.costs[s.best] + c > t.budget);
    }));
  }
});

test('isBetter: napoprvé, pak nápovědy, pak čas', () => {
  assert.ok(L.isBetter({ firstTry: 5, hints: 3 }, { firstTry: 4, hints: 0 }));
  assert.ok(L.isBetter({ firstTry: 5, hints: 1 }, { firstTry: 5, hints: 2 }));
  assert.ok(L.isBetter({ firstTry: 5, hints: 1, ms: 100 }, { firstTry: 5, hints: 1, ms: 200 }));
  assert.ok(!L.isBetter({ firstTry: 5, hints: 1 }, { firstTry: 5, hints: 1 }));
  assert.ok(L.isBetter({ firstTry: 0, hints: 0 }, undefined));
});
