// Psací azbuka – ovládání stránky. Logika převodu je v logic.js, psaní sadou písmen v handwriting.js (obojí bez DOM).
import * as L from './logic.js';
import * as H from './handwriting.js';

const STORAGE_KEY = 'vyukovy-portal:psaci-azbuka:v1';
const SAMPLE = 'Привет! Меня зовут Анна.\nЯ живу в Праге.';
const INK = '#14213d';
const FALLBACK = 'Bad Script';            // číslice a interpunkce (v sadě písmen nejsou)
const PENS = [
  [INK, 'tmavě modrá (pero)'], ['#000000', 'černá'], ['#1d4ed8', 'modrá'],
  ['#b91c1c', 'červená'], ['#15803d', 'zelená'], ['#7e22ce', 'fialová']
];
// Rukopisy: semínko odchylek, jejich síla a sklon navíc (kladný = víc nakloněné).
const HANDS = [
  { id: 'r1', name: 'Rukopis 1 – klidný', seed: 3, jitter: 0.7, lean: 0 },
  { id: 'r2', name: 'Rukopis 2 – pečlivý', seed: 11, jitter: 0.9, lean: 0.04 },
  { id: 'r3', name: 'Rukopis 3 – nakloněný', seed: 23, jitter: 1, lean: 0.12 },
  { id: 'r4', name: 'Rukopis 4 – rovnější', seed: 31, jitter: 1, lean: -0.1 },
  { id: 'r5', name: 'Rukopis 5 – živý', seed: 47, jitter: 1.6, lean: 0.02 },
  { id: 'r6', name: 'Rukopis 6 – spěchající', seed: 59, jitter: 2, lean: 0.14 },
  { id: 'r7', name: 'Rukopis 7 – vzpřímený', seed: 71, jitter: 1.2, lean: -0.18 },
  { id: 'r8', name: 'Rukopis 8 – rozverný', seed: 89, jitter: 2.4, lean: 0 }
];
const HAND_SAMPLE = 'Мама мыла раму';
const $ = id => document.getElementById(id);

const els = {
  text: $('text'), mirror: $('mirror'), help: $('mode-help'), canvas: $('preview'), box: $('preview-wrap'), feedback: $('feedback'),
  kbd: $('kbd'), kbdShift: $('kbd-shift'), pens: $('pens'), colorAll: $('btn-color-all'),
  size: $('opt-size'), pen: $('opt-pen'), lines: $('opt-lines'), spacing: $('opt-spacing'), scale: $('opt-scale'),
  wrap: $('opt-wrap'), transparent: $('opt-transparent'), handsWrap: $('hands-wrap'), hands: $('hands'),
  sizeInfo: $('size-info'), setFile: $('set-file'), setStatus: $('set-status'), setRemove: $('btn-set-remove'), useCustom: $('opt-custom')
};
let glyphSet = null;                       // vlastní nahraná sada písmen (píše se jí jen po zapnutí volby)
let builtinSet = null;                     // vestavěná Písanka Školeeq (sada-skoleeq.json)
let builtinLoading = null;
const state = { colors: [], prevText: '', ink: INK, look: 'print', hand: HANDS[0].id };
const SETTINGS = ['size', 'pen', 'lines', 'spacing', 'scale'];
const SWITCHES = ['wrap', 'transparent', 'useCustom'];

const HELP = {
  phonetic: 'Piš latinkou podle výslovnosti: č = ч, š = ш, ž = ж, ch = х, c = ц, y = ы, šč = щ, ja = я, ju = ю, jo = ё, é = э, q = ь, Shift+Q = ъ. Čísla a interpunkce píšeš jako obvykle. Text azbukou sem můžeš i vložit (Ctrl + V).',
  ytsuken: 'Klávesy fungují jako na ruské klávesnici ЙЦУКЕН (rozložení najdeš v písmenech na obrazovce). Tečka je na klávese pomlčky, čárka se Shiftem.'
};

// ---------- Uložení (jen localStorage, vždy v try/catch) ----------
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const data = {
      text: els.text.value, colors: L.toRuns(state.colors), ink: state.ink, mode: mode(), look: state.look, hand: state.hand, glyphSet
    };
    for (const k of SETTINGS) data[k] = els[k].value;
    for (const k of SWITCHES) data[k] = els[k].checked;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* soukromý režim nebo plné úložiště */ }
  }, 300);
}

