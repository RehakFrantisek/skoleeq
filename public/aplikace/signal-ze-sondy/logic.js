/* Signál ze sondy – čistá logika hry (bez DOM).
   Tematický plán ICT 6. ročník, říjen: identifikace barev, barevný model, vektorová grafika,
   zjednodušení zápisu a kontrolní součet. Výstup: zakóduje v obrázku barvy více způsoby, zakóduje
   obrázek pomocí základních geometrických tvarů, zjednoduší zápis textu a obrázku, pomocí
   kontrolního součtu ověří úplnost zápisu.
   Příběh: sonda na cizí planetě posílá snímky na Zemi. Každý bit stojí energii, okno spojení je
   krátké – žák volí a sestavuje zápis tak, aby se vešel, a kontrolním součtem hlídá poškození.
   Generátor úloh je deterministický (seed varianty A/B/C), vyhodnocení vrací věcné „proč“.
   Stejný soubor importují unit testy (node --test) i E2E testy – žádný přístup k window/document. */

/* ================= Seedovatelná náhoda ================= */
export const VARIANTS = { A: 4111, B: 5222, C: 6333 };

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
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
  };
}

/* ================= Barvy kamery sondy ================= */
/** Barvy, které kamera sondy rozliší. Písmeno se používá v zápisu „počet + barva“. */
export const PALETTE = [
  { name: 'černá', rgb: [0, 0, 0], letter: 'Č' },
  { name: 'bílá', rgb: [255, 255, 255], letter: 'B' },
  { name: 'oranžová', rgb: [255, 128, 0], letter: 'O' },
  { name: 'modrá', rgb: [0, 0, 255], letter: 'M' },
  { name: 'šedá', rgb: [128, 128, 128], letter: 'S' },
  { name: 'žlutá', rgb: [255, 255, 0], letter: 'Ž' },
  { name: 'fialová', rgb: [128, 0, 255], letter: 'F' }
];
export const LETTER_TO = Object.fromEntries(PALETTE.map((p, i) => [p.letter, i]));
/** Písmena bez háčku, která žák smí napsat místo Č a Ž. */
const DIACRITIC = { C: 'Č', Z: 'Ž' };

export const hex2 = v => v.toString(16).padStart(2, '0').toUpperCase();
export const hex = rgb => '#' + rgb.map(hex2).join('');
export const rgbText = rgb => `(${rgb.join(', ')})`;
/** Úrovně pro míchání podle šestnáctkového kódu: 00, 40, 80, C0, FF. */
export const HEX_LEVELS = [0, 64, 128, 192, 255];

/** Kolik bitů potřebuje jedno políčko, když je v obrázku k různých barev. */
export const bppFor = k => Math.max(1, Math.ceil(Math.log2(k)));
export const bitsWord = n => (n === 1 ? 'bit' : n >= 2 && n <= 4 ? 'bity' : 'bitů');

/* ================= Snímky 8 × 8 (čísla barev kamery) ================= */
export const PICTURES = {
  raketa: ['00011000', '00111100', '00133100', '00111100', '01111110', '01100110', '00255200', '00022000'],
  planeta: ['00000000', '00222200', '02222220', '55555555', '02222220', '00222200', '00000000', '00000000'],
  sonda: ['30000003', '33000033', '03311330', '00111100', '00144100', '00111100', '00400400', '04000040'],
  mimozemstan: ['00600600', '00066000', '00666600', '06166160', '06666660', '00600600', '06000060', '00000000'],
  kometa: ['00000000', '00000110', '00001111', '00011110', '04411100', '44400000', '40000000', '00000000'],
  mesic: ['00011100', '00110000', '01100000', '01100000', '01100000', '00110000', '00011100', '00000000'],
  krater: ['00000000', '00010000', '44444444', '44400444', '44000044', '44400444', '44444444', '44444444'],
  hvezda: ['00055000', '00055000', '55555555', '05555550', '00555500', '05555550', '05500550', '55000055']
};
export const PICTURE_NAMES = { raketa: 'raketa', planeta: 'planeta s prstencem', sonda: 'sonda', mimozemstan: 'mimozemšťan', kometa: 'kometa', mesic: 'měsíc', krater: 'kráter', hvezda: 'hvězda' };
export const gridFrom = rows => rows.map(r => [...r].map(Number));
export const colorsIn = grid => [...new Set(grid.flat())].sort((a, b) => a - b);

