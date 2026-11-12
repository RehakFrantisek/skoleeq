// E2E testy hry Signál ze sondy: titulní obrazovka, ukázka, dohrání celé mise přes nástroje všech typů,
// měřidlo okna spojení a náhled na Zemi, chyba s vysvětlením, nevyplněná odpověď se nepočítá, nápověda
// a řešení, rychlý režim z URL, háčky v úsecích, Menu hry, 320 px s dotykem, smazání výsledků.
import { test, expect } from '@playwright/test';
import { watchErrors, expectNoHorizontalScroll } from './helpers.js';
import * as L from '../../public/aplikace/signal-ze-sondy/logic.js';

const URL = '/aplikace/signal-ze-sondy/';
const KEY = 'vyukovy-portal:signal-ze-sondy:v1';
const CHECK = 'Odeslat a zkontrolovat';

/** Vyplní správnou odpověď přes skutečné ovládací prvky nástroje. */
async function solve(page, t, { tap = false } = {}) {
  const a = L.solution(t);
  const tool = page.locator('#tool');
  const press = loc => (tap ? loc.tap() : loc.click());
  switch (t.type) {
    case 'palette-build':
      for (const [li, c] of a.table.entries()) await page.locator(`#tab-${li}`).selectOption(String(c));
      await tool.locator(`input[name^="bpp-"][value="${a.bpp}"]`).check();
      break;
    case 'hex-mix':
      for (const [ch, name] of ['Červená', 'Zelená', 'Modrá'].entries()) await tool.getByRole('group', { name }).getByLabel(String(a.rgb[ch]), { exact: true }).check();
      break;
    case 'vector-send':
      for (const [i, v] of a.values.entries()) await page.locator(`#b-${i}`).fill(v);
      break;
    case 'order': {
      const order = [...t.start];
      for (let p = 0; p < order.length; p++) {
        while (order.indexOf(p) > p) {
          const pos = order.indexOf(p);
          await press(tool.getByRole('button', { name: `Posunout dřív: ${L.shapeText(t.shapes[p])}` }));
          [order[pos - 1], order[pos]] = [order[pos], order[pos - 1]];
        }
      }
      break;
    }
    case 'rle-rows':
      for (const [i, v] of a.values.entries()) await page.locator(`#r-${i}`).fill(v);
      break;
    case 'rle': case 'number':
      await page.locator('#ans').fill(a.value);
      break;
    case 'resend':
      for (const y of a.rows) await press(tool.locator('.resend').nth(y));
      break;
    case 'transfer':
      for (const [i, m] of a.choices.entries()) await tool.locator(`input[name="tr-${i}"][value="${m}"]`).check();
      break;
    default: throw new Error(t.type);
  }
}

async function passIntroIfShown(page, { tap = false } = {}) {
  if (await page.locator('#s-intro').isVisible()) {
    const b = page.getByRole('button', { name: 'Navázat spojení →' });
    await (tap ? b.tap() : b.click());
  }
}

