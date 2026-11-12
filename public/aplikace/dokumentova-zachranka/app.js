/* Dokumentová záchranka – UI a editor.
   Pravda o dokumentu je v datovém modelu (model.js). DOM editoru se po každé změně vykreslí znovu
   z modelu; contenteditable slouží jen k psaní a výběru textu uvnitř jednoho bloku.
   Formátování, Zpět/Znovu, vkládání (jen čistý text) a Enter zachytáváme a převádíme na operace modelu. */
import * as M from './model.js';
import { evaluate, stars as starsFor, points as pointsFor } from './checks.js';
import { MISSIONS, ILLUSTRATIONS, DIFFICULTIES } from './missions.js';

const STORE_KEY = 'vyukovy-portal:dokumentova-zachranka:v1';
const $ = id => document.getElementById(id);
const IMG = id => `img/${id}.svg`;
const illustration = id => ILLUSTRATIONS.find(i => i.id === id);

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}

/* ================= Úložiště ================= */
function loadStore() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    return d && typeof d === 'object' && d.missions ? d : { missions: {}, unlockAll: false };
  } catch { return { missions: {}, unlockAll: false }; }
}
function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* bez úložiště se hraje dál */ } }
let store = loadStore();

/* ================= Stav ================= */
const S = {
  mission: null, initial: null, hist: null,
  sel: { id: null, start: 0, end: 0 }, // poslední výběr textu v dokumentu
  current: null,                      // id aktuálního bloku (kurzor / vybraný obrázek)
  hints: 0, checks: 0, lastResult: null, completed: false
};

/* ================= Přehled misí ================= */
const isUnlocked = i => store.unlockAll || new URLSearchParams(location.search).has('vse') || i === 0 || !!store.missions[MISSIONS[i - 1].id]?.done;

function renderHome() {
  const box = $('mission-groups');
  box.replaceChildren();
  for (const [diff, label] of Object.entries(DIFFICULTIES)) {
    const list = el('ol', { class: 'missions' });
    MISSIONS.forEach((m, i) => {
      if (m.difficulty !== diff) return;
      const rec = store.missions[m.id];
      const open = isUnlocked(i);
      const starsTxt = rec?.done ? '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars) : '';
      const status = rec?.done ? `Hotovo, ${rec.stars} z 3 hvězd` : open ? 'Odemčeno' : 'Zamčeno – nejdřív dokonči předchozí misi';
      const card = el('li', { class: 'mcard' + (rec?.done ? ' is-done' : '') + (open ? '' : ' is-locked') },
        el('span', { class: 'mcard__num', 'aria-hidden': 'true', text: String(i + 1) }),
        el('span', { class: 'mcard__body' },
          el('b', { class: 'mcard__title', text: m.title }),
          el('span', { class: 'mcard__story', text: m.story }),
          el('span', { class: 'mcard__status' }, rec?.done ? el('span', { class: 'mcard__stars', 'aria-hidden': 'true', text: starsTxt }) : null, ' ', status)),
        open
          ? el('button', { class: 'btn btn--primary btn--small', type: 'button', 'aria-label': `${rec?.done ? 'Zahrát znovu' : 'Spustit'} misi ${i + 1}: ${m.title}`, onclick: () => openMission(m.id) }, rec?.done ? 'Znovu' : 'Spustit')
          : el('span', { class: 'lock', 'aria-hidden': 'true', text: '🔒' }));
      list.append(card);
    });
    box.append(el('section', { class: 'group' }, el('h2', { text: label }), list));
  }
  const done = MISSIONS.filter(m => store.missions[m.id]?.done);
  const totalStars = done.reduce((s, m) => s + store.missions[m.id].stars, 0);
  const totalPoints = done.reduce((s, m) => s + store.missions[m.id].points, 0);
  $('progress-summary').textContent = `Dokončeno ${done.length} z ${MISSIONS.length} misí · hvězdy ${totalStars} z ${MISSIONS.length * 3} · body ${totalPoints}.`;
  $('hud-stars').textContent = String(totalStars);
  $('hud-points').textContent = String(totalPoints);
  $('opt-unlock').checked = !!store.unlockAll;
}

