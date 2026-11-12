/* Robotí dílna – deterministický simulátor a interpret programu (bez DOM, bez eval).
   Mapa: celočíselná mřížka, robot má (x, y) a orientaci N/E/S/W. Každý příkaz = jeden diskrétní krok.
   Program = strom uzlů:
     { id, op: 'forward' | 'left' | 'right' | 'pick' | 'drop' }
     { id, op: 'repeat', n, body: [...] }
     { id, op: 'if', cond: 'wallAhead' | 'onBattery', then: [...], else: [...] }
   Interpret je generátor: po každém vykonaném příkazu (a vyhodnocení podmínky) vrátí událost.
   Logika vůbec nezávisí na časování animací. */

export const DIRS = ['N', 'E', 'S', 'W'];
export const DIR_LABELS = { N: 'sever (nahoru)', E: 'východ (doprava)', S: 'jih (dolů)', W: 'západ (doleva)' };
const DELTA = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

export const OPS = {
  forward: 'Jdi vpřed', left: 'Otoč vlevo', right: 'Otoč vpravo', pick: 'Vezmi', drop: 'Polož',
  repeat: 'Opakuj', if: 'Když'
};
export const CONDS = { wallAhead: 'před tebou je překážka', onBattery: 'stojíš na baterii' };
export const LIMIT = 400;      // max. vykonaných instrukcí (příkazy + vyhodnocení podmínek)
export const MAX_DEPTH = 3;    // max. vnoření bloků Opakuj / Když
export const MAX_REPEAT = 20;

/* Legenda mapy:
   #  zeď            o  kámen (překážka)    .  volno
   S  start robota   G  cíl                 A  anténa (překážka, k ní se robot natáčí)
   B  baterie        V  vzorek (bere se příkazem Vezmi)
   K  kontrolní bod (stačí přes něj projet)  D  dok sondy (sem se baterie pokládají) */
const BLOCKING = new Set(['#', 'o', 'A']);

export const pos = (x, y) => `${x},${y}`;
export const human = (x, y) => `[${x + 1}, ${y + 1}]`; // pro žáky: sloupec, řádek od 1

export function parseMap(def) {
  const rows = def.rows;
  const h = rows.length, w = rows[0].length;
  if (!rows.every(r => r.length === w)) throw new Error('řádky mapy musí mít stejnou délku');
  const map = { w, h, name: def.name || '', cells: [], items: {}, start: null, marks: { G: [], A: [], K: [], D: [] } };
  for (let y = 0; y < h; y++) {
    map.cells.push([]);
    for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      let floor = c;
      if (c === 'S') { map.start = { x, y, dir: def.dir || 'E' }; floor = '.'; }
      if (c === 'B' || c === 'V') { map.items[pos(x, y)] = c; floor = '.'; }
      if (c in map.marks) map.marks[c].push({ x, y });
      if (!'#o.SGAKDBV'.includes(c)) throw new Error(`neznámý znak mapy "${c}"`);
      map.cells[y].push(floor);
    }
  }
  if (!map.start) throw new Error('mapa nemá start S');
  return map;
}

export function blocked(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return 'edge';
  const c = map.cells[y][x];
  return BLOCKING.has(c) ? c : null;
}

export function createState(map) {
  return {
    x: map.start.x, y: map.start.y, dir: map.start.dir,
    carrying: { B: 0, V: 0 }, items: { ...map.items }, delivered: 0,
    visited: [pos(map.start.x, map.start.y)], steps: 0, error: null, done: false
  };
}

const ahead = s => [s.x + DELTA[s.dir][0], s.y + DELTA[s.dir][1]];
const WHAT = { '#': 'zdi', o: 'kamene', A: 'antény', edge: 'okraje mapy' };

export function evalCond(cond, map, s) {
  if (cond === 'wallAhead') return !!blocked(map, ...ahead(s));
  if (cond === 'onBattery') return s.items[pos(s.x, s.y)] === 'B';
  throw new Error('neznámá podmínka ' + cond);
}

