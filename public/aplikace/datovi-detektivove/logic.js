/* Datoví detektivové – čistá logika hry (bez DOM).
   Obsahuje: seedovatelný generátor, datové operace (řazení, filtrování, součty, adresy buněk,
   jednotky, zkreslení osy), generátor úloh a deterministické vyhodnocení odpovědí.
   Stejný soubor importují unit testy (node --test) i E2E testy – proto žádný přístup k window/document. */

/* ================= Seedovatelná náhoda ================= */

/** Varianty zadání pro sousedy v lavici. Stejné písmeno = stejné úlohy (např. pro promítání). */
export const VARIANTS = { A: 1001, B: 2002, C: 3003 };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  const rng = {
    next,
    /** celé číslo v intervalu <a, b> včetně */
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    sample: (arr, n) => rng.shuffle(arr).slice(0, n)
  };
  return rng;
}

/* ================= Datové operace ================= */

const collator = new Intl.Collator('cs', { sensitivity: 'base', numeric: true });

/** Porovná dvě hodnoty buněk: čísla číselně, texty podle české abecedy, prázdné buňky vždy na konec. */
export function compareValues(a, b) {
  const ea = a === null || a === undefined || a === '';
  const eb = b === null || b === undefined || b === '';
  if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/** Stabilně seřadí CELÉ řádky podle sloupce. Vrací nové pole, vstup nemění. */
export function sortRows(rows, key, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1;
  return rows
    .map((row, i) => ({ row, i }))
    .sort((x, y) => {
      const c = compareValues(x.row[key], y.row[key]);
      // prázdné buňky zůstávají na konci i při sestupném řazení (jako v tabulkovém editoru)
      const empty = v => v === null || v === undefined || v === '';
      if (empty(x.row[key]) || empty(y.row[key])) return c || x.i - y.i;
      return sign * c || x.i - y.i;
    })
    .map(x => x.row);
}

/**
 * Chybný postup „seřadit jen vybraný sloupec“: hodnoty jednoho sloupce se přeskládají,
 * ostatní sloupce zůstanou na místě => záznamy (řádky) se rozpadnou.
 */
export function sortColumnOnly(rows, key, dir = 'asc') {
  const values = sortRows(rows, key, dir).map(r => r[key]);
  return rows.map((r, i) => ({ ...r, [key]: values[i], broken: true }));
}

export function isSortedBy(rows, key, dir = 'asc') {
  for (let i = 1; i < rows.length; i++) {
    const c = compareValues(rows[i - 1][key], rows[i][key]);
    if (dir === 'asc' ? c > 0 : c < 0) return false;
  }
  return true;
}

/** Jsou všechny řádky celé, tj. každý řádek má stejné hodnoty jako původní řádek se stejným id? */
export function rowsIntact(original, current, columns) {
  const byId = new Map(original.map(r => [r.id, r]));
  if (current.length !== original.length) return false;
  return current.every(r => {
    const o = byId.get(r.id);
    return o && columns.every(k => o[k] === r[k]);
  });
}

export const OPS = {
  eq: { label: '=', test: (a, b) => (typeof a === 'string' ? collator.compare(a, b) === 0 : a === b) },
  gte: { label: '≥', test: (a, b) => a >= b },
  lte: { label: '≤', test: (a, b) => a <= b },
  gt: { label: '>', test: (a, b) => a > b },
  lt: { label: '<', test: (a, b) => a < b }
};

export function matchesCondition(row, { key, op, value }) {
  const v = row[key];
  if (v === null || v === undefined || v === '') return false;
  const fn = OPS[op];
  if (!fn) throw new Error(`neznámý operátor ${op}`);
  return fn.test(v, value);
}

/** Filtr se všemi podmínkami zároveň (A ZÁROVEŇ B). Prázdný seznam podmínek = všechny řádky. */
export function filterRows(rows, conditions = []) {
  return rows.filter(r => conditions.every(c => matchesCondition(r, c)));
}

export function sumBy(rows, key) {
  return rows.reduce((s, r) => s + (typeof r[key] === 'number' ? r[key] : 0), 0);
}

/** Všechny řádky s maximální hodnotou (pozor na shodu – může jich být víc). */
export function maxRows(rows, key) {
  const vals = rows.map(r => r[key]).filter(v => typeof v === 'number');
  if (!vals.length) return [];
  const m = Math.max(...vals);
  return rows.filter(r => r[key] === m);
}

export const colLetter = i => String.fromCharCode(65 + i);
/** Adresa buňky jako v tabulkovém editoru: řádek 1 = záhlaví, první datový řádek = 2. */
export const cellAddress = (col, row) => `${colLetter(col)}${row + 2}`;
export function parseAddress(addr) {
  const m = /^([A-Z])(\d+)$/.exec(String(addr).trim().toUpperCase());
  if (!m) return null;
  return { col: m[1].charCodeAt(0) - 65, row: Number(m[2]) - 2 };
}

/** Převod českého zápisu čísla: „12,5“ → 12.5, „1 200“ → 1200. Neplatný vstup → NaN. */
export function parseCzNumber(input) {
  const s = String(input ?? '').trim().replace(/[\s ]/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

export function formatCz(n) {
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(n);
}

const UNIT_TO_M = { km: 1000, m: 1, cm: 0.01, mm: 0.001 };
export function toMeters(value, unit) {
  if (!(unit in UNIT_TO_M)) throw new Error(`neznámá jednotka ${unit}`);
  return Math.round(value * UNIT_TO_M[unit] * 1000) / 1000;
}

/**
 * Jak moc osa Y zkresluje: poměr výšek sloupců (max/min) při daném začátku osy
 * oproti skutečnému poměru hodnot. Osa od nuly => obojí stejné.
 */
export function axisDistortion(values, axisMin) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const real = max / min;
  const visual = (max - axisMin) / Math.max(min - axisMin, 1e-9);
  return { real, visual, factor: visual / real };
}

/** „Hezké“ dělení osy: vrací pole hodnot od min po aspoň max. */
export function niceTicks(min, max, count = 5) {
  const span = Math.max(max - min, 1);
  const raw = span / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(m => m * pow).find(s => s >= raw) || 10 * pow;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v < max + step - 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

export const CHART_FOR_PURPOSE = { trend: 'line', share: 'pie', compare: 'bar' };

/* ================= Data případů (smyšlená, bez osobních údajů) ================= */

const DAYS = [
  { id: 'po', name: 'Pondělí', loc: 'v pondělí' },
  { id: 'ut', name: 'Úterý', loc: 'v úterý' },
  { id: 'st', name: 'Středa', loc: 've středu' },
  { id: 'ct', name: 'Čtvrtek', loc: 've čtvrtek' },
  { id: 'pa', name: 'Pátek', loc: 'v pátek' }
];
const BUFET_ITEMS = {
  ovoce: { label: 'Ovoce', phrase: 'kusů ovoce' },
  susenky: { label: 'Sušenky', phrase: 'balíčků sušenek' },
  voda: { label: 'Voda', phrase: 'lahví vody' }
};
const BOOK_TITLES = [
  'Tajemství staré půdy', 'Robot z 6.B', 'Výprava za polární září', 'Kočka, která uměla počítat',
  'Stín nad Kamenným mostem', 'Deník malého vynálezce', 'Ostrov ztracených map', 'Případ zmizelé svačiny',
  'Drak ze sídliště', 'Hvězdná posádka', 'Zápisník lesní hlídky', 'Superžák zasahuje',
  'Klíč od podzemí', 'Šifra ve školní kronice', 'Les, kde mluví stromy', 'Závod na Marsu'
];
const GENRES = ['Dobrodružná', 'Detektivka', 'Fantasy', 'Komiks'];
const GENRE_PLURAL = { 'Dobrodružná': 'dobrodružné knihy', 'Detektivka': 'detektivky', 'Fantasy': 'fantasy knihy', 'Komiks': 'komiksy' };
const TEAMS = ['Sovy', 'Lišky', 'Rysi', 'Vydry', 'Jestřábi', 'Bobři', 'Veverky', 'Delfíni'];
const MONTHS = [
  { name: 'září', short: 'Zář', loc: 'v září' }, { name: 'říjen', short: 'Říj', loc: 'v říjnu' },
  { name: 'listopad', short: 'Lis', loc: 'v listopadu' }, { name: 'prosinec', short: 'Pro', loc: 'v prosinci' },
  { name: 'leden', short: 'Led', loc: 'v lednu' }, { name: 'únor', short: 'Úno', loc: 'v únoru' },
  { name: 'březen', short: 'Bře', loc: 'v březnu' }, { name: 'duben', short: 'Dub', loc: 'v dubnu' },
  { name: 'květen', short: 'Kvě', loc: 'v květnu' }, { name: 'červen', short: 'Čvn', loc: 'v červnu' }
];
const DESTINATIONS = ['Zoo', 'Hrad', 'Aquapark', 'Planetárium', 'Skanzen'];

function bufetTable(rng) {
  const voda = rng.sample(Array.from({ length: 25 }, (_, i) => i + 6), 5); // různé hodnoty => jednoznačný vítěz
  const top = rng.int(14, 22);
  const tie = rng.sample([0, 1, 2, 3, 4], 2); // dva dny se stejným maximem sušenek
  const susenky = DAYS.map((_, i) => (tie.includes(i) ? top : rng.int(4, top - 1)));
  const zeroDay = rng.int(0, 4); // jeden den nedovezli ovoce => 0 (nula je údaj)
  const ovoce = DAYS.map((_, i) => (i === zeroDay ? 0 : rng.int(5, 18)));
  return {
    title: 'Prodej ve školním bufetu (počet kusů)',
    columns: [
      { key: 'den', label: 'Den', type: 'text' },
      { key: 'ovoce', label: 'Ovoce', type: 'number' },
      { key: 'susenky', label: 'Sušenky', type: 'number' },
      { key: 'voda', label: 'Voda', type: 'number' }
    ],
    rows: DAYS.map((d, i) => ({ id: d.id, den: d.name, ovoce: ovoce[i], susenky: susenky[i], voda: voda[i] })),
    meta: { tie, zeroDay }
  };
}

function libraryTable(rng) {
  const titles = rng.sample(BOOK_TITLES, 10);
  const genre = rng.pick(GENRES);
  const others = GENRES.filter(g => g !== genre);
  const k = rng.int(4, 7);
  // 4 knihy cílového žánru: dvě (nebo tři) splňují „aspoň k“, jedna má přesně k (hraniční případ)
  const third = rng.next() < 0.5;
  const targetLoans = [k + rng.int(1, 4), k, k - rng.int(1, 3), third ? k + rng.int(2, 5) : rng.int(0, k - 2)];
  // ostatní žánry: aspoň dvě knihy s ≥ k, ať jedna podmínka nestačí
  const otherLoans = [k + rng.int(0, 5), k + rng.int(1, 4), ...Array.from({ length: 4 }, () => rng.int(0, 12))];
  const rows = titles.map((nazev, i) => ({
    id: 'k' + i,
    nazev,
    zanr: i < 4 ? genre : others[(i + rng.int(0, 2)) % others.length],
    vypujcky: i < 4 ? targetLoans[i] : otherLoans[i - 4],
    stran: rng.int(6, 40) * 8
  }));
  return {
    title: 'Třídní knihovna – výpůjčky za pololetí',
    columns: [
      { key: 'nazev', label: 'Název knihy', type: 'text' },
      { key: 'zanr', label: 'Žánr', type: 'text', filter: 'select' },
      { key: 'vypujcky', label: 'Výpůjčky', type: 'number', filter: 'number' },
      { key: 'stran', label: 'Stran', type: 'number', filter: 'number' }
    ],
    rows: rng.shuffle(rows),
    meta: { genre, k }
  };
}

function sportTable(rng) {
  const teams = rng.sample(TEAMS, 6);
  let rows;
  // generujeme, dokud není jednoznačný vítěz (deterministicky – stále stejný rng)
  for (let attempt = 0; attempt < 50; attempt++) {
    rows = teams.map((t, i) => {
      const beh = rng.int(5, 20), skok = rng.int(5, 20), hod = rng.int(5, 20);
      return { id: 't' + i, druzstvo: t, beh, skok, hod, celkem: beh + skok + hod };
    });
    if (maxRows(rows, 'celkem').length === 1) break;
  }
  const winner = maxRows(rows, 'celkem')[0];
  const missing = rng.next() < 0.5 ? winner : rng.pick(rows.filter(r => r !== winner));
  return {
    title: 'Sportovní den – body družstev',
    columns: [
      { key: 'druzstvo', label: 'Družstvo', type: 'text' },
      { key: 'beh', label: 'Běh', type: 'number' },
      { key: 'skok', label: 'Skok', type: 'number' },
      { key: 'hod', label: 'Hod', type: 'number' },
      { key: 'celkem', label: 'Celkem', type: 'number' }
    ],
    rows,
    meta: { winnerId: winner.id, missingId: missing.id }
  };
}

function throwTable(rng, sportTeams) {
  const teams = rng.sample(sportTeams, 4); // stejná družstva jako ve sportovním dni
  const best = rng.int(300, 360) / 10; // v metrech
  const entries = [
    { m: best, unit: 'm' },
    { m: Math.round((best - rng.int(3, 12) / 10) * 100) / 100, unit: 'cm' },
    { m: Math.round((best - rng.int(13, 25) / 10) * 100) / 100, unit: 'cm' },
    { m: Math.round((best - rng.int(10, 40) / 10) * 10) / 10, unit: 'm' }
  ];
  const rows = entries.map((e, i) => {
    const value = e.unit === 'cm' ? Math.round(e.m * 100) : e.m;
    return { id: 'h' + i, druzstvo: teams[i], vykon: `${formatCz(value)} ${e.unit}`, value, unit: e.unit, meters: toMeters(value, e.unit) };
  });
  return {
    title: 'Hod míčkem – nejdelší hod družstva',
    columns: [
      { key: 'druzstvo', label: 'Družstvo', type: 'text' },
      { key: 'vykon', label: 'Nejdelší hod', type: 'text' }
    ],
    rows: rng.shuffle(rows),
    meta: { bestId: 'h0' }
  };
}

/* ================= Úrovně, režimy, dovednosti ================= */

export const LEVELS = {
  1: { name: 'Spis 1: Školní bufet', focus: 'Čtení tabulky' },
  2: { name: 'Spis 2: Knihovna a sportovní den', focus: 'Řazení, filtry a doplňování' },
  3: { name: 'Spis 3: Grafy školní redakce', focus: 'Grafy a jejich pravdivost' },
  4: { name: 'Velký případ: Školní výlet', focus: 'Propojení dat a skryté chyby' }
};

export const SKILLS = {
  cteni: 'Najdu buňku podle adresy a přečtu z tabulky hodnotu.',
  razeni: 'Seřadím tabulku tak, aby řádky zůstaly pohromadě.',
  filtr: 'Vyfiltruji záznamy podle dvou podmínek zároveň.',
  doplneni: 'Doplním údaj podle pravidla a porovnám různé jednotky.',
  graf: 'Vyberu typ grafu podle toho, co chci ukázat.',
  pravdivost: 'Odhalím, kdy graf neodpovídá tabulce nebo zkresluje.'
};

export const MODES = {
  rychly: { label: 'Rychlý režim', minutes: 10, tasks: ['t1', 't3', 't6', 't7', 't13', 't15'] },
  standard: { label: 'Celá mise', minutes: 20, levels: [1, 2, 3] },
  dlouha: { label: 'Dlouhá mise', minutes: 35, levels: [1, 2, 3, 4] }
};

/* ================= Generátor úloh ================= */

/** Ukázková úloha pro tutoriál (vždy stejná). */
export function tutorialTask() {
  return {
    id: 'tutorial', level: 0, type: 'cell', skill: 'cteni',
    title: 'Ukázka: najdi buňku',
    prompt: 'Klikni na buňku, ve které je počet hrušek snědených v úterý. Pak stiskni „Zkontrolovat“.',
    table: {
      title: 'Svačiny (ukázková tabulka)',
      columns: [{ key: 'den', label: 'Den', type: 'text' }, { key: 'jablka', label: 'Jablka', type: 'number' }, { key: 'hrusky', label: 'Hrušky', type: 'number' }],
      rows: [{ id: 'po', den: 'Pondělí', jablka: 4, hrusky: 2 }, { id: 'ut', den: 'Úterý', jablka: 6, hrusky: 3 }]
    },
    expected: { row: 1, col: 2 },
    hints: ['Najdi řádek „Úterý“.', 'Jdi po řádku doprava až pod nadpis „Hrušky“ – to je buňka C3.'],
    solution: 'Správná je buňka C3 (řádek Úterý, sloupec Hrušky) s hodnotou 3.'
  };
}

/** Vytvoří všechny úlohy mise pro daný seed. Stejný seed => stejné úlohy (deterministické). */
export function buildMission(seed) {
  const rng = makeRng(seed);
  const bufet = bufetTable(rng);
  const library = libraryTable(rng);
  const sport = sportTable(rng);
  const throws = throwTable(rng, sport.rows.map(r => r.druzstvo));
  const B = bufet.rows;
  const colIdx = key => bufet.columns.findIndex(c => c.key === key);
  const tasks = [];

  /* ---------- Úroveň 1: čtení tabulky ---------- */
  {
    const r = rng.int(0, 4);
    const item = rng.pick(['ovoce', 'voda']);
    const c = colIdx(item);
    tasks.push({
      id: 't1', level: 1, type: 'cell', skill: 'cteni', table: bufet,
      title: 'Najdi buňku',
      prompt: `Klikni na buňku, ve které je zapsáno, kolik ${BUFET_ITEMS[item].phrase} se prodalo ${DAYS[r].loc}.`,
      expected: { row: r, col: c },
      hints: [`Najdi nejdřív řádek „${DAYS[r].name}“.`, `Jdi po tomto řádku doprava až do sloupce „${BUFET_ITEMS[item].label}“. Hledaná buňka je na průsečíku.`],
      solution: `Správná je buňka ${cellAddress(c, r)}: řádek ${DAYS[r].name}, sloupec ${BUFET_ITEMS[item].label}, hodnota ${B[r][item]}.`
    });
  }
  {
    const c = rng.int(1, 3);
    const r = rng.int(0, 4);
    const key = bufet.columns[c].key;
    const addr = cellAddress(c, r);
    tasks.push({
      id: 't2', level: 1, type: 'number', skill: 'cteni', table: bufet, inspect: true,
      title: 'Adresa buňky',
      prompt: `Tabulkový editor označuje buňky písmenem sloupce a číslem řádku. Jaká hodnota je v buňce ${addr}?`,
      expected: B[r][key],
      near: {
        [r > 0 ? B[r - 1][key] : NaN]: 'Pozor na číslo řádku: řádek 1 je záhlaví s nadpisy, první den je až v řádku 2.',
        [r < 4 ? B[r + 1][key] : NaN]: 'Pozor na číslo řádku: počítej řádky od záhlaví (řádek 1), ne od prvního dne.'
      },
      hints: [`Písmeno ${addr[0]} je sloupec, číslo ${addr.slice(1)} je řádek.`, 'Můžeš klikat na buňky – nahoře v řádku vzorců uvidíš jejich adresu.'],
      solution: `V buňce ${addr} (sloupec ${bufet.columns[c].label}, řádek ${DAYS[r].name}) je hodnota ${B[r][key]}.`
    });
  }
  {
    const c = colIdx('susenky');
    const tieRows = bufet.meta.tie.slice().sort((a, b) => a - b);
    const top = B[tieRows[0]].susenky;
    tasks.push({
      id: 't3', level: 1, type: 'cells', skill: 'cteni', table: bufet,
      title: 'Stejné hodnoty',
      prompt: 'Ve který den se prodalo nejvíc balíčků sušenek? Označ všechny buňky s nejvyšší hodnotou ve sloupci Sušenky – může jich být i víc.',
      expected: { rows: tieRows, cols: [0, c] },
      hints: ['Projdi celý sloupec Sušenky a najdi největší číslo.', 'Zkontroluj, jestli se stejné největší číslo neobjeví ještě jinde.'],
      solution: `Nejvíc (${top}) se prodalo ${tieRows.map(i => DAYS[i].loc).join(' i ')} – dva dny mají stejnou hodnotu, oba „vyhrávají“.`
    });
  }
  {
    const z = bufet.meta.zeroDay;
    tasks.push({
      id: 't4', level: 1, type: 'choice', skill: 'cteni', table: bufet,
      title: 'Nula je také údaj',
      prompt: 'Ve který den se neprodal žádný kus ovoce?',
      options: DAYS.map((d, i) => ({
        id: d.id, label: d.name,
        why: i === z ? 'V buňce je 0. Nula je platný údaj: ten den se prodalo nula kusů.' : `${d.name}: prodalo se ${B[i].ovoce} kusů ovoce.`
      })),
      expected: DAYS[z].id,
      hints: ['Dívej se jen do sloupce Ovoce.', 'Hledáš buňku s hodnotou 0.'],
      solution: `${DAYS[z].name} – ve sloupci Ovoce je 0.`
    });
  }
  {
    const total = sumBy(B, 'voda');
    const near = { [sumBy(B, 'ovoce')]: 'To je součet sloupce Ovoce. Sčítej sloupec Voda.', [sumBy(B, 'susenky')]: 'To je součet sloupce Sušenky. Sčítej sloupec Voda.' };
    near[Math.max(...B.map(r => r.voda))] = 'To je jen jeden den. Sečti všech pět dní.';
    tasks.push({
      id: 't5', level: 1, type: 'number', skill: 'cteni', table: bufet, inspect: true,
      title: 'Součet za týden',
      prompt: 'Kolik lahví vody se prodalo za celý týden (pondělí až pátek)?',
      expected: total, near,
      hints: ['Sečti všech pět čísel ve sloupci Voda.', `Začátek: ${B[0].voda} + ${B[1].voda} + …`],
      solution: `${B.map(r => r.voda).join(' + ')} = ${total}`
    });
  }

  /* ---------- Úroveň 2: řazení, filtry, doplňování ---------- */
  {
    const sorted = sortRows(B, 'voda', 'desc');
    const leader = sorted[0];
    tasks.push({
      id: 't6', level: 2, type: 'sort', skill: 'razeni', table: bufet,
      title: 'Seřaď a najdi vítěze',
      prompt: 'Vedoucí bufetu chce vědět, kdy se nejvíc pije. Seřaď celou tabulku podle sloupce Voda sestupně (od největšího) a urči, který den vede.',
      sortKey: 'voda', sortDir: 'desc',
      question: 'Který den se prodalo nejvíc vody?',
      options: DAYS.map(d => ({ id: d.id, label: d.name })),
      expected: leader.id,
      hints: ['V nástroji Seřadit vyber sloupec Voda a pořadí „Sestupně“.', 'Zvol „Rozšířit výběr – celé řádky“. Jinak by se čísla odtrhla od svých dnů.'],
      solution: `Po seřazení celých řádků podle vody sestupně je nahoře ${leader.den} (${leader.voda} lahví).`
    });
  }
  {
    const { genre, k } = library.meta;
    const conds = [{ key: 'zanr', op: 'eq', value: genre }, { key: 'vypujcky', op: 'gte', value: k }];
    const ids = filterRows(library.rows, conds).map(r => r.id);
    tasks.push({
      id: 't7', level: 2, type: 'filter', skill: 'filtr', table: library,
      title: 'Dvě podmínky zároveň',
      prompt: `Knihovnice hledá ${GENRE_PLURAL[genre]}, které si někdo půjčil aspoň ${k}×. Nastav filtr tak, aby platily obě podmínky zároveň, a napiš, kolik knih zůstalo.`,
      conditions: conds, expectedIds: ids, expected: ids.length,
      hints: [`Ve filtru Žánr vyber „${genre}“.`, `U výpůjček zvol „≥“ (aspoň) a hodnotu ${k}. Kniha s přesně ${k} výpůjčkami se také počítá.`],
      solution: `Žánr = ${genre} a zároveň výpůjčky ≥ ${k}: ${filterRows(library.rows, conds).map(r => r.nazev).join(', ')} – celkem ${ids.length}.`
    });
  }
  {
    tasks.push({
      id: 't8', level: 2, type: 'choice', skill: 'razeni', table: library,
      title: 'Na pořadí nezáleží',
      prompt: 'Spočítáš celkový počet výpůjček všech knih. Pak někdo tabulku seřadí podle počtu stran (celé řádky). Co se stane se součtem výpůjček?',
      options: [
        { id: 'same', label: 'Zůstane stejný.', why: 'Řazení jen mění pořadí řádků. Žádný záznam nepřibude ani nezmizí, takže součet se nezmění.' },
        { id: 'more', label: 'Zvětší se.', why: 'Řazení nic nepřidává – jen přeskládá stejné řádky.' },
        { id: 'less', label: 'Zmenší se.', why: 'Řazení nic neubírá – jen přeskládá stejné řádky.' },
        { id: 'unknown', label: 'Nedá se říct, záleží na pořadí.', why: 'U sčítání na pořadí nezáleží (3 + 5 = 5 + 3).' }
      ],
      expected: 'same',
      hints: ['Přibude nebo zmizí při řazení nějaký řádek?', 'Platí 3 + 5 = 5 + 3?'],
      solution: 'Součet zůstane stejný – řazení mění jen pořadí záznamů, ne jejich hodnoty.'
    });
  }
  {
    const miss = sport.rows.find(r => r.id === sport.meta.missingId);
    const winner = sport.rows.find(r => r.id === sport.meta.winnerId);
    tasks.push({
      id: 't9', level: 2, type: 'edit', skill: 'doplneni', table: sport,
      title: 'Doplň chybějící údaj',
      prompt: `Ve sloupci Celkem chybí hodnota u družstva ${miss.druzstvo}. Platí pravidlo: Celkem = Běh + Skok + Hod. Doplň ji do buňky a pak urči vítězné družstvo.`,
      editRowId: miss.id, editKey: 'celkem',
      expectedValue: miss.celkem,
      partialValues: { [miss.beh + miss.skok]: 'Chybí ti body za hod.', [miss.skok + miss.hod]: 'Chybí ti body za běh.', [miss.beh + miss.hod]: 'Chybí ti body za skok.' },
      question: 'Které družstvo má nejvíc bodů celkem?',
      options: sport.rows.map(r => ({ id: r.id, label: r.druzstvo })),
      expected: winner.id,
      hints: [`Sečti body družstva ${miss.druzstvo}: ${miss.beh} + ${miss.skok} + ${miss.hod}.`, 'Vítěze urči až po doplnění – porovnej celý sloupec Celkem.'],
      solution: `${miss.druzstvo}: ${miss.beh} + ${miss.skok} + ${miss.hod} = ${miss.celkem}. Vítěz: ${winner.druzstvo} (${winner.celkem} bodů).`
    });
  }
  {
    const best = throws.rows.find(r => r.id === throws.meta.bestId);
    tasks.push({
      id: 't10', level: 2, type: 'choice', skill: 'doplneni', table: throws,
      title: 'Různé jednotky',
      prompt: 'Rozhodčí zapisovali výkony v různých jednotkách. Které družstvo hodilo nejdál?',
      options: throws.rows.map(r => ({
        id: r.id, label: r.druzstvo,
        why: r.id === best.id
          ? `${r.vykon} je nejdelší hod. Ostatní výkony převedené na metry jsou menší.`
          : `${r.vykon} = ${formatCz(r.meters)} m, to je méně než ${best.vykon}.${r.unit === 'cm' ? ' Velké číslo neznamená velký výkon – záleží na jednotce.' : ''}`
      })),
      expected: best.id,
      hints: ['Převeď všechny výkony na stejnou jednotku.', '100 cm = 1 m, takže 3 250 cm = 32,5 m.'],
      solution: `Převedeno na metry: ${throws.rows.map(r => `${r.druzstvo} ${formatCz(r.meters)} m`).join(', ')}. Nejdál hodilo družstvo ${best.druzstvo}.`
    });
  }

  /* ---------- Úroveň 3: grafy ---------- */
  const SCENARIOS = {
    trend: {
      prompt: 'Knihovnice chce ukázat, jak se měnil počet výpůjček měsíc po měsíci od září do června. Který graf je nejvhodnější?',
      why: {
        line: 'Čárový graf ukazuje vývoj v čase – je vidět, kdy počet roste a kdy klesá.',
        bar: 'Sloupcový graf by šel použít, ale vývoj v čase (trend) je lépe vidět na čárovém grafu.',
        pie: 'Kruhový graf ukazuje části jednoho celku, ne změnu v čase.'
      }
    },
    share: {
      prompt: 'Škola hlasovala o cíli výletu. Chceš ukázat, jakou část ze všech hlasů (z celku) získala každá možnost. Který graf je nejvhodnější?',
      why: {
        pie: 'Kruhový graf ukazuje, jak velkou část celku (100 %) tvoří každá možnost.',
        bar: 'Sloupcový graf porovná počty, ale neukáže, že dohromady tvoří jeden celek.',
        line: 'Čárový graf je pro vývoj v čase. Cíle výletu nejdou v čase po sobě.'
      }
    },
    compare: {
      prompt: 'Chceš porovnat, kolik kusů ovoce, sušenek a vody se v bufetu prodalo za celý týden. Který graf je nejvhodnější?',
      why: {
        bar: 'Sloupcový graf nejlépe porovná velikosti několika kategorií vedle sebe.',
        pie: 'Kruhový graf je pro části celku. Na porovnání velikostí je přesnější sloupcový graf.',
        line: 'Čárový graf je pro vývoj v čase. Ovoce, sušenky a voda nejdou v čase po sobě.'
      }
    }
  };
  const chartTask = (id, purpose) => {
    const s = SCENARIOS[purpose];
    const best = CHART_FOR_PURPOSE[purpose];
    const names = { bar: 'Sloupcový graf', line: 'Čárový graf', pie: 'Kruhový graf' };
    return {
      id, level: 3, type: 'choice', skill: 'graf', preview: 'charts',
      title: 'Vyber vhodný graf',
      prompt: s.prompt,
      options: ['bar', 'line', 'pie'].map(k => ({ id: k, label: names[k], why: s.why[k] })),
      expected: best,
      hints: ['Ptej se: ukazuji vývoj v čase, část z celku, nebo porovnávám velikosti?', 'Čas → čárový, část celku → kruhový, porovnání → sloupcový.'],
      solution: `${names[best]}. ${s.why[best]}`
    };
  };
  tasks.push(chartTask('t11', 'trend'));
  tasks.push(chartTask('t12', rng.pick(['share', 'compare'])));
  {
    const wrong = rng.int(0, 4);
    const delta = rng.pick([-1, 1]) * rng.int(5, 9);
    const values = B.map((r, i) => (i === wrong ? Math.max(1, r.voda + delta) : r.voda));
    if (values[wrong] === B[wrong].voda) values[wrong] += 6;
    tasks.push({
      id: 't13', level: 3, type: 'bar', skill: 'pravdivost', table: bufet,
      title: 'Tabulka vs. graf',
      prompt: 'Redakce nakreslila graf prodeje vody podle tabulky. Jeden sloupec ale neodpovídá. Klikni na chybný sloupec.',
      chart: { kind: 'bar', title: 'Prodej vody (lahve)', labels: DAYS.map(d => d.name), short: DAYS.map(d => d.name.slice(0, 2)), values, axisMin: 0, showValues: true },
      expected: wrong,
      hints: ['Porovnej číslo nad každým sloupcem s tabulkou, sloupec Voda.', 'Jdi den po dni: pondělí, úterý, …'],
      solution: `Chybný je sloupec ${DAYS[wrong].name}: graf ukazuje ${values[wrong]}, ale v tabulce je ${B[wrong].voda}.`
    });
  }
  {
    // obědy: pátek nejnižší, rozdíly malé => osa od 175 vytvoří „zhroucení“
    const base = rng.int(186, 194);
    const lunch = [base + rng.int(1, 6), base + rng.int(0, 5), base + rng.int(2, 7), base + rng.int(0, 4), base - rng.int(3, 6)];
    tasks.push({
      id: 't14', level: 3, type: 'axis', skill: 'pravdivost',
      title: 'Oprav osu',
      prompt: 'Školní noviny napsaly: „V pátek se počet obědů zhroutil!“ a přiložily tento graf. Změň začátek osy Y tak, aby graf ukazoval rozdíly poctivě.',
      chart: { kind: 'bar', title: 'Vydané obědy', labels: DAYS.map(d => d.name), short: DAYS.map(d => d.name.slice(0, 2)), values: lunch, axisMin: 175, showValues: true },
      axisOptions: [175, 150, 100, 0],
      expected: 0,
      hints: ['U sloupcového grafu má výška sloupce odpovídat hodnotě.', 'Výška odpovídá hodnotě jen tehdy, když osa začíná na nule.'],
      solution: `Osa má začínat na 0. Pak je vidět, že pátek (${lunch[4]}) je jen o pár obědů níž než ostatní dny (${Math.min(...lunch.slice(0, 4))}–${Math.max(...lunch.slice(0, 4))}).`
    });
  }
  {
    const dests = rng.sample(DESTINATIONS, 3);
    const votes = [rng.int(91, 94), rng.int(95, 97), rng.int(98, 100)];
    const order = rng.shuffle([0, 1, 2]);
    const labels = order.map(i => dests[i]);
    const values = order.map(i => votes[i]);
    const misleading = rng.pick(['A', 'B']);
    const d = axisDistortion(values, 90);
    const reasons = [
      { id: 'axis', label: 'Osa Y nezačíná na nule, takže malé rozdíly vypadají obrovské.' },
      { id: 'colors', label: 'Sloupce mají jiné barvy.' },
      { id: 'numbers', label: 'Používá jiná čísla než tabulka.' },
      { id: 'missing', label: 'Chybí v něm jedna z možností.' }
    ];
    tasks.push({
      id: 't15', level: 3, type: 'compare', skill: 'pravdivost',
      title: 'Který graf klame?',
      prompt: 'Dva žáci nakreslili graf ze stejných dat o hlasování. Jeden z grafů čtenáře klame. Vyber ho a urči proč.',
      table: {
        title: 'Hlasování o cíli výletu',
        columns: [{ key: 'cil', label: 'Cíl', type: 'text' }, { key: 'hlasy', label: 'Hlasy', type: 'number' }],
        rows: labels.map((l, i) => ({ id: 'v' + i, cil: l, hlasy: values[i] }))
      },
      charts: {
        A: { kind: 'bar', title: 'Graf A', labels, values, axisMin: misleading === 'A' ? 90 : 0, showValues: true, alt: true },
        B: { kind: 'bar', title: 'Graf B', labels, values, axisMin: misleading === 'B' ? 90 : 0, showValues: true }
      },
      reasons,
      expected: { chart: misleading, reason: 'axis' },
      reasonWhy: {
        colors: 'Barva sloupců hodnoty nemění – oba grafy mají stejná data.',
        numbers: 'Popisky nad sloupci jsou v obou grafech stejné jako v tabulce.',
        missing: 'V obou grafech jsou všechny tři možnosti.'
      },
      hints: ['Podívej se, kde začíná svislá osa (osa Y) v každém grafu.', `Hodnoty se liší jen o pár hlasů (${Math.min(...values)}–${Math.max(...values)}).`],
      solution: `Klame graf ${misleading}: osa začíná na 90, takže nejvyšší sloupec vypadá ${formatCz(Math.round(d.visual * 10) / 10)}× vyšší než nejnižší, i když hodnota je větší jen asi o ${Math.round((d.real - 1) * 100)} %.`
    });
  }

  /* ---------- Úroveň 4: velký případ (dlouhá mise) ---------- */
  {
    const classes = ['6.A', '6.B', '6.C'];
    const counts = classes.map(() => rng.int(18, 28));
    const doprava = rng.int(8, 15) * 10;
    const vstupne = rng.int(6, 12) * 10;
    const ci = rng.int(0, 2);
    const n = counts[ci];
    const expected = n * (doprava + vstupne);
    tasks.push({
      id: 't16', level: 4, type: 'number', skill: 'doplneni',
      title: 'Propoj dvě tabulky',
      prompt: `Kolik korun zaplatí dohromady všichni přihlášení žáci třídy ${classes[ci]}? Každý platí dopravu i vstupné.`,
      tables: [
        { title: 'Přihlášky na výlet', columns: [{ key: 'trida', label: 'Třída', type: 'text' }, { key: 'zaci', label: 'Přihlášeno žáků', type: 'number' }], rows: classes.map((c, i) => ({ id: 'c' + i, trida: c, zaci: counts[i] })) },
        { title: 'Ceník na jednoho žáka', columns: [{ key: 'polozka', label: 'Položka', type: 'text' }, { key: 'cena', label: 'Cena (Kč)', type: 'number' }], rows: [{ id: 'd', polozka: 'Doprava', cena: doprava }, { id: 'v', polozka: 'Vstupné', cena: vstupne }] }
      ],
      unit: 'Kč',
      expected,
      near: {
        [doprava + vstupne]: 'To je cena pro jednoho žáka. Vynásob ji počtem přihlášených.',
        [n * doprava]: 'Započítaná je jen doprava. Přidej i vstupné.',
        [n * vstupne]: 'Započítané je jen vstupné. Přidej i dopravu.'
      },
      hints: [`Z první tabulky: třída ${classes[ci]} má ${n} přihlášených. Z druhé: cena na žáka je ${doprava} + ${vstupne} Kč.`, `Spočítej ${n} × (${doprava} + ${vstupne}).`],
      solution: `${n} × (${doprava} + ${vstupne}) = ${n} × ${doprava + vstupne} = ${expected} Kč.`
    });
  }
  {
    const extra = rng.int(10, 25);
    const parts = [rng.int(30, 40), rng.int(20, 28), rng.int(10, 18)];
    parts.push(100 + extra - parts.reduce((a, b) => a + b, 0));
    const labels = ['Pěšky', 'Autobusem', 'Na kole', 'Autem'];
    tasks.push({
      id: 't17', level: 4, type: 'choice', skill: 'pravdivost',
      title: 'Kontrola celku',
      prompt: 'Graf ukazuje, jak žáci 6. ročníku jezdí do školy. Co je na něm špatně?',
      chart: { kind: 'pie', title: 'Cesta do školy (%)', labels, values: parts, unit: '%' },
      options: [
        { id: 'sum', label: `Procenta dávají dohromady ${100 + extra} %, celek ale musí být 100 %.`, why: `Sečti výseče: ${parts.join(' + ')} = ${100 + extra} %. Někde je chyba v datech.` },
        { id: 'pie', label: 'Kruhový graf se na procenta nepoužívá.', why: 'Naopak – kruhový graf je pro procenta (části celku) typický.' },
        { id: 'colors', label: 'Výseče mají různé barvy.', why: 'Různé barvy pomáhají výseče rozlišit, to chyba není.' },
        { id: 'ok', label: 'Nic, graf je v pořádku.', why: 'Zkus sečíst všechna procenta.' }
      ],
      expected: 'sum',
      hints: ['Kruhový graf ukazuje celek. Kolik procent má celek?', `Sečti ${parts.join(' + ')}.`],
      solution: `${parts.join(' + ')} = ${100 + extra} %, ale celek je vždy 100 %. Data jsou chybná.`
    });
  }
  {
    const loans = MONTHS.map(() => rng.int(25, 60));
    const mi = rng.int(2, 7);
    const tableRows = MONTHS.map((m, i) => ({ id: 'm' + i, mesic: m.name, vypujcky: i === mi ? null : loans[i] }));
    tasks.push({
      id: 't18', level: 4, type: 'choice', skill: 'pravdivost',
      title: 'Chybějící není nula',
      prompt: `Graf ukazuje, že ${MONTHS[mi].loc} si nikdo nepůjčil žádnou knihu. Porovnej ho s tabulkou. Co je pravda?`,
      table: { title: 'Výpůjčky v knihovně', columns: [{ key: 'mesic', label: 'Měsíc', type: 'text' }, { key: 'vypujcky', label: 'Výpůjčky', type: 'number' }], rows: tableRows },
      chart: { kind: 'line', title: 'Výpůjčky podle měsíců', labels: MONTHS.map(m => m.short), values: loans.map((v, i) => (i === mi ? 0 : v)), axisMin: 0 },
      options: [
        { id: 'missing', label: 'V tabulce údaj chybí. Graf ho nakreslil jako 0 – chybějící údaj ale není nula.', why: 'Prázdná buňka znamená „nevíme“. Graf, který z ní udělá nulu, tvrdí něco, co v datech není.' },
        { id: 'real', label: 'V tom měsíci se opravdu nic nepůjčilo.', why: 'V tabulce u toho měsíce není 0, ale prázdná buňka – údaj chybí.' },
        { id: 'empty0', label: 'Graf je správně, protože prázdná buňka znamená 0.', why: 'Prázdná buňka není totéž co 0. Nula je údaj, prázdná buňka znamená, že údaj nemáme.' },
        { id: 'table', label: 'Chyba je v tabulce, graf má pravdu.', why: 'Graf vzniká z tabulky. Když v tabulce údaj chybí, graf ho nemůže znát.' }
      ],
      expected: 'missing',
      hints: [`Najdi v tabulce řádek „${MONTHS[mi].name}“.`, 'Je v buňce 0, nebo je prázdná?'],
      solution: `Pro měsíc ${MONTHS[mi].name} v tabulce údaj chybí. Graf ho chybně nakreslil jako 0.`
    });
  }

  // pořadí možností u otázek, kde by správná odpověď byla vždy první, se míchá (deterministicky podle seedu)
  for (const t of tasks) {
    if (['t8', 't17', 't18'].includes(t.id)) t.options = rng.shuffle(t.options);
    if (t.reasons) t.reasons = rng.shuffle(t.reasons);
  }
  return { seed, tasks, data: { bufet, library, sport, throws } };
}

/** Úlohy pro daný režim, ve správném pořadí. */
export function tasksForMode(mission, modeId) {
  const mode = MODES[modeId] || MODES.standard;
  if (mode.tasks) return mission.tasks.filter(t => mode.tasks.includes(t.id));
  return mission.tasks.filter(t => mode.levels.includes(t.level));
}

/* ================= Vyhodnocení ================= */

const OK = msg => ({ ok: true, msg });
const NO = msg => ({ ok: false, msg });

/**
 * Deterministicky vyhodnotí odpověď. Vrací { ok, msg } – msg je věcné vysvětlení „proč“.
 * Tvar `answer` podle typu úlohy:
 *  cell    { row, col }            cells  [{ row, col }]        number { value: '12' }
 *  choice  { option }              sort   { rows, broken, option }
 *  filter  { visibleIds, count }   edit   { value, option }
 *  bar     { index }               axis   { axisMin }           compare { chart, reason }
 */
export function checkAnswer(task, answer = {}) {
  switch (task.type) {
    case 'cell': {
      if (answer.row == null) return NO('Nejdřív klikni na buňku v tabulce.');
      const { row, col } = task.expected;
      if (answer.row === row && answer.col === col) return OK(task.solution);
      const cols = task.table.columns;
      if (answer.row === row) return NO(`Řádek je správně, ale sloupec „${cols[answer.col].label}“ ne. Hledáš sloupec „${cols[col].label}“.`);
      if (answer.col === col) return NO(`Sloupec je správně, ale jsi v řádku „${task.table.rows[answer.row][cols[0].key]}“.`);
      return NO('To je jiná buňka. Najdi nejdřív správný řádek, pak sloupec.');
    }
    case 'cells': {
      const sel = answer.cells || [];
      if (!sel.length) return NO('Označ aspoň jednu buňku.');
      const rows = [...new Set(sel.map(c => c.row))].sort((a, b) => a - b);
      const badCol = sel.some(c => !task.expected.cols.includes(c.col));
      if (badCol) return NO('Označuj buňky ve sloupci Sušenky (případně názvy dnů).');
      const exp = task.expected.rows;
      const missing = exp.filter(r => !rows.includes(r));
      const extra = rows.filter(r => !exp.includes(r));
      if (!missing.length && !extra.length) return OK(`Výborně! ${task.solution}`);
      if (extra.length) return NO('Některá označená buňka nemá nejvyšší hodnotu. Porovnej čísla ještě jednou.');
      return NO('Správně, ale to není všechno: ještě jiný den má úplně stejnou nejvyšší hodnotu.');
    }
    case 'number': {
      const v = parseCzNumber(answer.value);
      if (Number.isNaN(v)) return NO('Napiš číslo (jen číslice, desetinnou čárku případně).');
      if (v === task.expected) return OK(task.solution);
      if (task.near && Object.hasOwn(task.near, String(v))) return NO(task.near[String(v)]);
      return NO('To nesedí. Zkontroluj, ze kterých buněk čteš, a zkus to znovu.');
    }
    case 'choice': {
      if (!answer.option) return NO('Vyber jednu z možností.');
      const opt = task.options.find(o => o.id === answer.option);
      const why = opt && opt.why ? ' ' + opt.why : '';
      return answer.option === task.expected ? OK(why.trim() || task.solution) : NO(why.trim() || 'Tahle možnost to není.');
    }
    case 'sort': {
      const { rows, broken, option } = answer;
      if (broken) return NO('Seřadil se jen sloupec Voda a ostatní hodnoty zůstaly na místě. Řádky se rozpadly – k dnům teď patří čísla z jiných dnů. Vrať změnu tlačítkem „Zpět“ a seřaď celé řádky.');
      const cols = task.table.columns.map(c => c.key);
      if (!rows || !rowsIntact(task.table.rows, rows, cols)) return NO('Řádky tabulky nejsou celé. Vrať změnu a seřaď celé řádky.');
      if (!isSortedBy(rows, task.sortKey, task.sortDir)) {
        if (isSortedBy(rows, task.sortKey, 'asc')) return NO('Tabulka je seřazená vzestupně (od nejmenšího). Úkol chce sestupně – od největšího.');
        return NO('Tabulka ještě není seřazená podle sloupce Voda.');
      }
      if (!option) return NO('Tabulka je seřazená správně. Teď vyber, který den vede.');
      if (option !== task.expected) return NO('Tabulka je seřazená správně. Vedoucí den je teď v prvním řádku – podívej se na něj.');
      return OK(`Přesně tak! ${task.solution} Díky řazení celých řádků zůstal každý počet u svého dne.`);
    }
    case 'filter': {
      const vis = [...(answer.visibleIds || [])].sort();
      const exp = [...task.expectedIds].sort();
      const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
      const rowsOf = conds => filterRows(task.table.rows, conds).map(r => r.id).sort();
      const [g, k] = task.conditions;
      if (!same(vis, exp)) {
        if (same(vis, rowsOf([g]))) return NO(`Platí jen podmínka žánru. Přidej druhou podmínku: výpůjčky ≥ ${k.value}.`);
        if (same(vis, rowsOf([k]))) return NO(`Platí jen podmínka na výpůjčky. Přidej i žánr „${g.value}“.`);
        if (same(vis, rowsOf([g, { ...k, op: 'gt' }]))) return NO(`Skoro! „Aspoň ${k.value}“ znamená ${k.value} a víc (≥). Kniha s přesně ${k.value} výpůjčkami se také počítá.`);
        return NO(`Zobrazené knihy nesplňují obě podmínky zároveň: žánr = ${g.value} a výpůjčky ≥ ${k.value}.`);
      }
      const c = parseCzNumber(answer.count);
      if (Number.isNaN(c)) return NO('Filtr je nastavený správně. Teď napiš, kolik knih zůstalo.');
      if (c !== task.expected) return NO('Filtr je správně, ale počet nesedí. Spočítej řádky, které zůstaly vidět.');
      return OK(`Výborně! ${task.solution}`);
    }
    case 'edit': {
      const v = parseCzNumber(answer.value);
      if (Number.isNaN(v)) return NO('Doplň číslo do prázdné buňky ve sloupci Celkem.');
      if (v !== task.expectedValue) {
        if (Object.hasOwn(task.partialValues, String(v))) return NO(`${task.partialValues[String(v)]} Celkem = Běh + Skok + Hod.`);
        return NO('Doplněná hodnota nesedí s pravidlem Celkem = Běh + Skok + Hod. Sečti to znovu.');
      }
      if (!answer.option) return NO('Hodnota je správně. Teď vyber vítězné družstvo.');
      if (answer.option !== task.expected) return NO('Hodnota sedí. Vítěz je družstvo s nejvyšším součtem – porovnej celý sloupec Celkem včetně doplněné buňky.');
      return OK(task.solution);
    }
    case 'bar': {
      if (answer.index == null) return NO('Klikni na sloupec v grafu.');
      if (answer.index === task.expected) return OK(`Odhaleno! ${task.solution}`);
      const v = task.chart.values[answer.index];
      return NO(`Sloupec ${task.chart.labels[answer.index]} ukazuje ${v} a v tabulce je také ${v}. Ten je v pořádku.`);
    }
    case 'axis': {
      const m = Number(answer.axisMin);
      if (m === task.expected) return OK(`Teď je graf poctivý. ${task.solution}`);
      return NO(`Osa začíná na ${m}, ne na nule. Výška sloupců pořád neodpovídá počtům – rozdíly vypadají větší, než jsou.`);
    }
    case 'compare': {
      const { chart, reason } = answer;
      if (!chart) return NO('Nejdřív vyber graf, který klame.');
      if (chart !== task.expected.chart) return NO(`Graf ${chart} má osu od nuly, takže výšky sloupců odpovídají hodnotám. Podívej se na osu Y druhého grafu.`);
      if (!reason) return NO('Graf je správně. Teď vyber, proč klame.');
      if (reason !== task.expected.reason) return NO(`Graf je správně, důvod ne. ${task.reasonWhy[reason] || ''}`.trim());
      return OK(`Odhaleno! ${task.solution}`);
    }
    default:
      throw new Error(`neznámý typ úlohy ${task.type}`);
  }
}

/* ================= Hodnocení a záznamy ================= */

/**
 * Souhrn výsledků. results: [{ id, skill, solved, firstTry, hints, revealed }]
 * Nápověda nesnižuje „vyřešeno“ – jen se zobrazuje zvlášť.
 */
export function summarize(results) {
  const total = results.length;
  const solved = results.filter(r => r.solved && !r.revealed).length;
  const firstTry = results.filter(r => r.firstTry).length;
  const hints = results.reduce((s, r) => s + (r.hints || 0), 0);
  const skills = {};
  for (const r of results) {
    const s = (skills[r.skill] ||= { total: 0, solved: 0 });
    s.total++;
    if (r.solved && !r.revealed) s.solved++;
  }
  return { total, solved, firstTry, hints, accuracy: total ? Math.round((firstTry / total) * 100) : 0, skills };
}

/** Je nový výsledek lepší než uložený? Víc vyřešených napoprvé, pak méně nápověd, pak rychlost. */
export function isBetter(next, prev) {
  if (!prev) return true;
  if (next.firstTry !== prev.firstTry) return next.firstTry > prev.firstTry;
  if (next.hints !== prev.hints) return next.hints < prev.hints;
  if (next.timeMs != null && prev.timeMs != null) return next.timeMs < prev.timeMs;
  return false;
}