function showHome() {
  $('s-home').hidden = false;
  $('s-mission').hidden = true;
  $('hud-mission').hidden = true;
  $('btn-overview').hidden = true;
  S.mission = null;
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  renderHome();
  window.scrollTo({ top: 0 });
  $('home-h').focus?.();
}

/* ================= Mise ================= */
function openMission(id) {
  const i = MISSIONS.findIndex(m => m.id === id);
  if (i < 0 || !isUnlocked(i)) return showHome();
  const m = MISSIONS[i];
  S.mission = m;
  S.initial = M.fromSpec(m.initialDocument);
  S.hist = new M.History(S.initial);
  S.sel = { id: null, start: 0, end: 0 };
  S.current = S.initial[0].id;
  S.hints = 0; S.checks = 0; S.lastResult = null; S.completed = false;
  history.replaceState(null, '', `#${m.id}`);

  $('s-home').hidden = true;
  $('s-mission').hidden = false;
  $('btn-overview').hidden = false;
  $('hud-mission').hidden = false;
  $('hud-mission').textContent = `Mise ${i + 1}/${MISSIONS.length}`;
  $('m-level').textContent = DIFFICULTIES[m.difficulty];
  $('m-num').textContent = `Mise ${i + 1} z ${MISSIONS.length} · ${m.grade}. ročník`;
  $('m-title').textContent = m.title;
  $('m-story').textContent = m.story;
  $('m-instr').textContent = m.instructions;
  $('hints').replaceChildren(m.noHints ? el('p', { class: 'muted small', text: 'V této misi nápověda není. Kontrola ti řekne jen, kolik chyb zbývá.' }) : '');
  $('btn-hint').hidden = !!m.noHints;
  $('btn-hint').disabled = false;
  $('btn-hint').textContent = 'Ukázat nápovědu';
  $('results').replaceChildren(el('p', { class: 'muted small', text: 'Až budeš chtít, stiskni „Zkontrolovat práci“. Kontrolovat můžeš kolikrát chceš.' }));
  renderChecklist(null);
  render();
  renderLog();
  status('');
  window.scrollTo({ top: 0 });
  $('m-title').focus();
}

function renderChecklist(result) {
  const ul = $('checklist');
  ul.replaceChildren();
  const m = S.mission;
  if (m.noHints && !(result && result.done)) {
    // expertní mise: kontrolní seznam se neprozrazuje
    ul.append(el('li', { class: 'ck' }, el('span', { class: 'ck__mark', 'aria-hidden': 'true', text: '?' }),
      el('span', { text: result ? `Splněno ${result.passed} z ${result.total} kontrol. Najdi zbývající chyby.` : `Článek kontroluje ${m.objectives.length + 1} pravidel. Najdi a oprav všechny chyby.` })));
    return;
  }
  const items = result ? result.results : [...m.objectives, { label: 'Text článku zůstal zachovaný' }].map(o => ({ label: o.label, ok: null }));
  for (const r of items) {
    const state = r.ok === null ? 'todo' : r.ok ? 'ok' : 'bad';
    ul.append(el('li', { class: `ck ck--${state}` },
      el('span', { class: 'ck__mark', 'aria-hidden': 'true', text: state === 'ok' ? '✓' : state === 'bad' ? '!' : '○' }),
      el('span', {}, el('span', { class: 'sr-only', text: state === 'ok' ? 'Splněno: ' : state === 'bad' ? 'Zbývá: ' : '' }), r.label)));
  }
}

/* ================= Vykreslení dokumentu ================= */
function renderSegments(node, block) {
  for (const seg of M.segments(block)) {
    let n = document.createTextNode(seg.text);
    if (seg.marks & 4) n = el('u', {}, n);
    if (seg.marks & 2) n = el('em', {}, n);
    if (seg.marks & 1) n = el('strong', {}, n);
    node.append(n);
  }
  if (!block.text.length) node.append(document.createElement('br'));
}