/** Provede jeden příkaz. Při chybě nastaví s.error a robot zůstane stát. */
export function applyOp(op, map, s) {
  if (op === 'forward') {
    const [nx, ny] = ahead(s);
    const b = blocked(map, nx, ny);
    if (b) {
      s.error = b === 'edge'
        ? { code: 'edge', msg: `Robot by vyjel z mapy na políčku ${human(s.x, s.y)} (směr ${DIR_LABELS[s.dir]}).` }
        : { code: 'wall', msg: `Robot narazil do ${WHAT[b]} na políčku ${human(nx, ny)}.`, x: nx, y: ny };
      return;
    }
    s.x = nx; s.y = ny;
    const k = pos(nx, ny);
    if (!s.visited.includes(k)) s.visited.push(k);
  } else if (op === 'left' || op === 'right') {
    s.dir = DIRS[(DIRS.indexOf(s.dir) + (op === 'left' ? 3 : 1)) % 4];
  } else if (op === 'pick') {
    const k = pos(s.x, s.y);
    const it = s.items[k];
    if (!it) { s.error = { code: 'pick', msg: `Na políčku ${human(s.x, s.y)} není nic, co by robot mohl vzít.` }; return; }
    delete s.items[k];
    s.carrying[it]++;
  } else if (op === 'drop') {
    if (!s.carrying.B) { s.error = { code: 'drop', msg: `Robot nemá žádnou baterii, kterou by položil (políčko ${human(s.x, s.y)}).` }; return; }
    s.carrying.B--;
    if (map.marks.D.some(d => d.x === s.x && d.y === s.y)) s.delivered++;
    else if (!s.items[pos(s.x, s.y)]) s.items[pos(s.x, s.y)] = 'B';
    else { s.carrying.B++; s.error = { code: 'drop', msg: `Na políčku ${human(s.x, s.y)} už něco leží.` }; }
  } else {
    throw new Error('neznámý příkaz ' + op);
  }
}

export function depth(program) {
  let d = 0;
  for (const n of program) {
    if (n.op === 'repeat') d = Math.max(d, 1 + depth(n.body));
    else if (n.op === 'if') d = Math.max(d, 1 + depth(n.then), 1 + depth(n.else || []));
  }
  return d;
}
export function countBlocks(program) {
  let c = 0;
  for (const n of program) {
    c++;
    if (n.op === 'repeat') c += countBlocks(n.body);
    if (n.op === 'if') c += countBlocks(n.then) + countBlocks(n.else || []);
  }
  return c;
}
export function uses(program, op) {
  return program.some(n => n.op === op || (n.op === 'repeat' && uses(n.body, op)) || (n.op === 'if' && (uses(n.then, op) || uses(n.else || [], op))));
}
export function* walk(program) {
  for (const n of program) {
    yield n;
    if (n.op === 'repeat') yield* walk(n.body);
    if (n.op === 'if') { yield* walk(n.then); yield* walk(n.else || []); }
  }
}

/**
 * Interpret jako generátor. Události: { kind: 'step' | 'cond' | 'end', node, path, value?, state }.
 * state je stále tentýž objekt – pro animaci se z něj čte aktuální poloha.
 */
