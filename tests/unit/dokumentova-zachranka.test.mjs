// Unit testy Dokumentové záchranky: model dokumentu, Zpět/Znovu, vyhodnocení cílů a řešitelnost všech misí.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../public/aplikace/dokumentova-zachranka/model.js';
import { evaluate, evaluateObjective, textSignature, stars, points } from '../../public/aplikace/dokumentova-zachranka/checks.js';
import { MISSIONS, ILLUSTRATIONS } from '../../public/aplikace/dokumentova-zachranka/missions.js';

const mission = id => MISSIONS.find(m => m.id === id);
const start = id => M.fromSpec(mission(id).initialDocument);
const mark = (doc, id, text, m) => {
  const b = M.find(doc, id);
  const at = b.text.indexOf(text);
  assert.ok(at >= 0, `"${text}" v ${id}`);
  return M.toggleMark(doc, id, at, at + text.length, m);
};
/** Seřadí dokument do zadaného pořadí jen pomocí tlačítek Nahoru/Dolů (jako žák). */
function arrange(doc, ids) {
  for (let k = 0; k < ids.length; k++) {
    let i = doc.findIndex(b => b.id === ids[k]);
    while (i > k) { doc = M.move(doc, ids[k], -1); i--; }
  }
  return doc;
}

/* ---------- Model ---------- */
test('fromSpec: značky podle podřetězců, chybný podřetězec je chyba definice', () => {
  const d = M.fromSpec([{ id: 'a', text: 'Ahoj světe', bold: ['světe'] }]);
  assert.deepEqual(d[0].marks, [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
  assert.throws(() => M.fromSpec([{ id: 'a', text: 'Ahoj', bold: ['xyz'] }]));
});

test('toggleMark: správný úsek, přepnutí zpět, kombinace značek; vstup se nemění', () => {
  const d0 = M.fromSpec([{ id: 'a', text: 'Sběr papíru ve čtvrtek' }]);
  const d1 = M.toggleMark(d0, 'a', 12, 22, 'b');
  assert.deepEqual(d0[0].marks.filter(Boolean), [], 'původní dokument beze změny');
  assert.ok(M.rangeHasMark(d1[0], 12, 22, 'b'));
  assert.ok(!M.rangeHasMark(d1[0], 0, 12, 'b'));
  const d2 = M.toggleMark(d1, 'a', 12, 22, 'b');
  assert.ok(d2[0].marks.every(m => m === 0), 'druhé použití značku odebere');
  const d3 = M.toggleMark(M.toggleMark(d1, 'a', 15, 22, 'i'), 'a', 0, 4, 'u');
  assert.equal(d3[0].marks[16], 1 | 2);
  assert.equal(d3[0].marks[0], 4);
  assert.equal(M.toggleMark(d0, 'a', 5, 5, 'b'), d0, 'prázdný výběr nic nemění');
});

test('replaceText: značky zůstanou u svých znaků, vložený text dědí značku', () => {
  let d = M.fromSpec([{ id: 'a', text: 'Ve středu  15.10.', bold: ['15.10.'] }]);
  d = M.replaceText(d, 'a', 'Ve středu 15. 10.');
  const b = d[0];
  assert.equal(b.text, 'Ve středu 15. 10.');
  assert.equal(b.marks.length, b.text.length);
  assert.ok(M.rangeHasMark(b, 10, 17, 'b'), 'datum zůstalo tučně i s vloženou mezerou');
  assert.ok(!M.rangeHasMark(b, 0, 9, 'b'));
  assert.equal(M.replaceText(d, 'a', 'x\ny')[0].text, 'x y', 'zalomení řádku se převede na mezeru');
});

test('setType, toggleList, setAlign, move, obrázek', () => {
  let d = M.fromSpec([{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }]);
  d = M.setType(d, 'a', 'heading1');
  assert.equal(d[0].type, 'heading1');
  d = M.toggleList(d, 'b', 'bullet');
  assert.equal(M.find(d, 'b').type, 'bullet');
  assert.equal(M.find(M.toggleList(d, 'b', 'bullet'), 'b').type, 'paragraph', 'druhé stisknutí seznam zruší');
  d = M.setAlign(d, ['b', 'c'], 'center');
  assert.equal(M.find(d, 'c').align, 'center');
  assert.deepEqual(M.move(d, 'c', -1).map(b => b.id), ['a', 'c', 'b']);
  assert.equal(M.move(d, 'a', -1), d, 'první blok výš nejde');
  d = M.insertImage(d, 'a', 'robot', 'img1');
  assert.deepEqual(d.map(b => b.id), ['a', 'img1', 'b', 'c']);
  d = M.setImage(d, 'img1', { caption: 'Náš\nrobot', position: 'right' });
  assert.equal(M.find(d, 'img1').caption, 'Náš robot');
  assert.equal(M.find(d, 'img1').position, 'right');
  assert.equal(M.find(M.setType(d, 'img1', 'heading1'), 'img1').type, 'image', 'obrázek styl nemění');
  assert.throws(() => M.setType(d, 'a', 'heading7'));
});

test('structure: po sobě jdoucí položky tvoří jeden seznam, jiný typ seznam rozdělí', () => {
  let d = M.fromSpec(['a', 'b', 'c', 'd', 'e'].map(id => ({ id, text: id })));
  d = M.setType(d, ['b', 'c'], 'bullet');
  d = M.setType(d, ['d'], 'number');
  const s = M.structure(d);
  assert.deepEqual(s.map(g => g.type), ['paragraph', 'bulletedList', 'numberedList', 'paragraph']);
  assert.deepEqual(s[1].items.map(i => i.id), ['b', 'c']);
});

test('History: Zpět/Znovu, spojování psaní, reset jako krok, nová akce maže Znovu', () => {
  const d0 = start('ztraceny-titulek');
  const h = new M.History(d0);
  const d1 = M.setType(d0, 'titul', 'heading1');
  h.push(d1, 'Nadpis 1');
  h.push(M.replaceText(h.doc, 'p2', 'Redakce hledá posily.'), 'psaní', 'type:p2');
  h.push(M.replaceText(h.doc, 'p2', 'Redakce hledá nové posily.'), 'psaní', 'type:p2');
  assert.equal(h.past.length, 2, 'psaní ve stejném bloku je jeden krok');
  h.undo();
  assert.equal(M.find(h.doc, 'p2').text, mission('ztraceny-titulek').initialDocument[3].text);
  assert.equal(M.find(h.doc, 'titul').type, 'heading1');
  h.undo();
  assert.equal(h.doc, d0);
  assert.equal(h.undo(), null, 'nic dalšího k vrácení');
  h.redo();
  assert.equal(M.find(h.doc, 'titul').type, 'heading1');
  h.push(start('ztraceny-titulek'), 'Nový pokus');
  assert.equal(h.canRedo, false, 'nová akce smaže Znovu');
  assert.equal(M.find(h.doc, 'titul').type, 'paragraph', 'reset vrátí původní dokument');
  h.undo();
  assert.equal(M.find(h.doc, 'titul').type, 'heading1', 'i reset jde vrátit');
  assert.ok(h.log.includes('Nový pokus'));
});

/* ---------- Vyhodnocení ---------- */
test('mark: přesný úsek ano, celý odstavec ne, jen část ne', () => {
  const m = mission('dulezita-zprava');
  const d0 = start(m.id);
  const target = m.objectives[0];
  assert.ok(!evaluateObjective(target, d0, d0).ok);
  const good = mark(d0, 'p', 've čtvrtek 14. listopadu', 'b');
  assert.ok(evaluateObjective(target, good, d0).ok);
  const whole = M.toggleMark(d0, 'p', 0, M.find(d0, 'p').text.length, 'b');
  assert.match(evaluateObjective(target, whole, d0).detail, /jen zadaný úsek/);
  const part = mark(d0, 'p', 've čtvrtek', 'b');
  assert.match(evaluateObjective(target, part, d0).detail, /není celé/);
  // výběr i s mezerou navíc na okraji je v pořádku
  const b = M.find(d0, 'p'); const at = b.text.indexOf('ve čtvrtek 14. listopadu');
  assert.ok(evaluateObjective(target, M.toggleMark(d0, 'p', at - 1, at + 25, 'b'), d0).ok);
  // značka na sousedním slově je chyba
  assert.ok(!evaluateObjective(target, M.toggleMark(good, 'p', 0, 4, 'b'), d0).ok);
});

test('seznam a nadpisy: typ, pořadí, souvislost', () => {
  const m = mission('skolni-pravidla');
  const d0 = start(m.id);
  const o = m.objectives[0];
  let d = M.setType(d0, ['s1', 's2', 's3', 's4', 's5'], 'number');
  assert.match(evaluateObjective(o, d, d0).detail, /pořadí/);
  d = arrange(d, ['h', 'p', 's1', 's2', 's3', 's4', 's5']);
  assert.ok(evaluateObjective(o, d, d0).ok);
  assert.match(evaluateObjective(o, M.setType(d, 's3', 'bullet'), d0).detail, /číslovaný/);
  assert.match(evaluateObjective(o, M.setType(d, 's3', 'paragraph'), d0).detail, /není položka/);
  const split = M.move(M.setType(d, 'p', 'paragraph'), 'p', 2); // úvodní věta mezi položky
  assert.ok(!evaluateObjective(o, split, d0).ok);
  const h = mission('ztraceny-titulek');
  const t0 = start(h.id);
  assert.match(evaluateObjective(h.objectives[0], t0, t0).detail, /Odstavec, má být Nadpis 1/);
  assert.match(evaluateObjective(h.objectives[4], M.setType(t0, ['titul', 'podtitul'], 'heading1'), t0).detail, /2× Nadpis 1/);
});

test('pořadí odstavců', () => {
  const m = mission('rozbita-reportaz');
  const d0 = start(m.id);
  assert.equal(evaluate(m, d0, d0).done, false);
  const d = arrange(d0, ['h', 'a', 'b', 'c', 'd', 'e']);
  assert.ok(evaluate(m, d, d0).done);
  assert.ok(!evaluate(m, M.move(d, 'h', 1), d0).done, 'nadpis musí zůstat nahoře');
});

test('obrázek: správná ilustrace, místo, umístění a popisek', () => {
  const m = mission('obrazek-na-uteku');
  const d0 = start(m.id);
  const wrong = M.insertImage(d0, 'p2', 'mic', 'x');
  assert.match(evaluateObjective(m.objectives[0], wrong, d0).detail, /není ta správná/);
  let d = M.insertImage(d0, 'p1', 'zahon', 'x');
  assert.match(evaluateObjective(m.objectives[1], d, d0).detail, /hned za odstavcem/);
  d = M.move(d, 'x', 1);
  assert.ok(evaluateObjective(m.objectives[1], d, d0).ok);
  assert.match(evaluateObjective(m.objectives[3], M.setImage(d, 'x', { caption: 'Obrázek' }), d0).detail, /krátký/);
  assert.match(evaluateObjective(m.objectives[3], M.setImage(d, 'x', { caption: 'Tady je hezký obrázek' }), d0).detail, /neříká/);
  assert.ok(evaluateObjective(m.objectives[3], M.setImage(d, 'x', { caption: 'Nové záhony se zeleninou' }), d0).ok);
  assert.match(evaluateObjective(m.objectives[2], M.setImage(d, 'x', { position: 'left' }), d0).detail, /vlevo/);
});

test('typografie: konkrétní pravidla na textu, ne na CSS', () => {
  const m = mission('typograficky-audit');
  const d0 = start(m.id);
  const r0 = evaluate(m, d0, d0);
  assert.equal(r0.results.filter(r => !r.ok && r.kind === 'typo').length, 4);
  // smazat text nejde – kontrola zachování textu
  const cheat = M.replaceText(d0, 'p2', 'Hrají se zápasy.');
  assert.ok(!evaluate(m, cheat, d0).results.find(r => r.kind === 'keepText').ok);
  // napůl opravené datum
  const half = M.replaceText(d0, 'p1', 'Ve středu 15. 10.2026 se v tělocvičně koná turnaj ve florbale.');
  assert.ok(!evaluateObjective(m.objectives[3], half, d0).ok);
});

test('textSignature ignoruje jen mezery', () => {
  const a = M.fromSpec([{ id: 'a', text: 'den 15.10.2026 ,a' }]);
  assert.equal(textSignature(a), textSignature(M.replaceText(a, 'a', 'den 15. 10. 2026, a')));
  assert.notEqual(textSignature(a), textSignature(M.replaceText(a, 'a', 'den 15. 10. 2025, a')));
});

/* ---------- Každá mise je řešitelná (postupem přes operace editoru) ---------- */
const SOLUTIONS = {
  'ztraceny-titulek': d => M.setType(M.setType(d, 'titul', 'heading1'), 'podtitul', 'heading2'),
  'dulezita-zprava': d => mark(mark(d, 'p', 've čtvrtek 14. listopadu', 'b'), 'p', 'Krabice prosím rozložte', 'i'),
  'rozsypane-informace': d => ['l1', 'l2', 'l3', 'l4'].reduce((x, id) => M.toggleList(x, id, 'bullet'), d),
  'pozvanka': d => M.setAlign(M.setAlign(d, 'h', 'center'), ['p1', 'p2', 'p3'], 'left'),
  'rozbita-reportaz': d => arrange(d, ['h', 'a', 'b', 'c', 'd', 'e']),
  'skolni-pravidla': d => M.setType(arrange(d, ['h', 'p', 's1', 's2', 's3', 's4', 's5']), ['s1', 's2', 's3', 's4', 's5'], 'number'),
  'obrazek-na-uteku': d => M.setImage(M.insertImage(d, 'p2', 'zahon', 'img'), 'img', { caption: 'Nové vyvýšené záhony se zeleninou' }),
  'typograficky-audit': d => {
    d = M.replaceText(d, 'p1', 'Ve středu 15. 10. 2026 se v tělocvičně koná turnaj ve florbale.');
    d = M.replaceText(d, 'p2', 'Hrají se zápasy pětičlenných týmů, každý tým má aspoň jednu dívku.');
    d = M.replaceText(d, 'p3', 'Přihlášky odevzdejte do pátku 10. 10. 2026 u třídní učitelky!');
    return M.replaceText(d, 'p4', 'Vstup pro diváky je zdarma. Přijďte fandit!');
  },
  'clanek-do-casopisu': d => {
    d = M.setType(d, 't', 'heading1');
    d = M.setType(d, ['sub', 's1', 's2'], 'heading2');
    d = M.setAlign(d, ['t', 'sub'], 'center');
    d = M.setAlign(d, ['p1', 'p2', 'p4'], 'left');
    d = M.setType(d, ['l1', 'l2', 'l3'], 'bullet');
    d = M.setImage(M.insertImage(d, 'p1', 'robot', 'img'), 'img', { caption: 'Robot týmu Šroubci na dráze' });
    return mark(d, 'p1', 'Šroubci', 'b');
  },
  'redaktor-pod-tlakem': d => {
    d = M.setType(d, 't', 'heading1');
    d = M.setType(d, ['s1', 's2'], 'heading2');
    d = M.setType(d, ['l1', 'l2', 'l3'], 'bullet');
    d = M.move(d, 's2', -1);
    d = M.replaceText(d, 'p1', 'Od pondělí si můžete půjčit přes sto nových titulů. Knihy vybírali sami žáci v anketě.');
    d = M.replaceText(d, 'p3', 'Knihovna je otevřená v úterý a ve čtvrtek od 12:30 do 14:00. Výpůjčka trvá tři týdny, pak je potřeba knihu vrátit.');
    d = M.replaceText(d, 'p4', 'Slavnostní otevření nového oddělení proběhne 3. 11. 2026 ve velké přestávce.');
    const p4 = M.find(d, 'p4');
    d = M.toggleMark(d, 'p4', 0, p4.text.length, 'b');
    return M.setImage(d, 'img', { caption: 'Nové knihy v regálu', position: 'center' });
  }
};

test('obsah: 10 misí (4 + 4 + 2), povinná pole, 3 úrovně nápovědy, platné ilustrace', () => {
  assert.equal(MISSIONS.length, 10);
  const count = d => MISSIONS.filter(m => m.difficulty === d).length;
  assert.deepEqual([count('zacatecnik'), count('pokrocily'), count('expert')], [4, 4, 2]);
  const ids = new Set();
  for (const m of MISSIONS) {
    for (const k of ['id', 'title', 'grade', 'difficulty', 'story', 'instructions', 'initialDocument', 'objectives', 'hints', 'successExplanation']) assert.ok(k in m, `${m.id}: ${k}`);
    assert.ok(!ids.has(m.id)); ids.add(m.id);
    assert.ok(m.noHints || m.hints.length === 3, `${m.id}: 3 úrovně nápovědy`);
    const sentences = m.instructions.split(/[.!?](?:\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ„])|$)/).filter(x => x.trim());
    assert.ok(sentences.length <= 3, `${m.id}: instrukce max. 3 věty (${sentences.length})`);
    const blockIds = m.initialDocument.map(b => b.id);
    assert.equal(new Set(blockIds).size, blockIds.length, `${m.id}: unikátní id bloků`);
    for (const b of m.initialDocument.filter(b => b.type === 'image')) assert.ok(ILLUSTRATIONS.some(i => i.id === b.src));
  }
  assert.ok(mission('clanek-do-casopisu').objectives.length >= 7, 'expertní článek má aspoň 7 kontrol');
});

