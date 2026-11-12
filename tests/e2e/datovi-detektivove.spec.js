// E2E testy hry Datoví detektivové: celé odehrání rychlého režimu, chyby a opravy,
// ovládání jen klávesnicí, mobil 320 px, snížený pohyb, lokální rekord a jeho smazání.
// Očekávané odpovědi bere test přímo z logic.js (stejný seed => stejné úlohy).
import { test, expect } from '@playwright/test';
import { watchErrors, expectNoHorizontalScroll } from './helpers.js';
import { buildMission, tasksForMode, VARIANTS } from '../../public/aplikace/datovi-detektivove/logic.js';

const URL = '/aplikace/datovi-detektivove/';
const KEY = 'vyukovy-portal:datovi-detektivove:v1';

async function openLevelIfShown(page) {
  const go = page.getByRole('button', { name: 'Otevřít spis' });
  if (await go.isVisible()) await go.click();
}

/** Vyplní správnou odpověď na aktuální úlohu přes UI (myš). */
async function answer(page, t) {
  const desk = page.locator('#desk');
  switch (t.type) {
    case 'cell':
      await desk.locator(`.cell[data-row="${t.expected.row}"][data-col="${t.expected.col}"]`).click();
      break;
    case 'cells':
      for (const r of t.expected.rows) await desk.locator(`.cell[data-row="${r}"][data-col="${t.expected.cols[1]}"]`).click();
      break;
    case 'sort':
      await page.getByLabel('Seřadit podle').selectOption(t.sortKey);
      await page.getByLabel('Pořadí').selectOption(t.sortDir);
      await page.getByRole('radio', { name: 'Rozšířit výběr – seřadit celé řádky' }).check();
      await page.getByRole('button', { name: 'Seřadit', exact: true }).click();
      await page.getByRole('radio', { name: t.options.find(o => o.id === t.expected).label, exact: true }).check();
      break;
    case 'filter': {
      const [g, k] = t.conditions;
      await page.getByLabel('Žánr', { exact: true }).selectOption(g.value);
      await page.getByLabel('Výpůjčky – podmínka').selectOption('gte');
      await page.getByLabel('Výpůjčky – hodnota').fill(String(k.value));
      await page.getByLabel('Kolik knih zůstalo po filtrování?').fill(String(t.expected));
      break;
    }
    case 'bar':
      await desk.locator('.cbar').nth(t.expected).click();
      break;
    case 'compare':
      await page.getByRole('radio', { name: new RegExp(`^Graf ${t.expected.chart} klame`) }).check();
      await page.getByRole('radio', { name: t.reasons.find(r => r.id === t.expected.reason).label }).check();
      break;
    default:
      throw new Error('test neumí typ ' + t.type);
  }
}

