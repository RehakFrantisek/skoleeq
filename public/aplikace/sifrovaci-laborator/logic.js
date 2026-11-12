/* Šifrovací laboratoř – čistá logika hry (bez DOM).
   Kódování (bity, znaková sada, Morseovka), šifry (Caesar), obrázky (kódování řádků, barvy RGB,
   tvary podle souřadnic), kontrolní součty (parita, kontrolní číslice).
   Generátor úloh je deterministický (seed varianty A/B/C), vyhodnocení vrací věcné „proč“.
   Stejný soubor importují unit testy (node --test) i E2E testy – žádný přístup k window/document. */

/* ================= Seedovatelná náhoda ================= */
export const VARIANTS = { A: 1101, B: 2202, C: 3303 };

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
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
  };
  return rng;
}

/* ================= Kódování ================= */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const LAMPS = [16, 8, 4, 2, 1];

/** Text pro porovnání: velká písmena, bez diakritiky, jedna mezera mezi slovy. */
export function normalize(text) {
  return String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}
export const letterNumber = ch => ALPHABET.indexOf(ch) + 1;          // A = 1 … Z = 26
export const numberLetter = n => ALPHABET[n - 1] ?? '?';
export function toBits(n, width = 5) { return n.toString(2).padStart(width, '0'); }
export function fromBits(bits) { return parseInt(bits, 2); }
/** Hodnota rozsvícených lamp (pole true/false v pořadí 16-8-4-2-1). */
export function lampsValue(on) { return LAMPS.reduce((s, v, i) => s + (on[i] ? v : 0), 0); }
export function lampsFor(n) { return LAMPS.map(v => (n & v) !== 0); }

/** Znaková sada laboratoře – výřez ASCII: mezera 32, A–Z 65–90. */
export const charCode = ch => (ch === ' ' ? 32 : 65 + ALPHABET.indexOf(ch));
export const codeChar = c => (c === 32 ? ' ' : ALPHABET[c - 65] ?? '?');
export const encodeText = text => [...normalize(text)].map(charCode);

/** Caesarova šifra: posun písmen A–Z o shift (záporný = zpět), ostatní znaky beze změny. */
export function caesar(text, shift) {
  const k = ((shift % 26) + 26) % 26;
  return [...normalize(text)].map(ch => {
    const i = ALPHABET.indexOf(ch);
    return i < 0 ? ch : ALPHABET[(i + k) % 26];
  }).join('');
}

export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..'
};
export const toMorse = word => [...normalize(word)].map(ch => MORSE[ch]).join(' ');

/* ================= Obrázky ================= */
/** Kódování řádku obrázku: počty stejných políček za sebou, začíná se VŽDY bílou (i počtem 0). */
export function encodeRow(row) {
  const out = [];
  let color = 0, count = 0;
  for (const px of row) {
    if (px === color) count++;
    else { out.push(count); color = px; count = 1; }
  }
  out.push(count);
  return out;
}
export function decodeRow(counts, width) {
  const row = [];
  counts.forEach((c, i) => { for (let k = 0; k < c; k++) row.push(i % 2); });
  while (row.length < width) row.push(0);
  return row.slice(0, width);
}
export const parseCounts = text => String(text ?? '').split(/[^0-9]+/).filter(Boolean).map(Number);
export const gridFrom = rows => rows.map(r => [...r].map(c => (c === '#' ? 1 : 0)));

/** Barvy: tři úrovně intenzity na kanál (0, 128, 255) = 27 barev. */
export const LEVELS = [0, 128, 255];
export const hex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('');

/* ================= Kontrolní součty ================= */
/** Paritní mřížka: k datům se doplní sloupec a řádek tak, aby měl každý řádek i sloupec SUDÝ počet černých. */
export function withParity(data) {
  const rows = data.map(r => [...r, r.reduce((a, b) => a + b, 0) % 2]);
  const last = rows[0].map((_, x) => rows.reduce((s, r) => s + r[x], 0) % 2);
  return [...rows, last];
}
export function parityErrors(grid) {
  const rows = grid.map((r, y) => (r.reduce((a, b) => a + b, 0) % 2 ? y : -1)).filter(y => y >= 0);
  const cols = grid[0].map((_, x) => (grid.reduce((s, r) => s + r[x], 0) % 2 ? x : -1)).filter(x => x >= 0);
  return { rows, cols };
}
/** Kontrolní číslice zprávy: součet pořadí písmen (A = 1) modulo 10. */
export const checkDigit = word => [...normalize(word)].filter(ch => ALPHABET.includes(ch)).reduce((s, ch) => s + letterNumber(ch), 0) % 10;

