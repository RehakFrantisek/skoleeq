// E2E testy Phishingové hlídky: titulní obrazovka, ukázka, celá služba přes skutečné ovládání (stopy, verdikt,
// výběr, stavba hesla), chyba s vysvětlením, nápovědy a řešení, adresa odkazu ve stavovém řádku, klávesnice,
// rychlý režim z URL, Menu hry, smazání výsledků, 320 px.
import { test, expect } from '@playwright/test';
import { watchErrors, expectNoHorizontalScroll } from './helpers.js';
import * as L from '../../public/aplikace/phishingova-hlidka/logic.js';

const URL = '/aplikace/phishingova-hlidka/';
const KEY = 'vyukovy-portal:phishingova-hlidka:v1';
const spot = (page, id) => page.locator(`#tool .spot[data-id="${id}"]`);

/** Vyplní správnou odpověď přes skutečné ovládací prvky nástroje. */
async function solve(page, t, { tap = false } = {}) {
  const a = L.solution(t);
  const act = loc => (tap ? loc.tap() : loc.click());
  if (t.type === 'inspect') {
    for (const id of a.marks) await act(spot(page, id));
    await act(page.getByRole('radio', { name: new RegExp('^' + L.VERDICTS[a.verdict].label) }));
  } else if (t.type === 'choice') {
    await act(page.getByRole('radio', { name: t.options[a.option], exact: true }));
  } else {
    await page.getByLabel('Nové heslo').fill(a.value);
  }
}

async function passIntroIfShown(page) {
  if (await page.locator('#s-intro').isVisible()) await page.getByRole('button', { name: 'Pustit se do toho →' }).click();
}

