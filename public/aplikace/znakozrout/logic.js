/* Znakožrout – čistá logika bez DOM (testovaná v tests/unit/znakozrout.test.mjs).
   Rozložení české klávesnice QWERTZ (Windows), generátor úloh ze seedu varianty,
   vyhodnocení s konkrétním vysvětlením chyby, řešení a porovnání rekordů. */

export const VARIANTS = { A: 7101, B: 7202, C: 7303 };

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
    int: n => Math.floor(next() * n),
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
  };
}

/* ================= Klávesnice ================= */
export const LAYERS = ['base', 'shift', 'altgr'];
export const LAYER_NAME = { base: 'bez přídavné klávesy', shift: 'se Shiftem', altgr: 's pravým Altem (AltGr)' };
export const LAYER_SHORT = { base: 'Sama', shift: 'Shift', altgr: 'AltGr' };

// [code, bez přídavné klávesy, Shift, AltGr]. Kód = fyzická poloha (event.code).
// Mrtvé klávesy (diakritika na AltGr v číselné řadě) neuvádíme, ať hra neučí nejisté kombinace.
const L = (code, base, shift, altgr = null) => ({ code, base, shift, altgr });
const letter = (code, ch, altgr = null) => L(code, ch, ch.toUpperCase(), altgr);
export const KEYBOARD = [
  [L('Backquote', ';', '°'), L('Digit1', '+', '1', '~'), L('Digit2', 'ě', '2'), L('Digit3', 'š', '3'), L('Digit4', 'č', '4'), L('Digit5', 'ř', '5'),
    L('Digit6', 'ž', '6'), L('Digit7', 'ý', '7'), L('Digit8', 'á', '8'), L('Digit9', 'í', '9'), L('Digit0', 'é', '0'), L('Minus', '=', '%')],
  [letter('KeyQ', 'q', '\\'), letter('KeyW', 'w', '|'), letter('KeyE', 'e', '€'), letter('KeyR', 'r'), letter('KeyT', 't'), letter('KeyY', 'z'),
    letter('KeyU', 'u'), letter('KeyI', 'i'), letter('KeyO', 'o'), letter('KeyP', 'p'), L('BracketLeft', 'ú', '/', '÷'), L('BracketRight', ')', '(', '×')],
  [letter('KeyA', 'a'), letter('KeyS', 's'), letter('KeyD', 'd'), letter('KeyF', 'f', '['), letter('KeyG', 'g', ']'), letter('KeyH', 'h'),
    letter('KeyJ', 'j'), letter('KeyK', 'k'), letter('KeyL', 'l'), L('Semicolon', 'ů', '"', '$'), L('Quote', '§', '!'), L('Backslash', '¨', '\'')],
  [letter('KeyZ', 'y'), letter('KeyX', 'x', '#'), letter('KeyC', 'c', '&'), letter('KeyV', 'v', '@'), letter('KeyB', 'b', '{'), letter('KeyN', 'n', '}'),
    letter('KeyM', 'm'), L('Comma', ',', '?', '<'), L('Period', '.', ':', '>'), L('Slash', '-', '_', '*')]
];
export const KEYS = Object.fromEntries(KEYBOARD.flat().map(k => [k.code, k]));

/** Kde znak „bydlí“: { code, layer } nebo null. Mezera a písmena se nehledají. */
export const WHERE = {};
for (const k of KEYBOARD.flat()) for (const layer of LAYERS) if (k[layer] && !(k[layer] in WHERE)) WHERE[k[layer]] = { code: k.code, layer };

/** Krátký popisek klávesy, jak je na ní natištěný (písmeno velké, u číslic číslice). */
export function keyCap(code) {
  const k = KEYS[code];
  if (!k) return '?';
  if (/^Key/.test(code)) return k.shift;
  if (/^Digit/.test(code)) return k.shift;
  return k.base;
}
const CAP_NAME = { ',': 'čárka', '.': 'tečka', '-': 'pomlčka', ';': 'středník', '=': 'rovná se', ')': 'závorka', '§': 'paragraf' };
export function keyName(code) {
  const cap = keyCap(code);
  return CAP_NAME[cap] ? `${cap} (${CAP_NAME[cap]})` : cap;
}