/* ================= Obsah úloh ================= */
const WORDS_BITS = ['BIT', 'KOD', 'MARS', 'LUNA', 'DATA', 'OKNO', 'VLNA'];
const MSG_ASCII = ['AHOJ ZEME', 'JSME TADY', 'VSE JE OK', 'MAME VODU'];
const WORDS_ENCODE = ['SOS', 'BIT', 'LED', 'ZEM'];
const MSG_CAESAR_KNOWN = ['VIDIM KRATER', 'BATERIE NABITA', 'ANTENA SVITI', 'NAVRAT ZITRA'];
const MSG_CAESAR_CRACK = ['NASLA JSEM LED', 'MAPA JE HOTOVA', 'SIGNAL JE SILNY', 'POSILAM FOTKU'];
const WORDS_MORSE = ['SOS', 'LED', 'MARS', 'VODA', 'NOC', 'KOMETA'];
const WORDS_CHECK = ['MARS', 'LUNA', 'KOMETA', 'PLANETA', 'RAKETA', 'SONDA', 'HVEZDA', 'ORBITA'];

/** Obrázky 8 × 8 (# = černá). Všechny jsou vymyšlené piktogramy. */
export const PICTURES = {
  raketa: ['...##...', '..####..', '..#..#..', '..####..', '..####..', '.######.', '##.##.##', '#..##..#'],
  robot: ['..####..', '.#....#.', '.#.##.#.', '.######.', '#.####.#', '#.####.#', '..#..#..', '.##..##.'],
  planeta: ['..####..', '.######.', '########', '#......#', '########', '.######.', '..####..', '........'],
  mimozemstan: ['.#....#.', '..####..', '.######.', '##.##.##', '########', '.#.##.#.', '#......#', '.#....#.'],
  antena: ['#......#', '.#....#.', '..#..#..', '...##...', '...##...', '...##...', '..####..', '.######.']
};
const PICTURE_NAMES = { raketa: 'raketa', robot: 'robot', planeta: 'planeta', mimozemstan: 'mimozemšťan', antena: 'anténa' };

const COLORS = [
  { name: 'oranžová', rgb: [255, 128, 0] }, { name: 'fialová', rgb: [128, 0, 255] }, { name: 'tyrkysová', rgb: [0, 128, 128] },
  { name: 'růžová', rgb: [255, 128, 255] }, { name: 'olivová', rgb: [128, 128, 0] }, { name: 'světle modrá', rgb: [128, 255, 255] },
  { name: 'žlutá', rgb: [255, 255, 0] }, { name: 'tmavě modrá', rgb: [0, 0, 128] }
];

const CHOICE_CAESAR = [
  {
    prompt: 'Proč je Caesarova šifra slabá?',
    options: ['Má jen 25 možných klíčů – útočník je může všechny vyzkoušet.', 'Používá jen velká písmena.', 'Zašifrovaná zpráva je delší než původní.'],
    correct: 0,
    why: ['Ano. Posunů je jen 25, takže šifru prolomíš zkoušením – přesně jako v minulé úloze.', 'Velká písmena bezpečnost neovlivní. Zkus, kolik různých klíčů má útočník k dispozici.', 'Délka zprávy se šifrováním nemění – každé písmeno se nahradí jedním písmenem.']
  },
  {
    prompt: 'Co je „klíč“ u Caesarovy šifry?',
    options: ['Číslo, o kolik písmen se abeceda posune.', 'Heslo k počítači, na kterém šifruješ.', 'Počet slov ve zprávě.'],
    correct: 0,
    why: ['Ano. Kdo zná posun, umí zprávu zašifrovat i rozluštit.', 'Heslo k počítači se šifrou nesouvisí. Co musí znát odesílatel i příjemce, aby si rozuměli?', 'Počet slov vidí každý. Klíč je to, co zná jen odesílatel a příjemce.']
  },
  {
    prompt: 'Zpráva byla zašifrovaná posunem o 3 dopředu (A → D). Jak ji rozluštíš?',
    options: ['Každé písmeno posunu o 3 zpět (D → A).', 'Každé písmeno posunu o 3 dopředu.', 'Přečtu zprávu pozpátku.'],
    correct: 0,
    why: ['Ano. Dešifrování je opačný posun.', 'Tím bys zprávu zašifroval(a) ještě jednou (celkem o 6).', 'Caesarova šifra pořadí písmen nemění, jen je nahrazuje.']
  }
];

