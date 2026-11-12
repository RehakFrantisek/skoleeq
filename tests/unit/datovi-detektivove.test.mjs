// Unit testy logiky hry Datoví detektivové (node --test): datové operace, generátor úloh, vyhodnocení.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../public/aplikace/datovi-detektivove/logic.js';

const rows = [
  { id: 'a', den: 'Pondělí', voda: 10, ovoce: 3 },
  { id: 'b', den: 'Úterý', voda: 25, ovoce: 0 },
  { id: 'c', den: 'Středa', voda: 10, ovoce: 7 },
  { id: 'd', den: 'Čtvrtek', voda: null, ovoce: 2 }
];
const COLS = ['den', 'voda', 'ovoce'];

/** Správná odpověď pro libovolnou úlohu – stejný tvar, jaký posílá UI. */
export function correctAnswer(t) {
  switch (t.type) {
    case 'cell': return { ...t.expected };
    case 'cells': return { cells: t.expected.rows.map(r => ({ row: r, col: t.expected.cols[1] })) };
    case 'number': return { value: String(t.expected) };
    case 'choice': return { option: t.expected };
    case 'sort': return { rows: L.sortRows(t.table.rows, t.sortKey, t.sortDir), broken: false, option: t.expected };
    case 'filter': return { visibleIds: L.filterRows(t.table.rows, t.conditions).map(r => r.id), count: String(t.expected) };
    case 'edit': return { value: String(t.expectedValue), option: t.expected };
    case 'bar': return { index: t.expected };
    case 'axis': return { axisMin: t.expected };
    case 'compare': return { ...t.expected };
    default: throw new Error(t.type);
  }
}

/* ---------- Řazení ---------- */
test('sortRows řadí celé řádky a nemění vstup', () => {
  const copy = structuredClone(rows);
  const s = L.sortRows(rows, 'voda', 'desc');
  assert.deepEqual(rows, copy, 'vstup zůstal beze změny');
  assert.deepEqual(s.map(r => r.id), ['b', 'a', 'c', 'd']);
  assert.ok(L.rowsIntact(rows, s, COLS), 'řádky zůstaly celé');
});

test('sortRows je stabilní při shodě a prázdné buňky dává na konec (i sestupně)', () => {
  assert.deepEqual(L.sortRows(rows, 'voda', 'asc').map(r => r.id), ['a', 'c', 'b', 'd']);
  assert.deepEqual(L.sortRows(rows, 'voda', 'desc').map(r => r.id), ['b', 'a', 'c', 'd']);
});

test('sortRows řadí texty podle české abecedy', () => {
  const s = L.sortRows(rows, 'den', 'asc').map(r => r.den);
  assert.deepEqual(s, ['Čtvrtek', 'Pondělí', 'Středa', 'Úterý']);
});

test('sortColumnOnly rozbije záznamy – rowsIntact to pozná', () => {
  const s = L.sortColumnOnly(rows, 'voda', 'desc');
  assert.deepEqual(s.map(r => r.den), rows.map(r => r.den), 'ostatní sloupce zůstaly na místě');
  assert.equal(s[0].voda, 25);
  assert.equal(L.rowsIntact(rows, s, COLS), false);
});

test('isSortedBy', () => {
  assert.ok(L.isSortedBy(L.sortRows(rows, 'ovoce', 'asc'), 'ovoce', 'asc'));
  assert.ok(!L.isSortedBy(rows, 'ovoce', 'asc'));
  assert.ok(L.isSortedBy(L.sortRows(rows, 'ovoce', 'desc'), 'ovoce', 'desc'));
});

test('nezávislost na pořadí: součet po seřazení je stejný', () => {
  for (const key of ['voda', 'ovoce', 'den']) {
    assert.equal(L.sumBy(L.sortRows(rows, key, 'desc'), 'ovoce'), L.sumBy(rows, 'ovoce'));
  }
});

