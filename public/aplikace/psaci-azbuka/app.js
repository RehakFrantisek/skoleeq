// Psací azbuka – ovládání stránky. Logika převodu je v logic.js (bez DOM).
import * as L from './logic.js';
import * as H from './handwriting.js';

const STORAGE_KEY = 'vyukovy-portal:psaci-azbuka:v1';
const SAMPLE = 'Привет! Меня зовут Анна.\nЯ живу в Праге.';
const $ = id => document.getElementById(id);

const els = {
  text: $('text'), help: $('mode-help'), canvas: $('preview'), feedback: $('feedback'), kbd: $('kbd'), kbdShift: $('kbd-shift'),
  font: $('opt-font'), size: $('opt-size'), color: $('opt-color'), lines: $('opt-lines'), spacing: $('opt-spacing'),
  scale: $('opt-scale'), transparent: $('opt-transparent'), jitter: $('opt-jitter'), fontCustom: $('opt-font-custom'),
  setFile: $('set-file'), setStatus: $('set-status'), reseed: $('btn-reseed'), setRemove: $('btn-set-remove')
};
let glyphSet = null;                       // vlastní sada písmen (z písanky)
const state = { seed: 1 };
const SETTINGS = ['font', 'size', 'color', 'lines', 'spacing', 'scale'];

const HELP = {
  phonetic: 'Piš latinkou podle výslovnosti: č = ч, š = ш, ž = ж, ch = х, c = ц, y = ы, šč = щ, ja = я, ju = ю, jo = ё, é = э, q = ь, Shift+Q = ъ. Čísla a interpunkce píšeš jako obvykle.',
  ytsuken: 'Klávesy fungují jako na ruské klávesnici ЙЦУКЕН (rozložení najdeš v písmenech na obrazovce). Tečka je na klávese pomlčky, čárka se Shiftem.',
  native: 'Přepni si klávesnici v systému na ruštinu (Windows: Win + mezerník) – nebo sem text azbukou vlož (Ctrl + V).'
};

// ---------- Uložení (jen localStorage, vždy v try/catch) ----------
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const data = { text: els.text.value, mode: mode(), transparent: els.transparent.checked, jitter: els.jitter.checked, seed: state.seed, glyphSet };
    for (const k of SETTINGS) data[k] = els[k].value;
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

// ---------- Písmena na obrazovce ----------
function buildKeyboard() {
  els.kbd.replaceChildren();
  const upper = els.kbdShift.checked;
  const rows = mode() === 'ytsuken'
    ? L.YTSUKEN_ROWS.map(r => r.filter(([, base]) => L.ALPHABET.includes(base)).map(([code, base, , cap]) => ({ ch: base, hint: cap, code })))
    : [[...L.ALPHABET].map(ch => ({ ch, hint: mode() === 'phonetic' ? L.PHONETIC_HINT[ch] : '' }))];
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
const fontFamily = o => (o.font === 'custom' ? 'Bad Script' : o.font);
const opts = () => ({
  font: els.font.value, size: Number(els.size.value), color: els.color.value, lines: els.lines.value,
  spacing: Number(els.spacing.value), transparent: els.transparent.checked, jitter: els.jitter.checked
});

// Rozvržení textu písmem (font) – vrací rozměry, účaří a funkci, která text nakreslí.
function fontLayout(ctx, lines, o) {
  const fontCss = `${o.size}px "${fontFamily(o)}"`;
  ctx.font = fontCss;
  const measure = s => {
    const m = ctx.measureText(s);
    return { ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent, left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight };
  };
  const lay = L.layoutLines(lines, measure, { size: o.size, spacing: o.spacing });
  lay.xHeight = ctx.measureText('х').actualBoundingBoxAscent || o.size * 0.45;
  lay.capHeight = ctx.measureText('Ш').actualBoundingBoxAscent || o.size * 0.7;
  lay.paint = () => {
    ctx.font = fontCss;
    ctx.fillStyle = o.color;
    ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, lay.x, lay.baselines[i]));
  };
  return lay;
}

