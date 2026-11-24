// Umělá sada písmen pro testy Psací azbuky: každé písmeno je obdélník přes střední výšku (žádná data z písanky).
export function makeSet(chars = 'абвгдеиклмнопрстуАМПЯ') {
  const grid = [-2.2, 0.1, 37];
  const glyph = (w, top = -1, tin = 'low', tout = 'low') => {
    const ys = Array.from({ length: grid[2] }, (_, i) => +(grid[0] + i * grid[1]).toFixed(2));
    const inside = y => y >= top - 0.001 && y <= 0.001;
    const k = v => Math.round(v * 1000);
    // obdélník jako čtyři „kubické“ úsečky
    const pts = [[0, top], [w, top], [w, 0], [0, 0], [0, top]];
    const path = [k(0), k(top)];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      path.push(k(x0 + (x1 - x0) / 3), k(y0 + (y1 - y0) / 3), k(x0 + 2 * (x1 - x0) / 3), k(y0 + 2 * (y1 - y0) / 3), k(x1), k(y1));
    }
    return { w, top, bottom: 0, in: tin, out: tout, entry: tin === 'high' ? [w / 2, -1] : [0, -0.25], exit: tout === 'high' ? [w, -0.9] : [w, -0.25], L: ys.map(y => (inside(y) ? 0 : null)), R: ys.map(y => (inside(y) ? (tout === 'low' && y < -0.35 ? w - 0.35 : w) : null)), paths: [path] };
  };
  const glyphs = {};
  for (const ch of chars) {
    const lower = ch === ch.toLowerCase();
    glyphs[ch] = [glyph(lower ? 0.8 : 1.2, lower ? -1 : -2, lower ? ('аос'.includes(ch) ? 'high' : 'low') : 'none', ch === 'о' ? 'high' : 'low')];
  }
  // в má dvě varianty jako v písance: bez spojovacího tahu (konec slova) a s horním tahem
  if (glyphs.в) glyphs.в = [glyph(0.8, -1, 'low', 'none'), glyph(0.9, -1, 'low', 'high')];
  return { format: 'psaci-azbuka-glyphs', version: 1, name: 'Testovací sada', pen: 0.03, grid, glyphs };
}