/* ---------- Filtrování ---------- */
test('filterRows: obě podmínky zároveň, ≥ zahrnuje hraniční hodnotu, > ne', () => {
  const books = [
    { id: 1, zanr: 'Komiks', v: 5 }, { id: 2, zanr: 'Komiks', v: 4 },
    { id: 3, zanr: 'Fantasy', v: 9 }, { id: 4, zanr: 'komiks', v: 8 }, { id: 5, zanr: 'Komiks', v: null }
  ];
  const ids = c => L.filterRows(books, c).map(r => r.id);
  assert.deepEqual(ids([{ key: 'zanr', op: 'eq', value: 'Komiks' }, { key: 'v', op: 'gte', value: 5 }]), [1, 4]);
  assert.deepEqual(ids([{ key: 'zanr', op: 'eq', value: 'Komiks' }, { key: 'v', op: 'gt', value: 5 }]), [4]);
  assert.deepEqual(ids([{ key: 'v', op: 'lte', value: 4 }]), [2], 'prázdná buňka nesplňuje žádnou podmínku');
  assert.deepEqual(ids([]), [1, 2, 3, 4, 5], 'bez podmínek všechny řádky');
  assert.throws(() => ids([{ key: 'v', op: 'xx', value: 1 }]));
});

test('maxRows vrací všechny řádky se shodným maximem; nula je hodnota', () => {
  assert.deepEqual(L.maxRows(rows, 'voda').map(r => r.id), ['b']);
  const tie = [{ id: 1, x: 5 }, { id: 2, x: 7 }, { id: 3, x: 7 }];
  assert.deepEqual(L.maxRows(tie, 'x').map(r => r.id), [2, 3]);
  assert.equal(L.sumBy(rows, 'voda'), 45, 'prázdná buňka se do součtu nepočítá');
});

/* ---------- Adresy, čísla, jednotky ---------- */
test('adresa buňky: řádek 1 je záhlaví', () => {
  assert.equal(L.cellAddress(0, 0), 'A2');
  assert.equal(L.cellAddress(2, 2), 'C4');
  assert.deepEqual(L.parseAddress('c4'), { col: 2, row: 2 });
  assert.equal(L.parseAddress('4C'), null);
});

test('parseCzNumber přijme český zápis', () => {
  assert.equal(L.parseCzNumber('12'), 12);
  assert.equal(L.parseCzNumber(' 12,5 '), 12.5);
  assert.equal(L.parseCzNumber('1 200'), 1200);
  assert.ok(Number.isNaN(L.parseCzNumber('dvanáct')));
  assert.ok(Number.isNaN(L.parseCzNumber('')));
});

test('převod jednotek na metry', () => {
  assert.equal(L.toMeters(3250, 'cm'), 32.5);
  assert.equal(L.toMeters(1.2, 'km'), 1200);
  assert.throws(() => L.toMeters(1, 'palce'));
});

/* ---------- Interpretace grafů ---------- */
test('osa od nuly nezkresluje, osa od 90 ano', () => {
  const v = [92, 96, 99];
  assert.equal(L.axisDistortion(v, 0).factor, 1);
  const d = L.axisDistortion(v, 90);
  assert.ok(d.visual > 4 && d.real < 1.1, `vizuálně ${d.visual}, reálně ${d.real}`);
});

test('niceTicks dělí osu pravidelně', () => {
  assert.deepEqual(L.niceTicks(0, 27, 5), [0, 10, 20, 30]);
  const t = L.niceTicks(175, 197, 5);
  assert.equal(t[0], 175);
  assert.ok(t.at(-1) >= 197);
});

test('účel grafu → typ grafu', () => {
  assert.equal(L.CHART_FOR_PURPOSE.trend, 'line');
  assert.equal(L.CHART_FOR_PURPOSE.share, 'pie');
  assert.equal(L.CHART_FOR_PURPOSE.compare, 'bar');
});

/* ---------- Generátor úloh ---------- */
test('stejný seed => stejná mise; varianty A/B/C se liší', () => {
  const a1 = L.buildMission(L.VARIANTS.A), a2 = L.buildMission(L.VARIANTS.A);
  assert.deepEqual(JSON.stringify(a1), JSON.stringify(a2));
  const sig = v => JSON.stringify(L.buildMission(L.VARIANTS[v]).data.bufet.rows);
  assert.notEqual(sig('A'), sig('B'));
  assert.notEqual(sig('B'), sig('C'));
  assert.notEqual(sig('A'), sig('C'));
});

test('režimy: rychlý 6 úloh, celá mise 15 ve 3 úrovních, dlouhá 18', () => {
  const m = L.buildMission(L.VARIANTS.A);
  assert.equal(L.tasksForMode(m, 'rychly').length, 6);
  const std = L.tasksForMode(m, 'standard');
  assert.equal(std.length, 15);
  assert.deepEqual([...new Set(std.map(t => t.level))], [1, 2, 3]);
  assert.equal(L.tasksForMode(m, 'dlouha').length, 18);
  assert.equal(new Set(m.tasks.map(t => t.id)).size, 18, 'unikátní id úloh');
  const types = new Set(std.map(t => t.type));
  assert.ok(types.size >= 8, `typů interakce: ${[...types].join(', ')}`);
});