/** Vykreslí dokument. editable = editor; jinak náhled (před/po, tisk). */
function renderDoc(doc, editable) {
  const frag = document.createDocumentFragment();
  for (const g of M.structure(doc)) {
    if (g.type === 'bulletedList' || g.type === 'numberedList') {
      const list = el(g.type === 'bulletedList' ? 'ul' : 'ol', { class: 'blk-list' });
      for (const it of g.items) list.append(textBlock('li', it, editable));
      frag.append(list);
    } else if (g.type === 'image') {
      const ill = illustration(g.src);
      const fig = el('figure', { class: `blk-img pos-${g.position}`, 'data-id': g.id, tabindex: editable ? '0' : null, 'aria-label': editable ? `Obrázek: ${ill?.label || g.src}` : null },
        el('img', { src: IMG(g.src), alt: ill?.label || '', width: '320', height: '200' }));
      const cap = el('figcaption', { 'data-caption': g.id });
      if (editable) {
        cap.contentEditable = 'true';
        cap.spellcheck = false;
        cap.setAttribute('aria-label', 'Popisek obrázku');
        cap.dataset.placeholder = 'Klikni a napiš popisek…';
      }
      cap.textContent = g.caption;
      fig.append(cap);
      frag.append(fig);
    } else {
      const tag = { heading1: 'h1', heading2: 'h2', paragraph: 'p' }[g.type];
      frag.append(textBlock(tag, g, editable));
    }
  }
  return frag;
}

function textBlock(tag, b, editable) {
  const n = el(tag, { class: `blk align-${b.align}`, 'data-id': b.id, 'data-label': M.TYPE_LABELS[b.type] });
  if (editable) {
    n.contentEditable = 'true';
    n.spellcheck = false;
    n.setAttribute('aria-label', `${M.TYPE_LABELS[b.type]}, zarovnání ${M.ALIGN_LABELS[b.align]}`);
    if (S.current === b.id) n.classList.add('is-current');
  }
  renderSegments(n, b);
  return n;
}

function render(restore) {
  const paper = $('paper');
  paper.replaceChildren(renderDoc(S.hist.doc, true));
  if (S.current) paper.querySelector(`[data-id="${S.current}"]`)?.classList.add('is-current');
  if (restore) restoreSelection(restore);
  updateToolbar();
}

