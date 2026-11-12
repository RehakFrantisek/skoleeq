// Unit testy logiky hry Šifrovací laboratoř (node --test): kódování, šifry, obrázky, parita, generátor a vyhodnocení.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../public/aplikace/sifrovaci-laborator/logic.js';

test('bity: lampy 16-8-4-2-1 a převody', () => {
  assert.equal(L.toBits(13), '01101');
  assert.equal(L.fromBits('10110'), 22);
  assert.equal(L.lampsValue([true, false, true, true, false]), 22);
  for (let n = 0; n < 32; n++) assert.equal(L.lampsValue(L.lampsFor(n)), n);
});

test('znaková sada a normalizace textu', () => {
  assert.deepEqual(L.encodeText('Ahoj zeme'), [65, 72, 79, 74, 32, 90, 69, 77, 69]);
  assert.equal(L.normalize('  vše   je ok '), 'VSE JE OK');
  assert.equal(L.letterNumber('A'), 1);
  assert.equal(L.numberLetter(26), 'Z');
});

test('Caesar: šifrování a dešifrování, posun přes konec abecedy', () => {
  assert.equal(L.caesar('XYZ ABC', 3), 'ABC DEF');
  assert.equal(L.caesar(L.caesar('NASLA JSEM LED', 11), -11), 'NASLA JSEM LED');
  assert.equal(L.caesar('ABC', 26), 'ABC');
});

test('Morseovka', () => {
  assert.equal(L.toMorse('sos'), '... --- ...');
  assert.equal(Object.keys(L.MORSE).length, 26);
});

test('kódování řádků obrázku začíná bílou a je vratné', () => {
  assert.deepEqual(L.encodeRow([0, 0, 0, 1, 1, 0, 0, 0]), [3, 2, 3]);
  assert.deepEqual(L.encodeRow([1, 1, 0, 0, 0, 0, 0, 0]), [0, 2, 6]);
  for (const pic of Object.values(L.PICTURES)) {
    assert.equal(pic.length, 8);
    for (const row of L.gridFrom(pic)) {
      assert.equal(row.length, 8);
      assert.deepEqual(L.decodeRow(L.encodeRow(row), 8), row);
    }
  }
  assert.deepEqual(L.parseCounts('3, 2 3'), [3, 2, 3]);
});

test('barvy: šestnáctkový zápis', () => {
  assert.equal(L.hex([255, 128, 0]), '#FF8000');
});

test('parita: doplněná mřížka je sudá, převrácený bit se najde na křížení', () => {
  const data = [[1, 0, 1], [0, 0, 1], [1, 1, 1]];
  const g = L.withParity(data);
  assert.deepEqual(L.parityErrors(g), { rows: [], cols: [] });
  g[1][2] ^= 1;
  assert.deepEqual(L.parityErrors(g), { rows: [1], cols: [2] });
});

test('kontrolní číslice', () => {
  assert.equal(L.checkDigit('MARS'), (13 + 1 + 18 + 19) % 10);
});

test('generátor: stejná varianta = stejné úlohy, varianty se liší, rychlý režim má 6 úloh', () => {
  assert.deepEqual(L.buildGame('B'), L.buildGame('B'));
  assert.notDeepEqual(L.buildGame('A'), L.buildGame('C'));
  for (const v of Object.keys(L.VARIANTS)) {
    const full = L.buildGame(v);
    assert.equal(full.length, 17);
    assert.deepEqual([...new Set(full.map(t => t.level))], [0, 1, 2, 3, 4]);
    assert.equal(L.buildGame(v, 'rychly').length, 6);
  }
});

test('každá úloha všech variant: řešení projde, prázdná odpověď ne, každá má aspoň 2 nápovědy', () => {
  const empty = { lamps: [], value: '', shift: 0, option: null, grid: Array.from({ length: 8 }, () => Array(8).fill(0)), values: [], rgb: [0, 0, 0], shape: {}, cell: null };
  for (const v of Object.keys(L.VARIANTS)) {
    for (const t of [...L.buildGame(v), L.tutorialTask()]) {
      const r = L.check(t, L.solution(t));
      assert.ok(r.ok, `${v}/${t.id}: ${r.msg}`);
      assert.ok(r.msg.length > 10, `${v}/${t.id} má vysvětlení`);
      assert.ok(t.hints.length >= 2, `${v}/${t.id} nápovědy`);
      const e = t.type === 'parity-add' ? { grid: L.withParity(t.data).map((row, y) => row.map((c, x) => (y < 4 && x < 4 ? c : 0))) } : empty;
      const bad = L.check(t, e);
      if (t.type === 'parity-add' && L.parityErrors(e.grid).rows.length === 0 && L.parityErrors(e.grid).cols.length === 0) continue;
      assert.equal(bad.ok, false, `${v}/${t.id} prázdná odpověď neprojde`);
      assert.ok(bad.msg.length > 5, `${v}/${t.id} vysvětlí chybu`);
    }
  }
});

test('vysvětlení chyb jsou konkrétní', () => {
  const lamps = { type: 'lamps', target: 13 };
  assert.match(L.check(lamps, { lamps: L.lampsFor(15) }).msg, /o 2 víc/);
  assert.match(L.check(lamps, { lamps: L.lampsFor(9) }).msg, /chybí ještě 4/);
  const text = { type: 'text', answer: 'VSE JE OK', tool: 'ascii' };
  assert.match(L.check(text, { value: 'vseje ok' }).msg, /mezery/);
  assert.ok(L.check(text, { value: 'Vše je OK' }).ok, 'diakritika a velikost písmen nevadí');
  const codes = { type: 'codes', word: 'SOS', answer: [83, 79, 83] };
  assert.match(L.check(codes, { value: '83 79' }).msg, /3 čísla/);
  assert.match(L.check(codes, { value: '83 80 83' }).msg, /2\. číslo/);
  const crack = { type: 'crack', key: 5, cipher: L.caesar('MAPA', 5), plain: 'MAPA' };
  assert.match(L.check(crack, { shift: 21 }).msg, /opačným směrem/);
  const enc = { type: 'encode', grid: [[1, 1, 0, 0, 0, 0, 0, 0]], rows: [0], answer: [[0, 2, 6]] };
  assert.match(L.check(enc, { values: ['2 6'] }).msg, /0/);
  assert.match(L.check(enc, { values: ['0 2 5'] }).msg, /8 políček/);
});

test('isBetter: přesnost, pak nápovědy, pak čas', () => {
  assert.ok(L.isBetter({ firstTry: 5, hints: 3 }, { firstTry: 4, hints: 0 }));
  assert.ok(L.isBetter({ firstTry: 5, hints: 1 }, { firstTry: 5, hints: 2 }));
  assert.ok(L.isBetter({ firstTry: 5, hints: 1, ms: 100 }, { firstTry: 5, hints: 1, ms: 200 }));
  assert.ok(!L.isBetter({ firstTry: 5, hints: 1 }, { firstTry: 5, hints: 1 }));
});
