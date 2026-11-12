// Unit testy logiky hry Grafový navigátor (node --test): grafové algoritmy, automat, rozvrh, generátor a vyhodnocení.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../public/aplikace/grafovy-navigator/logic.js';

const tiny = { nodes: ['A', 'B', 'C', 'D'].map(id => ({ id, x: 0, y: 0 })), edges: [{ a: 'A', b: 'B', w: 1 }, { a: 'B', b: 'C', w: 1 }, { a: 'A', b: 'C', w: 5 }, { a: 'C', b: 'D', w: 2 }] };

test('sousedé a hledání hran (neorientovaný i orientovaný graf)', () => {
  assert.deepEqual(L.neighbors(tiny, 'C').map(x => x.to).sort(), ['A', 'B', 'D']);
  const dir = { ...tiny, edges: tiny.edges.map(e => ({ ...e, dir: true })) };
  assert.deepEqual(L.neighbors(dir, 'C').map(x => x.to), ['D']);
  assert.ok(L.findEdge(tiny, 'C', 'A'));
  assert.equal(L.findEdge(dir, 'C', 'A'), null);
});

test('nejkratší cesta: ohodnocená vs. nejméně úseků', () => {
  assert.deepEqual(L.shortestPath(tiny, 'A', 'C'), { dist: 2, path: ['A', 'B', 'C'] });
  assert.deepEqual(L.shortestPath(tiny, 'A', 'C', false), { dist: 1, path: ['A', 'C'] });
  assert.deepEqual(L.pathInfo(tiny, ['A', 'B', 'C', 'D']), { valid: true, cost: 4 });
  assert.equal(L.pathInfo(tiny, ['A', 'D']).valid, false);
});

test('dosažitelnost v orientovaném grafu', () => {
  const dir = { ...tiny, edges: [{ a: 'A', b: 'B', dir: true }, { a: 'B', b: 'C', dir: true }, { a: 'D', b: 'C', dir: true }] };
  assert.deepEqual(L.canReach(dir, 'C').sort(), ['A', 'B', 'D']);
  assert.deepEqual(L.canReach(dir, 'A'), []);
  assert.equal(L.shortestPath(dir, 'C', 'A'), null);
});

test('kostra: Kruskal a rozbor sítě (okruh, odříznuté uzly)', () => {
  const m = L.minSpanningTree(tiny);
  assert.equal(m.cost, 4);
  assert.equal(m.edges.length, 3);
  const cyc = L.networkInfo(tiny, ['AB', 'BC', 'AC']);
  assert.ok(cyc.cycle);
  const cut = L.networkInfo(tiny, ['AB', 'BC']);
  assert.equal(cut.cycle, null);
  assert.equal(cut.groups.length, 2);
});

test('automat dveří: neplatný vstup nechá stav beze změny', () => {
  assert.deepEqual(L.runAutomaton(L.DOOR, ['klika', 'kód', 'klika', 'zamknout', 'zavřít']), { state: 'O', trace: ['Z', 'Z', 'O', 'T', 'T', 'O'] });
});

test('rozvrh dvou robotů: závislosti, překryv, nejkratší doba', () => {
  const jobs = [{ id: 'Z', d: 2, deps: [] }, { id: 'S', d: 3, deps: ['Z'] }, { id: 'K', d: 4, deps: [] }, { id: 'A', d: 1, deps: ['S', 'K'] }];
  const best = L.bestSchedule(jobs);
  assert.equal(best.end, 6);
  assert.deepEqual(L.scheduleInfo(jobs, best.sch).problems, []);
  const bad = { Z: { lane: 'A', start: 0 }, S: { lane: 'A', start: 1 }, K: { lane: 'A', start: 0 }, A: { lane: 'B', start: 9 } };
  const kinds = L.scheduleInfo(jobs, bad).problems.map(p => p.kind);
  assert.ok(kinds.includes('dep') && kinds.includes('overlap'));
});

