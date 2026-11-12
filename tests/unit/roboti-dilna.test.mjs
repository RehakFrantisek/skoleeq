// Unit testy Robotí dílny: simulátor, interpret (cykly, podmínky, krokování, limit),
// vyhodnocení misí a řešitelnost všech 12 misí včetně alternativních řešení a více map.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../../public/aplikace/roboti-dilna/engine.js';
import { MISSIONS } from '../../public/aplikace/roboti-dilna/missions.js';

const { P } = E;
const open = (rows, dir = 'E') => E.parseMap({ rows, dir });
const run = (prog, map) => E.runProgram(prog, map);
const mission = id => MISSIONS.find(m => m.id === id);

/* ---------- Pohyb, rotace, kolize ---------- */
test('pohyb vpřed a rotace ve všech směrech', () => {
  const map = open(['.....', '..S..', '.....'], 'N');
  const r = run(P('R F L L F F'), map);
  assert.deepEqual([r.state.x, r.state.y, r.state.dir], [1, 1, 'W']);
  assert.equal(run(P('L L L L'), map).state.dir, 'N', '4× vlevo = původní směr');
  assert.equal(run(P('R R'), map).state.dir, 'S');
  assert.equal(r.state.steps, 6);
  assert.deepEqual(r.trace.map(t => `${t.x},${t.y}`), ['2,1', '2,1', '3,1', '3,1', '3,1', '2,1', '1,1']);
});

test('okraj mapy a zeď robota zastaví s informativní chybou', () => {
  const edge = run(P('F F F'), open(['S.']));
  assert.equal(edge.state.error.code, 'edge');
  assert.equal(edge.state.x, 1, 'robot zůstal na posledním platném políčku');
  assert.match(edge.state.error.msg, /vyjel z mapy/);
  const wall = run(P('F F'), open(['S.#']));
  assert.equal(wall.state.error.code, 'wall');
  assert.equal(wall.state.error.msg, 'Robot narazil do zdi na políčku [3, 1].');
  assert.equal(run(P('F'), open(['So'])).state.error.msg, 'Robot narazil do kamene na políčku [2, 1].');
  assert.equal(wall.state.steps, 2, 'po chybě se nic dalšího neprovede');
  const after = run(P('F F R R'), open(['S.#']));
  assert.equal(after.state.dir, 'E', 'otočky po nárazu se neprovedly');
});

test('Vezmi / Polož: baterie, vzorky, dok, chyby', () => {
  const map = open(['SBVD']);
  let r = run(P('F T F T F P'), map);
  assert.equal(r.state.delivered, 1);
  assert.deepEqual(r.state.carrying, { B: 0, V: 1 });
  r = run(P('T'), map);
  assert.match(r.state.error.msg, /není nic/);
  r = run(P('P'), map);
  assert.match(r.state.error.msg, /nemá žádnou baterii/);
  r = run(P('F T F P'), map);
  assert.match(r.state.error.msg, /už něco leží/, 'na vzorek baterii položit nejde');
  r = run(P('F T L L F P'), open(['.SB']));
  assert.equal(r.state.items['1,0'], 'B', 'baterie položená mimo dok zůstane ležet');
});

/* ---------- Cykly a vnoření ---------- */
test('opakování a vnořené opakování', () => {
  const map = open(['S.........']);
  assert.equal(run(P(['R', 5, 'F']), map).state.x, 5);
  assert.equal(run(P(['R', 3, ['R', 2, 'F']]), map).state.x, 6, '3 × 2 kroky');
  assert.equal(run(P(['R', 0, 'F']), map).state.x, 0, 'nula opakování = nic');
  assert.equal(E.countBlocks(P(['R', 3, ['R', 2, 'F'], 'L'])), 4);
  assert.equal(E.depth(P(['R', 3, ['R', 2, 'F']])), 2);
  assert.ok(E.uses(P('F', ['R', 2, ['IF', 'wallAhead', ['L'], []]]), 'if'));
});

test('příliš hluboké vnoření a limit instrukcí skončí bezpečně s vysvětlením', () => {
  const map = open(['S.', '..']);
  const deep = run(P(['R', 2, ['R', 2, ['R', 2, ['R', 2, 'L']]]]), map);
  assert.equal(deep.state.error.code, 'depth');
  const forever = run(P(['R', 20, ['R', 20, ['R', 20, 'L']]]), map);
  assert.equal(forever.state.error.code, 'limit');
  assert.equal(forever.state.steps, E.LIMIT + 1);
  assert.match(forever.state.error.msg, /dokola/);
  assert.equal(run(P(['R', 99, 'L']), map).state.steps, E.MAX_REPEAT, 'počet opakování je omezený');
});