for (const m of MISSIONS) {
  test(`mise ${m.id}: na začátku nesplněná, po řešení splněná`, () => {
    const d0 = M.fromSpec(m.initialDocument);
    const before = evaluate(m, d0, d0);
    assert.equal(before.done, false, 'mise nesmí být hotová hned na začátku');
    const after = evaluate(m, SOLUTIONS[m.id](d0), d0);
    assert.deepEqual(after.results.filter(r => !r.ok).map(r => `${r.label}: ${r.detail}`), []);
    assert.ok(after.done);
    // vyhodnocení je deterministické a nemění dokument
    assert.deepEqual(evaluate(m, SOLUTIONS[m.id](d0), d0), after);
  });
}

test('expertní mise 10 obsahuje 8–10+ různých chyb', () => {
  const m = mission('redaktor-pod-tlakem');
  const d0 = start(m.id);
  const failing = evaluate(m, d0, d0).results.filter(r => !r.ok).length;
  assert.ok(failing >= 8, `chyb na začátku: ${failing}`);
});

test('více kol kontroly: částečná oprava se počítá, stav se neztrácí', () => {
  const m = mission('clanek-do-casopisu');
  const d0 = start(m.id);
  const r0 = evaluate(m, d0, d0);
  const d1 = M.setAlign(d0, 't', 'center');
  const r1 = evaluate(m, d1, d0);
  assert.equal(r1.passed, r0.passed + 1);
  const d2 = M.setType(d1, 's1', 'heading2');
  assert.equal(evaluate(m, d2, d0).passed, r1.passed + 1);
});

test('hvězdy a body', () => {
  assert.equal(stars({ hints: 0, checks: 1 }), 3);
  assert.equal(stars({ hints: 0, checks: 3 }), 2);
  assert.equal(stars({ hints: 1, checks: 9 }), 2);
  assert.equal(stars({ hints: 3, checks: 6 }), 1);
  assert.equal(points({ total: 5, hints: 0 }), 70);
  assert.equal(points({ total: 5, hints: 2 }), 50);
});