/* ================= Výběr textu ↔ pozice znaků ================= */
function offsetsIn(node) {
  const s = getSelection();
  if (!s.rangeCount) return null;
  const r = s.getRangeAt(0);
  if (!node.contains(r.startContainer) || !node.contains(r.endContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(node);
  pre.setEnd(r.startContainer, r.startOffset);
  const start = pre.toString().length;
  pre.setEnd(r.endContainer, r.endOffset);
  return { start, end: pre.toString().length };
}

function pointAt(node, offset) {
  const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let left = offset, t;
  while ((t = w.nextNode())) {
    if (left <= t.length) return [t, left];
    left -= t.length;
  }
  return [node, node.childNodes.length];
}

function restoreSelection({ id, start, end, caption }) {
  const node = caption ? $('paper').querySelector(`[data-caption="${id}"]`) : $('paper').querySelector(`.blk[data-id="${id}"]`);
  if (!node) return;
  node.focus({ preventScroll: true });
  const r = document.createRange();
  const [a, ao] = pointAt(node, start);
  const [b, bo] = pointAt(node, end ?? start);
  r.setStart(a, ao);
  r.setEnd(b, bo);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}

function blockOf(node) {
  const n = node && (node.nodeType === 1 ? node : node.parentElement);
  return n ? n.closest('#paper [data-id]') : null;
}

document.addEventListener('selectionchange', () => {
  if (!S.mission) return;
  const s = getSelection();
  if (!s.rangeCount) return;
  const blk = blockOf(s.anchorNode);
  if (!blk || !$('paper').contains(blk)) return;
  const id = blk.dataset.id;
  if (blk.classList.contains('blk')) {
    const o = offsetsIn(blk);
    if (o) S.sel = { id, start: Math.min(o.start, o.end), end: Math.max(o.start, o.end) };
  }
  setCurrent(id);
});

function setCurrent(id) {
  if (S.current === id) return updateToolbar();
  S.current = id;
  for (const n of $('paper').querySelectorAll('.is-current')) n.classList.remove('is-current');
  $('paper').querySelector(`[data-id="${id}"]`)?.classList.add('is-current');
  updateToolbar();
}

/* ================= Změny dokumentu ================= */
function commit(doc, label, key = null, restore = null) {
  if (doc === S.hist.doc) return false;
  S.hist.push(doc, label, key);
  render(restore);
  renderLog();
  return true;
}

function status(text) { $('status').textContent = text; }

function currentBlock() { return S.current ? M.find(S.hist.doc, S.current) : null; }

function applyMark(mark) {
  const { id, start, end } = S.sel;
  const b = id && M.find(S.hist.doc, id);
  if (!b || !M.isText(b) || end <= start) {
    status('Nejdřív myší (nebo Shift + šipkami) označ text, který chceš zvýraznit.');
    return;
  }
  const had = M.rangeHasMark(b, start, end, mark);
  const label = `${had ? 'Zrušeno' : M.MARK_LABELS[mark][0].toUpperCase() + M.MARK_LABELS[mark].slice(1)}: „${M.shortText(b.text.slice(start, end), 28)}“`;
  commit(M.toggleMark(S.hist.doc, id, start, end, mark), label, null, { id, start, end });
  status(label);
}

function applyStyle(type) {
  const b = currentBlock();
  if (!M.isText(b)) return status('Klikni do odstavce, kterému chceš změnit styl.');
  commit(M.setType(S.hist.doc, b.id, type), `${M.TYPE_LABELS[type]}: „${M.shortText(b.text)}“`, null, caretRestore(b.id));
}

function applyList(type) {
  const b = currentBlock();
  if (!M.isText(b)) return status('Klikni do řádku, který má být položkou seznamu.');
  const off = b.type === type;
  commit(M.toggleList(S.hist.doc, b.id, type), `${off ? 'Zrušen seznam' : type === 'bullet' ? 'Odrážka' : 'Číslování'}: „${M.shortText(b.text)}“`, null, caretRestore(b.id));
}

function applyAlign(align) {
  const b = currentBlock();
  if (!b) return status('Klikni do odstavce nebo vyber obrázek.');
  if (b.type === 'image') {
    if (align === 'justify') return status('Obrázek můžeš umístit vlevo, na střed nebo vpravo.');
    commit(M.setImage(S.hist.doc, b.id, { position: align }), `Obrázek ${M.ALIGN_LABELS[align]}`);
    focusFigure(b.id);
    return;
  }
  commit(M.setAlign(S.hist.doc, b.id, align), `Zarovnání ${M.ALIGN_LABELS[align]}: „${M.shortText(b.text)}“`, null, caretRestore(b.id));
}

function moveCurrent(delta) {
  const b = currentBlock();
  if (!b) return status('Klikni do odstavce, který chceš přesunout.');
  const doc = M.move(S.hist.doc, b.id, delta);
  if (doc === S.hist.doc) return status(delta < 0 ? 'Blok už je úplně nahoře.' : 'Blok už je úplně dole.');
  commit(doc, `Přesun ${delta < 0 ? 'nahoru' : 'dolů'}: „${M.shortText(b.type === 'image' ? 'obrázek' : b.text)}“`, null, b.type === 'image' ? null : caretRestore(b.id));
  if (b.type === 'image') focusFigure(b.id);
  $('paper').querySelector(`[data-id="${b.id}"]`)?.scrollIntoView({ block: 'nearest' });
}

function caretRestore(id) {
  const keep = S.sel.id === id ? S.sel : { id, start: 0, end: 0 };
  return { id, start: keep.start, end: keep.end };
}
function focusFigure(id) { $('paper').querySelector(`figure[data-id="${id}"]`)?.focus(); }

function doUndo() {
  const l = S.hist.undo();
  if (l === null) return status('Není co vrátit.');
  afterHistory(`Vráceno: ${l}`);
}
function doRedo() {
  const l = S.hist.redo();
  if (l === null) return status('Není co zopakovat.');
  afterHistory(`Zopakováno: ${l}`);
}
function afterHistory(msg) {
  if (!M.find(S.hist.doc, S.current)) S.current = S.hist.doc[0]?.id;
  render();
  renderLog();
  status(msg);
}

function insertImage(src) {
  const after = S.current && M.find(S.hist.doc, S.current) ? S.current : S.hist.doc[S.hist.doc.length - 1].id;
  const doc = M.insertImage(S.hist.doc, after, src);
  const id = doc.find(b => b.type === 'image' && !M.find(S.hist.doc, b.id)).id;
  S.current = id;
  commit(doc, `Vložen obrázek: ${illustration(src).label}`);
  focusFigure(id);
  status('Obrázek je vložený. Klikni pod něj a napiš popisek; umístění změníš tlačítky zarovnání.');
}

function removeImage() {
  const b = currentBlock();
  if (!b || b.type !== 'image') return status('Nejdřív klikni na obrázek, který chceš odebrat.');
  const i = S.hist.doc.indexOf(b);
  S.current = S.hist.doc[Math.max(0, i - 1)].id;
  commit(M.removeBlock(S.hist.doc, b.id), 'Odebrán obrázek');
}

/* ================= Psaní v editoru ================= */
const paper = $('paper');

paper.addEventListener('beforeinput', e => {
  const t = e.inputType;
  if (t === 'insertParagraph' || t === 'insertLineBreak') {
    e.preventDefault();
    status('Nový odstavec v této hře nevytváříš – opravuješ existující bloky.');
  } else if (t === 'formatBold' || t === 'formatItalic' || t === 'formatUnderline') {
    e.preventDefault();
    applyMark({ formatBold: 'b', formatItalic: 'i', formatUnderline: 'u' }[t]);
  } else if (t === 'historyUndo' || t === 'historyRedo') {
    e.preventDefault();
    (t === 'historyUndo' ? doUndo : doRedo)();
  } else if (t === 'insertFromPaste' || t === 'insertFromDrop' || t === 'insertReplacementText') {
    // jen čistý text, nikdy cizí HTML
    e.preventDefault();
    const text = (e.dataTransfer?.getData('text/plain') || e.data || '').replace(/[\r\n\t]+/g, ' ');
    if (!text) return;
    insertPlain(e.target, text);
  } else if (t === 'deleteByDrag' || t.startsWith('format')) {
    e.preventDefault();
  }
});

paper.addEventListener('paste', e => {
  // pojistka pro prohlížeče bez beforeinput insertFromPaste
  e.preventDefault();
  const text = (e.clipboardData?.getData('text/plain') || '').replace(/[\r\n\t]+/g, ' ');
  if (text) insertPlain(e.target, text);
});
paper.addEventListener('drop', e => e.preventDefault());

function insertPlain(target, text) {
  const cap = target.closest?.('[data-caption]');
  if (cap) {
    const o = offsetsIn(cap) || { start: cap.textContent.length, end: cap.textContent.length };
    const v = cap.textContent.slice(0, o.start) + text + cap.textContent.slice(o.end);
    const id = cap.dataset.caption;
    commit(M.setImage(S.hist.doc, id, { caption: v }), 'Popisek obrázku', `cap:${id}`, { id, start: o.start + text.length, caption: true });
    return;
  }
  const blk = blockOf(target);
  if (!blk || !blk.classList.contains('blk')) return;
  const o = offsetsIn(blk) || { start: S.sel.start, end: S.sel.end };
  const id = blk.dataset.id;
  commit(M.insertText(S.hist.doc, id, o.start, o.end, text), `Vložen text: „${M.shortText(text, 20)}“`, null, { id, start: o.start + text.length });
}

let composing = false;
paper.addEventListener('compositionstart', () => { composing = true; });
paper.addEventListener('compositionend', e => { composing = false; syncFromDom(e.target); });
paper.addEventListener('input', e => { if (!composing) syncFromDom(e.target); });

/** Přečte text upraveného bloku z DOM a promítne ho do modelu (rozdíl, zachování značek). */
function syncFromDom(target) {
  const cap = target.closest?.('[data-caption]');
  if (cap) {
    const id = cap.dataset.caption;
    const o = offsetsIn(cap) || { start: cap.textContent.length };
    commit(M.setImage(S.hist.doc, id, { caption: cap.textContent }), 'Popisek obrázku', `cap:${id}`, { id, start: o.start, caption: true });
    return;
  }
  const blk = blockOf(target);
  if (!blk || !blk.classList.contains('blk')) return;
  const id = blk.dataset.id;
  const o = offsetsIn(blk) || { start: 0 };
  const text = blk.textContent.replace(/​/g, '');
  const before = M.find(S.hist.doc, id);
  const doc = M.replaceText(S.hist.doc, id, text);
  if (doc === S.hist.doc) return render({ id, start: o.start, end: o.end });
  S.sel = { id, start: o.start, end: o.start };
  commit(doc, `Úprava textu: „${M.shortText(before.text, 24)}“`, `type:${id}`, { id, start: o.start, end: o.start });
}

paper.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  const k = (e.key || '').toLowerCase();
  if (e.key === 'Enter') { e.preventDefault(); status('Nový odstavec v této hře nevytváříš – opravuješ existující bloky.'); return; }
  if (mod && !e.altKey && (k === 'b' || k === 'i' || k === 'u' || ['KeyB', 'KeyI', 'KeyU'].includes(e.code))) {
    e.preventDefault();
    applyMark(k === 'b' || e.code === 'KeyB' ? 'b' : k === 'i' || e.code === 'KeyI' ? 'i' : 'u');
    return;
  }
  if (e.altKey && e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    moveCurrent(e.key === 'ArrowUp' ? -1 : 1);
    return;
  }
  // obrázek vybraný klávesnicí: Delete ho odebere
  if (e.target.matches('figure[data-id]') && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); removeImage(); }
});