/* ---------- Podmínky za běhu ---------- */
test('podmínka se vyhodnocuje za běhu podle aktuálního stavu', () => {
  const map = open(['S..#']);
  // opakuj 5×: když překážka → vlevo, jinak vpřed
  const r = run(P(['R', 5, ['IF', 'wallAhead', ['L'], ['F']]]), map);
  // vpřed, vpřed, zeď → vlevo (sever), okraj → vlevo (západ), volno → vpřed
  assert.deepEqual([r.state.x, r.state.dir], [1, 'W']);
  const c = Object.values(r.conds)[0];
  assert.deepEqual([c.true, c.false], [2, 3]);
  // na baterii: po sebrání už podmínka neplatí
  const b = run(P('F', ['IF', 'onBattery', ['T'], []], ['IF', 'onBattery', ['T'], []]), open(['SB.']));
  assert.equal(b.state.error, null);
  assert.equal(b.state.carrying.B, 1);
});

/* ---------- Krokování ---------- */
test('krokování: generátor vrací události postupně a jde kdykoli zastavit', () => {
  const map = open(['S...']);
  const prog = P(['R', 3, 'F'], 'L');
  const state = E.createState(map);
  const it = E.execute(prog, map, state);
  const e1 = it.next().value;
  assert.equal(e1.kind, 'step');
  assert.equal(state.x, 1);
  assert.deepEqual(e1.path, [prog[0].id, prog[0].body[0].id], 'cesta ke zvýrazněnému bloku');
  it.next(); it.next();
  const e4 = it.next().value;
  assert.equal(e4.node.op, 'left');
  assert.equal(it.next().value.kind, 'end');
  assert.ok(it.next().done);
  // zastavení uprostřed: stav zůstane, kde je
  const s2 = E.createState(map);
  const it2 = E.execute(prog, map, s2);
  it2.next(); it2.return();
  assert.equal(s2.x, 1);
  assert.equal(s2.done, false);
});

/* ---------- Mapy a mise ---------- */
test('parser mapy odmítne chyby', () => {
  assert.throws(() => E.parseMap({ rows: ['S.', '...'] }));
  assert.throws(() => E.parseMap({ rows: ['..', '..'] }), /start/);
  assert.throws(() => E.parseMap({ rows: ['S?'] }), /neznámý znak/);
});

test('obsah: 12 misí ve 3 kapitolách, každá má mapu, cíle, bloky, 3 nápovědy a referenci', () => {
  assert.equal(MISSIONS.length, 12);
  for (const ch of [1, 2, 3]) assert.equal(MISSIONS.filter(m => m.chapter === ch).length, 4);
  for (const m of MISSIONS) {
    for (const k of ['id', 'title', 'story', 'task', 'blocks', 'maps', 'goals', 'reference', 'hints']) assert.ok(m[k], `${m.id}: ${k}`);
    assert.equal(m.hints.length, 3, `${m.id}: 3 nápovědy`);
    for (const def of m.maps) {
      const map = E.parseMap(def);
      assert.ok(map.w >= 2 && map.w <= 10 && map.h <= 10, `${m.id}: mapa max 10×10`);
      const reach = E.reachable(map);
      for (const k of [...map.marks.G, ...map.marks.D, ...map.marks.K, ...Object.keys(map.items).map(p => ({ x: +p.split(',')[0], y: +p.split(',')[1] }))]) {
        assert.ok(reach.has(E.pos(k.x, k.y)), `${m.id}: políčko ${k.x},${k.y} je dosažitelné`);
      }
    }
    // požadavek mise musí být výslovně v zadání
    if (m.requires?.repeat) assert.match(m.task, /Opakuj/, `${m.id}: zadání zmiňuje Opakuj`);
    if (m.requires?.if) assert.match(m.task, /Když/, `${m.id}: zadání zmiňuje Když`);
    if (m.requires?.maxBlocks) assert.match(m.task, new RegExp(String(m.requires.maxBlocks)), `${m.id}: zadání uvádí limit`);
    // reference používá jen odemčené bloky
    for (const n of E.walk(m.reference)) assert.ok(m.blocks.includes(n.op), `${m.id}: blok ${n.op} je odemčený`);
  }
});

