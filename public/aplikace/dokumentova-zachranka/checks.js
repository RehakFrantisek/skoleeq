/* Dokumentová záchranka – deterministické vyhodnocení STAVU dokumentu (ne posloupnosti kliknutí).
   Každý cíl mise je objekt { kind, ... } (viz missions.js). evaluate() vrací pro každý cíl
   { ok, label, detail } – detail vysvětluje, co ještě nesedí. Bez DOM, testuje se v node. */
import { find, isText, structure, normSpaces, shortText, TYPE_LABELS, ALIGN_LABELS, MARKS, MARK_LABELS } from './model.js';

const q = s => `„${shortText(s, 40)}“`;
const blockName = b => (b ? q(b.type === 'image' ? b.caption || 'obrázek' : b.text) : 'blok');

/** Podpis textu: všechny znaky kromě mezer, podle id bloku. Hlídá, že žák text nesmazal ani nepřepsal. */
export function textSignature(doc) {
  return doc.filter(isText).map(b => `${b.id}:${normSpaces(b.text).replace(/\s+/g, '')}`).sort().join('|');
}

/* ---------- Typografická pravidla (čeština) ---------- */
export const TYPO = {
  doubleSpace: {
    label: 'Žádné dvě mezery za sebou',
    test: t => !/ {2,}/.test(t),
    fail: 'V textu jsou ještě dvě (nebo víc) mezer za sebou.'
  },
  spaceBeforePunct: {
    label: 'Před tečkou, čárkou, otazníkem a vykřičníkem není mezera',
    test: t => !/ [.,!?:;]/.test(t),
    fail: 'Před interpunkčním znaménkem (. , ! ? : ;) je ještě mezera.'
  },
  spaceAfterPunct: {
    label: 'Za čárkou a za koncem věty je mezera',
    // čárka/tečka/vykřičník/otazník následovaný písmenem bez mezery (čísla a zkratky v datu řeší pravidlo data)
    test: t => !/[,!?;][A-Za-zÁ-žá-ž]/.test(t) && !/[a-zá-ž]\.[A-ZÁ-Ž]/.test(t),
    fail: 'Za čárkou nebo za koncem věty chybí mezera.'
  },
  date: {
    label: 'Datum je zapsané s mezerami (15. 10. 2026)',
    test: t => !/\d{1,2}\.\d{1,2}\.(\d{4})?/.test(t) && !/\d{1,2}\. \d{1,2}\.\d{4}/.test(t),
    fail: 'Datum se píše s mezerami za tečkami, např. 15. 10. 2026.'
  }
};