// Rozvržení vlastní sadou písmen (z písanky). Znaky mimo sadu (čísla, interpunkce) píše tenké Bad Script.
function handLayout(ctx, lines, o) {
  const u = o.size * 0.42;                       // střední výška v px
  ctx.font = `${o.size}px "Bad Script"`;
  const fbX = (ctx.measureText('х').actualBoundingBoxAscent || o.size * 0.4) / o.size;
  const fbSize = (u / fbX) * 0.9;
  ctx.font = `${fbSize}px "Bad Script"`;
  const fallbackWidth = ch => ctx.measureText(ch).width / u;
  const hl = H.layout(lines.join('\n'), glyphSet, { seed: state.seed, jitter: o.jitter ? 1 : 0, fallbackWidth });
  const pad = Math.round(u * 0.6);
  const lineH = Math.max(o.spacing * o.size, u * 3.4);
  const top = Math.min(-2.1, ...hl.lines.map(l => l.top));
  const baselines = hl.lines.map((_, i) => pad + -top * u + i * lineH);
  const last = hl.lines[hl.lines.length - 1];
  const height = Math.ceil(baselines[baselines.length - 1] + Math.max(0.4, last.bottom) * u + pad);
  const width = Math.ceil(Math.max(1, ...hl.lines.map(l => l.width)) * u + 2 * pad);
  return {
    width, height, baselines, xHeight: u, capHeight: 2 * u,
    paint: () => hl.lines.forEach((l, i) => H.drawLine(ctx, l, {
      ox: pad, baseline: baselines[i], u, color: o.color, pen: hl.pen,
      drawText: (ch, x, y) => { ctx.font = `${fbSize}px "Bad Script"`; ctx.fillStyle = o.color; ctx.fillText(ch, x, y); }
    }))
  };
}

const useHand = o => o.font === 'custom' && !!glyphSet;

function draw(canvas, scale, o = opts()) {
  const ctx = canvas.getContext('2d');
  const lines = (els.text.value.replace(/\s+$/, '') || ' ').split('\n');
  const lay = useHand(o) ? handLayout(ctx, lines, o) : fontLayout(ctx, lines, o);

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
    try { await document.fonts.load(`${o.size}px "${fontFamily(o)}"`, els.text.value || 'Аа'); } catch { /* vykreslí se záložním písmem */ }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const lay = draw(els.canvas, dpr, o);
    els.canvas.style.width = `${lay.width}px`;
    els.canvas.setAttribute('aria-label', `Náhled psacího písma: ${els.text.value.trim() || 'zatím prázdný text'}`);
  });
}

// ---------- Export ----------
function say(msg, good = true) {
  els.feedback.textContent = msg;
  els.feedback.className = `feedback ${good ? 'is-good' : 'is-bad'}`;
}

async function makePng() {
  const o = opts();
  try { await document.fonts.load(`${o.size}px "${fontFamily(o)}"`, els.text.value || 'Аа'); } catch { /* záložní písmo */ }
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
els.text.addEventListener('input', () => { render(); save(); });
for (const k of [...SETTINGS, 'transparent', 'jitter']) els[k].addEventListener('change', () => { render(); save(); });

// ---------- Vlastní sada písmen ----------
function setGlyphSet(set, { select = false } = {}) {
  glyphSet = set;
  const n = set ? Object.keys(set.glyphs).length : 0;
  els.fontCustom.hidden = !set;
  els.fontCustom.disabled = !set;
  els.reseed.disabled = !set;
  els.setRemove.disabled = !set;
  if (set) {
    els.setStatus.textContent = `Nahraná sada: ${String(set.name || 'bez názvu').slice(0, 80)} (${n} písmen). Písmena, která v sadě chybí (čísla, interpunkce), se doplní písmem Bad Script.`;
    if (select) els.font.value = 'custom';
  } else {
    els.setStatus.textContent = 'Zatím není nahraná žádná sada písmen. Nahraj soubor se sadou (.json) a v nabídce Písmo vyber „Písanka“.';
    if (els.font.value === 'custom') els.font.value = 'Marck Script';
  }
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
    setGlyphSet(set, { select: true });
    say('✔ Sada písmen je nahraná a vybraná v nabídce Písmo.');
  } catch (e) {
    say(`Sadu písmen se nepodařilo nahrát. ${e instanceof SyntaxError ? 'Soubor není platný JSON.' : e.message}`, false);
  }
  render(); save();
});
els.reseed.addEventListener('click', () => { state.seed = (state.seed % 100000) + 1 + Math.floor(Math.random() * 1000); render(); save(); });
els.setRemove.addEventListener('click', () => { setGlyphSet(null); render(); save(); say('Sada písmen je odebraná.'); });

// ---------- Start ----------
const saved = load();
if (typeof saved.text === 'string') els.text.value = saved.text.slice(0, 5000);
else els.text.value = SAMPLE;
const savedMode = document.querySelector(`input[name="mode"][value="${CSS.escape(String(saved.mode || ''))}"]`);
if (savedMode) savedMode.checked = true;
for (const k of SETTINGS) {
  if (saved[k] && [...els[k].options].some(op => op.value === saved[k])) els[k].value = saved[k];
}
els.transparent.checked = !!saved.transparent;
els.jitter.checked = saved.jitter !== false;
if (Number.isInteger(saved.seed)) state.seed = saved.seed;
if (saved.glyphSet && !H.validateSet(saved.glyphSet).length) setGlyphSet(saved.glyphSet);
if (els.font.value === 'custom' && !glyphSet) els.font.value = 'Marck Script';
els.help.textContent = HELP[mode()];
buildKeyboard();
render();
document.fonts?.ready.then(render);