// Zpět/Znovu fungují v celé misi (mimo běžná textová pole formulářů)
document.addEventListener('keydown', e => {
  if (!S.mission || $('s-mission').hidden || document.querySelector('dialog[open]')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (!mod || e.altKey) return;
  const k = (e.key || '').toLowerCase();
  const undo = (k === 'z' || e.code === 'KeyZ') && !e.shiftKey;
  const redo = k === 'y' || e.code === 'KeyY' || ((k === 'z' || e.code === 'KeyZ') && e.shiftKey);
  if (!undo && !redo) return;
  if (e.target.matches('input, select, textarea')) return;
  e.preventDefault();
  (undo ? doUndo : doRedo)();
});

paper.addEventListener('focusin', e => {
  const fig = e.target.closest('figure[data-id]');
  if (fig) setCurrent(fig.dataset.id);
});
paper.addEventListener('mousedown', e => {
  const fig = e.target.closest('figure[data-id]');
  if (fig && !e.target.closest('figcaption')) setCurrent(fig.dataset.id);
});

/* ================= Panel nástrojů ================= */
const toolbar = $('toolbar');
// tlačítka nesmí vzít editoru výběr textu
toolbar.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
toolbar.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.mark) applyMark(b.dataset.mark);
  else if (b.dataset.align) applyAlign(b.dataset.align);
  else if (b.dataset.list) applyList(b.dataset.list);
  else if (b.id === 'tb-up') moveCurrent(-1);
  else if (b.id === 'tb-down') moveCurrent(1);
  else if (b.id === 'tb-undo') doUndo();
  else if (b.id === 'tb-redo') doRedo();
  else if (b.id === 'tb-image') $('dlg-img').showModal();
  else if (b.id === 'tb-remove') removeImage();
});
$('tb-style').addEventListener('change', e => applyStyle(e.target.value));

