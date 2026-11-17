// E2E testy hry Znakožrout: titulní obrazovka, ukázka, dohrání celé hry přes skutečné ovládací prvky
// (výběr klávesy a vrstvy, psaní do mezer, adresy, trezor, oprava textu), klávesnice na obrazovce
// (zvýraznění stisku, ťukání s AltGr), chyba s vysvětlením, nevyplněná odpověď se nepočítá, nápověda
// zvýrazní klávesy, rychlý režim z URL, Menu hry, 320 px dotykem, smazání výsledků.
import { test, expect } from '@playwright/test';
import { watchErrors, expectNoHorizontalScroll } from './helpers.js';
import * as L from '../../public/aplikace/znakozrout/logic.js';

const URL = '/aplikace/znakozrout/';
const KEY = 'vyukovy-portal:znakozrout:v1';
const CHECK = 'Zkontrolovat';

/** Vyplní správnou odpověď přes skutečné ovládací prvky nástroje. */
async function solve(page, t, { tap = false } = {}) {
  const a = L.solution(t);
  const press = loc => (tap ? loc.tap() : loc.click());
  switch (t.type) {
    case 'where':
      for (const [i, p] of a.picks.entries()) {
        await press(page.locator(`#pick-${i}`));
        await press(page.locator(`.kbd [data-code="${p.code}"]`));
        await page.locator(`input[name="ly-${i}"][value="${p.layer}"]`).check();
      }
      break;
    case 'blanks':
      for (const [i, v] of a.values.entries()) {
        await page.locator(`#bl-${i}`).fill('');
        if (tap) await page.locator(`#bl-${i}`).fill(v);
        else { await page.locator(`#bl-${i}`).click(); await page.keyboard.type(v); }
      }
      break;
    case 'rule': case 'password': case 'fix':
      await page.locator('#ans').fill(a.value);
      break;
    default: throw new Error(t.type);
  }
}
async function passIntroIfShown(page, { tap = false } = {}) {
  if (await page.locator('#s-intro').isVisible()) {
    const b = page.getByRole('button', { name: 'Do toho →' });
    await (tap ? b.tap() : b.click());
  }
}