export const CHAR_NAME = {
  '@': 'zavináč', '#': 'mřížka', '&': 'ampersand', '$': 'dolar', '€': 'euro', '*': 'hvězdička', '<': 'menší než', '>': 'větší než',
  '[': 'levá hranatá závorka', ']': 'pravá hranatá závorka', '{': 'levá složená závorka', '}': 'pravá složená závorka',
  '\\': 'zpětné lomítko', '|': 'svislá čára', '~': 'vlnovka', '×': 'krát', '÷': 'děleno', '?': 'otazník', ':': 'dvojtečka',
  '_': 'podtržítko', '!': 'vykřičník', '"': 'uvozovky', '(': 'levá závorka', ')': 'pravá závorka', '/': 'lomítko', '%': 'procento',
  '°': 'stupeň', '\'': 'apostrof', '+': 'plus', '=': 'rovná se', ';': 'středník', '-': 'spojovník (minus)', ',': 'čárka', '.': 'tečka', '§': 'paragraf'
};

/** Jak znak napsat: „Shift + čárka“, „pravý Alt (AltGr) + V“. */
export function combo(ch) {
  const w = WHERE[ch];
  if (!w) return null;
  const name = keyName(w.code);
  if (w.layer === 'base') return `klávesa ${name}`;
  return `${w.layer === 'shift' ? 'Shift' : 'pravý Alt (AltGr)'} + ${name}`;
}
export const showChar = ch => `„${ch}“`;
export const howTo = ch => `${showChar(ch)} (${CHAR_NAME[ch] || 'znak'}) = ${combo(ch) || 'není na klávesnici'}`;
const uniq = arr => [...new Set(arr)];
export const specials = text => uniq([...text].filter(c => !/[\p{L}\p{N}\s]/u.test(c)));

/* ================= Obsah úloh ================= */
export const LEVEL_INFO = [
  { name: 'Kde znak bydlí', focus: 'Na jedné klávese jsou až tři znaky. Vlevo dole píšeš klávesou samotnou, vlevo nahoře se Shiftem a vpravo dole s pravým Altem (AltGr). Najdi je na své klávesnici a napiš je.' },
  { name: 'Vyplivnuté znaky', focus: 'Znakožrout snědl znaky ze zpráv a pak je vyplivl na hromádku. Vrať každý znak na správné místo – napiš ho na klávesnici.' },
  { name: 'Adresy a názvy', focus: 'E-mail, webová adresa i název souboru mají přísná pravidla: žádné mezery, žádné háčky, správné znaky na správném místě.' },
  { name: 'Trezor', focus: 'Znakožrout se schoval do trezoru. Otevře ho jen silné heslo – dlouhé a se znaky, které se píšou s AltGr.' },
  { name: 'Typografická poradna', focus: 'Znaky už máš, teď je správně rozmísti. Oprav texty podle pravidel české typografie: mezery u jednotek, závorek a znamének.' }
];

export const SKILLS = {
  vrstvy: 'Najdu znak na klávesnici a vím, jestli potřebuji Shift, nebo AltGr.',
  interpunkce: 'Píšu interpunkci, závorky, smajlíky a matematická znaménka.',
  adresy: 'Napíšu e-mail, webovou adresu a název souboru podle pravidla.',
  heslo: 'Vytvořím silné heslo se speciálními znaky.',
  typografie: 'Dodržuji základní typografická pravidla (mezery u jednotek, závorek a znamének).'
};

const WHERE_SETS = [['@', '?', '%'], ['#', '!', '*'], ['€', ':', '/'], ['&', '_', '$'], ['<', '(', '°'], ['{', '"', '|']];

// Text s mezerami: řetězce = pevný text, { a } = snědený znak (nebo smajlík).
const BLANK_TEXTS = [
  { title: 'Zpráva do třídní skupiny', parts: ['Ahoj 7.B', { a: '!' }, ' Zítra jedeme do ZOO. Sraz je v 7', { a: ':' }, '30 před školou. Kdo ještě nemá přihlášku', { a: '?' }, ' Těším se ', { a: ':-)' }] },
  { title: 'Recept na pizzu', parts: ['Na těsto potřebuješ mouku ', { a: '(' }, 'asi 300 g', { a: ')' }, ', vodu a droždí', { a: ';' }, ' troubu nahřej na 220 ', { a: '°' }, 'C', { a: '.' }] },
  { title: 'Plakát jarmarku', parts: ['Jarmark 7.B: limonáda 15 Kč, perník se slevou 10 ', { a: '%' }, '. Objednávky na jarmark', { a: '@' }, 'skola.example, fotky pod značkou ', { a: '#' }, 'jarmark7B', { a: '!' }] },
  { title: 'Sešit z matematiky', parts: ['Platí 6 ', { a: '×' }, ' 7 ', { a: '=' }, ' 42 a 42 ', { a: '÷' }, ' 6 = 7. Dále 5 ', { a: '<' }, ' 8 a 9 ', { a: '>' }, ' 4.'] },
  { title: 'Kde je projekt', parts: ['Projekt je ve složce C:', { a: '\\' }, 'Skola', { a: '\\' }, 'Projekty a jmenuje se projekt', { a: '_' }, 'voda.docx. Body: 8', { a: '/' }, '10', { a: '.' }] },
  { title: 'Předpověď počasí', parts: ['V pondělí ráno ', { a: '-' }, '5 ', { a: '°' }, 'C, odpoledne slunečno', { a: '!' }, ' Vlhkost 80 ', { a: '%' }, ' ', { a: '(' }, 'v noci mlhy', { a: ')' }] }
];
export const TUTORIAL_TEXT = { title: 'Ukázka: krátký vzkaz', parts: ['Jdeš ven', { a: '?' }, ' Čekám u hřiště', { a: '!' }] };