function updateToolbar() {
  if (!S.hist) return;
  const b = currentBlock();
  const text = M.isText(b);
  const sel = S.sel.id === b?.id && S.sel.end > S.sel.start ? S.sel : null;
  const style = $('tb-style');
  style.disabled = !text;
  style.value = text ? b.type : 'paragraph';
  for (const btn of toolbar.querySelectorAll('[data-mark]')) {
    btn.setAttribute('aria-pressed', String(!!(text && sel && M.rangeHasMark(b, sel.start, sel.end, btn.dataset.mark))));
  }
  for (const btn of toolbar.querySelectorAll('[data-align]')) {
    const v = b?.type === 'image' ? b.position : b?.align;
    btn.setAttribute('aria-pressed', String(v === btn.dataset.align));
    btn.disabled = b?.type === 'image' && btn.dataset.align === 'justify';
  }
  for (const btn of toolbar.querySelectorAll('[data-list]')) {
    btn.setAttribute('aria-pressed', String(!!(text && b.type === btn.dataset.list)));
    btn.disabled = !text;
  }
  $('tb-remove').disabled = b?.type !== 'image';
  $('tb-undo').disabled = !S.hist.canUndo;
  $('tb-redo').disabled = !S.hist.canRedo;
}

function renderLog() {
  const ol = $('log');
  ol.replaceChildren(...S.hist.log.slice(-12).map(l => el('li', { text: l })));
  if (!S.hist.log.length) ol.append(el('li', { class: 'muted', text: 'Zatím žádné úpravy.' }));
}