/* ================= Zápis „počet + znak“ ================= */
/** „AAAB“ nebo [0,0,0,1] → [[3,'A'],[1,'B']] */
export function runs(seq) {
  const out = [];
  for (const ch of seq) {
    if (out.length && out[out.length - 1][1] === ch) out[out.length - 1][0]++;
    else out.push([1, ch]);
  }
  return out;
}
export const rleEncode = str => runs(str).map(([n, ch]) => `${n}${ch}`).join('');
/** Řádek čísel barev → zápis „3Č2O…“ */
export const rowCode = row => runs(row).map(([n, c]) => `${n}${PALETTE[c].letter}`).join('');
/** Rozebere zápis „3A1B“. Vrací { pairs } nebo { error: 'empty'|'nocount'|'format' }. */
export function rleParse(text, { colors = false } = {}) {
  let s = String(text ?? '').toUpperCase().replace(/[\s,;×*]+/g, '');
  if (colors) s = s.replace(/[CZ]/g, ch => DIACRITIC[ch]);
  if (!s) return { error: 'empty' };
  const pairs = [];
  const re = /(\d*)(\D)/gy;
  let m, pos = 0;
  while ((m = re.exec(s))) {
    if (m[1] === '') return { error: 'nocount', ch: m[2] };
    pairs.push([Number(m[1]), m[2]]);
    pos = re.lastIndex;
  }
  if (pos !== s.length) return { error: 'format' };
  return { pairs };
}
export const rleDecode = pairs => pairs.map(([n, ch]) => ch.repeat(n)).join('');
export const rleSum = pairs => pairs.reduce((s, [n]) => s + n, 0);

/* ================= Tvary (vektorová grafika na mřížce 10 × 10) ================= */
export const SIZE = 10;
const C = Object.fromEntries(PALETTE.map((p, i) => [p.name, i]));
const rect = (x, y, w, h, c) => ({ k: 'rect', x, y, w, h, c });
const circle = (x, y, r, c) => ({ k: 'circle', x, y, r, c });
const line = (x1, y1, x2, y2, c) => ({ k: 'line', x1, y1, x2, y2, c });

/** Scény: tvary v pořadí kreslení (pozdější tvar překryje dřívější). Pozadí je černý vesmír. */
export const SCENES = {
  zakladna: { name: 'základna', shapes: [rect(0, 7, 10, 3, C.šedá), rect(1, 4, 5, 3, C.bílá), rect(3, 5, 1, 2, C.modrá), line(8, 7, 8, 3, C.bílá), circle(8, 2, 1, C.oranžová)] },
  rampa: { name: 'raketa na rampě', shapes: [rect(0, 8, 10, 2, C.šedá), rect(4, 3, 2, 5, C.bílá), circle(5, 3, 1, C.oranžová), line(2, 8, 4, 5, C.šedá), line(8, 8, 6, 5, C.šedá)] },
  planety: { name: 'dvě planety', shapes: [circle(3, 4, 3, C.oranžová), line(0, 6, 7, 2, C.žlutá), circle(8, 8, 2, C.modrá)] },
  vozitko: { name: 'vozítko u kráteru', shapes: [rect(0, 6, 10, 4, C.šedá), circle(3, 8, 2, C.černá), rect(6, 4, 3, 2, C.bílá), line(7, 4, 7, 1, C.bílá)] },
  vychod: { name: 'východ planety', shapes: [circle(5, 6, 3, C.oranžová), rect(0, 6, 10, 4, C.šedá), rect(6, 5, 3, 2, C.bílá)] },
  kopule: { name: 'obytná kopule', shapes: [rect(0, 7, 10, 3, C.šedá), circle(5, 7, 3, C.bílá), rect(4, 6, 2, 2, C.modrá), circle(8, 2, 1, C.žlutá)] }
};
export const PARAMS = { rect: ['x', 'y', 'w', 'h'], circle: ['x', 'y', 'r'], line: ['x1', 'y1', 'x2', 'y2'] };
export const PARAM_LABEL = { x: 'x', y: 'y', w: 'šířka', h: 'výška', r: 'poloměr', x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2' };
export const SHAPE_NAME = { rect: 'obdélník', circle: 'kruh', line: 'úsečka' };

/** Textový zápis jednoho tvaru, např. „obdélník(x=2, y=5, šířka=6, výška=5, šedá)“. */
export function shapeText(s) {
  return `${SHAPE_NAME[s.k]}(${PARAMS[s.k].map(p => `${PARAM_LABEL[p]}=${s[p]}`).join(', ')}, ${PALETTE[s.c].name})`;
}

function inside(s, px, py) {
  if (s.k === 'rect') return px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h;
  if (s.k === 'circle') return (px - s.x) ** 2 + (py - s.y) ** 2 <= s.r * s.r;
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / L2));
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy)) <= 0.2;
}
/** Vykreslí tvary do jemného rastru (4 vzorky na políčko); −1 = pozadí. Slouží k porovnání kreseb. */
export function rasterize(shapes, res = 4) {
  const n = SIZE * res;
  const out = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const px = (i + 0.5) / res, py = (j + 0.5) / res;
    let c = -1;
    for (const s of shapes) if (inside(s, px, py)) c = s.c;
    out.push(c);
  }
  return out;
}
export const sameRaster = (a, b) => { const ra = rasterize(a), rb = rasterize(b); return ra.every((v, i) => v === rb[i]); };
export function overlap(a, b) { const ra = rasterize([a]), rb = rasterize([b]); return ra.some((v, i) => v >= 0 && rb[i] >= 0); }
/** Snímek scény po pixelech 10 × 10 (střed políčka, čára má tloušťku půl políčka); pozadí = černá. */
export function sceneGrid(shapes) {
  const g = [];
  for (let y = 0; y < SIZE; y++) {
    const row = [];
    for (let x = 0; x < SIZE; x++) {
      let c = 0;
      for (const s of shapes) {
        const hit = s.k === 'line'
          ? (() => { const dx = s.x2 - s.x1, dy = s.y2 - s.y1; const L2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((x + 0.5 - s.x1) * dx + (y + 0.5 - s.y1) * dy) / L2)); return Math.hypot(x + 0.5 - (s.x1 + t * dx), y + 0.5 - (s.y1 + t * dy)) <= 0.5; })()
          : inside(s, x + 0.5, y + 0.5);
        if (hit) c = s.c;
      }
      row.push(c);
    }
    g.push(row);
  }
  return g;
}