const RULE_TASKS = [
  { kind: 'email', skillChars: ['@', '_', '.'], title: 'E-mail kroužku',
    rule: 'Adresa kroužku = název malými písmeny bez háčků a čárek, mezery nahraď podtržítkem _, pak zavináč a doména krouzky.skola.example.',
    examples: [['Šachový klub', 'sachovy_klub@krouzky.skola.example']],
    items: [['Mladý zahradník', 'mlady_zahradnik@krouzky.skola.example'], ['Školní časopis', 'skolni_casopis@krouzky.skola.example'], ['Robotický tým', 'roboticky_tym@krouzky.skola.example']] },
  { kind: 'web', skillChars: [':', '/', '-'], title: 'Webová stránka třídy',
    rule: 'Stránka třídy = https://skola.example/tridy/ + třída malým písmenem s pomlčkou místo tečky (7.B → 7-b), lomítko a sekce bez háčků a čárek.',
    examples: [['Fotky třídy 6.A', 'https://skola.example/tridy/6-a/fotky']],
    items: [['Rozvrh třídy 8.C', 'https://skola.example/tridy/8-c/rozvrh'], ['Úkoly třídy 9.A', 'https://skola.example/tridy/9-a/ukoly'], ['Výlety třídy 7.B', 'https://skola.example/tridy/7-b/vylety']] },
  { kind: 'file', skillChars: ['_', '-', '.'], title: 'Název souboru s úkolem',
    rule: 'Soubor = třída bez tečky malým písmenem, podtržítko, předmět bez háčků a čárek malými písmeny, podtržítko, datum rok-měsíc-den (měsíc a den dvoumístně), přípona .docx.',
    examples: [['Dějepis, 6.B, 5. listopadu 2026', '6b_dejepis_2026-11-05.docx']],
    items: [['Zeměpis, 7.A, 3. prosince 2026', '7a_zemepis_2026-12-03.docx'], ['Přírodopis, 8.C, 9. října 2026', '8c_prirodopis_2026-10-09.docx'], ['Čeština, 9.B, 14. ledna 2027', '9b_cestina_2027-01-14.docx']] }
];

export const ALTGR_SET = uniq(Object.entries(WHERE).filter(([, w]) => w.layer === 'altgr').map(([c]) => c));
const PASSWORD_RULES = [
  { min: 12, banned: ['heslo', 'skola', '1234', 'qwert', 'trezor'], example: 'Kos7Zpiva@Rano#' },
  { min: 13, banned: ['heslo', 'skola', '1234', 'qwert', 'znakozrout'], example: 'Lipa&8Kvete*Hned' },
  { min: 14, banned: ['heslo', 'skola', '1234', 'qwert', 'abcd'], example: 'Rybnik{3}Zamrzl$Brzy' }
];