const mode = () => document.querySelector('input[name="mode"]:checked')?.value || 'phonetic';

// ---------- Vkládání textu ----------
function insertAtCursor(ins, del = 0) {
  const t = els.text;
  let start = t.selectionStart, end = t.selectionEnd;
  if (start === end && del) start = Math.max(0, start - del);
  t.setRangeText(ins, start, end, 'end');
  t.dispatchEvent(new Event('input', { bubbles: true }));
}

// Fonetický režim: beforeinput funguje pro fyzickou i dotykovou klávesnici.
els.text.addEventListener('beforeinput', e => {
  if (mode() !== 'phonetic' || e.inputType !== 'insertText' || !e.data || e.isComposing) return;
  const t = els.text;
  let before = t.value.slice(0, t.selectionStart);
  if (t.selectionStart !== t.selectionEnd) before = '';
  let out = '', del = 0, changed = false;
  for (const ch of e.data) {
    const step = L.phoneticStep((before + out).slice(-1), ch);
    if (!step) { out += ch; continue; }
    changed = true;
    if (step.del > out.length) { del += step.del - out.length; before = before.slice(0, before.length - (step.del - out.length)); out = ''; }
    else out = out.slice(0, out.length - step.del);
    out += step.ins;
  }
  if (!changed) return;
  e.preventDefault();
  insertAtCursor(out, del);
});