test('generátor: deterministický, varianty se liší, 11 úloh / 5 v rychlém režimu, 5 úrovní', () => {
  assert.deepEqual(L.buildGame('B'), L.buildGame('B'));
  assert.notDeepEqual(L.buildGame('A'), L.buildGame('C'));
  for (const v of Object.keys(L.VARIANTS)) {
    const g = L.buildGame(v);
    assert.equal(g.length, 11);
    assert.deepEqual([...new Set(g.map(t => t.level))], [0, 1, 2, 3, 4]);
    assert.equal(L.buildGame(v, 'rychly').length, 5);
    const reach = g.find(t => t.id === 'reach');
    assert.ok(reach.answer.length >= 2 && reach.answer.length <= 4, `${v}: dosažitelnost má 2–4 odpovědi`);
    assert.ok(g.find(t => t.id === 'directed').best >= 3);
  }
});

test('každá úloha všech variant: řešení projde, prázdná odpověď ne, aspoň 2 nápovědy', () => {
  for (const v of Object.keys(L.VARIANTS)) {
    for (const t of [...L.buildGame(v), L.tutorialTask()]) {
      const r = L.check(t, L.solution(t));
      assert.ok(r.ok, `${v}/${t.id}: ${r.msg}`);
      assert.ok(t.hints.length >= 2, `${v}/${t.id} nápovědy`);
      const bad = L.check(t, {});
      assert.equal(bad.ok, false, `${v}/${t.id} prázdná odpověď`);
      assert.ok(bad.msg.length > 10);
    }
  }
});

test('vysvětlení chyb jsou konkrétní', () => {
  const g = L.buildGame('A');
  const sh = g.find(t => t.id === 'shortest');
  const longer = L.shortestPath(sh.graph, sh.from, sh.to, false).path;
  const info = L.pathInfo(sh.graph, longer);
  if (info.cost > sh.best) assert.match(L.check(sh, { path: longer }).msg, new RegExp(`jde to za ${sh.best}`));
  assert.match(L.check(sh, { path: [sh.from, L.neighbors(sh.graph, sh.from)[0].to] }).msg, /končí/);
  const en = g.find(t => t.id === 'energy');
  const mst = g.find(t => t.id === 'mst');
  const allKeys = mst.graph.edges.map(e => L.edgeKey(e.a, e.b));
  assert.match(L.check(mst, { edges: allKeys }).msg, /okruh/);
  assert.match(L.check(mst, { edges: [allKeys[0]] }).msg, /odříznut/);
  const nb = g.find(t => t.id === 'neighbors');
  const non = nb.graph.nodes.map(n => n.id).find(id => id !== nb.focusNode && !nb.answer.includes(id));
  assert.match(L.check(nb, { nodes: [...nb.answer, non] }).msg, /nevede přímá cesta/);
  const pl = g.find(t => t.id === 'plan');
  const seq = {}; let tm = 0;
  for (const j of pl.jobs) { seq[j.id] = { lane: 'A', start: tm }; tm += j.d; }
  const m = L.check(pl, { schedule: seq });
  if (tm > pl.best) assert.match(m.msg, /Cíl je/);
  assert.ok(en.budget === en.best);
  assert.equal(L.plural(1, 'úsek', 'úseky', 'úseků'), '1 úsek');
  assert.equal(L.plural(5, 'úsek', 'úseky', 'úseků'), '5 úseků');
});

test('isBetter', () => {
  assert.ok(L.isBetter({ firstTry: 3, hints: 2 }, { firstTry: 2, hints: 0 }));
  assert.ok(!L.isBetter({ firstTry: 3, hints: 2 }, { firstTry: 3, hints: 2 }));
});

test('výchozí plán je platný, ale pomalejší než cíl (žák ho musí zlepšit)', () => {
  for (const v of Object.keys(L.VARIANTS)) {
    for (const t of L.buildGame(v).filter(x => x.type === 'schedule')) {
      const info = L.scheduleInfo(t.jobs, L.defaultSchedule(t.jobs));
      assert.deepEqual(info.problems, [], `${v}/${t.id}`);
      assert.ok(info.end > t.best, `${v}/${t.id}: výchozí ${info.end} > cíl ${t.best}`);
      assert.equal(L.check(t, { schedule: L.defaultSchedule(t.jobs) }).ok, false);
    }
  }
});
