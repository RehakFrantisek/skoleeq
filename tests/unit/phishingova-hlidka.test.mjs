// Unit testy logiky hry Phishingová hlídka (node --test): obsah úloh, generátor misí, vyhodnocení, síla hesla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../public/aplikace/phishingova-hlidka/logic.js';

const ALL = [L.tutorialTask(), ...L.allTasks()];

test('obsah: unikátní id, smyšlené domény .test, každá úloha má nápovědy a dovednost', () => {
  const ids = new Set();
  for (const t of ALL) {
    assert.ok(!ids.has(t.id), `duplicitní id ${t.id}`); ids.add(t.id);
    assert.ok(t.hints.length >= 2, `${t.id}: aspoň 2 nápovědy`);
    assert.ok(L.SKILLS[t.skill], `${t.id}: neznámá dovednost ${t.skill}`);
    for (const s of L.spotsOf(t)) {
      assert.ok(s.clue || s.ok, `${t.id}/${s.id}: každá část má vysvětlení`);
      assert.ok(!(s.clue && s.ok), `${t.id}/${s.id}: buď stopa, nebo v pořádku`);
      const urls = `${s.text} ${s.href || ''}`.match(/[a-z0-9.-]+\.[a-z]{2,}(?=[/\s>]|$)/gi) || [];
      for (const u of urls) if (!/\.(pdf|exe|docx?|zip)$/i.test(u)) assert.match(u, /\.test$/i, `${t.id}: doména ${u} musí končit .test`);
    }
  }
});

test('obsah: id částí jsou v rámci zprávy unikátní, verdikty a počty stop dávají smysl', () => {
  for (const t of ALL.filter(x => x.type === 'inspect')) {
    const spotIds = L.spotsOf(t).map(s => s.id);
    assert.equal(new Set(spotIds).size, spotIds.length, `${t.id}: duplicitní id části`);
    assert.ok(t.accept.every(v => t.verdicts.includes(v)), `${t.id}: přijímaný verdikt není mezi nabízenými`);
    for (const v of t.verdicts) assert.ok(t.verdictWhy[v], `${t.id}: chybí vysvětlení verdiktu ${v}`);
    assert.ok(t.need <= L.cluesOf(t).length, `${t.id}: need je větší než počet stop`);
    if (t.need === 0) assert.equal(L.cluesOf(t).length, 0, `${t.id}: bezpečná zpráva nemá mít stopy`);
  }
});

test('každá úloha jde vyřešit a prázdná odpověď neprojde (ani se nepočítá jako pokus)', () => {
  for (const t of ALL) {
    assert.equal(L.check(t, L.solution(t)).ok, true, `${t.id}: řešení neprojde`);
    const empty = L.check(t, {});
    assert.equal(empty.ok, false);
    assert.equal(empty.incomplete, true);
  }
});

test('inspect: špatný verdikt, označená nevinná část i chybějící stopy mají vysvětlení', () => {
  const t = L.allTasks().find(x => x.id === 'e-plna-schranka');
  const wrongVerdict = L.check(t, { marks: L.solution(t).marks, verdict: 'bezpecne' });
  assert.equal(wrongVerdict.ok, false);
  assert.match(wrongVerdict.msg, /heslo/);

  const innocent = L.check(t, { marks: [...L.solution(t).marks, 'b3'], verdict: 'podvod' });
  assert.equal(innocent.ok, false);
  assert.deepEqual(innocent.wrong, ['b3']);
  assert.match(innocent.msg, /Tohle je v pořádku/);

  const few = L.check(t, { marks: ['from'], verdict: 'podvod' });
  assert.equal(few.ok, false);
  assert.equal(few.missing, 2);
  assert.match(few.msg, /aspoň 2 stopy/);

  // need = 3 z 5 stop: stačí tři
  assert.equal(L.check(t, { marks: ['from', 'b4', 'b5'], verdict: 'podvod' }).ok, true);
});

test('inspect: u zprávy „máma“ projde verdikt ověřit i podvod, u bezpečné zprávy nesmí být nic označeno', () => {
  const mama = L.allTasks().find(x => x.id === 's-mama');
  for (const v of ['overit', 'podvod']) assert.equal(L.check(mama, { marks: L.solution(mama).marks, verdict: v }).ok, true);
  assert.equal(L.check(mama, { marks: L.solution(mama).marks, verdict: 'bezpecne' }).ok, false);
  const safe = L.allTasks().find(x => x.id === 'e-skola-v-prirode');
  assert.equal(L.check(safe, { marks: [], verdict: 'bezpecne' }).ok, true);
  assert.equal(L.check(safe, { marks: ['b4'], verdict: 'bezpecne' }).ok, false);
});

