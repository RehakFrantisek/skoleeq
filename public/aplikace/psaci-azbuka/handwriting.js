// Psaní vlastní sadou písmen (např. vyříznutou z písanky) – bez DOM, testované v tests/unit/.
// Sada: { format: 'psaci-azbuka-glyphs', pen, grid: [y0, krok, počet], glyphs: { 'а': [varianta, …] } }
// Varianta: { w, top, bottom, entry: [x, y], exit: [x, y], L: [...], R: [...], paths: [[x0, y0, c1x, c1y, c2x, c2y, x, y, …], …] }
// Jednotka = střední výška písma, účaří y = 0, nahoru záporné y. Souřadnice obrysů jsou v tisícinách jednotky.

export const FORMAT = 'psaci-azbuka-glyphs';
const GAP = 0.13;      // mezera mezi písmeny (v nejbližším místě)
const SPACE = 0.6;     // mezera mezi slovy
const MAX_JOIN = 1.3;  // delší spojovací tah už nekreslíme

/** Kontrola nahraného souboru se sadou písmen. Vrací seznam chyb (prázdný = v pořádku). */
export function validateSet(set) {
  const e = [];
  if (!set || typeof set !== 'object') return ['Soubor neobsahuje sadu písmen.'];
  if (set.format !== FORMAT) e.push('Neznámý formát souboru (čekám sadu písmen z Psací azbuky).');
  if (!set.glyphs || typeof set.glyphs !== 'object') e.push('V souboru chybí písmena.');
  else {
    for (const [ch, vars] of Object.entries(set.glyphs)) {
      if ([...ch].length !== 1 || !Array.isArray(vars) || !vars.length) { e.push(`Písmeno „${ch}“ má špatný zápis.`); continue; }
      for (const v of vars) {
        const ok = v && typeof v.w === 'number' && Array.isArray(v.paths) && v.paths.every(p => Array.isArray(p) && p.length >= 8 && p.every(Number.isFinite))
          && Array.isArray(v.entry) && Array.isArray(v.exit) && Array.isArray(v.L) && Array.isArray(v.R);
        if (!ok) { e.push(`Písmeno „${ch}“ má špatný tvar.`); break; }
      }
    }
  }
  if (!Array.isArray(set.grid) || set.grid.length !== 3) e.push('V souboru chybí mřížka profilů.');
  return e.slice(0, 5);
}

/** Deterministický generátor náhodných čísel (stejný text + stejné semínko = stejný rukopis). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ё, Й a velká měkká/tvrdá písmena skládáme z jiných písmen.
const COMPOSE = { ё: ['е', 'dots'], Ё: ['Е', 'dots'], й: ['и', 'breve'], Й: ['И', 'breve'], Ъ: ['ъ'], Ь: ['ь'], Ы: ['ы'] };

/** Varianty písmena v sadě (případně složeného) nebo null. */
export function variantsFor(set, ch) {
  if (set.glyphs[ch]) return { vars: set.glyphs[ch], mark: null };
  const c = COMPOSE[ch];
  if (c && set.glyphs[c[0]]) return { vars: set.glyphs[c[0]], mark: c[1] || null };
  return null;
}

/** Náhodné drobné odchylky jednoho písmene: natočení, velikost, sklon, posun a jemné „vlnění“ tahu. */
function jitterFor(r, amount) {
  const j = (s) => (r() - 0.5) * 2 * s * amount;
  return {
    rot: j(0.03), sx: 1 + j(0.035), sy: 1 + j(0.035), shear: j(0.05), dy: j(0.035),
    wa: 0.012 * amount, wk1: 3 + r() * 3, wk2: 3 + r() * 3, wp1: r() * 6.28, wp2: r() * 6.28
  };
}

/** Bod písmene (v jednotkách, vůči levému okraji písmene na účaří) → bod na řádku. */
export function transformPoint(x, y, item) {
  const t = item.jit;
  if (!t) return [item.x + x, y];
  const wx = x + t.wa * Math.sin(t.wk1 * y + t.wp1);
  const wy = y + t.wa * Math.sin(t.wk2 * x + t.wp2);
  const xs = wx * t.sx + wy * t.shear, ys = wy * t.sy;
  const c = Math.cos(t.rot), s = Math.sin(t.rot);
  return [item.x + xs * c - ys * s, xs * s + ys * c + t.dy];
}

/** O kolik posunout další písmeno, aby se v žádné výšce nedotklo předchozího (proklad podle profilů). */
export function kern(prev, prevX, next, gap = GAP, skip = null) {
  let best = -Infinity;
  const n = Math.min(prev.R.length, next.L.length);
  for (let i = 0; i < n; i++) {
    const r = prev.R[i];
    if (r == null || (skip && skip(i, r))) continue;
    // sousední řádky taky – šikmé tahy
    for (const k of [i - 1, i, i + 1]) {
      if (k < 0 || k >= n) continue;
      const l = next.L[k];
      if (l == null) continue;
      best = Math.max(best, prevX + r - l + gap);
    }
  }
  return best === -Infinity ? prevX + prev.w + gap : best;
}