/* ================= Úrovně a generátor ================= */
export const LEVEL_INFO = [
  { name: 'Binární vysílačka', focus: 'Bity: každé světlo má svou hodnotu 16, 8, 4, 2, 1. Rozsvícená = 1, zhasnutá = 0.' },
  { name: 'Znaková sada', focus: 'Počítač ukládá každý znak jako číslo. Kdo zná tabulku, přečte zprávu.' },
  { name: 'Šifrovací kolo', focus: 'Šifra zprávu skryje. Caesarova šifra posouvá abecedu o klíč – a má své slabiny.' },
  { name: 'Pixelová pohlednice', focus: 'Obrázek jde zapsat čísly: počty políček, barvy jako tři čísla, tvary souřadnicemi.' },
  { name: 'Rušení signálu', focus: 'Kontrolní součet prozradí, že se při přenosu něco pokazilo – a někdy i co.' }
];

export const SKILLS = {
  bity: 'Převádím čísla mezi dvojkovým a desítkovým zápisem (bity 16-8-4-2-1).',
  znaky: 'Kóduji a dekóduji znaky pomocí znakové sady.',
  jednotky: 'Počítám s bity a bajty (1 bajt = 8 bitů).',
  sifry: 'Šifruji a dešifruji text Caesarovou šifrou a Morseovkou.',
  limity: 'Vysvětlím, proč je jednoduchá šifra slabá.',
  obrazky: 'Zakóduji a nakreslím obrázek pomocí čísel.',
  barvy: 'Zakóduji barvu jako tři čísla (červená, zelená, modrá).',
  tvary: 'Popíšu obrázek pomocí tvarů a souřadnic.',
  kontrola: 'Pomocí kontrolního součtu odhalím chybu v přenosu.'
};

/** Úkoly v rychlém režimu (indexy do plného seznamu). */
const QUICK = ['lamps', 'bin-word', 'caesar-crack', 'pixels-paint', 'rgb', 'parity-find'];

/** Ukázková úloha (mimo hodnocení). */
export function tutorialTask() {
  return {
    id: 'ukazka', type: 'lamps', level: -1, skill: 'bity', target: 6,
    title: 'Ukázka: rozsviť číslo 6',
    prompt: 'Vysílačka posílá čísla světly. Každé světlo má hodnotu (16, 8, 4, 2, 1). Rozsviť světla tak, aby jejich součet byl 6, a stiskni Zkontrolovat.',
    hints: ['6 = 4 + 2.', 'Rozsviť světlo 4 a světlo 2, ostatní nech zhasnuté.']
  };
}