/* ================= Ceník přenosu (v bitech) ================= */
export const COUNT_BITS = 4;      // počet v úseku (1–15)
export const KIND_BITS = 2;       // druh tvaru
export const NUM_BITS = 4;        // každé číslo tvaru (0–15)
export const RGB_BITS = 24;       // jedna barva v tabulce palety
export const CHAR_BITS = 8;       // jeden znak textu
export const pixelCost = (grid, bpp) => grid.length * grid[0].length * bpp;
export const runCount = grid => grid.reduce((s, r) => s + runs(r).length, 0);
export const rleCost = (grid, bpp) => runCount(grid) * (COUNT_BITS + bpp);
export const shapeBits = (s, bpp) => KIND_BITS + PARAMS[s.k].length * NUM_BITS + bpp;
export const shapeCost = (shapes, bpp) => shapes.reduce((sum, s) => sum + shapeBits(s, bpp), 0);
export const METHODS = ['Po pixelech', 'Úseky (počet + barva)', 'Tvary'];

/* ================= Obsah úloh ================= */
const TEXT_WORDS = ['PIIIIIIIIP', 'BZZZZZZZZT', 'UFFFFFFFF', 'HMMMMMMMM', 'JUUUUUUUPI', 'PSSSSSSST'];
const CHECK_WORDS = ['AAAAHOOOOJ', 'BZZZZZUUUM', 'TRRRRRRR', 'HURAAAAA', 'KRRRRAAAK'];
const MIX_COLORS = [
  { name: 'rezavě oranžová', rgb: [192, 64, 0] }, { name: 'ledově modrá', rgb: [64, 192, 255] }, { name: 'levandulová', rgb: [192, 128, 255] },
  { name: 'tmavě zelená', rgb: [0, 128, 64] }, { name: 'pískově žlutá', rgb: [255, 192, 64] }, { name: 'šedofialová', rgb: [128, 64, 128] }
];
/** Terén 10 × 10 pro úseky: obloha (černá), písek, skály, led. Tvary ho přesně nepopíšou. */
export const TERRAINS = {
  duny: { name: 'písečné duny', rows: ['0000000000', '0000000000', '0000000000', '0000000220', '0000022222', '0002222222', '2222222222', '2222224444', '4444444444', '4444444444'] },
  led: { name: 'ledovec', rows: ['0000000000', '0000000000', '3300000000', '3333000000', '3333330000', '3333333300', '4433333333', '4444443333', '4444444444', '4444444444'] },
  hory: { name: 'pohoří', rows: ['0000000000', '0000400000', '0004440000', '0044444000', '0444444404', '4444444444', '2222444222', '2222222222', '2222222222', '2222222222'] }
};
/** Řádky pro úlohu „zakóduj řádky“: 10 × 6. */
const STRIPS = [
  ['0000000000', '0001000010', '0000000220', '2200002222', '2222222222', '4444224444'],
  ['0100000000', '0000001000', '3300000000', '3333300044', '3333444444', '4444444444'],
  ['0000010000', '0000000000', '0000440000', '0044444400', '2244444422', '2222222222']
];
/** Zrnitá fotka povrchu: náhodné body dvou barev – žádná dlouhá opakování. */
function noiseGrid(rng) {
  for (;;) {
    const g = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => (rng.next() < 0.5 ? 4 : 1)));
    if (runCount(g) >= 45) return g;
  }
}

/* ================= Úrovně ================= */
export const LEVEL_INFO = [
  { name: 'Barvy na cestu', focus: 'Sonda nepošle barvu, ale číslo. Na Zemi musí mít tabulku, které číslo je jaká barva – a čím méně barev, tím méně bitů.' },
  { name: 'Obrázek z tvarů', focus: 'Místo sta políček stačí pár tvarů se souřadnicemi. Jen musí přijít ve správném pořadí.' },
  { name: 'Úseky', focus: 'Deset černých políček za sebou? Pošli „10Č“. Opakování se dá zapsat krátce.' },
  { name: 'Šum v kanálu', focus: 'Cestou se data poškodí. Kontrolní součet prozradí, co nedorazilo celé.' },
  { name: 'Velký přenos', focus: 'Okno spojení se zavírá. Pro každý snímek vyber zápis, který se vyplatí – jinak se všechno nevejde.' }
];

export const SKILLS = {
  barvy: 'Zakóduji barvu číslem z palety, trojicí RGB i šestnáctkovým kódem.',
  bity: 'Spočítám, kolik bitů potřebuje políčko podle počtu barev.',
  tvary: 'Zakóduji obrázek pomocí geometrických tvarů a vím, že záleží na pořadí.',
  useky: 'Zjednoduším zápis textu a obrázku (počet + znak).',
  kontrola: 'Kontrolním součtem ověřím, že zápis dorazil celý.',
  volba: 'Vyberu zápis, který se pro daný obrázek vyplatí.'
};