/** Index řádku profilu pro výšku y. */
const rowOf = (set, y) => Math.round((y - set.grid[0]) / set.grid[1]);

/**
 * Kde písmeno začíná a končí (pravidla napojení z písanky):
 * in  – low: spojovací tah přichází do dolní třetiny střední výšky (и, л, м …), high: nahoru (а, о, с …), none: nenapojuje se
 * out – low: končí tahem v dolní třetině, high: končí nahoře (о, в, э …), none: dál nenavazuje
 * Starší sady bez těchto údajů odhadneme z bodů napojení.
 */
export function joinTypes(g) {
  const tin = g.in || (g.entry[1] < -0.55 ? 'high' : 'low');
  let tout = g.out;
  if (!tout) tout = g.exit[0] < g.w - 0.15 ? 'none' : g.exit[1] > -0.45 ? 'low' : 'high';
  return { in: tin, out: tout };
}

/** Navazuje písmeno na další? */
export function canJoin(g) {
  return joinTypes(g).out !== 'none';
}

/**
 * Vybere variantu písmene podle okolí: před dalším písmenem variantu se spojovacím tahem
 * (u в podle toho, jak začíná další písmeno), na konci slova variantu bez něj.
 */
export function chooseVariant(vars, next, r) {
  let pool = vars;
  if (vars.length > 1) {
    const joining = vars.filter(v => joinTypes(v).out !== 'none');
    const ending = vars.filter(v => joinTypes(v).out === 'none');
    if (!next) pool = ending.length ? ending : vars;
    else {
      pool = joining.length ? joining : vars;
      const nin = joinTypes(next[0]).in;
      const same = pool.filter(v => joinTypes(v).out === nin);
      if (same.length) pool = same;
    }
  }
  return pool[Math.floor(r() * pool.length)];
}

/** Řádky profilu, kde je jen spojovací tah předchozího písmene (ty se při prokladu nepočítají). */
function tailRows(set, g) {
  const t = joinTypes(g).out;
  const [ex, ey] = g.exit;
  if (t === 'none') return null;
  return (i, r) => {
    const y = set.grid[0] + i * set.grid[1];
    return r > ex - 0.3 && (t === 'low' ? y > ey - 0.15 : Math.abs(y - ey) < 0.2);
  };
}

/**
 * Umístí další písmeno za předchozí. Vrací { x, join }, join = druh spojovacího tahu nebo null.
 * Dolní tah → písmeno začínající dole: konec tahu se dotkne dalšího písmene (jako v písance).
 * Ostatní spojení: mezi písmeny zůstane místo a nakreslí se spojovací tah.
 */
export function place(set, prev, prevX, next) {
  const a = joinTypes(prev), b = joinTypes(next);
  if (a.out === 'none' || b.in === 'none') return { x: kern(prev, prevX, next, 0.16), join: null };
  const [ex, ey] = prev.exit;
  const base = kern(prev, prevX, next, GAP, tailRows(set, prev));
  if (a.out === 'low' && b.in === 'low') {
    const row = rowOf(set, ey);
    for (const k of [row, row - 1, row + 1, row - 2, row + 2]) {
      const l = next.L[k];
      if (l == null) continue;
      const touch = prevX + ex - l - 0.02;
      if (touch >= base - 0.02) return { x: touch, join: null };
      break;
    }
  }
  const minDx = a.out === 'low' && b.in === 'high' ? 0.3 : a.out === 'high' && b.in === 'low' ? 0.38 : 0.25;
  let x = Math.max(base + 0.05, prevX + ex + minDx - next.entry[0]);
  // písmeno začínající nahoře (а, о, с …) nesmí bříškem zasáhnout konec dolního tahu
  if (a.out === 'low' && b.in === 'high') {
    const row = rowOf(set, ey);
    const ls = [row - 1, row, row + 1].map(k => next.L[k]).filter(v => v != null);
    if (ls.length) x = Math.max(x, prevX + ex - Math.min(...ls) + 0.1);
  }
  return { x, join: `${a.out}-${b.in}` };
}

/** Kam spojovací tah míří. Shora do písmene začínajícího dole jde tah jen do půlky střední výšky (bez prudkého zhoupnutí). */
export function joinTarget(set, g, kind) {
  if (kind === 'high-low') {
    const y = -0.45, l = g.L[rowOf(set, y)];
    if (l != null && g.entry[1] > y) return [l, y];
  }
  return g.entry;
}

/** Body spojovací křivky (kubická Bézierova) podle druhu spojení. */
export function joinCurve(kind, e, s) {
  const dx = s[0] - e[0], dy = s[1] - e[1];
  if (kind === 'low-high') return [e, [e[0] + dx * 0.45, e[1] + dy * 0.55], [s[0] - dx * 0.12, s[1] + 0.28], s];
  if (kind === 'high-low') return [e, [e[0] + dx * 0.45, e[1] + 0.02], [s[0] - dx * 0.4, s[1] - 0.02], s];
  if (kind === 'high-high') return [e, [e[0] + dx * 0.35, e[1] - 0.06], [s[0] - dx * 0.35, s[1] - 0.04], s];
  return [e, [e[0] + dx * 0.5, e[1] - dx * 0.2], [s[0] - dx * 0.4, s[1]], s];
}