test.describe('Phishingová hlídka', () => {
  test.use({ viewport: { width: 1366, height: 820 } });

  test('titulní obrazovka: nastavení, odkazy, žádné chyby @smoke', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('heading', { level: 1, name: 'Phishingová hlídka' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Celá služba/ })).toBeChecked();
    await expect(page.getByRole('link', { name: 'Zpět do katalogu her' })).toHaveAttribute('href', '/');
    await expect(page.getByRole('link', { name: /Pro učitele/ })).toHaveAttribute('href', '/pro-ucitele/#phishingova-hlidka');
    expect(errors).toEqual([]);
  });

  test('ukázka + celá služba (varianta A) přes všechny nástroje, rekord v localStorage @smoke', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await page.goto(URL);
    await page.getByRole('button', { name: 'Začít ukázkou' }).click();
    await expect(page.locator('#task-level')).toHaveText('Ukázka');
    await solve(page, L.tutorialTask());
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText('Správně');
    await expect(page.locator('#debrief')).toContainText('Stopy v této zprávě');
    await page.getByRole('button', { name: 'Nastoupit do služby →' }).click();
    const tasks = L.buildGame('A', 'cela');
    let intros = 0;
    for (const [i, t] of tasks.entries()) {
      if (await page.locator('#s-intro').isVisible()) { intros++; await expect(page.locator('#intro-h')).toHaveText(L.LEVEL_INFO[t.level].name); }
      await passIntroIfShown(page);
      await expect(page.locator('#task-h'), t.id).toHaveText(t.title);
      await solve(page, t);
      await page.getByRole('button', { name: 'Zkontrolovat' }).click();
      await expect(page.locator('#feedback'), `${t.id}: ${await page.locator('#feedback').innerText()}`).toContainText('Správně');
      await expect(page.locator('#inbox .inbox__stamp')).toHaveCount(i + 1);
      await page.locator('#btn-next').click();
    }
    expect(intros).toBe(4);
    await expect(page.locator('#end-h')).toBeFocused();
    await expect(page.locator('#result')).toContainText('12 z 12 úloh, 12 napoprvé');
    await expect(page.locator('#badge-title')).toHaveText('Velitel(ka) hlídky');
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    expect(saved.best.cela).toMatchObject({ firstTry: 12, total: 12, hints: 0, variant: 'A' });
    expect(errors).toEqual([]);
  });

  test('chyba = vysvětlení a stav zůstane; nevinná část; nápovědy; po 2 pokusech řešení', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntroIfShown(page);
    const t = L.buildGame('A')[0];
    expect(t.id).toBe('e-plna-schranka');
    // bez verdiktu se nepočítá pokus
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText('Nejdřív vyber verdikt');
    // jedna stopa + nevinná věta + správný verdikt
    await spot(page, 'from').click();
    await spot(page, 'b3').click();
    await expect(spot(page, 'b3')).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('radio', { name: /^Podvod/ }).check();
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText('Tohle je v pořádku: „Pro zachování dat se přihlaste zde:“');
    await expect(page.locator('#feedback')).toContainText('najdi ještě aspoň 2 stopy');
    await expect(spot(page, 'b3')).toHaveClass(/is-wrong/);
    await expect(spot(page, 'from')).toHaveAttribute('aria-pressed', 'true'); // stav zůstal
    await expect(page.locator('#btn-reveal')).toBeHidden();
    for (let k = 0; k < t.hints.length; k++) await page.getByRole('button', { name: '🔍 Nápověda' }).click();
    await expect(page.locator('#hint-count')).toHaveText(String(t.hints.length));
    await expect(page.locator('#btn-hint')).toBeDisabled();
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await page.getByRole('button', { name: 'Ukázat řešení' }).click();
    await expect(page.locator('#feedback')).toContainText('Řešení:');
    await expect(page.locator('#debrief .is-found')).toHaveCount(1); // žák sám našel jen odesílatele
    await expect(page.locator('#btn-next')).toBeFocused();
    await expect(page.locator('#inbox .inbox__stamp')).toHaveText(['ukázané řešení']);
  });

  test('odkaz: stavový řádek ukáže skutečnou adresu; klávesnice označí část zprávy', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntroIfShown(page);
    const status = page.locator('#statusbar');
    await expect(status).toContainText('Najeď myší na odkaz');
    await spot(page, 'b4').hover();
    await expect(status).toContainText('http://zs-lipova.test.overeni-uctu.test/prihlaseni');
    await spot(page, 'b5').focus();
    await page.keyboard.press('Enter');
    await expect(spot(page, 'b5')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(spot(page, 'b5')).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Shift+Tab');
    await expect(spot(page, 'b4')).toBeFocused();
    await expect(status).toContainText('overeni-uctu.test');
  });

  test('stavba hesla: měřák, osobní údaj neprojde, Enter = Zkontrolovat', async ({ page }) => {
    await page.goto(URL + '?rezim=rychly&varianta=B');
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    const tasks = L.buildGame('B', 'rychly');
    const pwIndex = tasks.findIndex(t => t.type === 'password');
    for (const t of tasks.slice(0, pwIndex)) {
      await passIntroIfShown(page);
      await solve(page, t);
      await page.getByRole('button', { name: 'Zkontrolovat' }).click();
      await page.locator('#btn-next').click();
    }
    await passIntroIfShown(page);
    const t = tasks[pwIndex];
    const input = page.getByLabel('Nové heslo');
    await input.fill('Heslo123');
    await expect(page.locator('#pw-label')).toContainText('velmi slabé');
    await input.fill(`${t.personal[0]}-oblak-tygr-polevka`);
    await input.press('Enter');
    await expect(page.locator('#feedback')).toContainText('údaj z profilu');
    await input.fill(t.solution);
    await expect(page.locator('#pw-label')).toContainText('silné');
    await expect(page.locator('.checklist .is-ok')).toHaveCount(4);
    await input.press('Enter');
    await expect(page.locator('#feedback')).toContainText('Správně.');
  });

  test('rychlý režim a varianta z URL: 6 úloh', async ({ page }) => {
    await page.goto(URL + '?varianta=C&rezim=rychly');
    await expect(page.getByRole('radio', { name: 'C', exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    const tasks = L.buildGame('C', 'rychly');
    for (const [i, t] of tasks.entries()) {
      await passIntroIfShown(page);
      await expect(page.locator('#hud-task')).toHaveText(`${i + 1}/6`);
      await solve(page, t);
      await page.getByRole('button', { name: 'Zkontrolovat' }).click();
      await expect(page.locator('#feedback')).toContainText('Správně');
      await page.locator('#btn-next').click();
    }
    await expect(page.locator('#result')).toContainText('6 z 6');
    await expect(page.locator('#badge-sub')).toHaveText('rychlá služba · varianta C');
  });

  test('tlačítko Menu hry: bez postupu rovnou, po vyřešené úloze se zeptá', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('button', { name: 'Menu hry' })).toBeHidden();
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntroIfShown(page);
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Phishingová hlídka' })).toBeVisible();
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntroIfShown(page);
    await solve(page, L.buildGame('A')[0]);
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await page.locator('#btn-next').click();
    const title = await page.locator('#task-h').innerText();
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await expect(page.getByRole('dialog', { name: 'Odejít do menu hry?' })).toBeVisible();
    await page.getByRole('button', { name: 'Hrát dál' }).click();
    await expect(page.locator('#task-h')).toHaveText(title);
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await page.getByRole('button', { name: 'Ano, do menu' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Phishingová hlídka' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('smazání výsledků jen této hry', async ({ page }) => {
    await page.goto(URL);
    await page.evaluate(k => {
      localStorage.setItem(k, JSON.stringify({ best: { cela: { firstTry: 9, total: 12, hints: 2 } } }));
      localStorage.setItem('vyukovy-portal:roboti-dilna:v1', '{"keep":1}');
    }, KEY);
    await page.reload();
    await expect(page.locator('#best')).toContainText('napoprvé 9 z 12');
    await page.getByRole('button', { name: 'Smazat moje výsledky' }).click();
    await page.getByRole('button', { name: 'Ano, smazat' }).click();
    await expect(page.locator('#best')).toContainText('Zatím žádný výsledek');
    expect(await page.evaluate(() => localStorage.getItem('vyukovy-portal:roboti-dilna:v1'))).toBe('{"keep":1}');
  });
});

test.describe('Phishingová hlídka – mobil', () => {
  test('320 px: všechny typy úloh dotykem bez vodorovného scrollu @mobile', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(URL);
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).tap();
    for (const t of L.buildGame('A')) {
      if (await page.locator('#s-intro').isVisible()) await page.getByRole('button', { name: 'Pustit se do toho →' }).tap();
      await expect(page.locator('#task-h')).toHaveText(t.title);
      await expectNoHorizontalScroll(page);
      await solve(page, t, { tap: true });
      await page.getByRole('button', { name: 'Zkontrolovat' }).tap();
      await expect(page.locator('#feedback')).toContainText('Správně');
      await expectNoHorizontalScroll(page);
      await page.locator('#btn-next').tap();
    }
    await expect(page.locator('#s-end')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