const QUICK = ['palette-build', 'vector-send', 'rle-send', 'resend', 'transfer'];

/** Rozpočet okna spojení: o kousek víc než nejlevnější správný zápis, ale méně než o krok dražší. */
const budgetFor = (cost, nextCost) => Math.min(Math.ceil((cost + 8) / 10) * 10, nextCost - 1);

/** Úloha „tabulka barev“ ze snímku: lokální čísla barev jsou zamíchaná. */
function paletteTask(rows, rng, extra) {
  const grid = gridFrom(rows);
  const used = colorsIn(grid);
  const order = rng ? rng.shuffle(used) : used;            // order[lokální číslo] = barva kamery
  const local = grid.map(r => r.map(c => order.indexOf(c)));
  const k = used.length;
  const bpp = bppFor(k);
  const px = grid.length * grid[0].length;
  const cost = px * bpp + k * RGB_BITS;
  return {
    type: 'palette-build', skill: 'bity', grid, local, order, k, bpp, px,
    cost, budget: budgetFor(cost, px * (bpp + 1) + k * RGB_BITS), rgbCost: px * RGB_BITS, ...extra
  };
}

/** Ukázková úloha (mimo hodnocení): snímek 4 × 4 se dvěma barvami. */
export function tutorialTask() {
  return paletteTask(['0000', '0220', '0220', '0000'], null, {
    id: 'ukazka', level: -1, pic: 'planeta', picName: 'oranžový kámen',
    title: 'Ukázka: první snímek',
    prompt: 'Sonda poslala malý snímek jako čísla. Doplň tabulku: které číslo je jaká barva (podívej se, kde v datech čísla leží). Pak nastav, kolik bitů pošle sonda za jedno políčko, a zkontroluj, že se přenos vejde do okna spojení.',
    hints: ['Číslo 0 leží na okrajích snímku, číslo 1 uprostřed. Sonda vidí okraje černé a střed oranžový.', 'Dvě barvy rozliší 1 bit: 0 nebo 1.']
  });
}