/* ================= Nápověda, kontrola, dokončení ================= */
$('btn-hint').addEventListener('click', () => {
  const m = S.mission;
  if (m.noHints || S.hints >= m.hints.length) return;
  const levels = ['Princip', 'Kde hledat', 'Postup'];
  $('hints').append(el('p', { class: 'hint' }, el('b', { text: `${S.hints + 1}. ${levels[S.hints]}: ` }), m.hints[S.hints]));
  S.hints++;
  if (S.hints >= m.hints.length) { $('btn-hint').disabled = true; $('btn-hint').textContent = 'Všechny nápovědy použity'; }
  else $('btn-hint').textContent = 'Další nápověda';
});

$('btn-check').addEventListener('click', check);

function check() {
  const m = S.mission;
  S.checks++;
  const r = evaluate(m, S.hist.doc, S.initial);
  S.lastResult = r;
  renderChecklist(r);
  const box = $('results');
  box.replaceChildren();
  box.append(el('p', { class: 'score ' + (r.done ? 'is-good' : 'is-bad') },
    el('span', { 'aria-hidden': 'true', text: r.done ? '✓ ' : '! ' }),
    el('b', { text: r.done ? 'Všechno sedí!' : `Splněno ${r.passed} z ${r.total}.` }),
    r.done ? '' : ` Kontrola č. ${S.checks}.`));
  if (!m.noHints || r.done) {
    const ul = el('ul', { class: 'res' });
    for (const x of r.results.filter(x => !x.ok)) ul.append(el('li', {}, el('b', { text: x.label + ': ' }), x.detail));
    if (ul.childElementCount) box.append(el('p', { class: 'small', text: 'Co ještě zbývá:' }), ul);
  } else {
    box.append(el('p', { class: 'small', text: `Zbývá opravit ${r.total - r.passed} ${r.total - r.passed === 1 ? 'chybu' : r.total - r.passed < 5 ? 'chyby' : 'chyb'}. Kde jsou, musíš najít sám.` }));
  }
  if (r.done && !S.completed) complete(r);
}

function complete(r) {
  S.completed = true;
  const m = S.mission;
  const st = starsFor({ hints: S.hints, checks: S.checks });
  const pt = pointsFor({ total: r.total, hints: S.hints });
  const prev = store.missions[m.id];
  const better = !prev?.done || st > prev.stars || (st === prev.stars && pt > prev.points);
  if (better) store.missions[m.id] = { done: true, stars: st, points: pt, hints: S.hints, checks: S.checks };
  saveStore();
  renderHome();

  $('done-stars').replaceChildren(el('span', { 'aria-hidden': 'true', text: '★'.repeat(st) + '☆'.repeat(3 - st) }), el('span', { class: 'sr-only', text: `${st} ze 3 hvězd` }));
  $('done-stats').textContent = `Body: ${pt}. Kontrol: ${S.checks}. Nápověd: ${S.hints}.` + (S.hints === 0 ? ' Ocenění: zvládnuto bez nápovědy!' : '');
  $('done-rule').textContent = m.successExplanation;
  $('done-before').replaceChildren(renderDoc(S.initial, false));
  $('done-after').replaceChildren(renderDoc(S.hist.doc, false));
  const i = MISSIONS.indexOf(m);
  $('btn-next').hidden = i >= MISSIONS.length - 1;
  $('dlg-done').showModal();
  ($('btn-next').hidden ? $('btn-done-overview') : $('btn-next')).focus();
}

$('btn-next').addEventListener('click', () => {
  $('dlg-done').close();
  const i = MISSIONS.indexOf(S.mission);
  openMission(MISSIONS[i + 1].id);
});
$('btn-stay').addEventListener('click', () => $('dlg-done').close());
$('btn-done-overview').addEventListener('click', () => { $('dlg-done').close(); showHome(); });

