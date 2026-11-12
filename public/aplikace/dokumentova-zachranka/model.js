/* Dokumentová záchranka – datový model dokumentu (bez DOM).
   Dokument = pole bloků. Textový blok: { id, type, align, text, marks } kde marks je pole čísel
   (bitová maska pro každý znak: 1 = tučně, 2 = kurzíva, 4 = podtržení).
   Obrázek: { id, type: 'image', src, caption, position }.
   Všechny operace jsou čisté funkce: vrací nový dokument, vstup nemění. */

export const TEXT_TYPES = ['heading1', 'heading2', 'paragraph', 'bullet', 'number'];
export const TYPE_LABELS = {
  heading1: 'Nadpis 1', heading2: 'Nadpis 2', paragraph: 'Odstavec',
  bullet: 'Odrážka', number: 'Číslovaný seznam', image: 'Obrázek'
};
export const ALIGNS = ['left', 'center', 'right', 'justify'];
export const ALIGN_LABELS = { left: 'vlevo', center: 'na střed', right: 'vpravo', justify: 'do bloku' };
export const MARKS = { b: 1, i: 2, u: 4 };
export const MARK_LABELS = { b: 'tučně', i: 'kurzívou', u: 'podtrženě' };
export const POSITIONS = ['left', 'center', 'right'];

const clone = x => JSON.parse(JSON.stringify(x));
export const isText = b => b && TEXT_TYPES.includes(b.type);

/** Normalizace mezer: nezlomitelná mezera = obyčejná mezera (pro porovnávání). */
export const normSpaces = s => String(s).replace(/[  ]/g, ' ');

/* ---------- Vytvoření dokumentu z definice mise ---------- */
/**
 * Položka definice: { id, type?, text, align?, bold?: ['podřetězec'], italic?: [...], underline?: [...] }
 * nebo obrázek { id, type: 'image', src, caption?, position? }.
 */
export function fromSpec(spec) {
  return spec.map(s => {
    if (s.type === 'image') return { id: s.id, type: 'image', src: s.src, caption: s.caption || '', position: s.position || 'center' };
    const text = s.text;
    const marks = new Array(text.length).fill(0);
    for (const [key, bit] of [['bold', 1], ['italic', 2], ['underline', 4]]) {
      for (const part of s[key] || []) {
        const at = text.indexOf(part);
        if (at < 0) throw new Error(`definice: "${part}" není v textu bloku ${s.id}`);
        for (let k = at; k < at + part.length; k++) marks[k] |= bit;
      }
    }
    return { id: s.id, type: s.type || 'paragraph', align: s.align || 'left', text, marks };
  });
}

export const find = (doc, id) => doc.find(b => b.id === id);
const update = (doc, id, fn) => doc.map(b => (b.id === id ? fn(clone(b)) : b));

/* ---------- Operace ---------- */
export function setType(doc, ids, type) {
  if (!TEXT_TYPES.includes(type)) throw new Error('neznámý styl ' + type);
  const set = new Set([].concat(ids));
  return doc.map(b => (set.has(b.id) && isText(b) ? { ...clone(b), type } : b));
}

/** Přepínač seznamu: když už blok typ má, vrátí ho na odstavec. */
export function toggleList(doc, id, type) {
  const b = find(doc, id);
  if (!isText(b)) return doc;
  return setType(doc, id, b.type === type ? 'paragraph' : type);
}

export function setAlign(doc, ids, align) {
  if (!ALIGNS.includes(align)) throw new Error('neznámé zarovnání ' + align);
  const set = new Set([].concat(ids));
  return doc.map(b => (set.has(b.id) && isText(b) ? { ...clone(b), align } : b));
}

/** Má celý rozsah danou značku? */
export function rangeHasMark(block, start, end, mark) {
  const bit = MARKS[mark];
  if (end <= start) return false;
  for (let k = start; k < end; k++) if (!(block.marks[k] & bit)) return false;
  return true;
}

/** Přepne značku na rozsahu znaků [start, end): když ji celý rozsah má, odebere ji, jinak přidá. */
export function toggleMark(doc, id, start, end, mark) {
  const bit = MARKS[mark];
  if (!bit) throw new Error('neznámá značka ' + mark);
  const b = find(doc, id);
  if (!isText(b)) return doc;
  const s = Math.max(0, Math.min(start, end)), e = Math.min(b.text.length, Math.max(start, end));
  if (e <= s) return doc;
  const on = !rangeHasMark(b, s, e, mark);
  return update(doc, id, x => {
    for (let k = s; k < e; k++) x.marks[k] = on ? x.marks[k] | bit : x.marks[k] & ~bit;
    return x;
  });
}

/**
 * Nahradí text bloku. Značky zůstanou u znaků, které se nezměnily (zarovnání znaků přes
 * nejdelší společnou podposloupnost, LCS); nově vložené znaky převezmou značku znaku před nimi
 * (jako v textovém editoru), na začátku bloku značku znaku za nimi.
 */
export function replaceText(doc, id, newText) {
  const b = find(doc, id);
  if (!isText(b)) return doc;
  newText = String(newText).replace(/[\r\n\t]+/g, ' ');
  const old = b.text;
  if (newText === old) return doc;
  const marks = remapMarks(old, b.marks, newText);
  return update(doc, id, x => ({ ...x, text: newText, marks }));
}