export function buildGame(variant = 'A', mode = 'cela') {
  const rng = makeRng(VARIANTS[variant] ?? VARIANTS.A);
  const T = [];
  const picOrder = rng.shuffle(Object.keys(PICTURES));
  const add = (lvl, t) => T.push({ level: lvl, pic: picOrder[T.length % picOrder.length], ...t });

  // ---- 1) Barvy na cestu
  const pk = rng.pick(['raketa', 'planeta', 'sonda', 'mimozemstan', 'kometa']);
  const pb = paletteTask(PICTURES[pk], rng, {});
  add(0, { id: 'palette-build', ...pb, pic: pk, picName: PICTURE_NAMES[pk],
    title: 'Tabulka barev',
    prompt: `Sonda vyfotila objekt a pošle ho jako čísla barev. Aby Země věděla, co čísla znamenají, pošle i tabulku: číslo → šestnáctkový kód barvy (24 bitů za barvu). Doplň tabulku a nastav, kolik bitů zabere jedno políčko. Přenos se musí vejít do okna spojení (${pb.budget} bitů).`,
    hints: ['Najdi v datech, kde leží číslo 0, a podívej se, jakou barvu má sonda na stejném místě.',
      'Šestnáctkový kód má tři dvojice: červená, zelená, modrá. FF = 255 (naplno), 80 = 128 (napůl), 00 = zhasnuto.',
      `Snímek má ${pb.k} barev. 1 bit rozliší 2 čísla, 2 bity 4 čísla, 3 bity 8 čísel.`] });

  const mc = rng.pick(MIX_COLORS);
  add(0, { id: 'hex-mix', type: 'hex-mix', skill: 'barvy', answer: mc.rgb, colorName: mc.name, code: hex(mc.rgb),
    title: 'Spektrometr',
    prompt: `Spektrometr sondy změřil barvu horniny a poslal kód ${hex(mc.rgb)}. Na Zemi ho převeď na tři čísla RGB: nastav, kolik červeného, zeleného a modrého světla má obrazovka rozsvítit.`,
    hints: ['Kód má tři dvojice: červená, zelená, modrá. Převodní tabulka je nad světly: 00 = 0, 40 = 64, 80 = 128, C0 = 192, FF = 255.', `Červená je ${hex2(mc.rgb[0])} = ${mc.rgb[0]}.`, `Celá barva je ${rgbText(mc.rgb)}.`] });

  // ---- 2) Obrázek z tvarů
  const vecKeys = rng.shuffle(['zakladna', 'rampa', 'vozitko']);
  const fillKey = vecKeys[0];
  const fillShapes = SCENES[fillKey].shapes;
  const fillGrid = sceneGrid(fillShapes);
  const fillBpp = bppFor(colorsIn(fillGrid).length);
  const cand = [];
  fillShapes.forEach((s, si) => PARAMS[s.k].forEach(p => cand.push({ si, p })));
  const blanks = rng.shuffle(cand).slice(0, 3).sort((a, b) => a.si - b.si || PARAMS[fillShapes[a.si].k].indexOf(a.p) - PARAMS[fillShapes[b.si].k].indexOf(b.p));
  const vCost = shapeCost(fillShapes, fillBpp);
  add(1, { id: 'vector-send', type: 'vector-send', skill: 'tvary', shapes: fillShapes, blanks, answer: blanks.map(b => fillShapes[b.si][b.p]), sceneName: SCENES[fillKey].name,
    cost: vCost, pxCost: pixelCost(fillGrid, fillBpp), budget: Math.ceil((vCost + 15) / 10) * 10,
    title: 'Pošli to tvary',
    prompt: `Snímek „${SCENES[fillKey].name}“ by po pixelech zabral ${pixelCost(fillGrid, fillBpp)} bitů – do okna spojení se nevejde. Sonda ho proto popsala tvary. Ve třech políčkách zápisu chybí čísla: doplň je tak, aby se kresba na Zemi shodovala se snímkem.`,
    hints: ['Souřadnice čti z mřížky snímku: x roste doprava, y dolů. Obdélník má x, y levého horního rohu, kruh x, y středu.', 'Úsečka vede z bodu [x1, y1] do bodu [x2, y2].', `První chybějící číslo: ${PARAM_LABEL[blanks[0].p]} = ${fillShapes[blanks[0].si][blanks[0].p]}.`] });

  const orderKey = rng.pick(['vychod', 'kopule']);
  const orderShapes = SCENES[orderKey].shapes;
  let start = rng.shuffle(orderShapes.map((_, i) => i));
  for (let tries = 0; tries < 30 && sameRaster(start.map(i => orderShapes[i]), orderShapes); tries++) start = rng.shuffle(start);
  add(1, { id: 'vector-order', type: 'order', skill: 'tvary', shapes: orderShapes, start, sceneName: SCENES[orderKey].name,
    title: 'Přeházené pakety',
    prompt: `Tvary snímku „${SCENES[orderKey].name}“ dorazily všechny, ale v jiném pořadí, a tak se něco schovává. Přesuň je šipkami, aby kresba odpovídala snímku.`,
    hints: ['Co se kreslí později, překryje to, co už je nakreslené. Pozadí patří na začátek.',
      orderKey === 'vychod' ? 'Planeta vychází za obzorem: nejdřív planeta, pak povrch. Vozítko stojí na povrchu a je vidět celé.' : 'Kopule stojí na povrchu, dveře jsou na kopuli. Hvězda se ničeho nedotýká.'] });

  // ---- 3) Úseky
  const strip = gridFrom(rng.pick(STRIPS));
  const askRows = rng.shuffle(strip.map((r, i) => (runs(r).length >= 3 ? i : -1)).filter(i => i >= 0)).slice(0, 2).sort((a, b) => a - b);
  const sBpp = bppFor(colorsIn(strip).length);
  const sCost = rleCost(strip, sBpp);
  add(2, { id: 'rle-send', type: 'rle-rows', skill: 'useky', grid: strip, ask: askRows, answers: askRows.map(i => rowCode(strip[i])),
    cost: sCost, pxCost: pixelCost(strip, sBpp), bpp: sBpp, budget: Math.ceil((sCost + 10) / 10) * 10,
    title: 'Zakóduj řádky',
    prompt: 'Sonda posílá pás krajiny po řádcích jako úseky „počet + barva“ (Č černá, B bílá, O oranžová, M modrá, S šedá). Většinu řádků už zakódovala, dva zbývají – zapiš je. Na Zemi se hned rozbalí.',
    hints: ['Jdi zleva a počítej políčka stejné barvy za sebou. Každý řádek má 10 políček.', 'Č můžeš napsat i bez háčku jako C.', `Řádek ${askRows[0] + 1} začíná ${rowCode(strip[askRows[0]]).match(/\d+\D/)[0]}.`] });

  const word = rng.pick(TEXT_WORDS);
  add(2, { id: 'rle-text', type: 'rle', skill: 'useky', source: word, answer: rleEncode(word),
    title: 'Hlášení motoru',
    prompt: `Sonda hlásí zvuk motoru: ${word}. Každý znak stojí ${CHAR_BITS} bitů. Zkrať zprávu: před každé písmeno napiš, kolikrát se opakuje (i jedničku). Například AAAB = 3A1B.`,
    hints: ['Jdi zleva a počítej stejná písmena za sebou.', `Začátek: ${rleEncode(word).match(/\d+\D/g).slice(0, 2).join('')}…`] });

  // ---- 4) Šum v kanálu
  const cw = rng.pick(CHECK_WORDS);
  const cwCode = rleEncode(cw);
  add(3, { id: 'checksum-add', type: 'number', skill: 'kontrola', answer: cw.length, code: cwCode,
    title: 'Přidej kontrolní součet',
    prompt: `Sonda posílá zprávu ${cwCode}. Přidej k ní kontrolní součet: sečti všechna čísla v zápisu. Země spočítá totéž – a když to nesedí, ví, že se něco ztratilo.`,
    why: `${cwCode.match(/\d+/g).join(' + ')} = ${cw.length}. Součet je zároveň počet písmen zprávy ${cw}.`,
    hints: ['Sečti jen čísla, písmena vynech.', `Čísla v zápisu: ${cwCode.match(/\d+/g).join(', ')}.`] });

  const rk = rng.pick(['raketa', 'sonda', 'mimozemstan', 'krater', 'hvezda']);
  const rGrid = gridFrom(PICTURES[rk]);
  const rRuns = rGrid.map(r => runs(r));
  const dmg = rng.shuffle(rRuns.map((r, i) => (r.length >= 2 ? i : -1)).filter(i => i >= 0)).slice(0, 2).sort((a, b) => a - b);
  const received = rRuns.map((r, i) => (dmg.includes(i) ? (rng.next() < 0.5 ? r.slice(1) : r.slice(0, -1)) : r));
  add(3, { id: 'resend', type: 'resend', skill: 'kontrola', grid: rGrid, received, damaged: dmg, pic: rk, picName: PICTURE_NAMES[rk], rowCost: 20, energy: 40,
    title: 'Vyžádej poškozené řádky',
    prompt: 'Snímek 8 × 8 dorazil po řádcích. Každý řádek má 8 políček, takže součet počtů v řádku musí být 8. Šum dva řádky poškodil. Vyžádej je znovu – energie stačí přesně na dva řádky, nesmíš ji vyplýtvat na celé.',
    hints: ['U každého řádku sečti čísla před písmeny. Musí vyjít 8.', 'Poškozené řádky mají součet menší než 8.'] });

  // ---- 5) Velký přenos
  const shapeKey = rng.pick(vecKeys.slice(1).concat(['planety']));
  const sShapes = SCENES[shapeKey].shapes;
  const terrKey = rng.pick(Object.keys(TERRAINS));
  const shots = rng.shuffle([
    { kind: 'shapes', name: SCENES[shapeKey].name, grid: sceneGrid(sShapes), shapes: sShapes },
    { kind: 'terrain', name: TERRAINS[terrKey].name, grid: gridFrom(TERRAINS[terrKey].rows) },
    { kind: 'noise', name: 'zrnitá fotka povrchu', grid: noiseGrid(rng) }
  ]).map(s => {
    const k = colorsIn(s.grid).length;
    const bpp = bppFor(k);
    const costs = [pixelCost(s.grid, bpp), rleCost(s.grid, bpp), s.shapes ? shapeCost(s.shapes, bpp) : null];
    const valid = costs.filter(c => c != null);
    const best = costs.indexOf(Math.min(...valid));
    return { ...s, k, bpp, costs, best };
  });
  const bestSum = shots.reduce((s, x) => s + x.costs[x.best], 0);
  const minGap = Math.min(...shots.map(x => Math.min(...x.costs.filter((c, i) => c != null && i !== x.best)) - x.costs[x.best]));
  const tBudget = bestSum + Math.min(20, minGap - 1);
  add(4, { id: 'transfer', type: 'transfer', skill: 'volba', shots, budget: tBudget,
    title: 'Poslední okno spojení',
    prompt: `Než sonda zapadne za obzor, zbývá ${tBudget} bitů. Musí poslat tři snímky. Pro každý vyber zápis – vejde se to, jen když u každého zvolíš ten nejúspornější. Ceník najdeš pod snímky.`,
    hints: ['Po pixelech se vyplatí, když se barvy pořád střídají – úseky by byly samé jedničky.', 'Úseky se vyplatí u velkých jednobarevných ploch, které nejsou pravidelnými tvary.', 'Tvary jdou jen u snímku, který je opravdu složený z kruhů, obdélníků a úseček – a pak jsou nejlevnější.'] });

  return mode === 'rychly' ? T.filter(t => QUICK.includes(t.id)) : T;
}