$('btn-instr').addEventListener('click', () => {
  $('dlg-instr-h').textContent = S.mission.title;
  $('dlg-instr-story').textContent = S.mission.story;
  $('dlg-instr-text').textContent = S.mission.instructions;
  $('dlg-instr').showModal();
});
$('btn-restart').addEventListener('click', () => {
  S.current = S.initial[0].id;
  S.sel = { id: null, start: 0, end: 0 };
  if (commit(S.initial, 'Nový pokus')) status('Dokument je jako na začátku. Tlačítkem Zpět se můžeš vrátit k předchozí verzi.');
  else status('Dokument už je v původním stavu.');
});
$('btn-overview').addEventListener('click', showHome);

/* Výběr ilustrace */
$('pick').append(...ILLUSTRATIONS.map(i => el('button', { type: 'button', class: 'pick__item', onclick: () => { $('dlg-img').close(); insertImage(i.id); } },
  el('img', { src: IMG(i.id), alt: '', width: '160', height: '100' }), el('span', { text: i.label }))));

/* ================= Export ================= */
$('btn-print').addEventListener('click', () => {
  const root = $('print-root');
  root.replaceChildren(el('article', { class: 'paper paper--print' }, renderDoc(S.hist.doc, false)));
  document.body.classList.add('is-printing');
  window.print();
  setTimeout(() => document.body.classList.remove('is-printing'), 0);
});
window.addEventListener('afterprint', () => document.body.classList.remove('is-printing'));

$('btn-html').addEventListener('click', async () => {
  const art = el('article', {}, renderDoc(S.hist.doc, false));
  // obrázky vložíme přímo do souboru (data URI), aby šel otevřít offline
  for (const img of art.querySelectorAll('img')) {
    try {
      const svg = await (await fetch(img.getAttribute('src'))).text();
      img.setAttribute('src', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    } catch { /* necháme relativní cestu */ }
  }
  const css = 'body{font:16px/1.6 "Segoe UI",system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#132a32}h1{font-size:2rem}h2{font-size:1.4rem}.align-center{text-align:center}.align-right{text-align:right}.align-justify{text-align:justify}figure{margin:1rem 0}figure img{max-width:100%;height:auto}.pos-center{text-align:center}.pos-left{text-align:left}.pos-right{text-align:right}figcaption{font-size:.9rem;color:#52656d}';
  const title = S.hist.doc.find(b => b.type === 'heading1')?.text || S.mission.title;
  const html = `<!doctype html>\n<html lang="cs">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(title)}</title>\n<style>${css}</style>\n</head>\n<body>\n${art.innerHTML}\n</body>\n</html>\n`;
  const a = el('a', { href: URL.createObjectURL(new Blob([html], { type: 'text/html' })), download: `${S.mission.id}.html` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  status('Dokument je stažený jako HTML. Otevřeš ho v prohlížeči nebo ve Wordu (Soubor → Otevřít).');
});
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* ================= Přehled: nastavení a reset ================= */
$('opt-unlock').addEventListener('change', e => { store.unlockAll = e.target.checked; saveStore(); renderHome(); });
function askReset() {
  $('reset-box').replaceChildren(
    el('p', { class: 'warn', text: 'Opravdu smazat postup Dokumentové záchranky v tomto prohlížeči? Ostatní hry zůstanou beze změny.' }),
    el('button', { class: 'btn btn--warn btn--small', type: 'button', id: 'btn-reset-yes', onclick: () => {
      store = { missions: {}, unlockAll: false };
      try { localStorage.removeItem(STORE_KEY); } catch { /* nic */ }
      restoreReset(); renderHome(); $('btn-reset').focus();
    } }, 'Ano, smazat'),
    el('button', { class: 'btn btn--ghost btn--small', type: 'button', onclick: () => { restoreReset(); $('btn-reset').focus(); } }, 'Ne'));
  $('btn-reset-yes').focus();
}
function restoreReset() {
  $('reset-box').replaceChildren(el('button', { class: 'btn btn--ghost btn--small', id: 'btn-reset', type: 'button', onclick: askReset }, 'Smazat postup této hry'));
}
$('btn-reset').addEventListener('click', askReset);

/* ================= Start ================= */
renderHome();
const fromHash = decodeURIComponent(location.hash.slice(1));
if (fromHash && MISSIONS.some(m => m.id === fromHash)) openMission(fromHash);
window.addEventListener('hashchange', () => {
  const id = decodeURIComponent(location.hash.slice(1));
  if (id && id !== S.mission?.id && MISSIONS.some(m => m.id === id)) openMission(id);
});