/* ---------- Jednotlivé cíle ---------- */
export function evaluateObjective(o, doc, initial) {
  const r = (ok, detail = '') => ({ ok, label: o.label, detail: ok ? '' : detail });
  switch (o.kind) {
    case 'type': {
      const b = find(doc, o.block);
      if (!b) return r(false, 'Blok chybí.');
      return r(b.type === o.type, `${blockName(b)} je teď ${TYPE_LABELS[b.type]}, má být ${TYPE_LABELS[o.type]}.`);
    }
    case 'countType': {
      const n = doc.filter(b => b.type === o.type).length;
      return r(n === o.count, `V dokumentu je ${n}× ${TYPE_LABELS[o.type]}, má být ${o.count}×.`);
    }
    case 'align': {
      const ids = o.blocks || [o.block];
      const bad = ids.map(id => find(doc, id)).filter(b => !b || b.align !== o.align);
      return r(!bad.length, bad.length ? `${blockName(bad[0])} je zarovnaný ${ALIGN_LABELS[bad[0]?.align] || '?'}, má být ${ALIGN_LABELS[o.align]}.` : '');
    }
    case 'alignOthers': {
      // všechny textové bloky kromě vyjmenovaných mají dané zarovnání
      const skip = new Set(o.except || []);
      const bad = doc.filter(b => isText(b) && !skip.has(b.id) && b.align !== o.align);
      return r(!bad.length, bad.length ? `${blockName(bad[0])} je zarovnaný ${ALIGN_LABELS[bad[0].align]}, má být ${ALIGN_LABELS[o.align]}.` : '');
    }
    case 'mark': {
      // přesně zadaný úsek textu má značku; volitelně exclusive = nikde jinde v dokumentu ji nemá
      const b = find(doc, o.block);
      if (!b) return r(false, 'Blok chybí.');
      const at = b.text.indexOf(o.text);
      if (at < 0) return r(false, `Text ${q(o.text)} v bloku chybí.`);
      const bit = MARKS[o.mark];
      const missing = [...o.text].some((ch, k) => ch !== ' ' && !(b.marks[at + k] & bit));
      if (missing) return r(false, `${q(o.text)} ještě není celé ${MARK_LABELS[o.mark]}.`);
      if (o.exclusive) {
        for (const x of doc.filter(isText)) {
          const start = x.id === b.id ? at : -1;
          for (let k = 0; k < x.text.length; k++) {
            if (x.id === b.id && k >= start && k < start + o.text.length) continue;
            if (/[\s.,!?:;–-]/.test(x.text[k])) continue; // mezery a interpunkce na okraji výběru tolerujeme
            if (x.marks[k] & bit) return r(false, `${MARK_LABELS[o.mark][0].toUpperCase() + MARK_LABELS[o.mark].slice(1)} je i jiný text (${q(x.text.slice(Math.max(0, k - 8), k + 20))}). Zvýrazni jen zadaný úsek.`);
          }
        }
      }
      return r(true);
    }
    case 'noMark': {
      const bit = MARKS[o.mark];
      const ids = o.blocks ? new Set(o.blocks) : null;
      const bad = doc.filter(b => isText(b) && (!ids || ids.has(b.id)) && b.marks.some(m => m & bit));
      return r(!bad.length, bad.length ? `${blockName(bad[0])} obsahuje text ${MARK_LABELS[o.mark]}, který tam nemá být.` : '');
    }
    case 'list': {
      const kind = o.list === 'number' ? 'numberedList' : 'bulletedList';
      const other = o.list === 'number' ? 'bulletedList' : 'numberedList';
      const groups = structure(doc).filter(g => g.type === kind || g.type === other);
      const notInList = o.blocks.map(id => find(doc, id)).filter(b => !b || (b.type !== 'bullet' && b.type !== 'number'));
      if (notInList.length) return r(false, `${blockName(notInList[0])} ještě není položka seznamu.`);
      const wrongKind = o.blocks.map(id => find(doc, id)).find(b => b.type !== (o.list === 'number' ? 'number' : 'bullet'));
      if (wrongKind) return r(false, `Seznam má být ${o.list === 'number' ? 'číslovaný' : 'odrážkový'}.`);
      const g = groups.find(x => x.items.some(it => it.id === o.blocks[0]));
      const ids = g.items.map(it => it.id);
      const same = ids.length === o.blocks.length && (o.ordered ? ids.every((id, k) => id === o.blocks[k]) : o.blocks.every(id => ids.includes(id)));
      if (!same) {
        if (o.blocks.some(id => !ids.includes(id))) return r(false, 'Položky nejsou v jednom souvislém seznamu – mezi nimi je jiný blok.');
        if (ids.length > o.blocks.length) return r(false, 'V seznamu je navíc blok, který do něj nepatří.');
        return r(false, 'Položky seznamu jsou ve špatném pořadí.');
      }
      return r(true);
    }
    case 'order': {
      const idx = o.blocks.map(id => doc.findIndex(b => b.id === id));
      if (idx.some(i => i < 0)) return r(false, 'Některý odstavec chybí.');
      for (let k = 1; k < idx.length; k++) {
        if (idx[k] < idx[k - 1]) return r(false, `${blockName(find(doc, o.blocks[k]))} je před odstavcem, za kterým má následovat.`);
      }
      if (o.adjacent && idx.some((v, k) => k > 0 && v !== idx[k - 1] + 1)) return r(false, 'Mezi odstavci je jiný blok.');
      return r(true);
    }
    case 'first': {
      const firstText = doc[0];
      return r(firstText && firstText.id === o.block, `Na začátku dokumentu má být ${blockName(find(doc, o.block))}.`);
    }
    case 'image': {
      const imgs = doc.filter(b => b.type === 'image');
      const img = imgs.find(b => b.src === o.src);
      if (!img) return r(false, imgs.length ? 'Vložená ilustrace není ta správná – podívej se do zadání.' : 'Obrázek zatím není vložený.');
      if (o.after) {
        const i = doc.indexOf(img);
        if (i === 0 || doc[i - 1].id !== o.after) return r(false, `Obrázek má být hned za odstavcem ${blockName(find(doc, o.after))}.`);
      }
      if (o.position && img.position !== o.position) return r(false, `Obrázek je umístěný ${ALIGN_LABELS[img.position]}, má být ${ALIGN_LABELS[o.position]}.`);
      return r(true);
    }
    case 'caption': {
      const img = doc.find(b => b.type === 'image' && b.src === o.src);
      if (!img) return r(false, 'Obrázek zatím není vložený.');
      const words = normSpaces(img.caption).trim().split(/\s+/).filter(w => /[\p{L}\d]/u.test(w));
      if (words.length < (o.minWords || 2)) return r(false, `Popisek je příliš krátký – napiš aspoň ${o.minWords || 2} slova.`);
      const low = img.caption.toLocaleLowerCase('cs');
      if (o.mustInclude && !o.mustInclude.some(w => low.includes(w))) return r(false, `Popisek neříká, co je na obrázku (chybí slovo jako ${q(o.mustInclude[0])}).`);
      return r(true);
    }
    case 'typo': {
      const rule = TYPO[o.rule];
      const bad = doc.filter(b => isText(b) && (!o.blocks || o.blocks.includes(b.id))).find(b => !rule.test(normSpaces(b.text)));
      return r(!bad, bad ? `${rule.fail} Blok ${blockName(bad)}.` : '');
    }
    case 'contains': {
      const b = find(doc, o.block);
      return r(!!b && normSpaces(b.text).includes(o.text), `${blockName(b)} má obsahovat ${q(o.text)}.`);
    }
    case 'keepText':
      return r(textSignature(doc) === textSignature(initial), 'Text článku se změnil (něco chybí nebo přibylo). Oprav jen formát a mezery – případně použij Zpět nebo Nový pokus.');
    default:
      throw new Error('neznámý cíl ' + o.kind);
  }
}

/** Vyhodnotí všechny cíle mise. Ke každé misi se automaticky přidá kontrola zachování textu. */
export function evaluate(mission, doc, initial) {
  const objectives = [...mission.objectives];
  if (!mission.allowTextChanges) objectives.push({ kind: 'keepText', label: 'Text článku zůstal zachovaný' });
  const results = objectives.map(o => ({ ...evaluateObjective(o, doc, initial), kind: o.kind }));
  const passed = results.filter(x => x.ok).length;
  return { results, passed, total: results.length, done: passed === results.length };
}

/* ---------- Hodnocení mise ---------- */
/** Hvězdy 1–3: 3 = bez nápovědy a nejvýš 2 kontroly; 2 = nejvýš 1 nápověda nebo 4 kontroly; jinak 1. */
export function stars({ hints, checks }) {
  if (hints === 0 && checks <= 2) return 3;
  if (hints <= 1 || checks <= 4) return 2;
  return 1;
}
export function points({ total, hints }) {
  return total * 10 + (hints === 0 ? 20 : 0);
}
