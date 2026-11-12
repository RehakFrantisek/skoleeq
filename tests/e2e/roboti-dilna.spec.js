// E2E testy Robotí dílny: sestavení programu z bloků (myš i klávesnice), spuštění, krokování,
// pozastavení, reset, informativní chyby, dohrání všech 12 misí přes UI, postup a jeho smazání.
import { test, expect } from '@playwright/test';
import { watchErrors, expectNoHorizontalScroll } from './helpers.js';
import { MISSIONS } from '../../public/aplikace/roboti-dilna/missions.js';

const URL = '/aplikace/roboti-dilna/';
const KEY = 'vyukovy-portal:roboti-dilna:v1';

/** Postaví program přes UI: paleta, počet opakování, podmínka, vkládací místa. */
async function build(page, nodes) {
  for (const n of nodes) {
    await page.locator(`.pal[data-op="${n.op}"]`).click();
    const id = await page.locator('.pn.is-selected').getAttribute('data-id');
    if (n.op === 'repeat') {
      await page.locator(`#rep-${id}`).fill(String(n.n));
      await page.locator(`#rep-${id}`).press('Tab');
      await build(page, n.body);
      await page.locator(`[data-node="${id}"]`).click(); // další blok za cyklus
    }
    if (n.op === 'if') {
      await page.locator(`#cond-${id}`).selectOption(n.cond);
      await build(page, n.then);
      await page.locator(`li[data-id="${id}"] > .pn__body`).nth(1).locator(':scope > ol > li.slot-end > .slot-btn').click();
      await build(page, n.else || []);
      await page.locator(`[data-node="${id}"]`).click();
    }
  }
}
async function runToEnd(page) {
  await page.locator('#speed').fill('5');
  await page.getByRole('button', { name: '▶ Spustit' }).click();
  await expect(page.getByRole('button', { name: '▶ Spustit' })).toBeEnabled({ timeout: 20_000 });
}