export function* execute(program, map, state = createState(map), { limit = LIMIT } = {}) {
  if (depth(program) > MAX_DEPTH) {
    state.error = { code: 'depth', msg: `Program je vnořený příliš hluboko (max. ${MAX_DEPTH} úrovně).` };
    yield { kind: 'end', state };
    return state;
  }
  const tick = () => {
    state.steps++;
    if (state.steps > limit) state.error = { code: 'limit', msg: `Program se zastavil po ${limit} krocích – nejspíš běží pořád dokola. Zkontroluj počty opakování.` };
    return !state.error;
  };
  function* run(nodes, path) {
    for (const n of nodes) {
      if (state.error) return;
      const p = [...path, n.id];
      if (n.op === 'repeat') {
        const times = Math.max(0, Math.min(MAX_REPEAT, n.n | 0));
        for (let i = 0; i < times && !state.error; i++) yield* run(n.body, p);
      } else if (n.op === 'if') {
        if (!tick()) return;
        const value = evalCond(n.cond, map, state);
        yield { kind: 'cond', node: n, path: p, value, state };
        yield* run(value ? n.then : (n.else || []), p);
      } else {
        if (!tick()) return;
        applyOp(n.op, map, state);
        yield { kind: 'step', node: n, path: p, state };
      }
    }
  }
  yield* run(program, []);
  state.done = true;
  yield { kind: 'end', state };
  return state;
}

/** Spustí program do konce. Vrací stav, trasu a statistiku podmínek. */
export function runProgram(program, map, opts) {
  const state = createState(map);
  const trace = [{ x: state.x, y: state.y, dir: state.dir }];
  const conds = {};
  for (const ev of execute(program, map, state, opts)) {
    if (ev.kind === 'step') trace.push({ x: state.x, y: state.y, dir: state.dir, node: ev.node.id });
    if (ev.kind === 'cond') {
      const c = (conds[ev.node.id] ||= { cond: ev.node.cond, true: 0, false: 0 });
      c[ev.value ? 'true' : 'false']++;
    }
  }
  return { state, trace, conds };
}

/* ================= Cíle a vyhodnocení mise ================= */

export function checkGoals(goals, map, s) {
  const out = [];
  for (const g of goals) {
    if (g.type === 'reach') {
      const t = map.marks.G[0];
      const ok = s.x === t.x && s.y === t.y;
      out.push({ ok, msg: ok ? 'Robot dojel do cíle.' : `Robot skončil na ${human(s.x, s.y)}, cíl je na ${human(t.x, t.y)}.` });
    } else if (g.type === 'face') {
      const [ax, ay] = ahead(s);
      const ok = map.marks.A.some(a => a.x === ax && a.y === ay);
      out.push({ ok, msg: ok ? 'Robot je natočený k anténě.' : `Robot se nedívá na anténu (stojí na ${human(s.x, s.y)}, dívá se na ${DIR_LABELS[s.dir]}).` });
    } else if (g.type === 'collectAll') {
      const left = Object.entries(s.items).filter(([, t]) => !g.item || t === g.item);
      const ok = left.length === 0;
      const name = g.item === 'V' ? 'vzorek' : 'baterii';
      out.push({ ok, msg: ok ? 'Všechno je posbírané.' : `Nevzal ${name} na ${left.map(([k]) => human(...k.split(',').map(Number))).join(', ')}.` });
    } else if (g.type === 'visitAll') {
      const miss = map.marks.K.filter(k => !s.visited.includes(pos(k.x, k.y)));
      out.push({ ok: !miss.length, msg: miss.length ? `Robot neprojel kontrolním bodem ${miss.map(k => human(k.x, k.y)).join(', ')}.` : 'Všechny kontrolní body jsou prověřené.' });
    } else if (g.type === 'returnStart') {
      const ok = s.x === map.start.x && s.y === map.start.y && (!g.dir || s.dir === map.start.dir);
      out.push({ ok, msg: ok ? 'Robot se vrátil na start.' : `Robot se má vrátit na start ${human(map.start.x, map.start.y)}${g.dir ? ` a dívat se na ${DIR_LABELS[map.start.dir]}` : ''}.` });
    } else if (g.type === 'deliver') {
      const ok = s.delivered >= g.count;
      out.push({ ok, msg: ok ? 'Baterie jsou doručené do sondy.' : `Do sondy je doručeno ${s.delivered} z ${g.count} baterií.` });
    } else {
      throw new Error('neznámý cíl ' + g.type);
    }
  }
  return out;
}