// Pravidla, která musí platit pro každý seed (jinak by úloha neměla jednoznačnou odpověď).
for (const seed of [L.VARIANTS.A, L.VARIANTS.B, L.VARIANTS.C, ...Array.from({ length: 60 }, (_, i) => i * 7919 + 1)]) {
  test(`seed ${seed}: úlohy jsou jednoznačné a správná odpověď projde`, () => {
    const m = L.buildMission(seed);
    const T = Object.fromEntries(m.tasks.map(t => [t.id, t]));
    const { bufet, library, sport, throws } = m.data;

    assert.equal(L.maxRows(bufet.rows, 'susenky').length, 2, 't3: přesně dva dny se shodným maximem');
    assert.equal(bufet.rows.filter(r => r.ovoce === 0).length, 1, 't4: přesně jeden den s nulou');
    assert.equal(L.maxRows(bufet.rows, 'voda').length, 1, 't6: jednoznačný vítěz ve vodě');
    const n7 = T.t7.expected;
    assert.ok(n7 >= 2 && n7 <= 3, 't7: 2–3 knihy po filtru');
    const [g, k] = T.t7.conditions;
    assert.ok(library.rows.some(r => r.zanr === g.value && r.vypujcky === k.value), 't7: existuje hraniční kniha (přesně k)');
    assert.ok(L.filterRows(library.rows, [k]).length > n7, 't7: jedna podmínka nestačí');
    assert.equal(L.maxRows(sport.rows, 'celkem').length, 1, 't9: jednoznačný vítěz');
    const best = throws.rows.find(r => r.id === T.t10.expected);
    assert.ok(throws.rows.every(r => r === best || r.meters < best.meters), 't10: nejdelší hod je jednoznačný');
    assert.ok(throws.rows.some(r => r.value > best.value), 't10: past – jiný zápis má větší „číslo“');
    assert.notEqual(T.t11.expected, T.t12.expected, 't11/t12: různé typy grafů');
    assert.notEqual(T.t13.chart.values[T.t13.expected], bufet.rows[T.t13.expected].voda, 't13: chybný sloupec opravdu nesedí');
    assert.ok(T.t13.chart.values.every((v, i) => i === T.t13.expected || v === bufet.rows[i].voda), 't13: ostatní sloupce sedí');
    assert.equal(T.t15.charts[T.t15.expected.chart].axisMin, 90, 't15: klamavý graf má osu od 90');
    assert.notEqual(T.t17.chart.values.reduce((a, b) => a + b, 0), 100, 't17: procenta nedávají 100');
    assert.ok(T.t18.table.rows.some(r => r.vypujcky === null), 't18: v tabulce chybí údaj');

    for (const t of m.tasks) {
      const r = L.checkAnswer(t, correctAnswer(t));
      assert.ok(r.ok, `${t.id}: správná odpověď neprošla – ${r.msg}`);
      assert.ok(r.msg.length > 10, `${t.id}: chybí vysvětlení`);
      assert.ok(t.hints.length >= 2 && t.solution, `${t.id}: nápovědy a řešení`);
    }
  });
}

test('tutoriál: správná buňka projde, jiná ne', () => {
  const t = L.tutorialTask();
  assert.ok(L.checkAnswer(t, { row: 1, col: 2 }).ok);
  assert.match(L.checkAnswer(t, { row: 1, col: 1 }).msg, /Řádek je správně/);
  assert.match(L.checkAnswer(t, { row: 0, col: 2 }).msg, /Sloupec je správně/);
});