test.describe('Datoví detektivové', () => {
  test('titulní obrazovka: co se naučíš, ovládání, režimy, odkaz pro učitele @smoke', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('heading', { level: 1, name: 'Datoví detektivové' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Co se naučíš' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ovládání' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Rychlý režim/ })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Zobrazit stopky/ })).not.toBeChecked(); // výchozí: bez časomíry
    await expect(page.getByRole('link', { name: /Pro učitele/ })).toHaveAttribute('href', '/pro-ucitele/#datovi-detektivove');
    await expect(page.getByRole('link', { name: 'Zpět do katalogu her' })).toHaveAttribute('href', '/');
    expect(errors).toEqual([]);
  });

  test('rychlý režim jde odehrát od začátku do konce, rekord se uloží jen lokálně a jde smazat @smoke', async ({ page }) => {
    const errors = watchErrors(page);
    const tasks = tasksForMode(buildMission(VARIANTS.A), 'rychly');
    await page.goto(URL);
    await page.getByRole('radio', { name: /Rychlý režim/ }).check();
    await page.getByRole('radio', { name: 'Varianta A' }).check();
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();

    for (const [i, t] of tasks.entries()) {
      await openLevelIfShown(page);
      await expect(page.locator('#task-num')).toHaveText(`Úloha ${i + 1} z ${tasks.length}`);
      await expect(page.locator('#task-h')).toHaveText(t.title);
      await answer(page, t);
      await page.getByRole('button', { name: 'Zkontrolovat' }).click();
      await expect(page.locator('#feedback'), t.id).toContainText('Správně');
      await page.locator('#btn-next').click();
    }

    await expect(page.getByRole('heading', { name: 'Případ uzavřen!' })).toBeVisible();
    await expect(page.locator('#end-stats')).toContainText('Vyřešeno napoprvé6 z 6');
    await expect(page.locator('#end-stats')).toContainText('Použité nápovědy0');
    await expect(page.locator('#end-skills li.is-ok')).toHaveCount(4); // čtení, řazení, filtr, pravdivost

    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    expect(saved.best.rychly).toMatchObject({ firstTry: 6, total: 6, hints: 0, timeMs: null });
    expect(JSON.stringify(saved)).not.toMatch(/jméno|name/i);

    await page.getByRole('button', { name: 'Zpět na úvod' }).click();
    await expect(page.locator('#records')).toContainText('Rychlý režim: napoprvé 6 z 6');
    await page.getByRole('button', { name: 'Smazat moje výsledky' }).click();
    await page.getByRole('button', { name: 'Ano, smazat' }).click();
    await expect(page.locator('#records')).toContainText('Zatím žádný výsledek');
    expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBeNull();
    expect(errors).toEqual([]);
  });

  test('tlačítko Menu hry: bez postupu rovnou, po vyřešené úloze se zeptá; Hrát dál / Ano, do menu', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('button', { name: 'Menu hry' })).toBeHidden(); // na úvodu není potřeba
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await openLevelIfShown(page);
    // nic vyřešeno → rovnou do menu hry (ne do katalogu)
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Datoví detektivové' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(URL));
    // znovu a jednu úlohu vyřešit
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await openLevelIfShown(page);
    await answer(page, buildMission(VARIANTS.A).tasks[0]);
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText('Správně');
    await page.locator('#btn-next').click();
    await openLevelIfShown(page);
    const title = await page.locator('#task-h').innerText();
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await expect(page.getByRole('dialog', { name: 'Odejít do menu hry?' })).toBeVisible();
    await page.getByRole('button', { name: 'Hrát dál' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.locator('#task-h')).toHaveText(title);
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await page.getByRole('button', { name: 'Ano, do menu' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Datoví detektivové' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Menu hry' })).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('chyba má vysvětlení, jde opravit bez ztráty kontextu, nápověda a řešení', async ({ page }) => {
    const t6 = buildMission(VARIANTS.B).tasks.find(t => t.id === 't6');
    await page.goto(URL + '?varianta=B&rezim=rychly');
    await expect(page.getByRole('radio', { name: 'Varianta B' })).toBeChecked();
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await openLevelIfShown(page);
    // přeskočíme t1 a t3 přes „Ukázat řešení“ (2 chybné pokusy)
    for (let i = 0; i < 2; i++) {
      await openLevelIfShown(page);
      await page.getByRole('button', { name: 'Zkontrolovat' }).click();
      await expect(page.locator('#feedback')).toContainText('Ještě ne');
      await expect(page.getByRole('button', { name: 'Ukázat řešení' })).toBeHidden();
      await page.getByRole('button', { name: 'Zkontrolovat' }).click();
      await page.getByRole('button', { name: 'Ukázat řešení' }).click();
      await expect(page.locator('#feedback')).toContainText('Řešení:');
      await page.locator('#btn-next').click();
    }
    await openLevelIfShown(page);
    await expect(page.locator('#task-h')).toHaveText('Seřaď a najdi vítěze');

    // past: seřadit jen sloupec
    await page.getByLabel('Seřadit podle').selectOption('voda');
    await page.getByLabel('Pořadí').selectOption('desc');
    await page.getByRole('radio', { name: 'Jen vybraný sloupec' }).check();
    await page.getByRole('button', { name: 'Seřadit', exact: true }).click();
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText('Řádky se rozpadly');

    // nápověda nic neblokuje a počítá se
    await page.getByRole('button', { name: /Nápověda/ }).click();
    await expect(page.locator('#hints')).toContainText('Nápověda 1');
    await expect(page.locator('#hint-count b')).toHaveText('1');

    // Zpět (Ctrl+Z) vrátí řazení, pak správně celé řádky
    await page.locator('#task-h').click();
    await page.keyboard.press('Control+z');
    await expect(page.locator('.tool-status')).toHaveText('Poslední řazení vráceno.');
    await page.getByRole('radio', { name: 'Rozšířit výběr – seřadit celé řádky' }).check();
    await page.getByRole('button', { name: 'Seřadit', exact: true }).click();
    const firstDay = page.locator('#desk tbody tr').first().locator('th');
    await expect(firstDay).toHaveText(t6.options.find(o => o.id === t6.expected).label);
    await page.getByRole('radio', { name: t6.options.find(o => o.id === t6.expected).label, exact: true }).check();
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText('Správně');
  });

  test('ukázka a první úloha jdou ovládat jen klávesnicí', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Začít ukázkou' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#task-h')).toBeFocused();
    await expect(page.locator('#coach')).toBeVisible();

    // Tab do tabulky (roving tabindex), šipkami na C3, Enter vybere
    await page.keyboard.press('Tab');
    await expect(page.locator('.cell').first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.locator('.cell[aria-pressed="true"]')).toHaveAttribute('aria-label', /^C3:/);
    await expect(page.locator('#sel-info')).toHaveText('Vybraná buňka: C3');

    // Tab mimo tabulku: jen jedna buňka je v pořadí Tab
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /Nápověda/ })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator('#feedback')).toContainText('Správně');
    await expect(page.locator('#btn-next')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#level-h')).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator('#task-h')).toBeFocused();

    // sloupec grafu jde vybrat klávesnicí (role=button, Enter)
    const t13 = buildMission(VARIANTS.A).tasks.find(t => t.id === 't13');
    await page.goto(URL + '?rezim=rychly');
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    for (let i = 0; i < 4; i++) {
      await openLevelIfShown(page);
      await page.getByRole('button', { name: 'Zkontrolovat' }).click();
      await page.getByRole('button', { name: 'Zkontrolovat' }).click();
      await page.getByRole('button', { name: 'Ukázat řešení' }).click();
      await page.locator('#btn-next').click();
    }
    await openLevelIfShown(page);
    await expect(page.locator('#task-h')).toHaveText('Tabulka vs. graf');
    const bar = page.getByRole('button', { name: new RegExp(`^Sloupec ${t13.chart.labels[t13.expected]}`) });
    await bar.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#sel-info')).toHaveText(`Vybraný sloupec: ${t13.chart.labels[t13.expected]}`);
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText('Odhaleno');
  });

  test('stopky jsou volitelné a nic neomezují', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('checkbox', { name: /Zobrazit stopky/ }).check();
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await expect(page.locator('#timer')).toBeVisible();
    await expect(page.locator('#timer')).toContainText('0:0');
  });

  test('snížený pohyb vypne přechody', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(URL);
    const d = await page.getByRole('button', { name: 'Začít ukázkou' }).evaluate(b => getComputedStyle(b).transitionDuration);
    expect(d.split(',').every(x => parseFloat(x) === 0)).toBe(true);
  });
});

test.describe('Datoví detektivové – mobil', () => {
  test('320 px: titulní obrazovka, ukázka i grafová úloha bez vodorovného scrollu @mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(URL);
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Začít ukázkou' }).click();
    await expectNoHorizontalScroll(page);
    await page.locator('.cell[data-row="1"][data-col="2"]').tap();
    await page.getByRole('button', { name: 'Zkontrolovat' }).tap();
    await expect(page.locator('#feedback')).toContainText('Správně');

    await page.goto(URL + '?rezim=dlouha');
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).tap();
    // projdeme všechny úlohy přes „Ukázat řešení“ a na každé zkontrolujeme šířku
    for (let i = 0; i < 18; i++) {
      await openLevelIfShown(page);
      await expectNoHorizontalScroll(page);
      await page.getByRole('button', { name: 'Zkontrolovat' }).tap();
      await page.getByRole('button', { name: 'Zkontrolovat' }).tap();
      await page.getByRole('button', { name: 'Ukázat řešení' }).tap();
      await page.locator('#btn-next').tap();
    }
    await expect(page.getByRole('heading', { name: 'Případ uzavřen!' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
