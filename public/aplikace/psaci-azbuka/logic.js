// Logika aplikace Psací azbuka – bez DOM, testovaná v tests/unit/psaci-azbuka.test.mjs.
// 1) Ruské rozložení ЙЦУКЕН podle fyzické klávesy (event.code), takže funguje i na české klávesnici.
// 2) Fonetický přepis z latinky podle české výslovnosti (č → ч, ch → х, ja → я …).

export const ALPHABET = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';

/** Rozložení ЙЦУКЕН: event.code → [bez Shiftu, se Shiftem] a popisek klávesy na české klávesnici QWERTZ. */
export const YTSUKEN_ROWS = [
  [['Backquote', 'ё', 'Ё', ';'], ['Digit1', '1', '!', '+'], ['Digit2', '2', '"', 'ě'], ['Digit3', '3', '№', 'š'], ['Digit4', '4', ';', 'č'],
    ['Digit5', '5', '%', 'ř'], ['Digit6', '6', ':', 'ž'], ['Digit7', '7', '?', 'ý'], ['Digit8', '8', '*', 'á'], ['Digit9', '9', '(', 'í'],
    ['Digit0', '0', ')', 'é'], ['Minus', '-', '_', '='], ['Equal', '=', '+', '´']],
  [['KeyQ', 'й', 'Й', 'Q'], ['KeyW', 'ц', 'Ц', 'W'], ['KeyE', 'у', 'У', 'E'], ['KeyR', 'к', 'К', 'R'], ['KeyT', 'е', 'Е', 'T'],
    ['KeyY', 'н', 'Н', 'Z'], ['KeyU', 'г', 'Г', 'U'], ['KeyI', 'ш', 'Ш', 'I'], ['KeyO', 'щ', 'Щ', 'O'], ['KeyP', 'з', 'З', 'P'],
    ['BracketLeft', 'х', 'Х', 'ú'], ['BracketRight', 'ъ', 'Ъ', ')']],
  [['KeyA', 'ф', 'Ф', 'A'], ['KeyS', 'ы', 'Ы', 'S'], ['KeyD', 'в', 'В', 'D'], ['KeyF', 'а', 'А', 'F'], ['KeyG', 'п', 'П', 'G'],
    ['KeyH', 'р', 'Р', 'H'], ['KeyJ', 'о', 'О', 'J'], ['KeyK', 'л', 'Л', 'K'], ['KeyL', 'д', 'Д', 'L'], ['Semicolon', 'ж', 'Ж', 'ů'],
    ['Quote', 'э', 'Э', '§']],
  [['KeyZ', 'я', 'Я', 'Y'], ['KeyX', 'ч', 'Ч', 'X'], ['KeyC', 'с', 'С', 'C'], ['KeyV', 'м', 'М', 'V'], ['KeyB', 'и', 'И', 'B'],
    ['KeyN', 'т', 'Т', 'N'], ['KeyM', 'ь', 'Ь', 'M'], ['Comma', 'б', 'Б', ','], ['Period', 'ю', 'Ю', '.'], ['Slash', '.', ',', '-']]
];

export const YTSUKEN = Object.fromEntries(YTSUKEN_ROWS.flat().map(([code, base, shift, cap]) => [code, { base, shift, cap }]));

/** Znak, který napíše ruská klávesnice pro danou fyzickou klávesu, nebo null (klávesu pak necháme prohlížeči). */
export function ytsukenChar(code, shiftKey = false, capsLock = false) {
  const k = YTSUKEN[code];
  if (!k) return null;
  const isLetter = ALPHABET.includes(k.base);
  const upper = isLetter ? shiftKey !== capsLock : shiftKey;
  return upper ? k.shift : k.base;
}

/** Fonetický přepis: jedno latinské písmeno → azbuka. Spřežky (ch, šč, ja, ju, jo, je) řeší phoneticStep. */
export const PHONETIC = {
  a: 'а', á: 'а', b: 'б', v: 'в', w: 'щ', g: 'г', d: 'д', ď: 'дь', e: 'е', ě: 'е', é: 'э', ž: 'ж', z: 'з', i: 'и', í: 'и',
  j: 'й', k: 'к', l: 'л', m: 'м', n: 'н', ň: 'нь', o: 'о', ó: 'о', p: 'п', r: 'р', ř: 'р', s: 'с', š: 'ш', t: 'т', ť: 'ть',
  u: 'у', ú: 'у', ů: 'у', f: 'ф', h: 'х', x: 'х', c: 'ц', č: 'ч', y: 'ы', ý: 'ы', q: 'ь', "'": 'ь', '"': 'ъ'
};

