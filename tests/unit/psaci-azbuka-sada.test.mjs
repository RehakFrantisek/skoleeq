// Unit testy vestavěné sady „Písanka Školeeq“ (scripts/build-azbuka-set.mjs → sada-skoleeq.json)
// a výběru variant podle sousedních písmen (napojení shora / zdola).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as H from '../../public/vyklad/psaci-azbuka/handwriting.js';
import { buildSet } from '../../scripts/build-azbuka-set.mjs';

const set = JSON.parse(readFileSync(new URL('../../public/vyklad/psaci-azbuka/sada-skoleeq.json', import.meta.url), 'utf8'));
const LOWER = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
const UPPER = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
const glyphs = t => H.layout(t, set, { jitter: 0 }).lines[0].items.filter(i => i.type === 'glyph');

test('uložená sada odpovídá generátoru (po úpravě písmen spusť node psaci-azbuka/build-azbuka-set.mjs)', () => {
  assert.deepEqual(set, JSON.parse(JSON.stringify(buildSet())));
});

test('sada je platná a má celou azbuku (ё, й a velká ъ ы ь se skládají)', () => {
  assert.deepEqual(H.validateSet(set), []);
  for (const ch of LOWER + UPPER) assert.ok(H.variantsFor(set, ch), `chybí ${ch}`);
  for (const vars of Object.values(set.glyphs)) {
    for (const v of vars) {
      assert.equal(v.paths.length, 0);
      assert.ok(v.strokes.length > 0);
      assert.ok(['low', 'high', 'none'].includes(v.in) && ['low', 'high', 'none'].includes(v.out));
    }
  }
});

test('napojení shora: za о začíná к, т, н, р, и u vršku; samostatně mají náběh zdola', () => {
  for (const ch of 'ктнрийшв') {
    const [o, g] = glyphs('о' + ch);
    assert.equal(o.g.out, 'high', `о před ${ch}`);
    assert.equal(g.g.after, 'high', `${ch} za о`);
    const [k, g2] = glyphs('к' + ch);
    assert.equal(g2.g.after, undefined, `${ch} za к`);
    assert.equal(k.g.out, 'low');
  }
});

test('před л a м se о napojuje zdola (jako „стол“ v pracovních listech), na konci slova bez tahu', () => {
  for (const ch of 'лм') {
    const [o, g] = glyphs('о' + ch);
    assert.equal(o.g.out, 'low', `о před ${ch}`);
    assert.equal(g.g.after, undefined);
  }
  const end = glyphs('ко').at(-1);
  assert.equal(end.g.out, 'none');
});

test('každá dvojice malých písmen se rozvrhne zleva doprava a spojka není přehnaně dlouhá', () => {
  for (const a of LOWER) {
    for (const b of LOWER) {
      const { lines } = H.layout(a + b, set, { jitter: 0 });
      const [g1, g2] = lines[0].items.filter(i => i.type === 'glyph');
      assert.ok(g2.x > g1.x, `${a}${b}`);
      for (const j of lines[0].items.filter(i => i.type === 'join')) assert.ok(j.p[3][0] - j.p[0][0] < 1.3, `${a}${b} spojka`);
    }
  }
});

test('spojky jsou uvnitř písmen: konec písmene leží na začátku dalšího a tah pokračuje stejným směrem', () => {
  assert.equal(set.joins, 'touch');
  const angle = d => Math.atan2(d[1], d[0]);
  for (const a of LOWER + 'АЕЖИКЛМНПСТХЦЧШЩЯ') {
    for (const b of LOWER) {
      const [g1, g2] = glyphs(a + b);
      if (g1.g.out === 'none') continue;
      const ex = g1.x + g1.g.exit[0], ey = g1.g.exit[1];
      const sx = g2.x + g2.g.entry[0], sy = g2.g.entry[1];
      if (Math.abs(ey - sy) < 0.06) {
        assert.ok(Math.hypot(ex - sx, ey - sy) < 0.07, `${a}${b}: konec a začátek se nepotkají`);
        assert.ok(Math.abs(angle(g1.g.exitDir) - angle(g2.g.entryDir)) < 0.35, `${a}${b}: tah se láme`);
      } else {
        assert.ok(sx > ex && sx - ex < 0.5, `${a}${b}: mezera pro spojku`);
      }
    }
  }
});

test('s odchylkami rukopisu se mezi písmeny kreslí jen krátká plynulá spojka', () => {
  const { lines } = H.layout('спасибо, привет', set, { jitter: 1, seed: 7 });
  for (const j of lines[0].items.filter(i => i.type === 'join')) {
    assert.ok(Math.hypot(j.p[3][0] - j.p[0][0], j.p[3][1] - j.p[0][1]) < 0.6);
  }
});

test('е: za о zdola („ое“), za в shora („ве“); б se napojuje zespodu', () => {
  const [o, e1] = glyphs('ое');
  assert.equal(o.g.out, 'low');
  assert.equal(e1.g.after, undefined);
  const [v, e2] = glyphs('ве');
  assert.equal(v.g.out, 'high');
  assert.equal(e2.g.after, 'high');
  const [b] = glyphs('бо');
  assert.equal(b.g.out, 'low');
  assert.ok(b.g.exit[1] > -0.4, 'výstup б je dole');
});

test('s odchylkami rukopisu na sebe písmena navazují bez zoubku', () => {
  for (const word of ['спасибо', 'кдгдв', 'олидс', 'зага']) {
    const items = H.layout(word, set, { jitter: 1, seed: 11 }).lines[0].items.filter(i => i.type === 'glyph');
    for (let i = 1; i < items.length; i++) {
      const a = items[i - 1], b = items[i];
      if (Math.abs(a.g.exit[1] - b.g.entry[1]) >= 0.06) continue;
      const e = H.transformPoint(a.g.exit[0], a.g.exit[1], a), s = H.transformPoint(b.g.entry[0], b.g.entry[1], b);
      assert.ok(Math.hypot(e[0] - s[0], e[1] - s[1]) < 1e-9, `${word}: ${a.ch}${b.ch}`);
    }
  }
});

test('varianta after se nepoužije za mezerou ani za písmenem bez horního tahu', () => {
  const vars = set.glyphs.к;
  const r = H.rng(1);
  assert.equal(H.chooseVariant(vars, null, r, null).after, undefined);
  assert.equal(H.chooseVariant(vars, null, r, 'low').after, undefined);
  assert.equal(H.chooseVariant(vars, null, r, 'high').after, 'high');
});