export function buildGame(variant = 'A', mode = 'cela') {
  const rng = makeRng(VARIANTS[variant] ?? VARIANTS.A);
  const T = [];
  const add = (lvl, t) => T.push({ level: lvl, ...t });

  // ---- 1) Binární vysílačka
  const n1 = rng.int(9, 29);
  add(0, { id: 'lamps', type: 'lamps', skill: 'bity', target: n1, title: `Pošli číslo ${n1}`,
    prompt: `Sonda čeká na číslo ${n1}. Rozsviť správná světla – součet hodnot rozsvícených světel musí být ${n1}.`,
    hints: ['Začni největším světlem, které se ještě vejde (16, pak 8, 4, 2, 1).', `${n1} = ${LAMPS.filter(v => n1 & v).join(' + ')}.`] });
  let n2 = rng.int(11, 30); if (n2 === n1) n2 = n1 > 20 ? n1 - 3 : n1 + 3;
  add(0, { id: 'read', type: 'read', skill: 'bity', bits: toBits(n2), answer: n2, title: 'Přečti vysílačku',
    prompt: `Sonda poslala světla ${toBits(n2)} (1 = svítí, 0 = nesvítí). Jaké je to desítkové číslo?`,
    hints: ['Pod každé světlo si napiš jeho hodnotu: 16, 8, 4, 2, 1.', `Sečti hodnoty svítících světel: ${LAMPS.filter(v => n2 & v).join(' + ')}.`] });
  const w1 = rng.pick(WORDS_BITS);
  const groups = [...w1].map(ch => toBits(letterNumber(ch)));
  add(0, { id: 'bin-word', type: 'text', tool: 'letters', skill: 'bity', answer: w1, groups, title: 'Slovo z bitů',
    prompt: `Každá pětice bitů je jedno písmeno (A = 1, B = 2 … Z = 26). Rozluštíš slovo? ${groups.join(' · ')}`,
    hints: ['Převeď každou pětici na číslo (16-8-4-2-1) a najdi písmeno v tabulce.', `První písmeno: ${groups[0]} = ${letterNumber(w1[0])} = ${w1[0]}.`, `Čísla jsou ${[...w1].map(letterNumber).join(', ')}.`] });

  // ---- 2) Znaková sada
  const m2 = rng.pick(MSG_ASCII);
  add(1, { id: 'ascii-decode', type: 'text', tool: 'ascii', skill: 'znaky', answer: m2, codes: encodeText(m2), title: 'Zpráva v kódech',
    prompt: `Sonda poslala zprávu jako čísla znakové sady: ${encodeText(m2).join(' ')}. Co v ní stojí?`,
    hints: ['Najdi každé číslo v tabulce znaků. Číslo 32 je mezera.', `Zpráva začíná slovem ${m2.split(' ')[0]}.`] });
  const w2 = rng.pick(WORDS_ENCODE);
  add(1, { id: 'ascii-encode', type: 'codes', tool: 'ascii', skill: 'znaky', word: w2, answer: encodeText(w2), title: 'Odpověz sondě',
    prompt: `Zakóduj odpověď ${w2} do čísel znakové sady. Čísla odděl mezerou.`,
    hints: ['Každé písmeno najdi v tabulce a napiš jeho číslo.', `První číslo je ${charCode(w2[0])} (${w2[0]}).`] });
  const q = rng.pick([
    () => { const b = rng.int(3, 6); return { answer: 2 ** b, prompt: `Kolik různých zpráv (kombinací světel) zapíšeš pomocí ${b} bitů?`, hints: ['1 bit = 2 možnosti, 2 bity = 4, každý další bit počet zdvojnásobí.', `2 × 2 × … (${b}×) = ?`], why: `Každý bit zdvojnásobí počet možností: 2 na ${b} = ${2 ** b}.` }; },
    () => { const w = rng.pick(WORDS_CHECK); return { answer: w.length * 8, prompt: `Slovo ${w} má ${w.length} znaků. Každý znak zabere 1 bajt. Kolik je to bitů?`, hints: ['1 bajt = 8 bitů.', `${w.length} × 8 = ?`], why: `${w.length} znaků × 8 bitů = ${w.length * 8} bitů.` }; },
    () => { const by = rng.int(3, 6); return { answer: by * 8, prompt: `Sonda poslala ${by} bajtů dat. Kolik je to bitů?`, hints: ['1 bajt = 8 bitů.', `${by} × 8 = ?`], why: `${by} × 8 = ${by * 8} bitů.` }; }
  ])();
  add(1, { id: 'units', type: 'number', skill: 'jednotky', title: 'Bity a bajty', ...q });

  // ---- 3) Šifrovací kolo
  const m3 = rng.pick(MSG_CAESAR_KNOWN);
  const k3 = 3;
  add(2, { id: 'caesar-known', type: 'text', tool: 'wheel', skill: 'sifry', key: k3, cipher: caesar(m3, k3), answer: m3, title: 'Caesarova šifra',
    prompt: `Zpráva je zašifrovaná posunem o ${k3} dopředu (A → D). Rozlušti ji: ${caesar(m3, k3)}`,
    hints: [`Nastav kolo na posun ${k3}. Vnější písmeno je zašifrované, vnitřní je původní.`, `Každé písmeno posuň o ${k3} zpět: ${caesar(m3, k3)[0]} → ${m3[0]}.`] });
  const m4 = rng.pick(MSG_CAESAR_CRACK);
  const k4 = rng.int(4, 22);
  add(2, { id: 'caesar-crack', type: 'crack', tool: 'wheel', skill: 'sifry', key: k4, cipher: caesar(m4, k4), plain: m4, title: 'Prolom šifru',
    prompt: `Zachycená zpráva: ${caesar(m4, k4)}. Klíč neznáme. Otáčej kolem, dokud náhled nedává smysl, a odešli nalezený klíč.`,
    hints: ['Klíčů je jen 25 – zkoušej je postupně a sleduj náhled.', `Klíč je mezi ${Math.max(1, k4 - 3)} a ${Math.min(25, k4 + 3)}.`, `Klíč je ${k4}.`] });
  const w5 = rng.pick(WORDS_MORSE);
  add(2, { id: 'morse', type: 'text', tool: 'morse', skill: 'sifry', answer: w5, morse: toMorse(w5), title: 'Morseova abeceda',
    prompt: `Nouzový vysílač pípá Morseovkou: ${toMorse(w5).split(' ').join('   ')}. Jaké slovo vysílá?`,
    hints: ['Tečka = krátké pípnutí, čárka = dlouhé. Písmena jsou oddělená mezerou.', `První písmeno ${MORSE[w5[0]]} je ${w5[0]}.`] });
  add(2, { id: 'limits', type: 'choice', skill: 'limity', title: 'Slabina šifry', ...rng.pick(CHOICE_CAESAR),
    hints: ['Vzpomeň si, jak jsi šifru prolomil(a) bez klíče.', 'Kolik různých posunů abeceda vůbec má?'] });

  // ---- 4) Pixelová pohlednice
  const picKeys = rng.shuffle(Object.keys(PICTURES));
  const pic = picKeys[0];
  const rows = gridFrom(PICTURES[pic]).map(encodeRow);
  add(3, { id: 'pixels-paint', type: 'paint', skill: 'obrazky', size: 8, codes: rows, answer: gridFrom(PICTURES[pic]), picName: PICTURE_NAMES[pic], title: 'Nakresli podle čísel',
    prompt: 'Sonda poslala obrázek jako čísla. U každého řádku: kolik políček bílých, kolik černých, kolik bílých… (vždy se začíná bílou). Vybarvi mřížku.',
    hints: ['Řádek „3 2 3“ znamená: 3 bílá, 2 černá, 3 bílá.', 'Když řádek začíná nulou, první políčko je černé.', `Obrázek je ${PICTURE_NAMES[pic]}.`] });
  const pic2 = picKeys[1];
  const g2 = gridFrom(PICTURES[pic2]);
  // jen řádky s aspoň třemi úseky (ne triviální „8“ nebo „0 8“)
  const rowsAsk = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7].filter(r => encodeRow(g2[r]).length >= 3)).slice(0, 2).sort((a, b) => a - b);
  add(3, { id: 'pixels-encode', type: 'encode', skill: 'obrazky', grid: g2, rows: rowsAsk, answer: rowsAsk.map(r => encodeRow(g2[r])), picName: PICTURE_NAMES[pic2], title: 'Zakóduj obrázek',
    prompt: `Zakóduj označené řádky ${rowsAsk.map(r => r + 1).join(' a ')} stejným způsobem: počty bílých a černých políček za sebou, začni bílou.`,
    hints: ['Počítej zleva. Když řádek začíná černou, napiš na začátek 0.', `Řádek ${rowsAsk[0] + 1} začíná: ${encodeRow(g2[rowsAsk[0]]).slice(0, 2).join(' ')} …`] });
  const col = rng.pick(COLORS);
  add(3, { id: 'rgb', type: 'rgb', skill: 'barvy', answer: col.rgb, colorName: col.name, title: 'Namíchej barvu',
    prompt: `Obrazovka míchá barvy ze světla: červená, zelená, modrá. Každá svítí 0, 128 (napůl) nebo 255 (naplno). Namíchej barvu „${col.name}“ podle vzorku.`,
    hints: ['Červená + zelená naplno = žlutá. Všechny tři naplno = bílá, všechny na 0 = černá.', `Červená má být ${col.rgb[0]}.`, `Kód barvy je (${col.rgb.join(', ')}).`] });
  const cr = rng.int(2, 3);
  const circle = { cx: rng.int(cr, 10 - cr), cy: rng.int(cr, 6 - cr), r: cr };
  const rect = { x: rng.int(0, 5), y: rng.int(7, 8), w: rng.int(3, 5), h: rng.int(1, 2) };
  rect.x = Math.min(rect.x, 10 - rect.w);
  rect.y = Math.min(rect.y, 10 - rect.h);
  add(3, { id: 'vector', type: 'vector', skill: 'tvary', answer: { ...circle, ...rect }, title: 'Kresba tvary',
    prompt: 'Vektorový obrázek se nezapisuje po pixelech, ale jako tvary se souřadnicemi. Nastav planetu (kruh) a přistávací plochu (obdélník) tak, aby se kryly s přerušovanou předlohou.',
    hints: ['Střed kruhu je bod [x, y], poloměr je vzdálenost od středu k okraji. Mřížka má políčka po 1.', `Kruh: střed [${circle.cx}, ${circle.cy}].`, `Obdélník začíná v [${rect.x}, ${rect.y}], šířka ${rect.w}, výška ${rect.h}.`] });

  // ---- 5) Rušení signálu
  const data = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => (rng.next() < 0.45 ? 1 : 0)));
  const sent = withParity(data);
  const fx = rng.int(0, 4), fy = rng.int(0, 4);
  const received = sent.map(r => [...r]);
  received[fy][fx] ^= 1;
  add(4, { id: 'parity-find', type: 'parity-find', skill: 'kontrola', grid: received, answer: { x: fx, y: fy }, title: 'Najdi převrácený bit',
    prompt: 'Každý řádek i sloupec měl při odeslání SUDÝ počet černých políček (poslední řádek a sloupec jsou kontrolní). Rušení převrátilo jedno políčko. Klikni na něj.',
    hints: ['Spočítej černá políčka v každém řádku. Který řádek má lichý počet?', `Chyba je v ${fy + 1}. řádku – teď najdi lichý sloupec.`] });
  const data2 = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => (rng.next() < 0.5 ? 1 : 0)));
  add(4, { id: 'parity-add', type: 'parity-add', skill: 'kontrola', data: data2, answer: withParity(data2), title: 'Doplň kontrolní bity',
    prompt: 'Než odešleš obrázek, doplň kontrolní políčka (pravý sloupec a spodní řádek) tak, aby měl každý řádek i sloupec SUDÝ počet černých.',
    hints: ['Má řádek lichý počet černých? Pak jeho kontrolní políčko vybarvi.', 'Nezapomeň na rohové políčko – i spodní řádek a pravý sloupec musí být sudé.'] });
  const cw = rng.shuffle(WORDS_CHECK).slice(0, 3);
  const bad = rng.int(0, 2);
  const msgs = cw.map((w, i) => {
    const digit = checkDigit(w);
    if (i !== bad) return { word: w, digit };
    const pos = rng.int(0, w.length - 1);
    let ch = ALPHABET[(ALPHABET.indexOf(w[pos]) + rng.int(1, 4)) % 26];
    const broken = w.slice(0, pos) + ch + w.slice(pos + 1);
    return { word: broken, digit, original: w };
  });
  add(4, { id: 'checksum', type: 'choice', skill: 'kontrola', title: 'Kontrolní číslice', messages: msgs,
    prompt: 'Ke každé zprávě sonda přidává kontrolní číslici: sečte pořadí písmen v abecedě (A = 1 … Z = 26) a vezme poslední cifru součtu. Která zpráva dorazila poškozená?',
    options: msgs.map(m => `${m.word} – kontrolní číslice ${m.digit}`), correct: bad,
    why: msgs.map((m, i) => {
      const sum = [...m.word].reduce((s, ch) => s + letterNumber(ch), 0);
      return i === bad ? `Ano. Součet písmen ${m.word} je ${sum}, končí na ${sum % 10}, ale kontrolní číslice je ${m.digit}. Zpráva se poškodila (původně ${m.original}).`
        : `Zpráva ${m.word} je v pořádku: součet ${sum} končí na ${sum % 10} a kontrolní číslice je ${m.digit}. Spočítej ostatní.`;
    }),
    hints: ['U každé zprávy sečti čísla písmen (A = 1, B = 2 …) a porovnej poslední cifru s kontrolní číslicí.', `${msgs[0].word}: ${[...msgs[0].word].map(letterNumber).join(' + ')} = ${[...msgs[0].word].reduce((s, ch) => s + letterNumber(ch), 0)}.`] });

  return mode === 'rychly' ? T.filter(t => QUICK.includes(t.id)) : T;
}