/* ================= Vyhodnocení ================= */
const ok = msg => ({ ok: true, msg });
const no = (msg, extra = {}) => ({ ok: false, msg, ...extra });
const cap = s => s[0].toUpperCase() + s.slice(1);

/** Kontrola jednoho zápisu „počet + znak“ proti zdroji (řetězec). Vrací null, nebo text chyby. */
function rleProblem(text, source, { colors = false, unit = 'znaků', whole = 'nápis' } = {}) {
  const p = rleParse(text, { colors });
  if (p.error === 'empty') return { incomplete: true, msg: 'Napiš zkrácený zápis.' };
  if (p.error === 'nocount') return { msg: `Před každým znakem musí být počet – i jednička (např. 1${p.ch}).` };
  if (p.error === 'format') return { msg: 'Zápis musí být střídavě počet a znak, např. 3A1B.' };
  if (colors && p.pairs.some(([, ch]) => !(ch in LETTER_TO))) return { msg: 'Pro barvy používej jen písmena Č, B, O, M, S, Ž, F.' };
  const dec = rleDecode(p.pairs);
  if (dec === source) {
    if (p.pairs.length === runs(source).length && p.pairs.every(([n]) => n > 0)) return null;
    return { msg: 'Rozbalí se to správně, ale jde to kratší: stejné znaky za sebou slouč do jednoho počtu.' };
  }
  const sum = rleSum(p.pairs);
  if (sum !== source.length) return { msg: `Tvůj zápis má dohromady ${sum} ${unit}, ale ${whole} jich má ${source.length}.` };
  const k = [...dec].findIndex((ch, i) => ch !== source[i]);
  return { msg: `Po rozbalení nesedí ${k + 1}. ${unit === 'znaků' ? 'znak' : 'políčko'}. Počítej znovu zleva.` };
}
const letters = row => row.map(c => PALETTE[c].letter).join('');