/**
 * Rozvrhne text do řádků z písmen sady.
 * @param {string} text
 * @param {object} set sada písmen
 * @param {{seed?: number, jitter?: number, fallbackWidth?: (ch: string) => number}} o
 * @returns {{lines: Array<{items: object[], width: number, top: number, bottom: number}>, pen: number}}
 */
export function layout(text, set, { seed = 1, jitter = 1, fallbackWidth = () => 0.6 } = {}) {
  const r = rng(seed);
  const lines = String(text).split('\n').map(line => {
    const items = [];
    const chars = [...line];
    let x = 0, prev = null, top = -1, bottom = 0.2;
    chars.forEach((ch, idx) => {
      if (ch === ' ' || ch === '\t') { x = (prev ? Math.max(x, prev.x + prev.g.w) : x) + SPACE; prev = null; return; }
      const found = variantsFor(set, ch);
      if (!found) {
        const w = fallbackWidth(ch);
        const fx = prev ? Math.max(prev.x + prev.g.w + 0.06, x) : x;
        items.push({ type: 'text', ch, x: fx, w });
        x = fx + w + 0.06;
        prev = null;
        return;
      }
      const nextFound = idx + 1 < chars.length ? variantsFor(set, chars[idx + 1]) : null;
      const g = chooseVariant(found.vars, nextFound?.vars || null, r);
      const pl = prev ? place(set, prev.g, prev.x, g) : { x, join: null };
      const item = { type: 'glyph', g, x: pl.x, ch, mark: found.mark, jit: jitter > 0 ? jitterFor(r, jitter) : null };
      if (prev && pl.join) {
        const e = transformPoint(prev.g.exit[0], prev.g.exit[1], prev);
        const s = transformPoint(...joinTarget(set, g, pl.join), item);
        const dx = s[0] - e[0];
        if (dx > 0.01 && dx < MAX_JOIN) items.push({ type: 'join', p: joinCurve(pl.join, e, s) });
      }
      items.push(item);
      top = Math.min(top, g.top - (found.mark ? 0.5 : 0));
      bottom = Math.max(bottom, g.bottom);
      prev = item;
      x = pl.x + g.w;
    });
    let width = 0;
    for (const it of items) if (it.type !== 'join') width = Math.max(width, it.x + (it.type === 'glyph' ? it.g.w : it.w));
    for (const it of items) if (it.type === 'join') width = Math.max(width, it.p[3][0]);
    return { items, width, top, bottom };
  });
  return { lines, pen: set.pen || 0.03 };
}

/** Diakritika složených písmen (tečky nad ё, oblouček nad й) jako jednoduché tahy. */
export function markShapes(item) {
  const g = item.g;
  const cx = g.w * 0.55;
  const capital = g.top < -1.5;
  const y = capital ? g.top - 0.25 : -1.35;
  if (item.mark === 'dots') return { dots: [transformPoint(cx - 0.17, y, item), transformPoint(cx + 0.17, y, item)] };
  if (item.mark === 'breve') return { arc: [transformPoint(cx - 0.22, y - 0.12, item), transformPoint(cx, y + 0.12, item), transformPoint(cx + 0.22, y - 0.12, item)] };
  return null;
}

/**
 * Vykreslí jeden rozvržený řádek do canvasu. Řádek začíná v (ox, baseline), u = velikost jednotky v px.
 * Písmena mimo sadu kreslí volající přes drawText(ch, x, y).
 */
export function drawLine(ctx, line, { ox, baseline, u, color, pen, drawText }) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  const P = ([x, y]) => [ox + x * u, baseline + y * u];
  for (const it of line.items) {
    if (it.type === 'join') {
      const [a, b, c, d] = it.p.map(P);
      ctx.lineWidth = pen * u;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(...a); ctx.bezierCurveTo(...b, ...c, ...d); ctx.stroke();
    } else if (it.type === 'text') {
      drawText(it.ch, ox + it.x * u, baseline);
    } else if (it.type === 'glyph') {
      ctx.beginPath();
      for (const path of it.g.paths) {
        const pt = i => P(transformPoint(path[i] / 1000, path[i + 1] / 1000, it));
        ctx.moveTo(...pt(0));
        for (let i = 2; i + 5 < path.length; i += 6) ctx.bezierCurveTo(...pt(i), ...pt(i + 2), ...pt(i + 4));
        ctx.closePath();
      }
      ctx.fill('evenodd');
      const m = markShapes(it);
      if (m?.dots) for (const d of m.dots) { const [x, y] = P(d); ctx.beginPath(); ctx.arc(x, y, pen * u * 1.5, 0, 7); ctx.fill(); }
      if (m?.arc) {
        const [a, b, c] = m.arc.map(P);
        ctx.lineWidth = pen * u * 1.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(...a); ctx.quadraticCurveTo(b[0], b[1] + (b[1] - a[1]), ...c); ctx.stroke();
      }
    }
  }
}