/* ================= Vyhodnocení ================= */
const ok = msg => ({ ok: true, msg });
const no = msg => ({ ok: false, msg });

/** Vyhodnotí odpověď. Tvar odpovědi podle typu úlohy (stejný posílá UI i testy). */
export function check(t, a) {
  switch (t.type) {
    case 'lamps': {
      const v = lampsValue(a.lamps || []);
      if (v === t.target) return ok(`Světla ${toBits(v)} = ${LAMPS.filter(x => v & x).join(' + ')} = ${v}. Tohle je dvojkový zápis čísla ${v}.`);
      return no(v > t.target ? `Rozsvícená světla dávají ${v}, to je o ${v - t.target} víc. Které světlo je navíc?` : `Rozsvícená světla dávají ${v}, chybí ještě ${t.target - v}.`);
    }
    case 'read': case 'number': {
      const raw = String(a.value ?? '').trim();
      if (!/^\d+$/.test(raw)) return no('Napiš celé číslo (jen číslice).');
      const v = Number(raw);
      if (v === t.answer) return ok(t.type === 'read' ? `${t.bits} = ${LAMPS.filter(x => t.answer & x).join(' + ')} = ${t.answer}.` : t.why);
      if (t.type === 'read' && v === fromBits([...t.bits].reverse().join(''))) return no('Hodnoty čti zleva: první světlo má 16, poslední 1.');
      return no(t.type === 'read' ? `${v} to není. Sečti hodnoty jen u světel s jedničkou.` : `${v} to není. ${t.hints[0]}`);
    }
    case 'text': {
      const got = normalize(a.value);
      if (!got) return no('Napiš rozluštěnou zprávu do políčka.');
      if (got === t.answer) return ok(t.tool === 'morse' ? `${t.morse} = ${t.answer}.` : `Zpráva zní: ${t.answer}.`);
      const exp = t.answer;
      const n = Math.max(exp.length, got.length);
      let right = 0, first = -1;
      for (let i = 0; i < n; i++) { if (got[i] === exp[i]) right++; else if (first < 0) first = i; }
      if (got.replace(/ /g, '') === exp.replace(/ /g, '')) return no('Písmena máš správně, jen zkontroluj mezery mezi slovy.');
      return no(`Správně máš ${right} z ${exp.length} znaků. První rozdíl je na ${first + 1}. místě.`);
    }
    case 'codes': {
      const got = parseCounts(a.value);
      if (!got.length) return no('Napiš čísla oddělená mezerou.');
      if (got.length !== t.answer.length) return no(`Slovo ${t.word} má ${t.answer.length} znaky, takže čekám ${t.answer.length} čísla. Máš ${got.length}.`);
      const wrong = got.findIndex((v, i) => v !== t.answer[i]);
      if (wrong < 0) return ok(`${t.word} = ${t.answer.join(' ')}. Takhle počítač ukládá text.`);
      return no(`${wrong + 1}. číslo nesedí: ${got[wrong]} je v tabulce „${codeChar(got[wrong])}“, ale potřebuješ ${t.word[wrong]}.`);
    }
    case 'crack': {
      const k = ((Number(a.shift) % 26) + 26) % 26;
      if (k === t.key) return ok(`Klíč ${t.key}: ${t.plain}. Stačilo vyzkoušet nejvýš 25 posunů – proto je Caesarova šifra slabá.`);
      if (k === (26 - t.key) % 26) return no('Posunul(a) jsi opačným směrem. Klíč udává posun při šifrování, rozluštění je posun zpět.');
      return no(`S posunem ${k} vyjde „${caesar(t.cipher, -k)}“ – to nedává smysl. Zkus jiný klíč.`);
    }
    case 'choice': {
      if (a.option == null) return no('Nejdřív vyber jednu možnost.');
      return a.option === t.correct ? ok(t.why[a.option]) : no(t.why[a.option]);
    }
    case 'paint': {
      const g = a.grid || [];
      const badRows = t.answer.map((r, y) => (r.every((v, x) => (g[y]?.[x] ?? 0) === v) ? -1 : y)).filter(y => y >= 0);
      if (!badRows.length) return ok(`Obrázek je ${t.picName}. Celý se vešel do ${t.codes.flat().length} čísel.`);
      return no(`Nesedí ${badRows.length === 1 ? 'řádek' : 'řádky'} ${badRows.map(y => y + 1).join(', ')}. Porovnej je s čísly vlevo.`);
    }
    case 'encode': {
      const vals = a.values || [];
      const bad = t.rows.map((r, i) => {
        const got = parseCounts(vals[i]);
        const sum = got.reduce((s, v) => s + v, 0);
        return { r, got, sum, ok: got.join(',') === t.answer[i].join(',') };
      }).filter(x => !x.ok);
      if (!bad.length) return ok('Řádky jsou zakódované správně. Stejně šetří místo i komprese obrázků v počítači.');
      const b = bad[0];
      if (!b.got.length) return no(`U řádku ${b.r + 1} chybí čísla.`);
      if (b.sum !== 8) return no(`Čísla řádku ${b.r + 1} dávají dohromady ${b.sum}, ale řádek má 8 políček.`);
      if (t.grid[b.r][0] === 1 && b.got[0] !== 0) return no(`Řádek ${b.r + 1} začíná černou – na začátek patří 0 (nula bílých).`);
      return no(`Řádek ${b.r + 1} nesedí. Počítej políčka zleva a střídej bílá a černá.`);
    }
    case 'rgb': {
      const got = a.rgb || [0, 0, 0];
      const names = ['Červená', 'Zelená', 'Modrá'];
      const wrong = got.map((v, i) => (v === t.answer[i] ? null : `${names[i]} je ${v}, má být ${v < t.answer[i] ? 'víc' : 'míň'}`)).filter(Boolean);
      if (!wrong.length) return ok(`Barva „${t.colorName}“ = (${t.answer.join(', ')}), šestnáctkově ${hex(t.answer)}. Stejnou barvu tak můžeš zapsat dvěma způsoby.`);
      return no(wrong.join('. ') + '.');
    }
    case 'vector': {
      const v = a.shape || {};
      const c = ['cx', 'cy', 'r'].every(k => Number(v[k]) === t.answer[k]);
      const r = ['x', 'y', 'w', 'h'].every(k => Number(v[k]) === t.answer[k]);
      if (c && r) return ok('Kresba sedí. Celý obrázek popisuje jen 7 čísel – a jde zvětšit bez rozmazání.');
      const msgs = [];
      if (!c) msgs.push(Number(v.cx) === t.answer.cx && Number(v.cy) === t.answer.cy ? 'Střed kruhu sedí, uprav poloměr.' : 'Kruh je mimo – uprav jeho střed [x, y].');
      if (!r) msgs.push(Number(v.x) === t.answer.x && Number(v.y) === t.answer.y ? 'Roh obdélníku sedí, uprav šířku nebo výšku.' : 'Obdélník je posunutý – levý horní roh je v [x, y].');
      return no(msgs.join(' '));
    }
    case 'parity-find': {
      if (!a.cell) return no('Klikni na políčko, které se při přenosu převrátilo.');
      if (a.cell.x === t.answer.x && a.cell.y === t.answer.y) return ok(`Lichý je ${t.answer.y + 1}. řádek a ${t.answer.x + 1}. sloupec – chyba je na jejich křížení. Kontrolní bity chybu odhalí i opraví.`);
      if (a.cell.y === t.answer.y) return no('Řádek je správně, ale sloupec ne. Spočítej černá políčka ve sloupcích.');
      if (a.cell.x === t.answer.x) return no('Sloupec je správně, ale řádek ne. Spočítej černá políčka v řádcích.');
      return no('V tomto řádku i sloupci je sudý počet černých. Hledej řádek a sloupec s lichým počtem.');
    }
    case 'parity-add': {
      const g = a.grid;
      const dataOk = t.data.every((r, y) => r.every((v, x) => g[y][x] === v));
      if (!dataOk) return no('Data se měnit nesmí – uprav jen kontrolní políčka vpravo a dole.');
      const e = parityErrors(g);
      if (!e.rows.length && !e.cols.length) return ok('Každý řádek i sloupec je sudý. Příjemce teď pozná, když se cokoli převrátí.');
      const parts = [];
      if (e.rows.length) parts.push(`řádky ${e.rows.map(y => y + 1).join(', ')}`);
      if (e.cols.length) parts.push(`sloupce ${e.cols.map(x => x + 1).join(', ')}`);
      return no(`Lichý počet černých mají ${parts.join(' a ')}.`);
    }
    default: throw new Error('neznámý typ úlohy ' + t.type);
  }
}

/** Správná odpověď ve tvaru, jaký posílá UI (pro „Ukázat řešení“ a testy). */
export function solution(t) {
  switch (t.type) {
    case 'lamps': return { lamps: lampsFor(t.target) };
    case 'read': case 'number': return { value: String(t.answer) };
    case 'text': return { value: t.answer };
    case 'codes': return { value: t.answer.join(' ') };
    case 'crack': return { shift: t.key };
    case 'choice': return { option: t.correct };
    case 'paint': return { grid: t.answer.map(r => [...r]) };
    case 'encode': return { values: t.answer.map(r => r.join(' ')) };
    case 'rgb': return { rgb: [...t.answer] };
    case 'vector': return { shape: { ...t.answer } };
    case 'parity-find': return { cell: { ...t.answer } };
    case 'parity-add': return { grid: t.answer.map(r => [...r]) };
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
