// Unit testy logiky aplikace Psací azbuka (node --test): rozložení ЙЦУКЕН, fonetický přepis a rozvržení obrázku.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../public/vyklad/psaci-azbuka/logic.js';

test('ЙЦУКЕН: všech 33 písmen je na klávesnici právě jednou', () => {
  const letters = L.YTSUKEN_ROWS.flat().map(k => k[1]).filter(ch => L.ALPHABET.includes(ch));
  assert.equal(letters.length, 33);
  assert.deepEqual([...letters].sort(), [...L.ALPHABET].sort());
  for (const [, base, shift] of L.YTSUKEN_ROWS.flat()) if (L.ALPHABET.includes(base)) assert.equal(shift, base.toUpperCase());
});

test('ЙЦУКЕН: fyzická klávesa → ruské písmeno (i na české QWERTZ)', () => {
  assert.equal(L.ytsukenChar('KeyQ'), 'й');
  assert.equal(L.ytsukenChar('KeyF'), 'а');
  assert.equal(L.ytsukenChar('KeyZ'), 'я'); // na české klávesnici je tu popisek Y
  assert.equal(L.ytsukenChar('KeyY', true), 'Н');
  assert.equal(L.ytsukenChar('KeyR', false, true), 'К'); // Caps Lock
  assert.equal(L.ytsukenChar('KeyR', true, true), 'к'); // Caps Lock + Shift
  assert.equal(L.ytsukenChar('Slash'), '.');
  assert.equal(L.ytsukenChar('Slash', true), ',');
  assert.equal(L.ytsukenChar('Digit7', true), '?');
  assert.equal(L.ytsukenChar('Digit3'), '3');
  assert.equal(L.ytsukenChar('Space'), null);
  assert.equal(L.ytsukenChar('Enter'), null);
  assert.equal(L.YTSUKEN.KeyY.cap, 'Z');
});

test('fonetický přepis: písmena a spřežky', () => {
  const cases = {
    'privet': 'привет', 'Privet!': 'Привет!', 'čaj': 'чай', 'chorošo': 'хорошо', 'CHOROŠO': 'ХОРОШО', 'Chleb': 'Хлеб',
    'ščuka': 'щука', 'Ščuka': 'Щука', 'jabloko': 'яблоко', 'Ja': 'Я', 'JA': 'Я', 'jug': 'юг', 'jolka': 'ёлка', 'éto': 'это',
    'my': 'мы', 'mať': 'мать', 'mat\'': 'мать', 'matq': 'мать', 'obQjom': 'объём', 'cirk': 'цирк', 'žurnal': 'журнал',
    'Praha 2025, ok?': 'Праха 2025, ок?', 'Привет': 'Привет', 'xleb': 'хлеб', 'Moskva': 'Москва'
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(L.transliterate(input), expected, input);
});

test('phoneticStep vrací null pro znaky, které nepřevádíme', () => {
  for (const ch of ['1', ' ', ',', '.', '?', '\n', 'ж']) assert.equal(L.phoneticStep('', ch), null, JSON.stringify(ch));
  assert.deepEqual(L.phoneticStep('ц', 'h'), { del: 1, ins: 'х' });
  assert.deepEqual(L.phoneticStep('Й', 'a'), { del: 1, ins: 'Я' });
});

test('nápověda pokrývá celou abecedu', () => {
  for (const ch of L.ALPHABET) assert.ok(L.PHONETIC_HINT[ch], ch);
  const pairs = L.alphabetPairs().split(/\s+/);
  assert.equal(pairs.length, 33);
  assert.equal(pairs[0], 'Аа');
  assert.equal(pairs[32], 'Яя');
});

test('rozvržení obrázku: šířka podle nejdelšího řádku, účaří pod sebou', () => {
  const measure = s => ({ ascent: 30, descent: 12, left: 2, right: s.length * 20 });
  const lay = L.layoutLines(['аб', 'абвгд'], measure, { size: 40, spacing: 1.5 });
  assert.equal(lay.baselines.length, 2);
  assert.equal(lay.baselines[1] - lay.baselines[0], 60);
  assert.ok(lay.width >= 2 + 100 + 2 * lay.pad);
  assert.ok(lay.height > lay.baselines[1] + 12);
});

test('název souboru je bezpečný', () => {
  assert.equal(L.fileName('Привет, мир!\nКак дела?'), 'privet-mir-kak-dela.png');
  assert.equal(L.fileName('  '), 'psaci-azbuka.png');
  assert.ok(!/[\\/:*?"<>|]/.test(L.fileName('a/b:c*d?"e')));
});

test('zalamování: mezera se mění na konec řádku, délka textu zůstává', () => {
  const measure = s => s.length;
  const t = 'мама мыла раму и папа';
  const w = L.wrapText(t, measure, 10);
  assert.equal(w.length, t.length);
  assert.deepEqual(w.split('\n'), ['мама мыла', 'раму и', 'папа']);
  for (const line of w.split('\n')) assert.ok(line.length <= 10);
  // dlouhé slovo se nerozdělí, vlastní konce řádků zůstanou
  assert.equal(L.wrapText('абвгдежзийк лм', measure, 5), 'абвгдежзийк\nлм');
  assert.equal(L.wrapText('аб\nвг', measure, 1), 'аб\nвг');
  assert.equal(L.wrapText('аб вг', measure, Infinity), 'аб вг');
});

test('barvy: psaní, mazání a vložení posune barvy se znaky', () => {
  const R = '#b91c1c', B = '#000000';
  let c = L.spliceColors([], '', 'аб', B);
  assert.deepEqual(c, [B, B]);
  c = L.spliceColors(c, 'аб', 'абвг', R);          // dopsáno červeně
  assert.deepEqual(c, [B, B, R, R]);
  c = L.spliceColors(c, 'абвг', 'аXбвг', R);        // vloženo doprostřed
  assert.deepEqual(c, [B, R, B, R, R]);
  c = L.spliceColors(c, 'аXбвг', 'абвг', B);        // smazáno
  assert.deepEqual(c, [B, B, R, R]);
  c = L.spliceColors(c, 'абвг', 'абхг', B);         // fonetické nahrazení (ц → х)
  assert.deepEqual(c, [B, B, B, R]);
  assert.deepEqual(L.toRuns([B, B, R]), [[2, B], [1, R]]);
  assert.deepEqual(L.fromRuns([[2, B], [5, R]], 4, B), [B, B, R, R]);
  assert.deepEqual(L.fromRuns([[1, 'red'], 'x'], 2, B), [B, B]);   // neplatné úseky se zahodí
});