/** Spřežky: předchozí znak (malým písmenem) + nové písmeno → jeden znak azbuky. */
const COMBINE = { 'ц+h': 'х', 'ш+č': 'щ', 'й+a': 'я', 'й+á': 'я', 'й+u': 'ю', 'й+ú': 'ю', 'й+o': 'ё', 'й+e': 'е', 'й+é': 'э' };

const isUpper = ch => ch !== ch.toLowerCase();
const matchCase = (out, upper) => (upper ? out.charAt(0).toUpperCase() + out.slice(1) : out);

/**
 * Jeden krok fonetického psaní.
 * @param {string} prev znak těsně před kurzorem ('' když žádný)
 * @param {string} ch napsaný znak
 * @returns {{del: number, ins: string} | null} kolik znaků před kurzorem smazat a co vložit; null = znak nechat být
 */
export function phoneticStep(prev, ch) {
  const lower = ch.toLowerCase();
  if (ch === 'Q') return { del: 0, ins: 'ъ' }; // Shift+Q = tvrdý znak
  if (!(lower in PHONETIC)) return null;
  const combined = prev ? COMBINE[`${prev.toLowerCase()}+${lower}`] : undefined;
  if (combined) return { del: 1, ins: matchCase(combined, isUpper(prev) || isUpper(ch)) };
  return { del: 0, ins: matchCase(PHONETIC[lower], isUpper(ch)) };
}

/** Přepíše celý text z latinky do azbuky (znaky, které neznáme – čísla, interpunkce, azbuka – zůstanou). */
export function transliterate(text) {
  let out = '';
  for (const ch of String(text)) {
    const step = phoneticStep(out.slice(-1), ch);
    if (!step) { out += ch; continue; }
    out = out.slice(0, out.length - step.del) + step.ins;
  }
  return out;
}

/** Nápověda k fonetickému psaní: písmeno azbuky → co napsat latinkou. */
export const PHONETIC_HINT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e / je', ё: 'jo', ж: 'ž', з: 'z', и: 'i', й: 'j', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'ch / h / x', ц: 'c', ч: 'č', ш: 'š', щ: 'šč / w', ъ: 'Shift+Q',
  ы: 'y', ь: 'q', э: 'é', ю: 'ju', я: 'ja'
};

/** Celá abeceda jako dvojice velké + malé písmeno (např. pro list s abecedou). */
export function alphabetPairs(perLine = 11) {
  const pairs = [...ALPHABET].map(ch => ch.toUpperCase() + ch);
  const lines = [];
  for (let i = 0; i < pairs.length; i += perLine) lines.push(pairs.slice(i, i + perLine).join(' '));
  return lines.join('\n');
}

/** Rozložení řádků obrázku: rozměry a účaří každého řádku (výpočet bez canvasu, měření dodá volající). */
export function layoutLines(lines, measure, { size, spacing = 1.6, pad = 0.35 }) {
  const p = Math.round(size * pad);
  const lineH = size * spacing;
  const metrics = lines.map(l => measure(l || ' '));
  const asc = Math.max(size * 0.9, ...metrics.map(m => m.ascent));
  const desc = Math.max(size * 0.35, ...metrics.map(m => m.descent));
  const left = Math.max(0, ...metrics.map(m => m.left));
  const width = Math.ceil(Math.max(size, ...metrics.map(m => m.left + m.right)) + 2 * p);
  const baselines = lines.map((_, i) => p + asc + i * lineH);
  const height = Math.ceil(baselines[baselines.length - 1] + desc + p);
  return { width, height, baselines, x: p + left, pad: p };
}

const TO_LATIN = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'jo', ж: 'z', з: 'z', и: 'i', й: 'j', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'ch', ц: 'c', ч: 'c', ш: 's', щ: 'sc', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'ju', я: 'ja'
};

/** Bezpečný název souboru z prvních slov textu: jen a–z, číslice a pomlčky (funguje ve všech systémech). */
export function fileName(text) {
  const latin = [...String(text).toLowerCase()].map(ch => TO_LATIN[ch] ?? ch).join('')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const base = latin.replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 4).join('-').slice(0, 40).replace(/-+$/, '');
  return `${base || 'psaci-azbuka'}.png`;
}
