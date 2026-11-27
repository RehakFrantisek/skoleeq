// Psaní vlastní sadou písmen (např. vyříznutou z písanky) – bez DOM, testované v tests/unit/.
// Sada: { format: 'psaci-azbuka-glyphs', pen, grid: [y0, krok, počet], glyphs: { 'а': [varianta, …] } }
// Varianta: { w, top, bottom, in, out, entry: [x, y], exit: [x, y], L: [...], R: [...], paths: [[x0, y0, c1x, c1y, c2x, c2y, x, y, …], …] }
// Volitelně: strokes (stejný zápis, ale tahy pera kreslené čarou šířky pen místo vyplněných obrysů)
// a after: 'high' = varianta jen za písmenem, které končí nahoře (začátek písmene shora, např. к v „ок“).
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
        const curves = a => Array.isArray(a) && a.every(p => Array.isArray(p) && p.length >= 8 && p.every(Number.isFinite));
        const ok = v && typeof v.w === 'number' && curves(v.paths) && (v.strokes === undefined || curves(v.strokes))
          && (v.paths.length || v.strokes?.length) && Array.isArray(v.entry) && Array.isArray(v.exit) && Array.isArray(v.L) && Array.isArray(v.R);
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
function jitterFor(r, amount, calm = false, slant = 0) {
  const j = (s) => (r() - 0.5) * 2 * s * amount;
  if (!amount) return { rot: 0, sx: 1, sy: 1, shear: slant, dy: 0, wa: 0, wk1: 0, wk2: 0, wp1: 0, wp2: 0 };
  // Sada kreslená perem (joins: 'touch'): jen drobné rozdíly ve velikosti a sklonu, bez vlnění tahu –
  // písmo má působit čistě jako v písance, ne roztřeseně.
  if (calm) return { rot: j(0.012), sx: 1 + j(0.025), sy: 1 + j(0.025), shear: slant + j(0.03), dy: j(0.015), wa: 0, wk1: 0, wk2: 0, wp1: 0, wp2: 0 };
  return {
    rot: j(0.03), sx: 1 + j(0.035), sy: 1 + j(0.035), shear: slant + j(0.05), dy: j(0.035),
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
  // ox/oy: posun, kterým se písmeno v sadě se spojkami uvnitř písmen přisune k předchozímu
  return [item.x + xs * c - ys * s + (t.ox || 0), xs * s + ys * c + t.dy + (t.oy || 0)];
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
export function chooseVariant(vars, next, r, prevOut = null) {
  // Varianty s after: 'high' (začátek písmene shora, např. к v „ок“) jen za písmenem, které končí nahoře.
  const after = vars.filter(v => v.after === 'high');
  if (after.length || vars.some(v => v.after)) {
    const plain = vars.filter(v => !v.after);
    vars = prevOut === 'high' && after.length ? after : plain.length ? plain : vars;
  }
  let pool = vars;
  if (vars.length > 1) {
    const joining = vars.filter(v => joinTypes(v).out !== 'none');
    const ending = vars.filter(v => joinTypes(v).out === 'none');
    if (!next) pool = ending.length ? ending : vars;
    else {
      pool = joining.length ? joining : vars;
      // další písmeno umí začít shora (varianta after: 'high') → napojit shora, jinak podle jeho začátku
      const plainNext = next.filter(v => !v.after);
      // (weak = varianta shora jen pro písmena, která zdola napojit neumí; např. е: „ое“ zdola, „ве“ shora)
      const nin = next.some(v => v.after === 'high' && !v.weak) && pool.some(v => joinTypes(v).out === 'high') ? 'high' : joinTypes((plainNext.length ? plainNext : next)[0]).in;
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
  // Sada se spojkami uvnitř písmen (joins: 'touch', jako font Propisi): začátek dalšího písmene
  // leží přímo na konci předchozího. Jen když se výšky liší (в → л), zbude krátká mezera na plynulou spojku.
  if (set.joins === 'touch') {
    const [ex, ey] = prev.exit, [sx, sy] = next.entry;
    const dy = Math.abs(ey - sy);
    const gap = dy < 0.06 ? 0 : 0.08 + dy * 0.35;
    return { x: prevX + ex + gap - sx, join: 'touch', gap };
  }
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
    const y = -0.55, l = g.L[rowOf(set, y)];
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
 * Spojka mezi koncem předchozího a začátkem dalšího písmene ve směru jejich tahů (exitDir / entryDir).
 * Vrací null, když konec a začátek splývají (bez odchylek rukopisu a se stejnou výškou).
 */
export function touchCurve(prev, item) {
  const g0 = prev.g, g1 = item.g;
  const e = transformPoint(g0.exit[0], g0.exit[1], prev);
  const s = transformPoint(g1.entry[0], g1.entry[1], item);
  const d = Math.hypot(s[0] - e[0], s[1] - e[1]);
  if (d < 0.004) return null;
  const dirAt = (p, dir, it, sign) => {
    const q = transformPoint(p[0] + sign * dir[0] * 0.05, p[1] + sign * dir[1] * 0.05, it);
    const t = transformPoint(p[0], p[1], it);
    const n = Math.hypot(q[0] - t[0], q[1] - t[1]) || 1;
    return [sign * (q[0] - t[0]) / n, sign * (q[1] - t[1]) / n];
  };
  const de = dirAt(g0.exit, g0.exitDir || [0.5, -0.86], prev, -1);
  const ds = dirAt(g1.entry, g1.entryDir || [0.5, -0.86], item, 1);
  const k = d / 2.6;
  return [e, [e[0] + de[0] * k, e[1] + de[1] * k], [s[0] - ds[0] * k, s[1] - ds[1] * k], s];
}

/**
 * Rozvrhne text do řádků z písmen sady.
 * @param {string} text
 * @param {object} set sada písmen
 * Každá položka nese i = pozici znaku v textu (UTF-16, jako výběr v textovém poli) – podle ní se barví.
 * @param {{seed?: number, jitter?: number, slant?: number, fallbackWidth?: (ch: string) => number}} o
 *   jitter = síla „lidských odchylek“ (0 = jako tištěná písanka), slant = sklon navíc (rukopis)
 * @returns {{lines: Array<{items: object[], width: number, top: number, bottom: number}>, pen: number}}
 */
export function layout(text, set, { seed = 1, jitter = 1, slant = 0, fallbackWidth = () => 0.6 } = {}) {
  const r = rng(seed);
  let offset = 0;
  const lines = String(text).split('\n').map(line => {
    const items = [];
    const chars = [...line];
    const starts = [];
    for (const ch of chars) { starts.push(offset); offset += ch.length; }
    offset += 1; // znak konce řádku
    let x = 0, prev = null, top = -1, bottom = 0.2;
    chars.forEach((ch, idx) => {
      const i = starts[idx];
      if (ch === ' ' || ch === '\t') { x = (prev ? Math.max(x, prev.x + prev.g.w) : x) + SPACE; prev = null; return; }
      const found = variantsFor(set, ch);
      if (!found) {
        const w = fallbackWidth(ch);
        const fx = prev ? Math.max(prev.x + prev.g.w + 0.06, x) : x;
        items.push({ type: 'text', ch, x: fx, w, i });
        x = fx + w + 0.06;
        prev = null;
        return;
      }
      const nextFound = idx + 1 < chars.length ? variantsFor(set, chars[idx + 1]) : null;
      const g = chooseVariant(found.vars, nextFound?.vars || null, r, prev ? joinTypes(prev.g).out : null);
      const pl = prev ? place(set, prev.g, prev.x, g) : { x, join: null };
      const item = { type: 'glyph', g, x: pl.x, ch, i, mark: found.mark, mk: found.mark ? markPlace(set, g) : null, jit: jitter > 0 || slant ? jitterFor(r, jitter, set.joins === 'touch', slant) : null };
      if (prev && pl.join === 'touch') {
        // Písmena na sebe přímo navazují: po odchylkách rukopisu písmeno přisuneme tak, aby začínalo
        // přesně v konci předchozího (jinak by ve spoji zůstal viditelný zoubek).
        if (!pl.gap && item.jit) {
          const e = transformPoint(prev.g.exit[0], prev.g.exit[1], prev);
          const s = transformPoint(g.entry[0], g.entry[1], item);
          item.jit.ox = e[0] - s[0];
          item.jit.oy = e[1] - s[1];
        }
        // jinak (různé výšky) plynulá spojka ve směru tahů obou písmen
        const c = touchCurve(prev, item);
        if (c) items.push({ type: 'join', p: c, i });
      } else if (prev && pl.join) {
        const e = transformPoint(prev.g.exit[0], prev.g.exit[1], prev);
        const s = transformPoint(...joinTarget(set, g, pl.join), item);
        const dx = s[0] - e[0];
        if (dx > 0.01 && dx < MAX_JOIN) items.push({ type: 'join', p: joinCurve(pl.join, e, s), i });
      }
      items.push(item);
      top = Math.min(top, g.top - (found.mark ? 0.5 : 0));
      bottom = Math.max(bottom, g.bottom);
      prev = item;
      x = pl.x + g.w;
    });
    let width = 0;
    for (const it of items) if (it.type !== 'join') width = Math.max(width, it.x + (it.type === 'glyph' ? it.g.w + Math.max(0, it.jit?.ox || 0) : it.w));
    for (const it of items) if (it.type === 'join') width = Math.max(width, it.p[3][0]);
    return { items, width, top, bottom };
  });
  return { lines, pen: set.pen || 0.03 };
}

/**
 * Kde nad písmenem leží tečky (ё) nebo oblouček (й): uprostřed písmene a posunuté podle sklonu písma
 * (sada.slant), aby nad nakloněným písmenem neujížděly doleva.
 */
export function markPlace(set, g) {
  const S = set.slant || 0;
  const capital = g.top < -1.5;
  const ym = capital ? g.top - 0.3 : -1.32;       // výška značky
  const yr = capital ? -1.5 : -0.75;              // řádek, ve kterém měříme střed písmene
  const row = rowOf(set, yr);
  const l = g.L?.[row], r = g.R?.[row];
  // střed v nakloněných souřadnicích přepočtený z výšky yr do výšky značky
  const cx = l != null && r != null ? (l + r) / 2 + S * (yr - ym) : g.w * 0.55;
  return { cx, ym, S };
}

/** Diakritika složených písmen: tečky jako malé kroužky, oblouček jako pravidelná křivka (kubická Bézierova). */
export function markShapes(item) {
  const { cx, ym, S } = item.mk || { cx: item.g.w * 0.55, ym: -1.32, S: 0 };
  // bod (dx, dy) vůči středu značky bez sklonu → s naklonením
  const at = (dx, dy) => transformPoint(cx + dx - S * dy, ym + dy, item);
  if (item.mark === 'dots') return { dots: [at(-0.14, 0), at(0.14, 0)] };
  if (item.mark === 'breve') return { breve: [at(-0.2, -0.12), at(-0.13, 0.1), at(0.13, 0.1), at(0.2, -0.12)] };
  return null;
}

/**
 * Vykreslí jeden rozvržený řádek do canvasu. Řádek začíná v (ox, baseline), u = velikost jednotky v px.
 * Písmena mimo sadu kreslí volající přes drawText(ch, x, y, barva).
 * colorOf(i) = barva znaku na pozici i v textu (volitelné, jinak celý řádek barvou color).
 */
export function drawLine(ctx, line, { ox, baseline, u, color, colorOf = null, pen, drawText }) {
  const P = ([x, y]) => [ox + x * u, baseline + y * u];
  for (const it of line.items) {
    const c = colorOf && it.i != null ? colorOf(it.i) || color : color;
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    if (it.type === 'join') {
      const [a, b, c, d] = it.p.map(P);
      ctx.lineWidth = pen * u;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(...a); ctx.bezierCurveTo(...b, ...c, ...d); ctx.stroke();
    } else if (it.type === 'text') {
      drawText(it.ch, ox + it.x * u, baseline, c);
    } else if (it.type === 'glyph') {
      ctx.beginPath();
      for (const path of it.g.paths) {
        const pt = i => P(transformPoint(path[i] / 1000, path[i + 1] / 1000, it));
        ctx.moveTo(...pt(0));
        for (let i = 2; i + 5 < path.length; i += 6) ctx.bezierCurveTo(...pt(i), ...pt(i + 2), ...pt(i + 4));
        ctx.closePath();
      }
      ctx.fill('evenodd');
      // písmena zadaná tahem pera (středová čára) – stejné pero jako spojovací tahy
      if (it.g.strokes?.length) {
        ctx.lineWidth = pen * u;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (const s of it.g.strokes) {
          const pt = i => P(transformPoint(s[i] / 1000, s[i + 1] / 1000, it));
          ctx.moveTo(...pt(0));
          for (let i = 2; i + 5 < s.length; i += 6) ctx.bezierCurveTo(...pt(i), ...pt(i + 2), ...pt(i + 4));
        }
        ctx.stroke();
      }
      const m = markShapes(it);
      if (m?.dots) for (const d of m.dots) { const [x, y] = P(d); ctx.beginPath(); ctx.arc(x, y, pen * u * 0.8, 0, 7); ctx.fill(); }
      if (m?.breve) {
        const [a, b, c, d] = m.breve.map(P);
        ctx.lineWidth = pen * u; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(...a); ctx.bezierCurveTo(...b, ...c, ...d); ctx.stroke();
      }
    }
  }
}