const FIX_TEXTS = [
  { title: 'Předpověď počasí', wrong: 'Ráno bude -3°C, odpoledne 5 ° C a srážky 40%.', right: 'Ráno bude -3 °C, odpoledne 5 °C a srážky 40 %.', chars: ['°', '%'],
    issues: [['-3 °C', 'Mezi číslem a °C patří mezera: -3 °C.'], ['5 °C', 'Značka °C se nerozděluje – ° a C píšeš hned za sebou.'], ['40 %', 'Mezi číslem a % patří mezera (40 % = čtyřicet procent).']] },
  { title: 'Pozvánka na výlet', wrong: 'Výlet ( do Brna ) bude v pátek ,sraz v 7:30 !', right: 'Výlet (do Brna) bude v pátek, sraz v 7:30!', chars: ['(', ')', '!'],
    issues: [['(do Brna)', 'Uvnitř závorek se u závorky mezera nepíše: (do Brna).'], ['pátek, sraz', 'Čárka se píše hned za slovo, mezera až za ni.'], ['7:30!', 'Před vykřičníkem (i otazníkem a tečkou) mezera není.']] },
  { title: 'Výsledky z matematiky', wrong: 'Platí 3x4=12 a 12:4=3.', right: 'Platí 3 × 4 = 12 a 12 : 4 = 3.', chars: ['×', '='],
    issues: [['3 × 4', 'Krát se píše znakem × (pravý Alt + závorka), ne písmenem x – a kolem něj mezery.'], ['4 = 12', 'Kolem rovnítka patří mezery: 4 = 12.'], ['12 : 4', 'Dělení dvojtečkou se v textu píše s mezerami: 12 : 4.'], ['4 = 3', 'Mezery kolem rovnítka patří i do druhého příkladu.']] },
  { title: 'Ceník kina', wrong: 'Lístek stojí 120Kč , pro žáky je sleva 25% .', right: 'Lístek stojí 120 Kč, pro žáky je sleva 25 %.', chars: ['%', ','],
    issues: [['120 Kč', 'Mezi číslem a jednotkou (Kč, kg, km…) patří mezera.'], ['Kč, pro', 'Čárka se píše hned za slovo, mezera až za ni.'], ['25 %.', 'Mezi číslem a % je mezera, před tečkou na konci věty mezera není.']] }
];

/* ================= Generátor ================= */
function blankTask(src, extra = {}) {
  const answers = src.parts.filter(p => typeof p === 'object').map(p => p.a);
  return { type: 'blanks', skill: 'interpunkce', title: src.title, parts: src.parts, answers, chars: uniq(answers),
    pile: [...answers].sort((a, b) => a.localeCompare(b)),
    prompt: 'Znakožrout vyplivl snědené znaky na hromádku. Klikni do mezery a napiš do ní správný znak.',
    hints: ['Přečti si větu nahlas: kde se ptáš, kde zvoláš, kde je čas nebo jednotka?',
      `Na klávesnici: ${uniq(answers).flatMap(a => [...a]).filter((c, i, arr) => arr.indexOf(c) === i).map(howTo).join(' · ')}.`], ...extra };
}

export function tutorialTask() {
  return { id: 'ukazka', level: -1, ...blankTask(TUTORIAL_TEXT), title: 'Ukázka: vrať znaky do vzkazu' };
}

export function buildGame(variant = 'A', mode = 'cela') {
  const rng = makeRng(VARIANTS[variant] ?? VARIANTS.A);
  const quick = mode === 'rychly';
  const T = [];
  const add = (level, t) => T.push({ id: `${t.type}-${T.length}`, level, ...t });

  // 1) Kde znak bydlí
  for (const chars of rng.shuffle(WHERE_SETS).slice(0, quick ? 1 : 2)) {
    add(0, { type: 'where', skill: 'vrstvy', chars, title: 'Ukradené štítky',
      prompt: `Znakožrout okusoval štítky na klávesách. Najdi na své klávesnici znaky ${chars.map(showChar).join(', ')} a do každého políčka je napiš – stiskni klávesu, a když je potřeba, drž k ní Shift nebo pravý Alt (AltGr).`,
      hints: ['Na klávese vlevo nahoře = se Shiftem, vlevo dole = bez přídavné klávesy, vpravo dole = s pravým Altem (AltGr).',
        `Klávesy: ${chars.map(c => `${showChar(c)} je na klávese ${keyName(WHERE[c].code)}`).join(' · ')}.`] });
  }
  // 2) Vyplivnuté znaky
  for (const src of rng.shuffle(BLANK_TEXTS).slice(0, quick ? 1 : 3)) add(1, blankTask(src));
  // 3) Adresy a názvy
  for (const r of rng.shuffle(RULE_TASKS).slice(0, quick ? 1 : 2)) {
    const [from, answer] = rng.pick(r.items);
    add(2, { type: 'rule', skill: 'adresy', kind: r.kind, title: r.title, rule: r.rule, examples: r.examples, from, answer, chars: r.skillChars,
      prompt: `Pravidlo platí pro všechny. Napiš podle něj: ${from}.`,
      hints: ['Porovnej svůj zápis s příkladem znak po znaku. Žádné mezery, žádné háčky ani čárky, malá písmena.',
        `Znaky: ${specials(answer).map(howTo).join(' · ')}.`] });
  }
  // 4) Trezor
  const pr = PASSWORD_RULES[Object.keys(VARIANTS).indexOf(variant) % PASSWORD_RULES.length] || PASSWORD_RULES[0];
  add(3, { type: 'password', skill: 'heslo', title: 'Heslo k trezoru', min: pr.min, banned: pr.banned, example: pr.example, chars: ['🔒'],
    prompt: 'Vymysli heslo, které splní všechna pravidla trezoru. Pravidla se odškrtávají, jak píšeš. Heslo se nikam neukládá a nikomu se neposílá – a nepoužívej ho nikde doopravdy.',
    hints: ['Zkus větu, kterou si zapamatuješ: začáteční písmena slov, číslo a mezi slova speciální znaky.',
      `Znaky s AltGr: ${['@', '#', '&', '$', '*', '€'].map(howTo).join(' · ')}.`] });
  // 5) Typografická poradna
  for (const f of rng.shuffle(FIX_TEXTS).slice(0, quick ? 2 : 3)) {
    add(4, { type: 'fix', skill: 'typografie', title: f.title, wrong: f.wrong, answer: f.right, issues: f.issues, chars: f.chars,
      prompt: 'Text je naťukaný, ale mezery jsou rozházené. Oprav ho přímo v políčku podle pravidel české typografie.',
      hints: [f.issues[0][1], `V textu jsou ${f.issues.length} chyby. ${f.issues.slice(1).map(i => i[1]).join(' ')}`] });
  }
  return T;
}

