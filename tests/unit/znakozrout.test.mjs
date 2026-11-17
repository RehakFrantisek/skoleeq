// Unit testy logiky hry Znakožrout (node --test): rozložení klávesnice, generátor, vyhodnocení a hesla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../public/aplikace/znakozrout/logic.js';

const ALL = ['A', 'B', 'C'].flatMap(v => ['cela', 'rychly'].map(m => [v, m]));

test('česká klávesnice: známé znaky jsou na správné klávese a vrstvě', () => {
  const expect = { '@': ['KeyV', 'altgr'], '#': ['KeyX', 'altgr'], '€': ['KeyE', 'altgr'], '?': ['Comma', 'shift'], ':': ['Period', 'shift'],
    '_': ['Slash', 'shift'], '%': ['Minus', 'shift'], '°': ['Backquote', 'shift'], '(': ['BracketRight', 'shift'], ')': ['BracketRight', 'base'],
    '!': ['Quote', 'shift'], '"': ['Semicolon', 'shift'], '$': ['Semicolon', 'altgr'], '*': ['Slash', 'altgr'], '<': ['Comma', 'altgr'],
    '×': ['BracketRight', 'altgr'], '÷': ['BracketLeft', 'altgr'], '/': ['BracketLeft', 'shift'], '+': ['Digit1', 'base'], '5': ['Digit5', 'shift'], 'ř': ['Digit5', 'base'] };
  for (const [ch, [code, layer]] of Object.entries(expect)) assert.deepEqual(L.WHERE[ch], { code, layer }, ch);
  assert.equal(L.combo('@'), 'pravý Alt (AltGr) + V');
  assert.equal(L.combo('?'), 'Shift + , (čárka)');
  assert.equal(L.keyCap('KeyY'), 'Z'); // QWERTZ: na místě Y je Z
});

test('každý znak v úlohách je na klávesnici a má jméno', () => {
  for (const [v, m] of ALL) {
    for (const t of L.buildGame(v, m)) {
      const chars = t.type === 'where' ? t.chars : t.type === 'blanks' ? t.answers.flatMap(a => [...a]) : t.type === 'password' ? [] : L.specials(t.answer);
      for (const c of chars) {
        assert.ok(L.WHERE[c], `${v}/${m} ${t.title}: ${c} chybí v rozložení`);
        assert.ok(L.CHAR_NAME[c], `${c} nemá jméno`);
      }
    }
  }
});

test('generátor: počty úloh, úrovně jdou po sobě, varianty se liší', () => {
  for (const [v, m] of ALL) {
    const g = L.buildGame(v, m);
    assert.equal(g.length, m === 'rychly' ? 6 : 11, `${v}/${m}`);
    const levels = g.map(t => t.level);
    assert.deepEqual(levels, [...levels].sort((a, b) => a - b));
    assert.deepEqual([...new Set(levels)], [0, 1, 2, 3, 4]);
    assert.equal(new Set(g.map(t => t.id)).size, g.length);
    for (const t of g) {
      assert.ok(t.hints.length >= 2, t.id);
      assert.ok(L.SKILLS[t.skill], t.id);
      assert.ok(t.chars.length, t.id);
    }
  }
  const sig = v => L.buildGame(v).map(t => t.title + (t.from || '') + (t.chars || []).join('')).join('|');
  assert.notEqual(sig('A'), sig('B'));
  assert.notEqual(sig('B'), sig('C'));
  assert.equal(sig('A'), sig('A'));
});

test('každá úloha jde vyřešit a prázdná odpověď se nepočítá', () => {
  for (const [v, m] of ALL) {
    for (const t of [...L.buildGame(v, m), L.tutorialTask()]) {
      const r = L.check(t, L.solution(t));
      assert.ok(r.ok, `${v}/${m} ${t.id}: ${r.msg}`);
      const empty = { where: { values: ['', '', ''] }, blanks: { values: [] }, rule: { value: '  ' }, password: { value: '' }, fix: { value: '' } }[t.type];
      assert.equal(L.check(t, empty).incomplete, true, t.id);
    }
  }
});

test('kde znak bydlí: správná klávesa se špatnou vrstvou dostane konkrétní vysvětlení', () => {
  const t = { type: 'where', chars: ['@', '?', '%'] };
  assert.equal(L.check(t, { values: ['@', '?', '%'] }).ok, true);
  const r = L.check(t, { values: ['v', '?', '%'] }); // V bez AltGr
  assert.equal(r.ok, false);
  assert.deepEqual(r.wrong, [0]);
  assert.match(r.msg, /správné klávese.*pravým Altem/);
  assert.match(L.check(t, { values: ['@', ',', '%'] }).msg, /vlevo nahoře/); // čárka bez Shiftu
  assert.match(L.check(t, { values: ['@', '?', 'x'] }).msg, /Místo „%“ jsi napsal\(a\) „x“/);
  assert.equal(L.check(t, { values: ['@', '', '%'] }).incomplete, true);
});