test.describe('Robotí dílna', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('přehled: 12 misí ve 3 kapitolách, odemknutá první, odkazy @smoke', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('heading', { level: 1, name: 'Robotí dílna' })).toBeVisible();
    await expect(page.locator('.mcard')).toHaveCount(12);
    for (const h of ['Kapitola 1 – Posloupnost', 'Kapitola 2 – Opakování', 'Kapitola 3 – Podmínky a ladění']) await expect(page.getByRole('heading', { name: h })).toBeVisible();
    await expect(page.locator('.mcard button')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Zpět do katalogu her' })).toHaveAttribute('href', '/');
    await expect(page.getByRole('link', { name: /Pro učitele/ })).toHaveAttribute('href', '/pro-ucitele/#roboti-dilna');
    expect(errors).toEqual([]);
  });

  test('všech 12 misí jde dohrát přes UI, mise se odemykají @smoke', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = watchErrors(page);
    await page.goto(URL);
    await page.getByRole('button', { name: `Spustit misi 1: ${MISSIONS[0].title}` }).click();
    for (const [i, m] of MISSIONS.entries()) {
      await expect(page.locator('#m-title'), m.id).toHaveText(m.title);
      if (m.initialProgram) await page.getByRole('button', { name: 'Vymazat program' }).click();
      await build(page, m.reference);
      await runToEnd(page);
      await expect(page.locator('#dlg-done'), `${m.id}: ${await page.locator('#results').innerText()}`).toBeVisible();
      if (i < MISSIONS.length - 1) await page.locator('#btn-next').click();
      else await page.locator('#btn-done-overview').click();
    }
    await expect(page.locator('#progress-summary')).toContainText('Dokončeno 12 z 12 misí');
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    expect(Object.values(saved.missions).filter(x => x.done)).toHaveLength(12);
    expect(errors).toEqual([]);
  });

  test('krokování zvýrazní aktuální blok, pozastavení a reset; náraz do zdi s důvodem', async ({ page }) => {
    await page.goto(URL + '?vse=1#pozor-stena');
    await build(page, [{ op: 'forward' }, { op: 'forward' }, { op: 'forward' }, { op: 'left' }]);
    await page.getByRole('button', { name: '⏭ Krokovat' }).click();
    await expect(page.locator('.pn.is-running')).toHaveCount(1);
    await expect(page.locator('#state')).toContainText('[3, 3]');
    await expect(page.locator('#log')).toContainText('Jdi vpřed → [3, 3]');
    await page.getByRole('button', { name: '⏭ Krokovat' }).click();
    await page.getByRole('button', { name: '⏭ Krokovat' }).click(); // třetí krok narazí do zdi
    await expect(page.locator('#results')).toContainText('Robot narazil do zdi na políčku [5, 3].');
    await expect(page.locator('#map .crash')).toHaveCount(1);
    await expect(page.locator('#state')).toContainText('[4, 3]');
    await page.getByRole('button', { name: '↺ Reset' }).click();
    await expect(page.locator('#state')).toContainText('[2, 3]');
    await expect(page.locator('#map .crash')).toHaveCount(0);
    // pozastavení uprostřed běhu
    await page.locator('#speed').fill('1');
    await page.getByRole('button', { name: '▶ Spustit' }).click();
    await page.getByRole('button', { name: '⏸ Pozastavit' }).click();
    const before = await page.locator('#state').textContent();
    await page.waitForTimeout(1000);
    expect(await page.locator('#state').textContent()).toBe(before);
    await expect(page.getByRole('button', { name: '▶ Spustit' })).toBeEnabled();
  });

  test('úprava programu: přesun, smazání, limit vnoření; jen klávesnicí', async ({ page }) => {
    await page.goto(URL + '?vse=1#dve-cesty');
    // klávesnicí: Tab na paletu a Enter
    await page.locator('.pal[data-op="forward"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('.pal[data-op="left"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.pn')).toHaveCount(2);
    await expect(page.locator('.pn__label')).toHaveText(['Jdi vpřed', 'Otoč vlevo']);
    // přesun nahoru tlačítkem ↑ (klávesnicí)
    await page.getByRole('button', { name: 'Posunout blok 2 nahoru' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.pn__label')).toHaveText(['Otoč vlevo', 'Jdi vpřed']);
    await page.getByRole('button', { name: 'Smazat blok 1 (Otoč vlevo)' }).click();
    await expect(page.locator('.pn__label')).toHaveText(['Jdi vpřed']);
    // vnoření: Opakuj > Opakuj > Opakuj – dál už cyklus vložit nejde
    await page.getByRole('button', { name: 'Vymazat program' }).click();
    for (let i = 0; i < 3; i++) await page.locator('.pal[data-op="repeat"]').click();
    await expect(page.locator('.pal[data-op="repeat"]')).toBeDisabled();
    await expect(page.locator('.pal[data-op="if"]')).toBeDisabled();
    await expect(page.locator('.pal[data-op="forward"]')).toBeEnabled();
  });

  test('více map: sekvence projde jen na jedné, chyba je popsaná u konkrétní mapy', async ({ page }) => {
    await page.goto(URL + '?vse=1#dve-cesty');
    await build(page, [{ op: 'forward' }, { op: 'forward' }, { op: 'forward' }, { op: 'right' }, { op: 'forward' }, { op: 'forward' }, { op: 'forward' }]);
    await runToEnd(page);
    await expect(page.locator('#results')).toContainText('Zatáčka za 3 kroky: robot úlohu splnil.');
    await expect(page.locator('#results')).toContainText('Zatáčka za 2 kroky: Robot narazil do zdi');
    await expect(page.locator('#results')).toContainText('musíš použít blok Opakuj');
    await page.getByRole('button', { name: 'Zatáčka za 2 kroky' }).click();
    await expect(page.getByRole('button', { name: 'Zatáčka za 2 kroky' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#map')).toHaveAttribute('aria-label', /Robot na \[2, 2\]/);
  });

  test('oprava chybného programu: výchozí program selže s vysvětlením', async ({ page }) => {
    await page.goto(URL + '?vse=1#oprav-program');
    await expect(page.locator('.pn')).not.toHaveCount(0);
    await runToEnd(page);
    await expect(page.locator('#results')).toContainText('Na políčku [6, 2] není nic');
    // oprava: Opakuj 4× → 3×
    const rep = page.locator('.num').first();
    await rep.fill('3');
    await rep.press('Tab');
    await runToEnd(page);
    await expect(page.locator('#results')).toContainText('Robot narazil do zdi');
    // druhá chyba: druhé „Otoč vlevo“ → smazat a vložit „Otoč vpravo“
    const left = page.locator('.pn', { has: page.locator('.pn__label', { hasText: 'Otoč vlevo' }) }).first();
    const leftId = await left.getAttribute('data-id');
    await page.locator(`[data-node="${leftId}"]`).click(); // vkládat za něj
    await page.locator('.pal[data-op="right"]').click();
    await left.locator('.mini--del').click();
    await runToEnd(page);
    await expect(page.locator('#dlg-done')).toBeVisible();
  });

  test('nápověda ve třech úrovních, smazání postupu jen této hry', async ({ page }) => {
    await page.goto(URL);
    await page.evaluate(k => {
      localStorage.setItem(k, JSON.stringify({ missions: { 'start-motoru': { done: true, stars: 2, points: 120 } } }));
      localStorage.setItem('vyukovy-portal:dokumentova-zachranka:v1', '{"keep":1}');
    }, KEY);
    await page.reload();
    await expect(page.locator('.mcard button')).toHaveCount(2);
    await page.getByRole('button', { name: /Spustit misi 2/ }).click();
    for (const lvl of ['1. Princip', '2. Kde se zaměřit', '3. Postup']) {
      await page.getByRole('button', { name: /nápověd/i }).click();
      await expect(page.locator('#hints')).toContainText(lvl);
    }
    await page.getByRole('button', { name: 'Přehled misí' }).click();
    await page.getByRole('button', { name: 'Smazat postup této hry' }).click();
    await page.getByRole('button', { name: 'Ano, smazat' }).click();
    await expect(page.locator('#progress-summary')).toContainText('Dokončeno 0 z 12');
    expect(await page.evaluate(() => localStorage.getItem('vyukovy-portal:dokumentova-zachranka:v1'))).toBe('{"keep":1}');
  });
});

test.describe('Robotí dílna – mobil', () => {
  test('320 px: přehled i mise bez vodorovného scrollu @mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(URL);
    await expectNoHorizontalScroll(page);
    await page.goto(URL + '?vse=1#zachrana-sondy');
    await page.locator('.pal[data-op="repeat"]').tap();
    await page.locator('.pal[data-op="if"]').tap();
    await expectNoHorizontalScroll(page);
  });
});
