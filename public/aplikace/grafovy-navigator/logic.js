/* Grafový navigátor – čistá logika hry (bez DOM).
   Grafy (sousedé, nejméně přestupů, nejkratší ohodnocená cesta, nejlevnější propojení = kostra),
   orientované grafy (dosažitelnost), automat (stavy a přechody) a souběžná práce dvou robotů (rozvrh).
   Generátor úloh je deterministický (seed varianty A/B/C), vyhodnocení vrací věcné „proč“.
   Stejný soubor importují unit testy (node --test) i E2E testy – žádný přístup k window/document. */

/* ================= Seedovatelná náhoda ================= */
export const VARIANTS = { A: 4101, B: 5202, C: 6303 };

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
  const rng = {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
  };
  return rng;
}

/* ================= Grafy =================
   graf = { nodes: [{ id, x, y }], edges: [{ a, b, w?, dir? }], view: [w, h] }
   dir = true: hrana vede jen z a do b. */
export const LAYOUTS = {
  sest: {
    view: [400, 250],
    nodes: { A: [50, 60], B: [200, 35], C: [350, 60], D: [60, 200], E: [200, 140], F: [340, 205] },
    edges: ['AB', 'BC', 'AD', 'AE', 'BE', 'CE', 'CF', 'DE', 'EF', 'DF']
  },
  sedm: {
    view: [480, 260],
    nodes: { A: [40, 130], B: [150, 45], C: [150, 215], D: [250, 130], E: [350, 45], F: [350, 215], G: [440, 130] },
    edges: ['AB', 'AC', 'BC', 'BD', 'CD', 'BE', 'DE', 'DF', 'CF', 'EG', 'FG', 'DG']
  }
};

export function makeGraph(layout, { weights = null, dirs = null } = {}) {
  const L = LAYOUTS[layout];
  return {
    layout, view: L.view,
    nodes: Object.entries(L.nodes).map(([id, [x, y]]) => ({ id, x, y })),
    edges: L.edges.map(([a, b], i) => {
      const e = { a, b };
      if (weights) e.w = weights[i];
      if (dirs && dirs[i]) { e.a = b; e.b = a; }
      if (dirs) e.dir = true;
      return e;
    })
  };
}
export const edgeKey = (a, b) => [a, b].sort().join('');

/** Sousedé uzlu (u orientovaného grafu jen tam, kam vede šipka). */
export function neighbors(g, id) {
  const out = [];
  for (const e of g.edges) {
    if (e.a === id) out.push({ to: e.b, w: e.w ?? 1, e });
    else if (e.b === id && !e.dir) out.push({ to: e.a, w: e.w ?? 1, e });
  }
  return out;
}
export function findEdge(g, from, to) {
  return g.edges.find(e => (e.a === from && e.b === to) || (!e.dir && e.a === to && e.b === from)) || null;
}

/** Dijkstra. weighted = false → počet úseků (přestupů). Vrací { dist, path } nebo null. */
export function shortestPath(g, s, t, weighted = true) {
  const dist = { [s]: 0 }, prev = {}, done = new Set();
  while (true) {
    let u = null;
    for (const n of g.nodes) if (!done.has(n.id) && dist[n.id] != null && (u == null || dist[n.id] < dist[u] || (dist[n.id] === dist[u] && n.id < u))) u = n.id;
    if (u == null) break;
    if (u === t) break;
    done.add(u);
    for (const { to, w } of neighbors(g, u)) {
      const d = dist[u] + (weighted ? w : 1);
      if (dist[to] == null || d < dist[to]) { dist[to] = d; prev[to] = u; }
    }
  }
  if (dist[t] == null) return null;
  const path = [t];
  while (path[0] !== s) path.unshift(prev[path[0]]);
  return { dist: dist[t], path };
}

/** Cena a platnost trasy (seznam uzlů). */
export function pathInfo(g, path, weighted = true) {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    const e = findEdge(g, path[i - 1], path[i]);
    if (!e) return { valid: false, at: i, cost };
    cost += weighted ? (e.w ?? 1) : 1;
  }
  return { valid: true, cost };
}