test('mezery: chyba označí pozice a pozná znak, který na hromádce není', () => {
  const t = L.buildGame('C').find(x => x.type === 'blanks' && x.answers.includes('?'));
  assert.ok(t, 'varianta C má zprávu s otazníkem');
  const vals = [...t.answers];
  const qi = vals.indexOf('?');
  vals[qi] = ',';
  const r = L.check(t, { values: vals });
  assert.equal(r.ok, false);
  assert.deepEqual(r.wrong, [qi]);
  assert.match(r.msg, /na hromádce není/);
  // prohozené znaky z hromádky
  const sw = [...t.answers];
  [sw[0], sw[1]] = [sw[1], sw[0]];
  assert.match(L.check(t, { values: sw }).msg, /špatných místech/);
  // pevná mezera a dlouhé minus se tolerují
  assert.equal(L.check(t, { values: t.answers.map(a => ` ${a} `) }).ok, true);
});

test('adresy: vysvětlí mezeru, diakritiku a chybějící zavináč; u webu projde i lomítko na konci', () => {
  const g = ['A', 'B', 'C'].flatMap(v => L.buildGame(v)).filter(t => t.type === 'rule');
  const email = g.find(t => t.kind === 'email');
  const web = g.find(t => t.kind === 'web');
  assert.match(L.check(email, { value: email.answer.replace('_', ' ') }).msg, /mezera/);
  assert.match(L.check(email, { value: email.answer.replace('@', '') }).msg, /Chybí „@“/);
  assert.match(L.check(email, { value: email.answer.replace('a', 'á') }).msg, /Háčky a čárky/);
  assert.equal(L.check(web, { value: `${web.answer}/` }).ok, true);
});

test('heslo: pravidla trezoru a vzorová hesla všech variant', () => {
  for (const v of ['A', 'B', 'C']) {
    const t = L.buildGame(v).find(x => x.type === 'password');
    assert.ok(L.passwordChecks(t, t.example).every(c => c.ok), `${v}: ${t.example}`);
    const fail = id => L.passwordChecks(t, 'heslo').find(c => c.id === id).ok;
    assert.equal(fail('len'), false);
    assert.equal(fail('banned'), false);
    assert.equal(L.check(t, { value: 'Ahoj' }).ok, false);
  }
  const t = L.buildGame('A').find(x => x.type === 'password');
  const c = pw => Object.fromEntries(L.passwordChecks(t, pw).map(x => [x.id, x.ok]));
  assert.equal(c('Aaa1@#xxxxxxx').repeat, false);
  assert.equal(c('Kos7Zpiva@Rano!').altgr, false); // ! se píše se Shiftem, ne s AltGr
  assert.equal(c('Škola7@#Velká').banned, false); // diakritika zakázané slovo neschová
});

test('typografie: každá chyba je ve špatném textu a vysvětlení přijde postupně', () => {
  for (const v of ['A', 'B', 'C']) {
    for (const t of L.buildGame(v).filter(x => x.type === 'fix')) {
      for (const [good] of t.issues) {
        assert.ok(t.answer.includes(good), `${t.title}: ${good} není ve správném textu`);
        assert.ok(!t.wrong.includes(good), `${t.title}: ${good} už je ve špatném textu`);
      }
      const r = L.check(t, { value: t.wrong });
      assert.equal(r.ok, false);
      assert.match(r.msg, /Zbývá|Zbývají/);
      assert.equal(L.check(t, { value: t.answer.replace(/ /g, ' ').replace('-', '−') }).ok, true, t.title);
    }
  }
});

test('isBetter: napoprvé > nápovědy > čas', () => {
  assert.equal(L.isBetter({ firstTry: 5, hints: 3 }, { firstTry: 4, hints: 0 }), true);
  assert.equal(L.isBetter({ firstTry: 5, hints: 3 }, { firstTry: 5, hints: 1 }), false);
  assert.equal(L.isBetter({ firstTry: 5, hints: 1, ms: 1000 }, { firstTry: 5, hints: 1, ms: 2000 }), true);
  assert.equal(L.isBetter({ firstTry: 0, hints: 0 }, undefined), true);
});