test.describe('Signál ze sondy', () => {
  test.use({ viewport: { width: 1366, height: 820 } });

  test('titulní obrazovka: nastavení, odkazy, žádné chyby @smoke', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('heading', { level: 1, name: 'Signál ze sondy' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Celá mise/ })).toBeChecked();
    await expect(page.getByRole('link', { name: 'Zpět do katalogu her' })).toHaveAttribute('href', '/');
    await expect(page.getByRole('link', { name: /Pro učitele/ })).toHaveAttribute('href', '/pro-ucitele/#signal-ze-sondy');
    expect(errors).toEqual([]);
  });

  test('ukázka + celá mise (varianta A) přes všechny nástroje, rekord v localStorage @smoke', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await page.goto(URL);
    await page.getByRole('button', { name: 'Začít ukázkou' }).click();
    await expect(page.locator('#task-level')).toHaveText('Ukázka');
    await solve(page, L.tutorialTask());
    await page.getByRole('button', { name: CHECK }).click();
    await expect(page.locator('#feedback')).toContainText('Doručeno');
    await page.getByRole('button', { name: 'Spustit misi →' }).click();
    const tasks = L.buildGame('A', 'cela');
    let intros = 0;
    for (const [i, t] of tasks.entries()) {
      if (await page.locator('#s-intro').isVisible()) { intros++; await expect(page.locator('#intro-h')).toHaveText(L.LEVEL_INFO[t.level].name); }
      await passIntroIfShown(page);
      await expect(page.locator('#task-h'), t.id).toHaveText(t.title);
      await solve(page, t);
      await page.getByRole('button', { name: CHECK }).click();
      await expect(page.locator('#feedback'), `${t.id}: ${await page.locator('#feedback').innerText()}`).toContainText('Doručeno');
      await expect(page.locator('#album .slot.is-done')).toHaveCount(i + 1);
      if (t.type === 'resend') await expect(page.getByRole('img', { name: `Složený snímek: ${t.picName}` })).toBeVisible();
      if (t.type === 'transfer') await expect(page.locator('#tool .meter__text')).toContainText(`z ${t.budget} bitů`);
      await page.locator('#btn-next').click();
    }
    expect(intros).toBe(5);
    await expect(page.locator('#end-h')).toBeFocused();
    await expect(page.locator('#result')).toContainText('9 z 9 přenosů, 9 napoprvé');
    await expect(page.locator('#skills li.ok')).toHaveCount(Object.keys(L.SKILLS).length);
    await expect(page.locator('#album-end .slot.is-done')).toHaveCount(9);
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    expect(saved.best.cela).toMatchObject({ firstTry: 9, total: 9, hints: 0, variant: 'A' });
    expect(errors).toEqual([]);
  });

  test('tabulka barev: měřidlo a náhled reagují, chyba = vysvětlení, prázdná odpověď se nepočítá, řešení', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntroIfShown(page);
    const t = L.buildGame('A')[0];
    const a = L.solution(t);
    // nic nevyplněno → nepočítá se
    await page.getByRole('button', { name: CHECK }).click();
    await page.getByRole('button', { name: CHECK }).click();
    await expect(page.locator('#feedback')).toContainText('Doplň barvu u každého čísla');
    await expect(page.locator('#btn-reveal')).toBeHidden();
    // náhled na Zemi: neznámá políčka, dokud tabulka není vyplněná
    await expect(page.locator('.pix--earth .is-unknown')).toHaveCount(t.px);
    for (const [li, c] of a.table.entries()) await page.locator(`#tab-${li}`).selectOption(String(c));
    await expect(page.locator('.pix--earth .is-unknown')).toHaveCount(0);
    // moc bitů: měřidlo ukáže, že se to nevejde
    await page.locator(`input[name^="bpp-"][value="${t.bpp + 1}"]`).check();
    await expect(page.locator('#tool .meter')).toHaveClass(/is-over/);
    await expect(page.locator('#tool .meter__text')).toContainText('nevejde se');
    await page.getByRole('button', { name: CHECK }).click();
    await expect(page.locator('#feedback')).toContainText(`okno spojení má jen ${t.budget}`);
    // málo bitů: část políček nedorazí
    await page.locator(`input[name^="bpp-"][value="${t.bpp - 1}"]`).check();
    expect(await page.locator('.pix--earth .is-unknown').count()).toBeGreaterThan(0);
    await page.getByRole('button', { name: CHECK }).click();
    await expect(page.locator('#feedback')).toContainText('vejdou jen čísla');
    await page.getByRole('button', { name: 'Ukázat řešení' }).click();
    await expect(page.locator('#feedback')).toContainText('Řešení:');
    await expect(page.locator('#tool .meter')).not.toHaveClass(/is-over/);
    await expect(page.locator('#btn-next')).toBeFocused();
    await expect(page.locator('#album .slot.is-dim')).toHaveCount(1);
  });

  test('úseky: náhled na Zemi, háčky nejsou povinné, Enter odešle; nápovědy', async ({ page }) => {
    await page.goto(URL + '?rezim=rychly');
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    for (const t of L.buildGame('A', 'rychly')) {
      await passIntroIfShown(page);
      if (t.type === 'rle-rows') {
        await page.locator('#r-0').fill(t.answers[0].replace(/\d+\D$/, '')); // chybí poslední úsek
        await expect(page.locator('.pix--earth .is-unknown')).not.toHaveCount(0);
        await page.locator('#r-1').fill(t.answers[1]);
        await page.locator('#r-1').press('Enter');
        await expect(page.locator('#feedback')).toContainText(`Řádek ${t.ask[0] + 1}:`);
        await page.locator('#r-0').fill(t.answers[0].replace(/Č/g, 'c').toLowerCase());
        await expect(page.locator('.pix--earth .is-unknown')).toHaveCount(0);
        for (let k = 0; k < t.hints.length; k++) await page.getByRole('button', { name: '🔍 Nápověda' }).click();
        await expect(page.locator('#hint-count')).toHaveText(String(t.hints.length));
        await expect(page.locator('#btn-hint')).toBeDisabled();
        await page.locator('#r-0').press('Enter');
        await expect(page.locator('#feedback')).toContainText('Doručeno');
        return;
      }
      await solve(page, t);
      await page.getByRole('button', { name: CHECK }).click();
      await expect(page.locator('#feedback')).toContainText('Doručeno');
      await page.locator('#btn-next').click();
    }
    throw new Error('rle-send v rychlé misi chybí');
  });

  test('rychlý režim a varianta z URL: 5 přenosů; poškozené řádky a velký přenos s chybou', async ({ page }) => {
    await page.goto(URL + '?varianta=C&rezim=rychly');
    await expect(page.getByRole('radio', { name: 'C', exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    const tasks = L.buildGame('C', 'rychly');
    for (const [i, t] of tasks.entries()) {
      await passIntroIfShown(page);
      await expect(page.locator('#hud-task')).toHaveText(`${i + 1}/5`);
      if (t.type === 'resend') {
        const good = t.received.findIndex(r => L.rleSum(r) === 8);
        await page.locator('#tool .resend').nth(good).click();
        await expect(page.locator('#tool .resend').nth(good)).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('button', { name: CHECK }).click();
        await expect(page.locator('#feedback')).toContainText(`Řádek ${good + 1} dorazil celý`);
        await page.locator('#tool .resend').nth(good).click(); // zrušit výběr
      }
      if (t.type === 'transfer') {
        const ch = t.shots.map(s => s.best);
        const noise = t.shots.findIndex(s => s.kind === 'noise');
        ch[noise] = 1; // úseky u zrnité fotky
        for (const [k, m] of ch.entries()) await page.locator(`input[name="tr-${k}"][value="${m}"]`).check();
        await page.getByRole('button', { name: CHECK }).click();
        await expect(page.locator('#feedback')).toContainText(`okno má jen ${t.budget}`);
      }
      await solve(page, t);
      await page.getByRole('button', { name: CHECK }).click();
      await expect(page.locator('#feedback')).toContainText('Doručeno');
      await page.locator('#btn-next').click();
    }
    await expect(page.locator('#result')).toContainText('5 z 5');
    await expect(page.locator('#stats')).toContainText('C · rychlá mise');
  });

  test('tlačítko Menu hry: bez postupu rovnou, po vyřešené úloze se zeptá', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('button', { name: 'Menu hry' })).toBeHidden();
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntroIfShown(page);
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Signál ze sondy' })).toBeVisible();
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntroIfShown(page);
    await solve(page, L.buildGame('A')[0]);
    await page.getByRole('button', { name: CHECK }).click();
    await page.locator('#btn-next').click();
    const title = await page.locator('#task-h').innerText();
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await expect(page.getByRole('dialog', { name: 'Odejít do menu hry?' })).toBeVisible();
    await page.getByRole('button', { name: 'Hrát dál' }).click();
    await expect(page.locator('#task-h')).toHaveText(title);
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await page.getByRole('button', { name: 'Ano, do menu' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Signál ze sondy' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('smazání výsledků jen této hry', async ({ page }) => {
    await page.goto(URL);
    await page.evaluate(k => {
      localStorage.setItem(k, JSON.stringify({ best: { cela: { firstTry: 7, total: 9, hints: 2 } } }));
      localStorage.setItem('vyukovy-portal:roboti-dilna:v1', '{"keep":1}');
    }, KEY);
    await page.reload();
    await expect(page.locator('#best')).toContainText('napoprvé 7 z 9');
    await page.getByRole('button', { name: 'Smazat moje výsledky' }).click();
    await page.getByRole('button', { name: 'Ano, smazat' }).click();
    await expect(page.locator('#best')).toContainText('Zatím žádný výsledek');
    expect(await page.evaluate(() => localStorage.getItem('vyukovy-portal:roboti-dilna:v1'))).toBe('{"keep":1}');
  });
});

test.describe('Signál ze sondy – mobil', () => {
  test('320 px: celá mise dotykem, všechny typy úloh bez vodorovného scrollu @mobile', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(URL + '?varianta=B');
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Začít ukázkou' }).tap();
    await expectNoHorizontalScroll(page);
    await solve(page, L.tutorialTask(), { tap: true });
    await page.getByRole('button', { name: CHECK }).tap();
    await page.locator('#btn-next').tap();
    for (const t of L.buildGame('B')) {
      await passIntroIfShown(page, { tap: true });
      await expect(page.locator('#task-h')).toHaveText(t.title);
      await expectNoHorizontalScroll(page);
      await solve(page, t, { tap: true });
      await page.getByRole('button', { name: CHECK }).tap();
      await expect(page.locator('#feedback')).toContainText('Doručeno');
      await expectNoHorizontalScroll(page);
      await page.locator('#btn-next').tap();
    }
    await expect(page.locator('#result')).toContainText('9 z 9');
    await expectNoHorizontalScroll(page);
  });
});