export function check(t, a = {}) {
  switch (t.type) {
    case 'palette-build': {
      const table = a.table || [];
      if (t.order.some((_, i) => table[i] == null) || a.bpp == null) return no('Doplň barvu u každého čísla v tabulce a vyber počet bitů na políčko.', { incomplete: true });
      const wrong = t.order.map((c, i) => (table[i] === c ? -1 : i)).filter(i => i >= 0);
      if (wrong.length) {
        const i = wrong[0];
        return no(`Číslo ${i} leží v datech tam, kde má snímek barvu ${PALETTE[t.order[i]].name}. Kód ${hex(PALETTE[table[i]].rgb)} je ale ${PALETTE[table[i]].name}.${wrong.length > 1 ? ` Nesedí ani ${wrong.length === 2 ? 'číslo' : 'čísla'} ${wrong.slice(1).join(', ')}.` : ''}`);
      }
      if (2 ** a.bpp < t.k) return no(`Do ${a.bpp} ${bitsWord(a.bpp)} se vejdou jen čísla 0 až ${2 ** a.bpp - 1}, ale tabulka má ${t.k} barev (0 až ${t.k - 1}). Políčka s vyšším číslem by nedorazila.`);
      const cost = t.px * a.bpp + t.k * RGB_BITS;
      if (a.bpp > t.bpp) return no(`Snímek by dorazil, ale stál by ${cost} bitů a okno spojení má jen ${t.budget}. Na ${t.k} různá čísla stačí méně bitů.`);
      return ok(`${t.k} ${t.k < 5 ? 'barvy' : 'barev'} rozliší ${t.bpp} ${bitsWord(t.bpp)} na políčko. ${t.px} políček × ${t.bpp} + tabulka ${t.k} × ${RGB_BITS} = ${t.cost} bitů. Kdyby každé políčko neslo celý kód RGB, bylo by to ${t.rgbCost} bitů.`);
    }
    case 'hex-mix': {
      const got = a.rgb || [0, 0, 0];
      const names = ['Červená', 'Zelená', 'Modrá'];
      const wrong = got.map((v, i) => (v === t.answer[i] ? null : `${names[i]}: ${hex2(t.answer[i])} = ${t.answer[i]}, máš ${v}`)).filter(Boolean);
      if (!wrong.length) return ok(`${t.code} = ${rgbText(t.answer)}, to je ${t.colorName}. Stejná barva, dva zápisy – a v obou zabere 24 bitů (3 × 8).`);
      return no(wrong.join('. ') + '.');
    }
    case 'vector-send': {
      const vals = a.values || [];
      if (t.blanks.some((_, i) => String(vals[i] ?? '').trim() === '')) return no('Doplň všechna tři prázdná políčka.', { incomplete: true });
      const errs = t.blanks.map((b, i) => (Number(vals[i]) === t.answer[i] ? null : `${SHAPE_NAME[t.shapes[b.si].k]} – ${PARAM_LABEL[b.p]}`)).filter(Boolean);
      if (!errs.length) return ok(`Kresba sedí. ${t.shapes.length} tvary zabraly ${t.cost} bitů místo ${t.pxCost} po pixelech. A obrázek jde zvětšit bez rozmazání.`);
      return no(`Nesedí: ${errs.join(', ')}. Porovnej kresbu se snímkem.`);
    }
    case 'order': {
      const ord = a.order || [];
      const shapes = ord.map(i => t.shapes[i]);
      if (sameRaster(shapes, t.shapes)) return ok('Kresba odpovídá snímku. Tvar, který se kreslí později, leží navrchu – proto musí pakety přijít ve správném pořadí.');
      for (let i = 0; i < ord.length; i++) for (let j = i + 1; j < ord.length; j++) {
        const A = ord[i], B = ord[j];
        if (A > B && overlap(t.shapes[A], t.shapes[B])) {
          return no(`${cap(SHAPE_NAME[t.shapes[B].k])} (${PALETTE[t.shapes[B].c].name}) se teď kreslí až po tvaru ${SHAPE_NAME[t.shapes[A].k]} (${PALETTE[t.shapes[A].c].name}), takže ho zakryje. Na snímku je to naopak.`);
        }
      }
      return no('Kresba zatím neodpovídá snímku. Co má být vespod, kresli dřív.');
    }
    case 'rle-rows': {
      const vals = a.values || [];
      if (t.ask.some((_, i) => String(vals[i] ?? '').trim() === '')) return no('Zapiš oba řádky.', { incomplete: true });
      for (let i = 0; i < t.ask.length; i++) {
        const pr = rleProblem(vals[i], letters(t.grid[t.ask[i]]), { colors: true, unit: 'políček', whole: 'řádek' });
        if (pr) return no(`Řádek ${t.ask[i] + 1}: ${pr.msg}`);
      }
      return ok(`Oba řádky sedí. Celý pás zabral ${runCount(t.grid)} úseků × ${COUNT_BITS + t.bpp} bitů = ${t.cost} bitů, po pixelech by to bylo ${t.pxCost}.`);
    }
    case 'rle': {
      const pr = rleProblem(a.value, t.source);
      if (pr) return no(pr.msg, pr.incomplete ? { incomplete: true } : {});
      return ok(`${t.answer}: ${t.answer.length} znaků místo ${t.source.length}, tedy ${t.answer.length * CHAR_BITS} bitů místo ${t.source.length * CHAR_BITS}. Země z toho poskládá přesně ${t.source}.`);
    }
    case 'number': {
      const raw = String(a.value ?? '').trim().replace(/\s/g, '');
      if (!raw) return no('Napiš číslo.', { incomplete: true });
      if (!/^\d+$/.test(raw)) return no('Napiš celé číslo (jen číslice).');
      const v = Number(raw);
      if (v === t.answer) return ok(t.why);
      const nums = t.code.match(/\d+/g).length;
      if (v === nums) return no(`${v} je počet čísel v zápisu. Kontrolní součet je jejich součet.`);
      return no(`${v} to není. ${t.hints[0]}`);
    }
    case 'resend': {
      const pick = [...new Set(a.rows || [])].sort((x, y) => x - y);
      if (!pick.length) return no('Vyber řádky, které chceš vyžádat znovu.', { incomplete: true });
      const sums = t.received.map(r => rleSum(r));
      const extra = pick.filter(i => !t.damaged.includes(i));
      const missing = t.damaged.filter(i => !pick.includes(i));
      if (!extra.length && !missing.length) {
        return ok(`Řádky ${t.damaged.map(i => i + 1).join(' a ')} měly součet ${t.damaged.map(i => sums[i]).join(' a ')} místo 8. Po opakovaném poslání je snímek celý: ${t.picName}.`);
      }
      const parts = [];
      if (pick.length * t.rowCost > t.energy) parts.push(`Na ${pick.length} řádky nestačí energie (${pick.length} × ${t.rowCost} = ${pick.length * t.rowCost} bitů, máš ${t.energy}).`);
      if (extra.length) parts.push(`Řádek ${extra[0] + 1} dorazil celý: ${t.received[extra[0]].map(([n]) => n).join(' + ')} = 8.`);
      if (missing.length) parts.push(`${missing.length === 1 ? 'Jeden poškozený řádek' : 'Poškozené řádky'} ti ${missing.length === 1 ? 'chybí' : 'chybí'} – hledej součet menší než 8.`);
      return no(parts.join(' '));
    }
    case 'transfer': {
      const ch = a.choices || [];
      if (t.shots.some((_, i) => ch[i] == null)) return no('Vyber zápis u všech tří snímků.', { incomplete: true });
      const lines = [];
      let total = 0, impossible = false;
      t.shots.forEach((s, i) => {
        const c = s.costs[ch[i]];
        if (c == null) { impossible = true; lines.push(`${cap(s.name)}: tenhle snímek není složený z jednoduchých tvarů – tvary by ho nepopsaly přesně.`); return; }
        total += c;
        if (ch[i] !== s.best) lines.push(`${cap(s.name)}: ${METHODS[ch[i]].toLowerCase()} = ${c} bitů, ale ${METHODS[s.best].toLowerCase()} jen ${s.costs[s.best]}.`);
      });
      if (!impossible && !lines.length) {
        return ok(`Všechno se vešlo: ${t.shots.map(s => `${s.costs[s.best]}`).join(' + ')} = ${total} bitů z ${t.budget}. ${t.shots.map(s => `${cap(s.name)} – ${METHODS[s.best].toLowerCase()}`).join(', ')}.`);
      }
      return no((impossible ? '' : `Celkem ${total} bitů, okno má jen ${t.budget}. `) + lines.join(' '));
    }
    default: throw new Error('neznámý typ úlohy ' + t.type);
  }
}

/** Správná odpověď ve tvaru, jaký posílá UI. */
export function solution(t) {
  switch (t.type) {
    case 'palette-build': return { table: [...t.order], bpp: t.bpp };
    case 'hex-mix': return { rgb: [...t.answer] };
    case 'vector-send': return { values: t.answer.map(String) };
    case 'order': return { order: t.shapes.map((_, i) => i) };
    case 'rle-rows': return { values: [...t.answers] };
    case 'rle': return { value: t.answer };
    case 'number': return { value: String(t.answer) };
    case 'resend': return { rows: [...t.damaged] };
    case 'transfer': return { choices: t.shots.map(s => s.best) };
    default: throw new Error(t.type);
  }
}

/** Lepší výsledek: víc napoprvé, pak méně nápověd, pak (jen se stopkami) kratší čas. */
export function isBetter(a, b) {
  if (!b) return true;
  if (a.firstTry !== b.firstTry) return a.firstTry > b.firstTry;
  if (a.hints !== b.hints) return a.hints < b.hints;
  if (a.ms != null && b.ms != null) return a.ms < b.ms;
  return false;
}