// Režim ЙЦУКЕН: rozhoduje fyzická klávesa (event.code), ne české rozložení.
els.text.addEventListener('keydown', e => {
  if (mode() !== 'ytsuken' || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  const ch = L.ytsukenChar(e.code, e.shiftKey, e.getModifierState?.('CapsLock'));
  if (!ch) return;
  e.preventDefault();
  insertAtCursor(ch);
  flashKey(e.code);
});

// ---------- Barevný text v editoru ----------
// Textové pole je průhledné a pod ním leží „zrcadlo“ se stejným textem obarveným po úsecích.
function renderMirror() {
  const v = els.text.value;
  const frag = document.createDocumentFragment();
  let i = 0;
  for (const [len, color] of L.toRuns(state.colors)) {
    const span = document.createElement('span');
    span.style.color = color;
    span.textContent = v.slice(i, i + len);
    frag.append(span);
    i += len;
  }
  frag.append(document.createTextNode(v.endsWith('\n') || !v ? ' ' : ''));
  els.mirror.replaceChildren(frag);
}
function autoGrow() {
  const t = els.text;
  t.style.height = 'auto';
  t.style.height = `${t.scrollHeight + 4}px`;
}
function onTextChange() {
  state.colors = L.spliceColors(state.colors, state.prevText, els.text.value, state.ink);
  state.prevText = els.text.value;
  renderMirror();
  autoGrow();
}

function buildPens() {
  els.pens.replaceChildren();
  for (const [color, name] of PENS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pen';
    b.dataset.color = color;
    b.style.setProperty('--pen', color);
    b.setAttribute('aria-label', `Barva: ${name}`);
    b.title = name;
    b.addEventListener('click', () => pickInk(color));
    els.pens.append(b);
  }
  markInk();
}
function markInk() {
  for (const b of els.pens.children) b.setAttribute('aria-pressed', String(b.dataset.color === state.ink));
}
/** Barva pera: obarví označený text a platí pro další psaní. */
function pickInk(color) {
  const t = els.text;
  state.ink = color;
  markInk();
  const { selectionStart: a, selectionEnd: b } = t;
  if (a !== b) {
    for (let i = a; i < b; i++) state.colors[i] = color;
    renderMirror();
    render();
  }
  t.focus();
  t.setSelectionRange(a, b);
  save();
}
els.colorAll.addEventListener('click', () => {
  state.colors = state.colors.map(() => state.ink);
  renderMirror(); render(); save();
});

// ---------- Písmena na obrazovce ----------
function buildKeyboard() {
  els.kbd.replaceChildren();
  const upper = els.kbdShift.checked;
  const rows = mode() === 'ytsuken'
    ? L.YTSUKEN_ROWS.map(r => r.filter(([, base]) => L.ALPHABET.includes(base)).map(([code, base, , cap]) => ({ ch: base, hint: cap, code })))
    : [[...L.ALPHABET].map(ch => ({ ch, hint: L.PHONETIC_HINT[ch] }))];
  for (const row of rows) {
    const div = document.createElement('div');
    div.className = 'kbd__row';
    for (const k of row) {
      const ch = upper ? k.ch.toUpperCase() : k.ch;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'key';
      if (k.code) b.dataset.code = k.code;
      b.setAttribute('aria-label', `Vložit ${ch}`);
      b.append(document.createTextNode(ch));
      if (k.hint) { const s = document.createElement('small'); s.textContent = k.hint; s.setAttribute('aria-hidden', 'true'); b.append(s); }
      b.addEventListener('click', () => { insertAtCursor(ch); });
      div.append(b);
    }
    els.kbd.append(div);
  }
}
function flashKey(code) {
  const b = els.kbd.querySelector(`[data-code="${code}"]`);
  if (!b) return;
  b.classList.add('is-pressed');
  setTimeout(() => b.classList.remove('is-pressed'), 150);
}

// ---------- Vykreslení psacího písma ----------
const currentHand = () => (state.look === 'hand' ? HANDS.find(h => h.id === state.hand) || HANDS[0] : null);
const handParams = hand => (hand ? { seed: hand.seed, jitter: hand.jitter, slant: -hand.lean } : { seed: 1, jitter: 0, slant: 0 });
const colorAt = i => state.colors[i] || state.ink;

/** Šířka, do které se text zalamuje (px): šířka náhledu bez okrajů rámečku. */
function availableWidth() {
  if (!els.wrap.checked) return Infinity;
  const cs = getComputedStyle(els.box);
  return Math.max(200, els.box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
}
const opts = () => ({
  size: Number(els.size.value), penScale: Number(els.pen.value), lines: els.lines.value, spacing: Number(els.spacing.value),
  transparent: els.transparent.checked, hand: currentHand(), maxWidth: availableWidth()
});

// Záložní kreslení písmem Bad Script (než se sada načte, nebo když se nenačte vůbec).
function fontLayout(ctx, text, o) {
  const fontCss = `${o.size}px "${FALLBACK}"`;
  ctx.font = fontCss;
  const pad = Math.round(o.size * 0.35);
  const wrapped = L.wrapText(text, s => ctx.measureText(s).width, o.maxWidth - 2 * pad);
  const lines = wrapped.split('\n');
  const measure = s => {
    const m = ctx.measureText(s);
    return { ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent, left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight };
  };
  const lay = L.layoutLines(lines, measure, { size: o.size, spacing: o.spacing });
  lay.xHeight = ctx.measureText('х').actualBoundingBoxAscent || o.size * 0.45;
  lay.capHeight = ctx.measureText('Ш').actualBoundingBoxAscent || o.size * 0.7;
  lay.paint = () => {
    ctx.font = fontCss;
    ctx.textBaseline = 'alphabetic';
    let offset = 0;
    lines.forEach((line, li) => {
      let x = lay.x;
      for (let k = 0; k < line.length; k++) {
        ctx.fillStyle = colorAt(offset + k);
        ctx.fillText(line[k], x, lay.baselines[li]);
        x += ctx.measureText(line[k]).width;
      }
      offset += line.length + 1;
    });
  };
  return lay;
}

// Rozvržení sadou písmen. Znaky mimo sadu (čísla, interpunkce) píše tenké Bad Script.
function handLayout(ctx, text, o, set) {
  const u = o.size * 0.42;                       // střední výška v px
  ctx.font = `${o.size}px "${FALLBACK}"`;
  const fbX = (ctx.measureText('х').actualBoundingBoxAscent || o.size * 0.4) / o.size;
  const fbSize = (u / fbX) * 0.9;
  ctx.font = `${fbSize}px "${FALLBACK}"`;
  const fallbackWidth = ch => ctx.measureText(ch).width / u;
  const pad = Math.round(u * 0.6);
  const params = handParams(o.hand);
  const wrapped = L.wrapText(text, line => H.layout(line, set, { jitter: 0, slant: params.slant, fallbackWidth }).lines[0].width,
    (o.maxWidth - 2 * pad) / u - 0.1);
  const hl = H.layout(wrapped, set, { ...params, fallbackWidth });
  const lineH = Math.max(o.spacing * o.size, u * 3.4);
  const top = Math.min(-2.1, ...hl.lines.map(l => l.top));
  const baselines = hl.lines.map((_, i) => pad + -top * u + i * lineH);
  const last = hl.lines[hl.lines.length - 1];
  const height = Math.ceil(baselines[baselines.length - 1] + Math.max(0.4, last.bottom) * u + pad);
  const width = Math.ceil(Math.max(1, ...hl.lines.map(l => l.width)) * u + 2 * pad);
  return {
    width, height, baselines, xHeight: u, capHeight: 2 * u,
    paint: () => hl.lines.forEach((l, i) => H.drawLine(ctx, l, {
      ox: pad, baseline: baselines[i], u, color: state.ink, colorOf: colorAt, pen: hl.pen * o.penScale,
      drawText: (ch, x, y, c) => { ctx.font = `${fbSize}px "${FALLBACK}"`; ctx.fillStyle = c; ctx.fillText(ch, x, y); }
    }))
  };
}

const usingCustom = () => !!glyphSet && els.useCustom.checked;
const activeSet = () => (usingCustom() ? glyphSet : builtinSet);

/** Vestavěnou sadu stáhne jen jednou. */
function loadBuiltin() {
  builtinLoading ||= fetch('sada-skoleeq.json')
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then(set => { if (!H.validateSet(set).length) builtinSet = set; })
    .catch(() => { /* bez sítě zůstane záložní písmo */ });
  return builtinLoading;
}

function draw(canvas, scale, o = opts()) {
  const ctx = canvas.getContext('2d');
  const text = els.text.value.replace(/\s+$/, '') || ' ';
  const set = activeSet();
  const lay = set ? handLayout(ctx, text, o, set) : fontLayout(ctx, text, o);

  canvas.width = Math.max(1, Math.round(lay.width * scale));
  canvas.height = Math.max(1, Math.round(lay.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, lay.width, lay.height);
  if (!o.transparent) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, lay.width, lay.height); }

  if (o.lines !== 'none') {
    const thin = Math.max(1, o.size / 48);
    const line = (y, color, w = thin) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(lay.width, y); ctx.stroke(); };
    for (const y of lay.baselines) {
      if (o.lines === 'school') {
        line(y - lay.capHeight, '#c9d6e8');
        line(y - lay.xHeight, '#9fb6d6');
      }
      line(y, '#6b8bb8', thin * 1.3);
    }
  }

  lay.paint();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return lay;
}