function remapMarks(old, oldMarks, text) {
  let p = 0;
  while (p < old.length && p < text.length && old[p] === text[p]) p++;
  let s = 0;
  while (s < old.length - p && s < text.length - p && old[old.length - 1 - s] === text[text.length - 1 - s]) s++;
  const a = old.slice(p, old.length - s), c = text.slice(p, text.length - s);
  const out = new Array(text.length).fill(null);
  for (let k = 0; k < p; k++) out[k] = oldMarks[k];
  for (let k = 0; k < s; k++) out[text.length - 1 - k] = oldMarks[old.length - 1 - k];
  if (a.length && c.length && a.length * c.length <= 400000) {
    // LCS tabulka pro změněný střed
    const n = a.length, m = c.length;
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === c[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === c[j]) { out[p + j] = oldMarks[p + i]; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
    }
  }
  // vložené znaky: značka předchozího znaku, na začátku následujícího
  for (let k = 0; k < out.length; k++) if (out[k] === null && k > 0) out[k] = out[k - 1];
  for (let k = out.length - 1; k >= 0; k--) if (out[k] === null) out[k] = k + 1 < out.length ? out[k + 1] : 0;
  return out.map(v => v ?? 0);
}

/** Vloží text místo výběru [start, end) – používá se pro vkládání ze schránky (jen čistý text). */
export function insertText(doc, id, start, end, text) {
  const b = find(doc, id);
  if (!isText(b)) return doc;
  return replaceText(doc, id, b.text.slice(0, start) + text + b.text.slice(end));
}

export function move(doc, id, delta) {
  const i = doc.findIndex(b => b.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= doc.length) return doc;
  const out = doc.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

let imgSeq = 0;
export function insertImage(doc, afterId, src, newId = `img-${Date.now().toString(36)}-${++imgSeq}`) {
  const i = afterId ? doc.findIndex(b => b.id === afterId) : doc.length - 1;
  const block = { id: newId, type: 'image', src, caption: '', position: 'center' };
  const out = doc.slice();
  out.splice(i + 1, 0, block);
  return out;
}

export function setImage(doc, id, patch) {
  return update(doc, id, x => {
    if (x.type !== 'image') return x;
    if ('position' in patch && POSITIONS.includes(patch.position)) x.position = patch.position;
    if ('caption' in patch) x.caption = String(patch.caption).replace(/[\r\n\t]+/g, ' ').slice(0, 200);
    if ('src' in patch) x.src = patch.src;
    return x;
  });
}

export function removeBlock(doc, id) {
  return doc.filter(b => b.id !== id);
}

/* ---------- Struktura (sémantické bloky) ---------- */
/**
 * Seskupí po sobě jdoucí položky seznamu do bloků bulletedList / numberedList.
 * Výsledek: [{ type: 'heading1' | 'heading2' | 'paragraph' | 'image' | 'bulletedList' | 'numberedList', ... }]
 */
export function structure(doc) {
  const out = [];
  for (const b of doc) {
    if (b.type === 'bullet' || b.type === 'number') {
      const kind = b.type === 'bullet' ? 'bulletedList' : 'numberedList';
      const last = out[out.length - 1];
      if (last && last.type === kind) last.items.push(b);
      else out.push({ type: kind, items: [b] });
    } else {
      out.push(b);
    }
  }
  return out;
}

/** Části textu se stejnými značkami – pro vykreslení. */
export function segments(block) {
  const out = [];
  for (let k = 0; k < block.text.length; k++) {
    const m = block.marks[k] || 0;
    const last = out[out.length - 1];
    if (last && last.marks === m) last.text += block.text[k];
    else out.push({ text: block.text[k], marks: m });
  }
  return out;
}

/* ---------- Historie (Zpět / Znovu) ---------- */
export class History {
  constructor(doc, limit = 200) {
    this.doc = doc;
    this.past = [];
    this.future = [];
    this.limit = limit;
    this.log = [];
  }
  /**
   * Zapíše nový stav. coalesceKey: po sobě jdoucí psaní ve stejném bloku se spojí do jednoho kroku Zpět.
   */
  push(doc, label, coalesceKey = null) {
    if (doc === this.doc) return false;
    const last = this.past[this.past.length - 1];
    if (coalesceKey && last && last.key === coalesceKey && this.lastKey === coalesceKey) {
      // nevytváříme nový krok, jen aktualizujeme stav
    } else {
      this.past.push({ doc: this.doc, label, key: coalesceKey });
      if (this.past.length > this.limit) this.past.shift();
      this.log.push(label);
    }
    this.lastKey = coalesceKey;
    this.doc = doc;
    this.future = [];
    return true;
  }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  undo() {
    const p = this.past.pop();
    if (!p) return null;
    this.future.push({ doc: this.doc, label: p.label, key: p.key });
    this.doc = p.doc;
    this.lastKey = null;
    this.log.push(`Zpět: ${p.label}`);
    return p.label;
  }
  redo() {
    const f = this.future.pop();
    if (!f) return null;
    this.past.push({ doc: this.doc, label: f.label, key: f.key });
    this.doc = f.doc;
    this.lastKey = null;
    this.log.push(`Znovu: ${f.label}`);
    return f.label;
  }
}

/* ---------- Pomůcky pro popisky ---------- */
export function shortText(s, n = 32) {
  const t = normSpaces(s).trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}