/**
 * Vyhodnotí program pro misi na všech variantách mapy.
 * Vrací { success, variants: [{ name, ok, failures, steps, trace }], requirements: [{ ok, msg }], blocks, steps }.
 */
export function evaluateMission(mission, program) {
  const variants = mission.maps.map((def, i) => {
    const map = parseMap(def);
    const { state, trace, conds } = runProgram(program, map);
    const failures = [];
    if (state.error) failures.push(state.error.msg);
    for (const g of checkGoals(mission.goals, map, state)) if (!g.ok) failures.push(g.msg);
    return { name: def.name || `Mapa ${i + 1}`, ok: failures.length === 0, failures, steps: state.steps, trace, conds, state };
  });
  const req = mission.requires || {};
  const requirements = [];
  const blocks = countBlocks(program);
  if (!program.length) requirements.push({ ok: false, msg: 'Program je prázdný – přidej příkazy.' });
  if (req.repeat) requirements.push({ ok: uses(program, 'repeat'), msg: 'V této misi musíš použít blok Opakuj.' });
  if (req.if) {
    const used = uses(program, 'if');
    requirements.push({ ok: used, msg: 'V této misi musíš použít blok Když.' });
    if (used) {
      const everTrue = variants.some(v => Object.values(v.conds).some(c => c.true > 0));
      requirements.push({ ok: everTrue, msg: 'Podmínka se nikdy nevyhodnotila jako pravda – blok Když nic nerozhodl.' });
    }
  }
  if (req.maxBlocks) requirements.push({ ok: blocks <= req.maxBlocks, msg: `Program má ${blocks} bloků, povoleno je nejvýš ${req.maxBlocks}.` });
  const success = variants.every(v => v.ok) && requirements.every(r => r.ok);
  return { success, variants, requirements, blocks, steps: Math.max(...variants.map(v => v.steps)) };
}

/** Existuje vůbec cesta ze startu na každé cílové/sběrné políčko? (kontrola řešitelnosti map) */
export function reachable(map) {
  const seen = new Set([pos(map.start.x, map.start.y)]);
  const q = [[map.start.x, map.start.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of Object.values(DELTA)) {
      const nx = x + dx, ny = y + dy;
      if (blocked(map, nx, ny) || seen.has(pos(nx, ny))) continue;
      seen.add(pos(nx, ny));
      q.push([nx, ny]);
    }
  }
  return seen;
}

/* ---------- Hodnocení ---------- */
export function stars({ blocks, par, hints }) {
  if (hints === 0 && blocks <= par) return 3;
  if (hints <= 1 || blocks <= par + 2) return 2;
  return 1;
}
export function points({ blocks, par, hints }) {
  return 100 + (blocks <= par ? 30 : 0) + (hints === 0 ? 20 : 0);
}

/* ---------- Pomocník pro zápis programů v datech a testech ----------
   P('F F L', ['R', 3, 'F'], ...) – krátký zápis: F vpřed, L vlevo, R vpravo, T vezmi, P polož,
   ['R', n, ...] opakuj, ['IF', 'wallAhead', [then], [else]] když. */
let seq = 0;
export function P(...parts) {
  const out = [];
  const add = x => {
    if (typeof x === 'string') {
      for (const t of x.trim().split(/\s+/).filter(Boolean)) {
        const op = { F: 'forward', L: 'left', R: 'right', T: 'pick', P: 'drop' }[t];
        if (!op) throw new Error('neznámá zkratka ' + t);
        out.push({ id: `n${++seq}`, op });
      }
    } else if (x[0] === 'R') {
      out.push({ id: `n${++seq}`, op: 'repeat', n: x[1], body: P(...x.slice(2)) });
    } else if (x[0] === 'IF') {
      out.push({ id: `n${++seq}`, op: 'if', cond: x[1], then: P(...[].concat(x[2] || [])), else: P(...[].concat(x[3] || [])) });
    } else throw new Error('neznámá část programu');
  };
  parts.forEach(add);
  return out;
}
