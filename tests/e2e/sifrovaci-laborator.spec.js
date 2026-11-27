// E2E testy Šifrovací laboratoře: titulní obrazovka, ukázka, dohrání celé mise přes nástroje všech typů,
// chybná odpověď s vysvětlením, nápověda a řešení, rychlý režim z URL, klávesnice v mřížce, 320 px, smazání výsledků.
import { test, expect } from '@playwright/test';
import { watchErrors, expectNoHorizontalScroll } from './helpers.js';
import * as L from '../../public/aplikace/sifrovaci-laborator/logic.js';

const URL = '/aplikace/sifrovaci-laborator/';
const KEY = 'vyukovy-portal:sifrovaci-laborator:v1';

/** Vyplní správnou odpověď přes skutečné ovládací prvky nástroje. */
async function solve(page, t) {
  const a = L.solution(t);
  const tool = page.locator('#tool');
  switch (t.type) {
    case 'lamps':
      for (const [i, on] of a.lamps.entries()) if (on) await tool.getByRole('button', { name: `Světlo s hodnotou ${L.LAMPS[i]}`, exact: true }).click();
      break;
    case 'read': case 'number': case 'text': case 'codes':
      await page.locator('#ans').fill(a.value);
      break;
    case 'crack':
      for (let k = 0; k < a.shift; k++) await tool.getByRole('button', { name: 'Posun o 1 více' }).click();
      break;
    case 'choice':
      await tool.getByRole('radio', { name: t.options[a.option], exact: true }).check();
      break;
    case 'paint': {
      const cells = tool.locator('button.px');
      for (const [y, row] of a.grid.entries()) for (const [x, v] of row.entries()) if (v) await cells.nth(y * 8 + x).click();
      break;
    }
    case 'encode':
      for (const [i, v] of a.values.entries()) await page.locator(`#ans-${i}`).fill(v);
      break;
    case 'rgb':
      for (const [ch, name] of ['Červená', 'Zelená', 'Modrá'].entries()) await tool.getByRole('group', { name }).getByLabel(String(a.rgb[ch]), { exact: true }).check();
      break;
    case 'vector':
      for (const [k, v] of Object.entries(a.shape)) await page.locator(`#v-${k}`).fill(String(v));
      break;
    case 'parity-find':
      await tool.locator('button.px').nth(a.cell.y * t.grid.length + a.cell.x).click();
      break;
    case 'parity-add': {
      const n = a.grid.length;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x === n - 1 || y === n - 1) && a.grid[y][x]) await tool.locator('button.px').nth(y * n + x).click();
      break;
    }
    default: throw new Error(t.type);
  }
}

async function passIntroIfShown(page) {
  if (await page.locator('#s-intro').isVisible()) await page.getByRole('button', { name: 'Pustit se do toho →' }).click();
}