/* ================= Vyhodnocení ================= */
const norm = s => String(s ?? '').replace(/[   ]/g, ' ').replace(/[−–]/g, '-');
export const stripDia = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function passwordChecks(t, pw) {
  const p = String(pw ?? '');
  const plain = stripDia(p.toLowerCase());
  return [
    { id: 'len', label: `aspoň ${t.min} znaků (teď ${[...p].length})`, ok: [...p].length >= t.min },
    { id: 'upper', label: 'velké písmeno', ok: /\p{Lu}/u.test(p) },
    { id: 'lower', label: 'malé písmeno', ok: /\p{Ll}/u.test(p) },
    { id: 'digit', label: 'číslice', ok: /\d/.test(p) },
    { id: 'altgr', label: `aspoň dva různé znaky, které se píšou s AltGr (${ALTGR_SET.filter(c => !/[÷×~\\|]/.test(c)).join(' ')} …)`, ok: uniq([...p].filter(c => ALTGR_SET.includes(c))).length >= 2 },
    { id: 'banned', label: `žádné snadno uhodnutelné slovo (${t.banned.join(', ')})`, ok: !t.banned.some(b => plain.includes(b)) },
    { id: 'repeat', label: 'žádný znak třikrát za sebou', ok: !/(.)\1\1/u.test(p) }
  ];
}

function firstDiff(a, b) {
  const A = [...a], B = [...b];
  let i = 0;
  while (i < A.length && i < B.length && A[i] === B[i]) i++;
  return i;
}