/** Uzly, ze kterých se dá dojet do cíle t (bez t samotného). */
export function canReach(g, t) {
  return g.nodes.map(n => n.id).filter(id => id !== t && shortestPath(g, id, t, false));
}

/** Union-find pro kostru. */
function components(ids, edges) {
  const p = Object.fromEntries(ids.map(i => [i, i]));
  const find = x => (p[x] === x ? x : (p[x] = find(p[x])));
  let cycle = null;
  for (const e of edges) {
    const ra = find(e.a), rb = find(e.b);
    if (ra === rb) { if (!cycle) cycle = e; } else p[ra] = rb;
  }
  const groups = {};
  for (const i of ids) (groups[find(i)] ||= []).push(i);
  return { groups: Object.values(groups), cycle };
}
/** Kruskal: nejlevnější propojení všech uzlů. */
export function minSpanningTree(g) {
  const sorted = [...g.edges].sort((x, y) => x.w - y.w || edgeKey(x.a, x.b).localeCompare(edgeKey(y.a, y.b)));
  const chosen = [];
  const ids = g.nodes.map(n => n.id);
  for (const e of sorted) {
    if (!components(ids, [...chosen, e]).cycle) chosen.push(e);
    if (chosen.length === ids.length - 1) break;
  }
  return { edges: chosen, cost: chosen.reduce((s, e) => s + e.w, 0) };
}
export function networkInfo(g, keys) {
  const edges = g.edges.filter(e => keys.includes(edgeKey(e.a, e.b)));
  const { groups, cycle } = components(g.nodes.map(n => n.id), edges);
  return { edges, cost: edges.reduce((s, e) => s + e.w, 0), groups, cycle };
}

/* ================= Automat ================= */
export const DOOR = {
  states: [
    { id: 'Z', name: 'Zamčeno', x: 70, y: 110 },
    { id: 'O', name: 'Odemčeno', x: 250, y: 110 },
    { id: 'T', name: 'Otevřeno', x: 430, y: 110 }
  ],
  view: [500, 220],
  start: 'Z',
  transitions: [
    { from: 'Z', input: 'kód', to: 'O' },
    { from: 'O', input: 'zamknout', to: 'Z' },
    { from: 'O', input: 'klika', to: 'T' },
    { from: 'T', input: 'zavřít', to: 'O' }
  ],
  inputs: ['kód', 'klika', 'zavřít', 'zamknout']
};
/** Projde vstupy; když pro vstup šipka nevede, automat zůstane ve stejném stavu. */
export function runAutomaton(a, inputs) {
  const trace = [a.start];
  let s = a.start;
  for (const inp of inputs) {
    const t = a.transitions.find(x => x.from === s && x.input === inp);
    if (t) s = t.to;
    trace.push(s);
  }
  return { state: s, trace };
}
export const stateName = (a, id) => a.states.find(s => s.id === id)?.name ?? id;

/* ================= Souběžná práce (rozvrh dvou robotů) ================= */
export const LANES = ['A', 'B'];
/** Rozvrh: { [taskId]: { lane, start } }. Vrací problémy a dobu dokončení. */
export function scheduleInfo(jobs, sch) {
  const problems = [];
  let end = 0;
  for (const j of jobs) {
    const s = sch[j.id];
    if (!s || !LANES.includes(s.lane) || !Number.isInteger(s.start) || s.start < 0) { problems.push({ kind: 'missing', job: j }); continue; }
    end = Math.max(end, s.start + j.d);
    for (const dep of j.deps) {
      const ds = sch[dep];
      const dj = jobs.find(x => x.id === dep);
      if (ds && ds.start + dj.d > s.start) problems.push({ kind: 'dep', job: j, dep: dj, depEnd: ds.start + dj.d });
    }
  }
  for (let i = 0; i < jobs.length; i++) for (let k = i + 1; k < jobs.length; k++) {
    const a = jobs[i], b = jobs[k], sa = sch[a.id], sb = sch[b.id];
    if (!sa || !sb || sa.lane !== sb.lane) continue;
    if (sa.start < sb.start + b.d && sb.start < sa.start + a.d) problems.push({ kind: 'overlap', job: a, other: b, lane: sa.lane });
  }
  return { problems, end };
}
/** Nejkratší možná doba: projde všechna pořadí (respektující závislosti) a přiřazení robotům. */
export function bestSchedule(jobs) {
  let best = null;
  const n = jobs.length;
  const orders = [];
  const rec = (order, used) => {
    if (order.length === n) { orders.push([...order]); return; }
    for (const j of jobs) if (!used.has(j.id) && j.deps.every(d => used.has(d))) { used.add(j.id); order.push(j); rec(order, used); order.pop(); used.delete(j.id); }
  };
  rec([], new Set());
  for (const order of orders) {
    for (let mask = 0; mask < 2 ** n; mask++) {
      const free = { A: 0, B: 0 }, sch = {};
      let end = 0;
      order.forEach((j, i) => {
        const lane = mask & (1 << i) ? 'B' : 'A';
        const start = Math.max(free[lane], ...j.deps.map(d => sch[d].start + jobs.find(x => x.id === d).d), 0);
        sch[j.id] = { lane, start };
        free[lane] = start + j.d;
        end = Math.max(end, start + j.d);
      });
      if (!best || end < best.end) best = { end, sch };
    }
  }
  return best;
}