let raf = 0;
function render() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(async () => {
    const o = opts();
    if (!builtinSet) loadBuiltin().then(() => { if (builtinSet) { render(); drawHands(); } });
    try { await document.fonts.load(`${o.size}px "${FALLBACK}"`, els.text.value || 'Аа'); } catch { /* vykreslí se záložním písmem */ }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const lay = draw(els.canvas, dpr, o);
    els.canvas.style.width = `${lay.width}px`;
    const sc = Number(els.scale.value);
    const w = Math.round(lay.width * sc), h = Math.round(lay.height * sc);
    const shrunk = lay.width > els.box.clientWidth;
    els.sizeInfo.textContent = `${usingCustom() ? 'Píše se nahranou sadou písmen. ' : ''}${shrunk ? 'Náhled je zmenšený, aby se vešel.' : 'Náhled je ve skutečné velikosti.'} Stažený obrázek: ${w} × ${h} px.`;
    els.canvas.setAttribute('aria-label', `Náhled psacího písma: ${els.text.value.trim() || 'zatím prázdný text'}`);
  });
}

// ---------- Rukopisy (nabídka s ukázkou jako výběr písma ve Wordu) ----------
function buildHands() {
  els.hands.replaceChildren();
  for (const hand of HANDS) {
    const label = document.createElement('label');
    label.className = 'hand';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'hand';
    input.value = hand.id;
    input.checked = hand.id === state.hand;
    input.addEventListener('change', () => { state.hand = hand.id; render(); save(); });
    const name = document.createElement('span');
    name.className = 'hand__name';
    name.textContent = hand.name;
    const canvas = document.createElement('canvas');
    canvas.className = 'hand__sample';
    canvas.dataset.hand = hand.id;
    canvas.setAttribute('aria-hidden', 'true');
    label.append(input, name, canvas);
    els.hands.append(label);
  }
  drawHands();
}
function drawHands() {
  const set = activeSet();
  if (!set) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const u = 13, pad = 6;
  for (const canvas of els.hands.querySelectorAll('canvas')) {
    const hand = HANDS.find(h => h.id === canvas.dataset.hand);
    const hl = H.layout(HAND_SAMPLE, set, handParams(hand));
    const w = Math.ceil(hl.lines[0].width * u + 2 * pad), h = Math.ceil(3.2 * u + 2 * pad);
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    H.drawLine(ctx, hl.lines[0], { ox: pad, baseline: pad + 2.2 * u, u, color: INK, pen: hl.pen * Math.max(1.3, Number(els.pen.value)), drawText: () => {} });
  }
}
function setLook(look) {
  state.look = look === 'hand' ? 'hand' : 'print';
  const r = document.querySelector(`input[name="look"][value="${state.look}"]`);
  if (r) r.checked = true;
  els.handsWrap.hidden = state.look !== 'hand';
}
document.querySelectorAll('input[name="look"]').forEach(r => r.addEventListener('change', () => { setLook(r.value); render(); save(); }));