test.describe('Znakožrout', () => {
  test.use({ viewport: { width: 1366, height: 820 } });

  test('titulní obrazovka: nastavení, odkazy, žádné chyby @smoke', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('heading', { level: 1, name: 'Znakožrout' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Celá hra/ })).toBeChecked();
    await expect(page.getByRole('link', { name: 'Zpět do katalogu her' })).toHaveAttribute('href', '/');
    await expect(page.getByRole('link', { name: /Pro učitele/ })).toHaveAttribute('href', '/pro-ucitele/#znakozrout');
    expect(errors).toEqual([]);
  });

  test('ukázka + celá hra (varianta A) přes všechny nástroje, rekord v localStorage @smoke', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await page.goto(URL);
    await page.getByRole('button', { name: 'Začít ukázkou' }).click();
    await expect(page.locator('#task-level')).toHaveText('Ukázka');
    await solve(page, L.tutorialTask());
    await page.getByRole('button', { name: CHECK }).click();
    await expect(page.locator('#feedback')).toContainText('Správně');
    await page.getByRole('button', { name: 'Spustit hru →' }).click();
    const tasks = L.buildGame('A', 'cela');
    let intros = 0;
    for (const [i, t] of tasks.entries()) {
      if (await page.locator('#s-intro').isVisible()) { intros++; await expect(page.locator('#intro-h')).toHaveText(L.LEVEL_INFO[t.level].name); }
      await passIntroIfShown(page);
      await expect(page.locator('#task-h'), t.id).toHaveText(t.title);
      await solve(page, t);
      if (t.type === 'password') await expect(page.locator('.checks li.is-ok')).toHaveCount(7);
      await page.getByRole('button', { name: CHECK }).click();
      await expect(page.locator('#feedback'), `${t.id}: ${await page.locator('#feedback').innerText()}`).toContainText('Správně');
      await expect(page.locator('#belly .slot.is-done')).toHaveCount(i + 1);
      await page.locator('#btn-next').click();
    }
    expect(intros).toBe(5);
    await expect(page.locator('#end-h')).toBeFocused();
    await expect(page.locator('#result')).toContainText('11 z 11 úloh, 11 napoprvé');
    await expect(page.locator('#skills li.ok')).toHaveCount(Object.keys(L.SKILLS).length);
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    expect(saved.best.cela).toMatchObject({ firstTry: 11, total: 11, hints: 0, variant: 'A' });
    expect(JSON.stringify(saved)).not.toContain(tasks.find(t => t.type === 'password').example); // heslo se neukládá
    expect(errors).toEqual([]);
  });

  test('kde znak bydlí: prázdné se nepočítá, špatná vrstva = vysvětlení, řešení', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntroIfShown(page);
    const t = L.buildGame('A')[0];
    await page.getByRole('button', { name: CHECK }).click();
    await page.getByRole('button', { name: CHECK }).click();
    await expect(page.locator('#feedback')).toContainText('U každého znaku vyber');
    await expect(page.locator('#btn-reveal')).toBeHidden();
    // na obrazovce jsou jen hlavní znaky – AltGr vrstva není vidět
    await expect(page.locator('.kbd--pick .key__br')).toHaveCount(0);
    const a = L.solution(t);
    for (const [i, p] of a.picks.entries()) {
      await page.locator(`#pick-${i}`).click();
      await page.locator(`.kbd [data-code="${p.code}"]`).click();
      const wrong = i === 0 ? (p.layer === 'base' ? 'shift' : 'base') : p.layer;
      await page.locator(`input[name="ly-${i}"][value="${wrong}"]`).check();
    }
    await expect(page.locator('#pick-0')).toContainText(`klávesa: ${L.keyName(a.picks[0].code)}`);
    await page.getByRole('button', { name: CHECK }).click();
    await expect(page.locator('#feedback')).toContainText('na správné klávese');
    await page.getByRole('button', { name: CHECK }).click();
    await page.getByRole('button', { name: 'Ukázat řešení' }).click();
    await expect(page.locator('#feedback')).toContainText('Řešení:');
    await expect(page.locator('#btn-next')).toBeFocused();
    await expect(page.locator('#belly .slot.is-dim')).toHaveCount(1);
  });

  test('klávesnice: zvýrazní stisk, ťuknutí s AltGr vloží @, nápověda označí klávesy, Enter zkontroluje', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL + '?rezim=rychly');
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    for (const t of L.buildGame('A', 'rychly')) {
      await passIntroIfShown(page);
      if (t.type === 'blanks') {
        await page.locator('#bl-0').click();
        await page.keyboard.press('KeyV');
        await expect(page.locator('.kbd__readout')).toContainText('klávesa V → v');
        await page.locator('#bl-0').fill('');
        // ťuknutí: AltGr + V
        await page.getByRole('button', { name: 'AltGr' }).click();
        await expect(page.getByRole('button', { name: 'AltGr' })).toHaveAttribute('aria-pressed', 'true');
        await page.locator('.kbd [data-code="KeyV"]').click();
        await expect(page.locator('#bl-0')).toHaveValue('@');
        await expect(page.getByRole('button', { name: 'AltGr' })).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('.kbd__readout')).toContainText('pravý Alt (AltGr) + V → @ (zavináč)');
        // zbytek mezer nevyplněn → nepočítá se
        await page.locator('#bl-0').press('Enter');
        await expect(page.locator('#feedback')).toContainText('Vyplň všechny mezery');
        for (let k = 0; k < t.hints.length; k++) await page.getByRole('button', { name: '🔍 Nápověda' }).click();
        await expect(page.locator('#hint-count')).toHaveText(String(t.hints.length));
        await expect(page.locator('.kbd .key.is-hint')).not.toHaveCount(0);
        await solve(page, t);
        await page.locator('#bl-0').press('Enter');
        await expect(page.locator('#feedback')).toContainText('Správně');
        expect(errors).toEqual([]);
        return;
      }
      await solve(page, t);
      await page.getByRole('button', { name: CHECK }).click();
      await page.locator('#btn-next').click();
    }
    throw new Error('mezery v rychlé hře chybí');
  });

  test('rychlý režim a varianta z URL: 6 úloh; adresa, heslo a typografie s chybou', async ({ page }) => {
    await page.goto(URL + '?varianta=C&rezim=rychly');
    await expect(page.getByRole('radio', { name: 'C', exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    const tasks = L.buildGame('C', 'rychly');
    for (const [i, t] of tasks.entries()) {
      await passIntroIfShown(page);
      await expect(page.locator('#hud-task')).toHaveText(`${i + 1}/6`);
      if (t.type === 'rule') {
        await page.locator('#ans').fill(t.answer.replace('@', ' '));
        await page.getByRole('button', { name: CHECK }).click();
        await expect(page.locator('#feedback')).toContainText('nesmí být mezera');
      }
      if (t.type === 'password') {
        await page.locator('#ans').fill('heslo');
        await expect(page.locator('.vault__count')).not.toHaveText('7/7');
        await page.getByRole('button', { name: CHECK }).click();
        await expect(page.locator('#feedback')).toContainText('Trezor zůstal zamčený');
      }
      if (t.type === 'fix') {
        await expect(page.locator('#ans')).toHaveValue(t.wrong);
        await page.getByRole('button', { name: CHECK }).click();
        await expect(page.locator('#feedback')).toContainText(t.issues[0][1]);
      }
      await solve(page, t);
      await page.getByRole('button', { name: CHECK }).click();
      await expect(page.locator('#feedback')).toContainText('Správně');
      await page.locator('#btn-next').click();
    }
    await expect(page.locator('#result')).toContainText('6 z 6');
    await expect(page.locator('#stats')).toContainText('C · rychlá hra');
  });

  test('tlačítko Menu hry: bez postupu rovnou, po vyřešené úloze se zeptá', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('button', { name: 'Menu hry' })).toBeHidden();
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntroIfShown(page);
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Znakožrout' })).toBeVisible();
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntroIfShown(page);
    await solve(page, L.buildGame('A')[0]);
    await page.getByRole('button', { name: CHECK }).click();
    await page.locator('#btn-next').click();
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await expect(page.getByRole('dialog', { name: 'Odejít do menu hry?' })).toBeVisible();
    await page.getByRole('button', { name: 'Hrát dál' }).click();
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await page.getByRole('button', { name: 'Ano, do menu' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Znakožrout' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('smazání výsledků jen této hry', async ({ page }) => {
    await page.goto(URL);
    await page.evaluate(k => {
      localStorage.setItem(k, JSON.stringify({ best: { cela: { firstTry: 7, total: 11, hints: 2 } } }));
      localStorage.setItem('vyukovy-portal:roboti-dilna:v1', '{"keep":1}');
    }, KEY);
    await page.reload();
    await expect(page.locator('#best')).toContainText('napoprvé 7 z 11');
    await page.getByRole('button', { name: 'Smazat moje výsledky' }).click();
    await page.getByRole('button', { name: 'Ano, smazat' }).click();
    await expect(page.locator('#best')).toContainText('Zatím žádný výsledek');
    expect(await page.evaluate(() => localStorage.getItem('vyukovy-portal:roboti-dilna:v1'))).toBe('{"keep":1}');
  });
});

test.describe('Znakožrout – mobil', () => {
  test('320 px: celá hra dotykem bez vodorovného scrollu, ťukání na klávesnici @mobile', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(URL + '?varianta=B');
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Začít ukázkou' }).tap();
    await expectNoHorizontalScroll(page);
    // ukázka ťukáním: Shift + čárka = ?, Shift + § = !
    await page.locator('#bl-0').tap();
    await page.getByRole('button', { name: 'Shift' }).tap();
    await page.locator('.kbd [data-code="Comma"]').tap();
    await expect(page.locator('#bl-0')).toHaveValue('?');
    await page.locator('#bl-1').tap();
    await page.getByRole('button', { name: 'Shift' }).tap();
    await page.locator('.kbd [data-code="Quote"]').tap();
    await expect(page.locator('#bl-1')).toHaveValue('!');
    await page.getByRole('button', { name: CHECK }).tap();
    await expect(page.locator('#feedback')).toContainText('Správně');
    await page.locator('#btn-next').tap();
    for (const t of L.buildGame('B')) {
      await passIntroIfShown(page, { tap: true });
      await expect(page.locator('#task-h')).toHaveText(t.title);
      await expectNoHorizontalScroll(page);
      await solve(page, t, { tap: true });
      await page.getByRole('button', { name: CHECK }).tap();
      await expect(page.locator('#feedback')).toContainText('Správně');
      await expectNoHorizontalScroll(page);
      await page.locator('#btn-next').tap();
    }
    await expect(page.locator('#result')).toContainText('11 z 11');
    await expectNoHorizontalScroll(page);
  });
});