/* ================= Úrovně ================= */
export const LEVEL_INFO = [
  { name: 'Mapa jako graf', focus: 'Základny jsou body (uzly), cesty jsou čáry (hrany). Z takového schématu snadno vyčteš, kam se dá dojet.' },
  { name: 'Nejkratší trasa', focus: 'Každá cesta stojí energii. Nejkratší trasa není ta s nejméně úseky, ale ta s nejmenším součtem.' },
  { name: 'Síť kabelů', focus: 'Propoj všechny základny co nejlevněji. Okruh je zbytečný – stačí, aby se signál dostal všude.' },
  { name: 'Šipky a automaty', focus: 'Šipka znamená jednosměrku. Automat je graf stavů: vstup tě po šipce přesune do dalšího stavu.' },
  { name: 'Souběžná práce', focus: 'Dva roboti pracují zároveň. Některá práce musí počkat, až skončí jiná.' }
];
export const SKILLS = {
  schema: 'V mapě a schématu najdu odpověď na otázku.',
  cesta: 'Najdu nejkratší cestu v ohodnoceném grafu.',
  kostra: 'Propojím všechna místa nejlevněji (kostra grafu).',
  orientace: 'Řeším úlohy v orientovaném grafu (jednosměrky).',
  automat: 'Projdu automat podle vstupů a určím jeho stav.',
  soubeh: 'Naplánuju souběžnou práci se závislostmi.'
};
const QUICK = ['hops', 'shortest', 'mst', 'automat', 'plan'];

const JOBS = {
  Z: 'Vykopat základy', S: 'Postavit stěny', K: 'Natáhnout kabel', M: 'Postavit stožár', A: 'Zapojit anténu', T: 'Otestovat spojení'
};
const SHORT = { Z: 'Základy', S: 'Stěny', K: 'Kabel', M: 'Stožár', A: 'Anténa', T: 'Test' };
/** Výchozí plán: všechno u robota A za sebou – platný, ale pomalý. Žák ho zrychluje. */
export function defaultSchedule(jobs) {
  let t = 0;
  return Object.fromEntries(jobs.map(j => { const s = [j.id, { lane: 'A', start: t }]; t += j.d; return s; }));
}

export function tutorialTask() {
  const g = makeGraph('sest');
  return {
    id: 'ukazka', type: 'path', level: -1, skill: 'schema', graph: g, from: 'A', to: 'C', weighted: false, best: 2,
    title: 'Ukázka: dojeď z A do C',
    prompt: 'Rover stojí v základně A. Klikej na sousední základny a postav trasu do základny C přes co nejméně úseků. Kliknutím na předchozí základnu krok vrátíš.',
    hints: ['Z A vede cesta do B, D a E.', 'Trasa A → B → C má jen 2 úseky.']
  };
}