/* ---------- Věcná zpětná vazba u typických chyb ---------- */
test('typické chyby dostanou konkrétní vysvětlení', () => {
  const m = L.buildMission(L.VARIANTS.A);
  const T = Object.fromEntries(m.tasks.map(t => [t.id, t]));

  // řazení jen sloupce
  const broken = L.sortColumnOnly(T.t6.table.rows, 'voda', 'desc');
  assert.match(L.checkAnswer(T.t6, { rows: broken, broken: true, option: T.t6.expected }).msg, /rozpadly/);
  // vzestupně místo sestupně
  assert.match(L.checkAnswer(T.t6, { rows: L.sortRows(T.t6.table.rows, 'voda', 'asc'), broken: false }).msg, /vzestupně/);
  // seřazeno správně, ale špatný vedoucí den
  const wrongDay = T.t6.options.find(o => o.id !== T.t6.expected).id;
  assert.match(L.checkAnswer(T.t6, { rows: L.sortRows(T.t6.table.rows, 'voda', 'desc'), broken: false, option: wrongDay }).msg, /prvním řádku/);

  // filtr: jen jedna podmínka, > místo ≥
  const [g, k] = T.t7.conditions;
  const ids = c => L.filterRows(T.t7.table.rows, c).map(r => r.id);
  assert.match(L.checkAnswer(T.t7, { visibleIds: ids([g]), count: '1' }).msg, /jen podmínka žánru/);
  assert.match(L.checkAnswer(T.t7, { visibleIds: ids([k]), count: '1' }).msg, /jen podmínka na výpůjčky/);
  assert.match(L.checkAnswer(T.t7, { visibleIds: ids([g, { ...k, op: 'gt' }]), count: '1' }).msg, /Aspoň/);
  assert.match(L.checkAnswer(T.t7, { visibleIds: ids([g, k]), count: '99' }).msg, /počet nesedí/);

  // shoda: označen jen jeden ze dvou dnů
  const one = { cells: [{ row: T.t3.expected.rows[0], col: T.t3.expected.cols[1] }] };
  assert.match(L.checkAnswer(T.t3, one).msg, /stejnou nejvyšší/);

  // součet: jen jeden den / jiný sloupec
  const maxVoda = Math.max(...T.t5.table.rows.map(r => r.voda));
  assert.match(L.checkAnswer(T.t5, { value: String(maxVoda) }).msg, /jeden den/);
  assert.match(L.checkAnswer(T.t5, { value: 'abc' }).msg, /Napiš číslo/);

  // doplnění: zapomenutá disciplína
  const miss = T.t9.table.rows.find(r => r.id === T.t9.editRowId);
  assert.match(L.checkAnswer(T.t9, { value: String(miss.beh + miss.skok) }).msg, /hod/);

  // dvě tabulky: cena jen pro jednoho žáka
  const [, cenik] = T.t16.tables;
  assert.match(L.checkAnswer(T.t16, { value: String(cenik.rows[0].cena + cenik.rows[1].cena) }).msg, /jednoho žáka/);

  // osa a graf
  assert.ok(!L.checkAnswer(T.t14, { axisMin: 175 }).ok);
  const other = T.t15.expected.chart === 'A' ? 'B' : 'A';
  assert.match(L.checkAnswer(T.t15, { chart: other, reason: 'axis' }).msg, /osu od nuly/);
  assert.match(L.checkAnswer(T.t15, { chart: T.t15.expected.chart, reason: 'colors' }).msg, /Barva/);
  const wrongBar = (T.t13.expected + 1) % 5;
  assert.match(L.checkAnswer(T.t13, { index: wrongBar }).msg, /v pořádku/);
});

/* ---------- Hodnocení ---------- */
test('summarize: nápověda nesnižuje vyřešení, odhalené řešení ano', () => {
  const s = L.summarize([
    { id: 't1', skill: 'cteni', solved: true, firstTry: true, hints: 2 },
    { id: 't2', skill: 'cteni', solved: true, firstTry: false, hints: 0 },
    { id: 't3', skill: 'graf', solved: false, revealed: true, firstTry: false, hints: 1 }
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.solved, 2);
  assert.equal(s.firstTry, 1);
  assert.equal(s.hints, 3);
  assert.deepEqual(s.skills.cteni, { total: 2, solved: 2 });
  assert.deepEqual(s.skills.graf, { total: 1, solved: 0 });
});

test('isBetter: víc napoprvé > méně nápověd > rychlost', () => {
  assert.ok(L.isBetter({ firstTry: 5, hints: 3 }, null));
  assert.ok(L.isBetter({ firstTry: 6, hints: 9 }, { firstTry: 5, hints: 0 }));
  assert.ok(L.isBetter({ firstTry: 5, hints: 1 }, { firstTry: 5, hints: 2 }));
  assert.ok(L.isBetter({ firstTry: 5, hints: 1, timeMs: 100 }, { firstTry: 5, hints: 1, timeMs: 200 }));
  assert.ok(!L.isBetter({ firstTry: 5, hints: 1, timeMs: null }, { firstTry: 5, hints: 1, timeMs: 200 }));
});