// ---------- Export ----------
function say(msg, good = true) {
  els.feedback.textContent = msg;
  els.feedback.className = `feedback ${good ? 'is-good' : 'is-bad'}`;
}

async function makePng() {
  const o = opts();
  await loadBuiltin();
  try { await document.fonts.load(`${o.size}px "${FALLBACK}"`, els.text.value || 'Аа'); } catch { /* záložní písmo */ }
  const c = document.createElement('canvas');
  draw(c, Number(els.scale.value), o);
  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
}

$('btn-download').addEventListener('click', async () => {
  if (!els.text.value.trim()) { say('Nejdřív napiš nějaký text.', false); return; }
  try {
    const blob = await makePng();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = L.fileName(els.text.value);
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    say(`✔ Obrázek ${a.download} se stahuje.`);
  } catch {
    say('Obrázek se nepodařilo vytvořit. Zkus menší velikost nebo nižší kvalitu.', false);
  }
});

$('btn-copy').addEventListener('click', async () => {
  if (!els.text.value.trim()) { say('Nejdřív napiš nějaký text.', false); return; }
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    say('Tento prohlížeč neumí kopírovat obrázky. Použij „Stáhnout obrázek PNG“.', false);
    return;
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': makePng() })]);
    say('✔ Obrázek je ve schránce. Vlož ho do dokumentu (Ctrl + V).');
  } catch {
    say('Kopírování se nepovedlo (prohlížeč ho možná nepovolil). Použij „Stáhnout obrázek PNG“.', false);
  }
});

// ---------- Tlačítka nad textem ----------
function setText(value) {
  els.text.value = value;
  els.text.dispatchEvent(new Event('input', { bubbles: true }));
  els.text.focus();
}
$('btn-translit').addEventListener('click', () => {
  setText(L.transliterate(els.text.value));
  say('✔ Latinka je přepsaná na azbuku. Zkontroluj й, ь a ъ – ty se z latinky nedají vždy poznat.');
});
$('btn-alphabet').addEventListener('click', () => setText((els.text.value ? els.text.value.replace(/\n?$/, '\n') : '') + L.alphabetPairs()));
$('btn-sample').addEventListener('click', () => setText(SAMPLE));
$('btn-clear').addEventListener('click', () => { setText(''); els.feedback.textContent = ''; els.feedback.className = 'feedback'; });