export function buildGame(variant = 'A', mode = 'cela') {
  const rng = makeRng(VARIANTS[variant] ?? VARIANTS.A);
  const T = [];
  const add = (lvl, t) => T.push({ level: lvl, ...t });
  const ids6 = Object.keys(LAYOUTS.sest.nodes), ids7 = Object.keys(LAYOUTS.sedm.nodes);
  const weights = n => Array.from({ length: n }, () => rng.int(1, 9));

  // ---- 1) Mapa jako graf
  const g1 = makeGraph('sest');
  const hub = rng.pick(['A', 'B', 'C', 'E', 'F']);
  const nb = neighbors(g1, hub).map(x => x.to).sort();
  add(0, { id: 'neighbors', type: 'pick', skill: 'schema', graph: g1, focusNode: hub, answer: nb, title: `Sousedé základny ${hub}`,
    prompt: `Označ všechny základny, do kterých se ze základny ${hub} dojede PŘÍMO – jednou cestou, bez zastávky.`,
    hints: [`Podívej se na čáry, které vycházejí ze základny ${hub}.`, `Ze základny ${hub} vede ${plural(nb.length, 'čára', 'čáry', 'čar')}.`] });
  const g2 = makeGraph('sedm');
  let [s2, t2] = rng.pick([['A', 'G'], ['A', 'E'], ['C', 'E'], ['A', 'F']]);
  const h2 = shortestPath(g2, s2, t2, false);
  add(0, { id: 'hops', type: 'path', skill: 'schema', graph: g2, from: s2, to: t2, weighted: false, best: h2.dist, title: 'Nejméně přestupů',
    prompt: `Najdi trasu ze základny ${s2} do ${t2}, která má co nejméně úseků (každá zastávka zdržuje).`,
    hints: [`Jde to na ${plural(h2.dist, 'úsek', 'úseky', 'úseků')}.`, `Trasa může vést přes ${h2.path[1]}.`] });

  // ---- 2) Nejkratší trasa
  const g3 = makeGraph('sest', { weights: weights(10) });
  const [s3, t3] = rng.pick([['A', 'F'], ['D', 'C'], ['B', 'D'], ['A', 'C']]);
  const p3 = shortestPath(g3, s3, t3);
  add(1, { id: 'shortest', type: 'path', skill: 'cesta', graph: g3, from: s3, to: t3, weighted: true, best: p3.dist, title: 'Nejúspornější trasa',
    prompt: `Čísla u cest jsou spotřeba energie. Najdi trasu ze ${s3} do ${t3} s nejmenší celkovou spotřebou.`,
    hints: ['Trasa s nejméně úseky nemusí být nejlevnější – sčítej čísla.', `Nejlevnější trasa stojí ${p3.dist}.`, `Začni úsekem ${s3} → ${p3.path[1]}.`] });
  const g4 = makeGraph('sedm', { weights: weights(12) });
  const p4 = shortestPath(g4, 'A', 'G');
  add(1, { id: 'energy', type: 'path', skill: 'cesta', graph: g4, from: 'A', to: 'G', weighted: true, best: p4.dist, budget: p4.dist, title: 'Rover na poslední kapce',
    prompt: `Rover má energii jen ${p4.dist}. Dojede ze základny A do G? Najdi trasu, na kterou energie stačí.`,
    hints: ['Zkoušej více tras a porovnávej jejich součty.', `Trasa vede přes ${p4.path.slice(1, -1).join(' a ')}.`] });

  // ---- 3) Síť kabelů
  const g5 = makeGraph('sest', { weights: weights(10) });
  const m5 = minSpanningTree(g5);
  add(2, { id: 'mst', type: 'network', skill: 'kostra', graph: g5, best: m5.cost, title: 'Nejlevnější síť',
    prompt: 'Čísla jsou ceny kabelů. Vyber kabely tak, aby byly propojené všechny základny a síť byla co nejlevnější.',
    hints: ['Začni nejlevnějšími kabely. Kabel, který by uzavřel okruh, přeskoč.', `Pro ${g5.nodes.length} základen stačí ${g5.nodes.length - 1} kabelů. Nejlevnější síť stojí ${m5.cost}.`] });
  const g6 = makeGraph('sedm', { weights: weights(12) });
  const m6 = minSpanningTree(g6);
  add(2, { id: 'mst2', type: 'network', skill: 'kostra', graph: g6, best: m6.cost, title: 'Síť pro sedm základen',
    prompt: 'Nová základna G potřebuje signál. Propoj všech sedm základen co nejlevněji.',
    hints: ['Postup: vždy přidej nejlevnější kabel, který nevytvoří okruh.', `Stačí ${g6.nodes.length - 1} kabelů za ${m6.cost}.`] });

  // ---- 4) Šipky a automaty
  let g7, t7, r7;
  for (let k = 0; k < 50; k++) {
    g7 = makeGraph('sest', { dirs: Array.from({ length: 10 }, () => rng.next() < 0.5) });
    t7 = rng.pick(ids6);
    r7 = canReach(g7, t7);
    if (r7.length >= 2 && r7.length <= 4) break;
  }
  add(3, { id: 'reach', type: 'pick', skill: 'orientace', graph: g7, focusNode: t7, answer: [...r7].sort(), title: 'Jednosměrné tunely',
    prompt: `Tunely jsou jednosměrné (šipky). Označ všechny základny, ze kterých se dá – třeba přes jiné – dojet do základny ${t7}.`,
    hints: [`Jdi od ${t7} pozpátku: které šipky do ${t7} míří?`, `Takové základny jsou ${r7.length}.`] });
  let g8, s8, t8, p8;
  for (let k = 0; k < 80; k++) {
    g8 = makeGraph('sedm', { dirs: Array.from({ length: 12 }, () => rng.next() < 0.5) });
    [s8, t8] = rng.shuffle(ids7).slice(0, 2);
    p8 = shortestPath(g8, s8, t8, false);
    if (p8 && p8.dist >= 3) break;
  }
  add(3, { id: 'directed', type: 'path', skill: 'orientace', graph: g8, from: s8, to: t8, weighted: false, best: p8.dist, title: 'Po šipkách do cíle',
    prompt: `Dojeď ze základny ${s8} do ${t8}. Po každém tunelu se dá jet jen ve směru šipky. Hledej trasu s nejméně úseky.`,
    hints: [`Ze ${s8} vedou šipky ven jen do: ${neighbors(g8, s8).map(x => x.to).join(', ') || 'nikam'}.`, `Nejkratší trasa má ${plural(p8.dist, 'úsek', 'úseky', 'úseků')} a začíná ${s8} → ${p8.path[1]}.`] });
  let inputs, res;
  for (let k = 0; k < 50; k++) {
    inputs = Array.from({ length: rng.int(5, 6) }, () => rng.pick(DOOR.inputs));
    res = runAutomaton(DOOR, inputs);
    const moves = res.trace.filter((s, i) => i > 0 && s !== res.trace[i - 1]).length;
    if (moves >= 3 && res.state !== 'Z') break;
  }
  add(3, { id: 'automat', type: 'automat', skill: 'automat', automaton: DOOR, inputs, answer: res.state, trace: res.trace, title: 'Dveře základny',
    prompt: `Dveře jsou automat. Na začátku jsou Zamčené. Postupně přijdou vstupy: ${inputs.join(' → ')}. Ve kterém stavu dveře skončí? Když pro vstup šipka nevede, dveře zůstanou, jak jsou.`,
    hints: [`Po prvním vstupu „${inputs[0]}“ jsou dveře: ${stateName(DOOR, res.trace[1])}.`, `Po třetím vstupu jsou: ${stateName(DOOR, res.trace[3])}.`] });

  // ---- 5) Souběžná práce
  const d = () => rng.int(1, 4);
  const jobs1 = [{ id: 'Z', d: d(), deps: [] }, { id: 'S', d: d(), deps: ['Z'] }, { id: 'K', d: d(), deps: [] }, { id: 'A', d: d(), deps: ['S', 'K'] }].map(j => ({ ...j, name: JOBS[j.id], short: SHORT[j.id] }));
  const b1 = bestSchedule(jobs1);
  add(4, { id: 'plan', type: 'schedule', skill: 'soubeh', jobs: jobs1, best: b1.end, solution: b1.sch, title: 'Stavba antény',
    prompt: `Roboti A a B mohou pracovat zároveň, ale každý jen na jedné práci. Teď dělá všechno robot A – je to pomalé. Přesuň práce tak, aby bylo vše hotovo za ${b1.end} h.`,
    hints: ['Práce bez závislostí může začít hned – a klidně u druhého robota.', `Práce „${JOBS.A}“ musí čekat na stěny i kabel.`, `Jedno z řešení: ${planText(jobs1, b1.sch)}.`] });
  const jobs2 = [{ id: 'Z', d: d(), deps: [] }, { id: 'S', d: d(), deps: ['Z'] }, { id: 'K', d: d(), deps: [] }, { id: 'M', d: d(), deps: [] }, { id: 'A', d: d(), deps: ['S', 'M'] }, { id: 'T', d: d(), deps: ['A', 'K'] }].map(j => ({ ...j, name: JOBS[j.id], short: SHORT[j.id] }));
  const b2 = bestSchedule(jobs2);
  add(4, { id: 'plan2', type: 'schedule', skill: 'soubeh', jobs: jobs2, best: b2.end, solution: b2.sch, title: 'Celá výstavba',
    prompt: `Šest prací, dva roboti. Naplánuj je tak, aby byla základna hotová za ${b2.end} h.`,
    hints: ['Nejdřív najdi nejdelší řetěz prací, které na sebe čekají – ten určuje, kdy nejdřív můžeš skončit.', 'Kratší práce bez závislostí vkládej do volných chvil druhého robota.', `Jedno z řešení: ${planText(jobs2, b2.sch)}.`] });

  return mode === 'rychly' ? T.filter(t => QUICK.includes(t.id)) : T;
}