export function check(t, ans) {
  switch (t.type) {
    case 'where': {
      const v = (ans?.values || []).map(x => String(x ?? '').trim());
      if (v.length < t.chars.length || v.some(x => !x)) return { ok: false, incomplete: true, msg: 'Do každého políčka napiš jeden znak – stiskni kombinaci kláves, která ho napíše.' };
      const bad = [];
      t.chars.forEach((c, i) => {
        if (v[i] === c) return;
        const w = WHERE[c], got = WHERE[v[i]];
        if (got && got.code === w.code) bad.push(`${showChar(v[i])} je na správné klávese, ale ${showChar(c)} se píše ${LAYER_NAME[w.layer]}${w.layer === 'altgr' ? ' – znak je na klávese vpravo dole' : w.layer === 'shift' ? ' – znak je na klávese vlevo nahoře' : ''}.`);
        else bad.push(`Místo ${showChar(c)} jsi napsal(a) ${showChar(v[i])}. Hledej ${showChar(c)} v rozích kláves na své klávesnici.`);
      });
      if (!bad.length) return { ok: true, msg: `Štítky jsou zpátky: ${t.chars.map(howTo).join(' · ')}.` };
      return { ok: false, msg: bad.join(' '), wrong: t.chars.map((c, i) => (v[i] === c ? null : i)).filter(i => i != null) };
    }
    case 'blanks': {
      const v = (ans?.values || []).map(x => norm(x).trim());
      if (v.length < t.answers.length || v.some(x => !x)) return { ok: false, incomplete: true, msg: 'Vyplň všechny mezery – v každé chybí aspoň jeden znak.' };
      const wrong = t.answers.map((a, i) => (v[i] === a ? null : i)).filter(i => i != null);
      if (!wrong.length) return { ok: true, msg: `Zpráva je celá. Použil(a) jsi: ${uniq(t.answers.flatMap(a => [...a])).map(c => `${showChar(c)} ${combo(c)}`).join(' · ')}.` };
      const notInPile = wrong.map(i => v[i]).filter(x => !t.answers.includes(x));
      let msg = `${wrong.length === 1 ? 'Mezera' : 'Mezery'} ${wrong.map(i => i + 1).join(', ')} nesedí.`;
      if (notInPile.length) msg += ` Znak ${notInPile.map(showChar).join(', ')} na hromádce není – možná jsi zmáčkl(a) klávesu bez Shiftu nebo AltGr.`;
      else msg += ' Všechny znaky jsou z hromádky, jen jsou na špatných místech – přečti si větu znovu.';
      return { ok: false, msg, wrong };
    }
    case 'rule': {
      const a = norm(ans?.value).trim();
      if (!a) return { ok: false, incomplete: true, msg: 'Napiš adresu nebo název do políčka.' };
      const target = t.answer;
      const ok = a === target || (t.kind === 'web' && a === `${target}/`);
      if (ok) return { ok: true, msg: `${target} – znaky ${specials(target).map(c => `${showChar(c)} ${combo(c)}`).join(' · ')}.` };
      const why = [];
      if (/\s/.test(a)) why.push('V adrese ani názvu souboru nesmí být mezera.');
      if (stripDia(a) !== a) why.push('Háčky a čárky sem nepatří (č → c, á → a).');
      if (a !== a.toLowerCase()) why.push('Piš jen malými písmeny.');
      for (const c of specials(target)) if (!a.includes(c)) why.push(`Chybí ${showChar(c)} – ${combo(c)}.`);
      if (!why.length) {
        const i = firstDiff(a, target);
        why.push(`Až do ${i}. znaku je to správně, pak se zápis od pravidla odchyluje. Porovnej s příkladem.`);
      }
      return { ok: false, msg: why.join(' ') };
    }
    case 'password': {
      const p = String(ans?.value ?? '');
      if (!p) return { ok: false, incomplete: true, msg: 'Napiš do políčka heslo.' };
      const missing = passwordChecks(t, p).filter(c => !c.ok);
      if (!missing.length) return { ok: true, msg: 'Trezor cvakl a je otevřený! Dlouhé heslo se znaky z různých vrstev klávesnice se těžko hádá. Doopravdy si vymysli jiné a nikomu ho neříkej.' };
      return { ok: false, msg: `Trezor zůstal zamčený. Chybí: ${missing.map(c => c.label).join('; ')}.` };
    }
    case 'fix': {
      const a = norm(ans?.value).replace(/ {2,}/g, ' ').trim();
      if (!a) return { ok: false, incomplete: true, msg: 'Políčko je prázdné – oprav text v něm.' };
      if (a === t.answer) return { ok: true, msg: `Typograficky správně: ${t.answer}` };
      const todo = t.issues.filter(([good]) => !a.includes(good)).map(([, why]) => why);
      if (todo.length) return { ok: false, msg: `${todo.length === 1 ? 'Zbývá 1 oprava' : `Zbývají ${todo.length} opravy`}: ${todo[0]}` };
      const i = firstDiff(a, t.answer);
      return { ok: false, msg: `Pravidla sedí, ale text se jinde liší od původního (od ${i + 1}. znaku). Nepřepsal(a) jsi omylem jiné slovo nebo znak?` };
    }
    default: return { ok: false, msg: 'Neznámý typ úlohy.' };
  }
}

export function solution(t) {
  switch (t.type) {
    case 'where': return { values: [...t.chars] };
    case 'blanks': return { values: [...t.answers] };
    case 'rule': return { value: t.answer };
    case 'password': return { value: t.example };
    case 'fix': return { value: t.answer };
    default: return null;
  }
}

export function isBetter(a, b) {
  if (!b) return true;
  if (a.firstTry !== b.firstTry) return a.firstTry > b.firstTry;
  if (a.hints !== b.hints) return a.hints < b.hints;
  if (a.ms != null && b.ms != null) return a.ms < b.ms;
  return false;
}