// ---------- Nastavení ----------
function onMode() {
  els.help.textContent = HELP[mode()];
  buildKeyboard();
  save();
}
document.querySelectorAll('input[name="mode"]').forEach(r => r.addEventListener('change', onMode));
els.kbdShift.addEventListener('change', buildKeyboard);
els.text.addEventListener('input', () => { onTextChange(); render(); save(); });
for (const k of [...SETTINGS, ...SWITCHES]) els[k].addEventListener('change', () => { render(); save(); });
els.pen.addEventListener('change', drawHands);
els.useCustom.addEventListener('change', drawHands);

// Zalamování závisí na šířce náhledu – při změně šířky okna vykreslit znovu.
let lastBoxWidth = 0;
new ResizeObserver(() => {
  const w = els.box.clientWidth;
  if (Math.abs(w - lastBoxWidth) < 2) return;
  lastBoxWidth = w;
  render();
  autoGrow();
}).observe(els.box);

// ---------- Vlastní sada písmen ----------
function setGlyphSet(set, use = !!set) {
  glyphSet = set;
  const n = set ? Object.keys(set.glyphs).length : 0;
  els.setRemove.disabled = !set;
  els.useCustom.disabled = !set;
  els.useCustom.checked = !!set && use;
  els.setStatus.textContent = set
    ? `Nahraná sada: ${String(set.name || 'bez názvu').slice(0, 80)} (${n} písmen). Písmena, která v sadě chybí (čísla, interpunkce), se doplní písmem Bad Script.`
    : 'Zatím není nahraná žádná vlastní sada písmen. Můžeš nahrát soubor se sadou (.json), třeba vyříznutou z vlastní písanky.';
  drawHands();
}
els.setFile.addEventListener('change', async () => {
  const file = els.setFile.files?.[0];
  els.setFile.value = '';
  if (!file) return;
  try {
    if (file.size > 3_000_000) throw new Error('Soubor je moc velký.');
    const set = JSON.parse(await file.text());
    const errors = H.validateSet(set);
    if (errors.length) throw new Error(errors.join(' '));
    setGlyphSet(set);
    say('✔ Sada písmen je nahraná, text se teď píše jí.');
  } catch (e) {
    say(`Sadu písmen se nepodařilo nahrát. ${e instanceof SyntaxError ? 'Soubor není platný JSON.' : e.message}`, false);
  }
  render(); save();
});
els.setRemove.addEventListener('click', () => { setGlyphSet(null); render(); save(); say('Sada písmen je odebraná, píše se zase Písankou Školeeq.'); });

// ---------- Start ----------
const saved = load();
els.text.value = typeof saved.text === 'string' ? saved.text.slice(0, 5000) : SAMPLE;
const savedMode = document.querySelector(`input[name="mode"][value="${CSS.escape(String(saved.mode || ''))}"]`);
if (savedMode) savedMode.checked = true;
for (const k of SETTINGS) {
  if (saved[k] && [...els[k].options].some(op => op.value === saved[k])) els[k].value = saved[k];
}
for (const k of SWITCHES) if (k !== 'useCustom' && typeof saved[k] === 'boolean') els[k].checked = saved[k];
const isColor = c => typeof c === 'string' && PENS.some(([p]) => p === c);
// starší verze měla jednu barvu pro celý text (saved.color)
const baseColor = isColor(saved.ink) ? saved.ink : isColor(saved.color) ? saved.color : INK;
state.ink = baseColor;
state.colors = L.fromRuns(saved.colors, els.text.value.length, isColor(saved.color) ? saved.color : baseColor)
  .map(c => (isColor(c) ? c : INK));
state.prevText = els.text.value;
if (HANDS.some(h => h.id === saved.hand)) state.hand = saved.hand;
setLook(saved.look);
// nahranou sadou se píše, jen když to uživatel zapnul (starší verze: v nabídce Písmo byla vybraná „Vlastní sada“)
if (saved.glyphSet && !H.validateSet(saved.glyphSet).length) setGlyphSet(saved.glyphSet, saved.useCustom === true || (saved.useCustom === undefined && saved.font === 'custom'));
els.help.textContent = HELP[mode()];
buildPens();
buildKeyboard();
buildHands();
renderMirror();
autoGrow();
render();
document.fonts?.ready.then(render);