function planText(jobs, sch) {
  return jobs.map(j => ({ j, s: sch[j.id] })).sort((x, y) => x.s.start - y.s.start || x.s.lane.localeCompare(y.s.lane))
    .map(({ j, s }) => `${j.name} – robot ${s.lane} od ${s.start} h`).join(', ');
}

/* ================= Vyhodnocení ================= */
const ok = msg => ({ ok: true, msg });
const no = msg => ({ ok: false, msg });
/** Skloňování: 1 úsek, 2–4 úseky, 5+ úseků. */
export const plural = (n, one, few, many) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
const list = arr => (arr.length > 1 ? arr.slice(0, -1).join(', ') + ' a ' + arr.at(-1) : arr[0] || '');

export function check(t, a) {
  switch (t.type) {
    case 'pick': {
      const got = [...new Set(a.nodes || [])].sort();
      if (!got.length) return no('Klikni na základny, které chceš označit.');
      const missing = t.answer.filter(x => !got.includes(x));
      const extra = got.filter(x => !t.answer.includes(x));
      if (!missing.length && !extra.length) {
        return ok(t.id === 'reach' ? `Do ${t.focusNode} se dostaneš ze základen ${list(t.answer)}. Z ostatních tě šipky nepustí.` : `Základna ${t.focusNode} má ${plural(t.answer.length, 'souseda', 'sousedy', 'sousedů')}: ${list(t.answer)}. Počet sousedů je stupeň uzlu.`);
      }
      if (t.id === 'reach') {
        if (extra.length) return no(`Ze základny ${extra[0]} se do ${t.focusNode} po šipkách nedostaneš. Zkus jet po šipkách a uvidíš.`);
        return no(`Chybí ${missing.length === 1 ? 'jedna základna' : `${missing.length} základny`}. Nezapomeň na cesty přes jiné základny.`);
      }
      if (extra.length) return no(`Mezi ${t.focusNode} a ${extra[0]} nevede přímá cesta – musel(a) bys jet přes jinou základnu.`);
      return no(`Chybí ti ${missing.length === 1 ? 'jeden soused' : `${missing.length} sousedé`}. Spočítej čáry ze základny ${t.focusNode}.`);
    }
    case 'path': {
      const p = a.path || [];
      if (p.length < 2) return no(`Klikni na základnu, kam má rover ze ${t.from} jet.`);
      const info = pathInfo(t.graph, p, t.weighted);
      if (p[0] !== t.from || !info.valid) return no('Trasa vede tam, kde žádná cesta není.');
      if (p.at(-1) !== t.to) return no(`Trasa končí v ${p.at(-1)}, ale cíl je ${t.to}.`);
      if (info.cost === t.best) {
        return ok(t.weighted ? `Trasa ${p.join(' → ')} stojí ${info.cost}. Levněji to nejde${t.budget ? ' a rover dojede' : ''}.` : `Trasa ${p.join(' → ')} má ${plural(info.cost, 'úsek', 'úseky', 'úseků')} – méně to nejde.`);
      }
      if (t.budget) return no(`Trasa stojí ${info.cost}, ale rover má energii jen ${t.budget}. Uvízl by ${info.cost - t.budget} jednotek před cílem.`);
      return no(`Trasa ${p.join(' → ')} ${t.weighted ? `stojí ${info.cost}, jde to za ${t.best}` : `má ${plural(info.cost, 'úsek', 'úseky', 'úseků')}, jde to na ${t.best}`}.`);
    }
    case 'network': {
      const info = networkInfo(t.graph, a.edges || []);
      if (!info.edges.length) return no('Klikni na kabely (čáry), které chceš postavit.');
      if (info.cycle) return no(`Kabely tvoří okruh (přes ${info.cycle.a}–${info.cycle.b}). Jeden kabel z okruhu je zbytečný – signál projde i bez něj.`);
      if (info.groups.length > 1) {
        const lone = info.groups.filter(g => !g.includes('A')).flat();
        return no(`Síť není propojená: základn${lone.length === 1 ? 'a' : 'y'} ${list(lone)} ${lone.length === 1 ? 'je odříznutá' : 'jsou odříznuté'} od základny A.`);
      }
      if (info.cost === t.best) return ok(`Všech ${t.graph.nodes.length} základen propojuje ${info.edges.length} kabelů za ${info.cost}. Taková síť bez okruhů se jmenuje kostra grafu.`);
      return no(`Síť funguje, ale stojí ${info.cost}. Nejlevnější stojí ${t.best} – zkus drahý kabel nahradit levnějším.`);
    }
    case 'automat': {
      if (!a.state) return no('Klikni na stav, ve kterém dveře skončí.');
      const path = t.trace.map(s => stateName(t.automaton, s)).join(' → ');
      if (a.state === t.answer) return ok(`Průchod: ${path}.`);
      return no(`Dveře skončí jinde. Projdi vstupy jeden po druhém a po každém si stav zapiš.`);
    }
    case 'schedule': {
      const sch = a.schedule || {};
      const info = scheduleInfo(t.jobs, sch);
      const pr = info.problems;
      const miss = pr.find(p => p.kind === 'missing');
      if (miss) return no(`Práce „${miss.job.name}“ nemá robota nebo začátek.`);
      const dep = pr.find(p => p.kind === 'dep');
      if (dep) return no(`„${dep.job.name}“ začíná v ${sch[dep.job.id].start} h, ale musí počkat na „${dep.dep.name}“, která končí až v ${dep.depEnd} h.`);
      const ov = pr.find(p => p.kind === 'overlap');
      if (ov) return no(`Robot ${ov.lane} by dělal dvě práce zároveň: „${ov.job.name}“ a „${ov.other.name}“.`);
      if (info.end <= t.best) return ok(`Hotovo za ${info.end} h. Dva roboti zkrátili práci díky tomu, že nezávislé práce běžely souběžně.`);
      return no(`Plán funguje, ale hotovo je až za ${info.end} h. Cíl je ${t.best} h – kde stojí robot zbytečně?`);
    }
    default: throw new Error('neznámý typ úlohy ' + t.type);
  }
}

export function solution(t) {
  switch (t.type) {
    case 'pick': return { nodes: [...t.answer] };
    case 'path': return { path: shortestPath(t.graph, t.from, t.to, t.weighted).path };
    case 'network': return { edges: minSpanningTree(t.graph).edges.map(e => edgeKey(e.a, e.b)) };
    case 'automat': return { state: t.answer };
    case 'schedule': return { schedule: structuredClone(t.solution) };
    default: throw new Error(t.type);
  }
}

export function isBetter(a, b) {
  if (!b) return true;
  if (a.firstTry !== b.firstTry) return a.firstTry > b.firstTry;
  if (a.hints !== b.hints) return a.hints < b.hints;
  if (a.ms != null && b.ms != null) return a.ms < b.ms;
  return false;
}