test('síla hesla: délka vítězí, běžná slova, řady a osobní údaje se poznají', () => {
  const r = p => L.passwordReport(p, ['rex', '2013']);
  assert.equal(r('modry-slon-jede-tramvaji').level, 3);
  assert.ok(r('Heslo123!').level <= 1);
  assert.deepEqual(r('Heslo123!').common, ['heslo']);
  assert.ok(r('Heslo123!').sequences.includes('123'));
  assert.ok(r('P@ssw0rd').level === 0, 'záměny znaků útočníka nezastaví');
  assert.deepEqual(r('R3x-2013').personal, ['rex', '2013']);
  assert.equal(r('Kl0b0uk#7').level, 2, 'krátké složité heslo je jen střední');
  assert.equal(r('').level, 0);
  assert.deepEqual(r('stul-okno-strom-pes').sequences, [], 'běžná slova nejsou řady');
  assert.equal(L.crackTime(0), 'okamžitě');
  assert.equal(L.crackTime(200), 'víc než milion let');
  assert.match(L.crackTime(46), /^asi \d+ (minut|minuty|minutu)$/);
});

test('volba hesla: nejsilnější možnost podle modelu je ta správná', () => {
  const t = L.allTasks().find(x => x.id === 'h-nejsilnejsi');
  const bits = t.options.map(o => L.passwordReport(o).bits);
  assert.equal(bits.indexOf(Math.max(...bits)), t.correct);
});

test('stavba hesla: osobní údaj a běžné slovo neprojdou, krátké heslo dostane radu', () => {
  const t = L.allTasks().find(x => x.id === 'h-heslo-rex');
  assert.match(L.check(t, { value: 'Rex-je-nejlepsi-pes-2013' }).msg, /profilu/);
  assert.match(L.check(t, { value: 'mojeheslo-na-skolu-x' }).msg, /heslo/);
  assert.match(L.check(t, { value: 'Ab#9xk' }).msg, /delší/);
});

test('generátor: stejná varianta = stejné úlohy, varianty se liší, počty a úrovně sedí', () => {
  assert.deepEqual(L.buildGame('B').map(t => t.id), L.buildGame('B').map(t => t.id));
  const sets = ['A', 'B', 'C'].map(v => L.buildGame(v).map(t => t.id).join());
  assert.equal(new Set(sets).size, 3);
  for (const v of ['A', 'B', 'C']) {
    for (const mode of ['cela', 'rychly']) {
      const g = L.buildGame(v, mode);
      assert.equal(g.length, L.COUNTS[mode].reduce((a, b) => a + b, 0));
      L.COUNTS[mode].forEach((n, level) => assert.equal(g.filter(t => t.level === level).length, n));
      assert.deepEqual(g.map(t => t.level), [...g.map(t => t.level)].sort(), 'úrovně jdou popořadě');
      assert.equal(new Set(g.map(t => t.id)).size, g.length, 'žádná úloha dvakrát');
      assert.ok(g.some(t => t.type === 'password'), 'v každé misi je stavba hesla');
      for (const level of [0, 1, 3]) {
        const lv = g.filter(t => t.level === level);
        assert.ok(!lv[0].accept.includes('bezpecne') && !lv[0].accept.includes('zverejnit'), 'úroveň začíná jasným podvodem');
        if (lv.length >= 2) assert.ok(lv.some(t => t.accept.some(x => ['bezpecne', 'overit', 'zverejnit'].includes(x))), `${v}/${mode}/L${level}: chybí klidnější případ`);
      }
    }
  }
});

test('isBetter: přesnost, pak nápovědy, pak čas', () => {
  assert.equal(L.isBetter({ firstTry: 5, hints: 3 }, null), true);
  assert.equal(L.isBetter({ firstTry: 6, hints: 9 }, { firstTry: 5, hints: 0 }), true);
  assert.equal(L.isBetter({ firstTry: 5, hints: 1 }, { firstTry: 5, hints: 2 }), true);
  assert.equal(L.isBetter({ firstTry: 5, hints: 1, ms: 9 }, { firstTry: 5, hints: 1, ms: 10 }), true);
  assert.equal(L.isBetter({ firstTry: 5, hints: 1 }, { firstTry: 5, hints: 1 }), false);
});