for (const m of MISSIONS) {
  test(`mise ${m.id}: referenční program projde na všech mapách`, () => {
    const r = E.evaluateMission(m, m.reference);
    assert.deepEqual([...r.variants.flatMap(v => v.failures), ...r.requirements.filter(x => !x.ok).map(x => x.msg)], []);
    assert.ok(r.success);
    assert.equal(E.evaluateMission(m, []).success, false, 'prázdný program neprojde');
    if (m.initialProgram) assert.equal(E.evaluateMission(m, m.initialProgram).success, false, 'výchozí program ještě úlohu nesplňuje');
    for (const alt of m.alternatives || []) assert.ok(E.evaluateMission(m, alt).success, 'alternativní řešení je přijaté');
  });
}

/* ---------- Konkrétní pravidla misí ---------- */
test('alternativní správné řešení je přijaté, nejen autorský skript', () => {
  const m = mission('pozor-stena');
  assert.ok(E.evaluateMission(m, P('F F R F L F F L F R F F')).success, 'objetí zespodu');
  assert.ok(E.evaluateMission(mission('start-motoru'), P('F F F F L')).variants[0].failures.length === 1, 'jiné místo vedle antény, ale natočený jinam');
  assert.ok(E.evaluateMission(mission('start-motoru'), P('F F L F R')).success, 'natočit se k anténě jde i z vedlejšího políčka');
});

test('limit bloků i povinný cyklus', () => {
  const m = mission('nejkratsi-trasa');
  const long = E.evaluateMission(m, P('F F F F R F F F L R'));
  assert.equal(long.success, false);
  assert.match(long.requirements.find(r => !r.ok).msg, /nejvýš 9/);
  const z = mission('zkraceni-programu');
  const r = E.evaluateMission(z, z.initialProgram);
  assert.ok(r.variants[0].ok, 'původní program do cíle dojede…');
  assert.deepEqual(r.requirements.filter(x => !x.ok).map(x => x.msg), ['V této misi musíš použít blok Opakuj.', 'Program má 16 bloků, povoleno je nejvýš 6.']);
});

test('program se sekvencí neprojde na více mapách; podmínka, která nikdy neplatí, je nahlášena', () => {
  const m = mission('dve-cesty');
  const seq = E.evaluateMission(m, P('F F F R F F F'));
  assert.deepEqual(seq.variants.map(v => v.ok), [true, false]);
  assert.match(seq.variants[1].failures[0], /narazil do zdi/);
  const never = E.evaluateMission(mission('dvere-a-senzor'), P('F', ['IF', 'onBattery', ['L'], []], 'F F F'));
  assert.ok(never.requirements.some(r => !r.ok && /nikdy nevyhodnotila jako pravda/.test(r.msg)));
});

test('chybný program v misi 11 dává informativní důvod', () => {
  const m = mission('oprav-program');
  const r = E.evaluateMission(m, m.initialProgram);
  assert.match(r.variants[0].failures[0], /Na políčku \[6, 2\] není nic/);
  const half = E.evaluateMission(m, P(['R', 3, 'F'], 'T R F F L', ['R', 3, 'F'], 'P'));
  assert.match(half.variants[0].failures[0], /narazil do zdi/);
});

test('závěrečná mise: baterie na jiných místech – bez podmínky to nejde', () => {
  const m = mission('zachrana-sondy');
  const fixedForA = P('F F T F F F T F R F F R', ['R', 6, 'F'], 'P P');
  const r = E.evaluateMission(m, fixedForA);
  assert.equal(r.variants[0].ok, true);
  assert.equal(r.variants[1].ok, false);
  const nevzal = E.evaluateMission(m, P(['R', 6, 'F'], 'R F F R', ['R', 6, 'F'], 'P'));
  assert.match(nevzal.variants[0].failures.join(' '), /nemá žádnou baterii|Nevzal/);
});

test('hvězdy a body', () => {
  assert.equal(E.stars({ blocks: 5, par: 5, hints: 0 }), 3);
  assert.equal(E.stars({ blocks: 7, par: 5, hints: 0 }), 2);
  assert.equal(E.stars({ blocks: 9, par: 5, hints: 2 }), 1);
  assert.equal(E.points({ blocks: 5, par: 5, hints: 0 }), 150);
});