test.describe('Šifrovací laboratoř', () => {
  test.use({ viewport: { width: 1366, height: 820 } });

  test('titulní obrazovka: nastavení, odkazy, žádné chyby @smoke', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('heading', { level: 1, name: 'Šifrovací laboratoř' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Celá mise/ })).toBeChecked();
    await expect(page.getByRole('link', { name: 'Zpět do katalogu her' })).toHaveAttribute('href', '/hriste/');
    await expect(page.getByRole('link', { name: /Pro učitele/ })).toHaveAttribute('href', '/pro-ucitele/#sifrovaci-laborator');
    expect(errors).toEqual([]);
  });

  test('ukázka + celá mise (varianta A) přes všechny nástroje, rekord v localStorage @smoke', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await page.goto(URL);
    await page.getByRole('button', { name: 'Začít ukázkou' }).click();
    await expect(page.locator('#task-level')).toHaveText('Ukázka');
    await solve(page, L.tutorialTask());
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText('Správně');
    await page.getByRole('button', { name: 'Spustit misi →' }).click();
    const tasks = L.buildGame('A', 'cela');
    let intros = 0;
    for (const [i, t] of tasks.entries()) {
      if (await page.locator('#s-intro').isVisible()) { intros++; await expect(page.locator('#intro-h')).toHaveText(L.LEVEL_INFO[t.level].name); }
      await passIntroIfShown(page);
      await expect(page.locator('#task-h'), t.id).toHaveText(t.title);
      await solve(page, t);
      await page.getByRole('button', { name: 'Zkontrolovat' }).click();
      await expect(page.locator('#feedback'), `${t.id}: ${await page.locator('#feedback').innerText()}`).toContainText('Správně');
      await expect(page.locator('#photo .tile.is-open')).toHaveCount(i + 1 >= tasks.length ? 18 : i + 1);
      await page.locator('#btn-next').click();
    }
    expect(intros).toBe(5);
    await expect(page.locator('#end-h')).toBeFocused();
    await expect(page.locator('#result')).toContainText('17 z 17 zpráv, 17 napoprvé');
    await expect(page.locator('#skills li.ok')).toHaveCount(Object.keys(L.SKILLS).length);
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    expect(saved.best.cela).toMatchObject({ firstTry: 17, total: 17, hints: 0, variant: 'A' });
    expect(errors).toEqual([]);
  });

  test('chyba = vysvětlení, stav zůstane; nápovědy se počítají; po 2 pokusech řešení', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntroIfShown(page);
    const t = L.buildGame('A')[0];
    // rozsvítit 16 + 8 + 4 + 2 + 1 = 31 → „o … víc“
    for (const v of L.LAMPS) await page.getByRole('button', { name: `Světlo s hodnotou ${v}`, exact: true }).click();
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText(`Ještě ne. Rozsvícená světla dávají 31, to je o ${31 - t.target} víc`);
    await expect(page.getByRole("button", { name: "Světlo s hodnotou 16", exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#btn-reveal')).toBeHidden();
    await page.getByRole('button', { name: '🔍 Nápověda' }).click();
    await page.getByRole('button', { name: '🔍 Nápověda' }).click();
    await expect(page.locator('#hint-count')).toHaveText('2');
    await expect(page.locator('#btn-hint')).toBeDisabled();
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await page.getByRole('button', { name: 'Ukázat řešení' }).click();
    await expect(page.locator('#feedback')).toContainText('Řešení:');
    await expect(page.locator('.lamps__sum')).toContainText(`= ${t.target}`);
    await expect(page.locator('#btn-next')).toBeFocused();
    await expect(page.locator('#photo .tile.is-dim')).toHaveCount(1);
    // textová odpověď: Enter odešle, diakritika nevadí
    await page.locator('#btn-next').click();
    const t2 = L.buildGame('A')[1];
    await page.locator('#ans').fill(String(t2.answer + 1));
    await page.locator('#ans').press('Enter');
    await expect(page.locator('#feedback')).toContainText('Ještě ne.');
    await page.locator('#ans').fill(String(t2.answer));
    await page.locator('#ans').press('Enter');
    await expect(page.locator('#feedback')).toContainText('Správně.');
  });

  test('rychlý režim a varianta z URL: 6 úloh; klávesnice v mřížce (šipky)', async ({ page }) => {
    await page.goto(URL + '?varianta=C&rezim=rychly');
    await expect(page.getByRole('radio', { name: 'C', exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    const tasks = L.buildGame('C', 'rychly');
    expect(tasks.map(t => t.type)).toContain('paint');
    for (const t of tasks) {
      await passIntroIfShown(page);
      await expect(page.locator('#hud-task')).toHaveText(`${tasks.indexOf(t) + 1}/6`);
      if (t.type === 'paint') {
        // roving tabindex: jen jedna buňka v pořadí Tab, šipky se pohybují, mezerník vybarví
        await expect(page.locator('#tool button.px[tabindex="0"]')).toHaveCount(1);
        await page.locator('#tool button.px').first().focus();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        await expect(page.locator('#tool button.px').nth(9)).toBeFocused();
        await page.keyboard.press('Space');
        await expect(page.locator('#tool button.px').nth(9)).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('button', { name: 'Vymazat mřížku' }).click();
      }
      await solve(page, t);
      await page.getByRole('button', { name: 'Zkontrolovat' }).click();
      await expect(page.locator('#feedback')).toContainText('Správně');
      await page.locator('#btn-next').click();
    }
    await expect(page.locator('#result')).toContainText('6 z 6');
    await expect(page.locator('#stats')).toContainText('C · rychlá mise');
  });

  test('tlačítko Menu hry: bez postupu rovnou, po vyřešené úloze se zeptá; Hrát dál / Ano, do menu', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('button', { name: 'Menu hry' })).toBeHidden(); // na úvodu není potřeba
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntroIfShown(page);
    // nic vyřešeno → rovnou do menu hry (ne do katalogu)
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Šifrovací laboratoř' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(URL));
    // znovu a jednu úlohu vyřešit
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntroIfShown(page);
    await solve(page, L.buildGame('A')[0]);
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText('Správně');
    await page.locator('#btn-next').click();
    await passIntroIfShown(page);
    const title = await page.locator('#task-h').innerText();
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await expect(page.getByRole('dialog', { name: 'Odejít do menu hry?' })).toBeVisible();
    await page.getByRole('button', { name: 'Hrát dál' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.locator('#task-h')).toHaveText(title);
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await page.getByRole('button', { name: 'Ano, do menu' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Šifrovací laboratoř' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Menu hry' })).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('smazání výsledků jen této hry', async ({ page }) => {
    await page.goto(URL);
    await page.evaluate(k => {
      localStorage.setItem(k, JSON.stringify({ best: { cela: { firstTry: 9, total: 17, hints: 2 } } }));
      localStorage.setItem('vyukovy-portal:roboti-dilna:v1', '{"keep":1}');
    }, KEY);
    await page.reload();
    await expect(page.locator('#best')).toContainText('napoprvé 9 z 17');
    await page.getByRole('button', { name: 'Smazat moje výsledky' }).click();
    await page.getByRole('button', { name: 'Ano, smazat' }).click();
    await expect(page.locator('#best')).toContainText('Zatím žádný výsledek');
    expect(await page.evaluate(() => localStorage.getItem('vyukovy-portal:roboti-dilna:v1'))).toBe('{"keep":1}');
  });
});

test.describe('Šifrovací laboratoř – mobil', () => {
  test('320 px: všechny typy úloh bez vodorovného scrollu @mobile', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(URL);
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    for (const t of L.buildGame('A')) {
      await passIntroIfShown(page);
      await expect(page.locator('#task-h')).toHaveText(t.title);
      await expectNoHorizontalScroll(page);
      // dvakrát „Zkontrolovat“ bez odpovědi → řešení
      await page.getByRole('button', { name: 'Zkontrolovat' }).tap();
      await page.getByRole('button', { name: 'Zkontrolovat' }).tap();
      await page.getByRole('button', { name: 'Ukázat řešení' }).tap();
      await page.locator('#btn-next').tap();
    }
    await expect(page.locator('#s-end')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
