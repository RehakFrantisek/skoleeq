// E2E testy interaktivních výkladů (scrollytelling): načtení bez chyb, ovládání šipkami a tlačítky,
// tečky kapitol, návrat do katalogu, filtr „Druh“ v katalogu a šířka 320 px.
import { test, expect } from '@playwright/test';
import { watchErrors, expectNoHorizontalScroll, card, registry } from './helpers.js';

const VYKLADY = registry().apps.filter(a => a.kind === 'vyklad' && a.status === 'published');

test('registr obsahuje výklady', () => {
  expect(VYKLADY.map(a => a.id)).toEqual(expect.arrayContaining(['pudy', 'kolobeh-vody', 'tajne-zpravy']));
});

for (const v of VYKLADY) {
  test.describe(`Výklad ${v.title}`, () => {
    test('načte se bez chyb, šipka i tlačítko posunou výklad @smoke', async ({ page }) => {
      const errors = watchErrors(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(v.url);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('#dots li').first()).toBeAttached();
      expect(await page.locator('#dots li').count()).toBeGreaterThan(3);

      const y0 = await page.evaluate(() => scrollY);
      await page.keyboard.press('ArrowRight');
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y0);
      const y1 = await page.evaluate(() => scrollY);
      await page.locator('#stepNext').click();
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y1);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y1); // dojelo
      const y2 = await page.evaluate(() => scrollY);
      await page.keyboard.press('ArrowLeft');
      await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(y2);

      // projet celý výklad (scény reagují na posouvání) – žádná chyba v konzoli
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < h; y += 700) await page.evaluate(top => window.scrollTo(0, top), y);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      expect(errors).toEqual([]);
    });

    test('odkaz zpět vede na stránku Výklad', async ({ page }) => {
      await page.goto(v.url);
      await page.locator('a.back').click();
      await expect(page).toHaveURL('/vyklad/');
      await expect(card(page, v.id)).toBeVisible();
    });

    test('na mobilu 320 px bez vodorovného posuvníku @mobile', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(v.url);
      await expect(page.locator('h1')).toBeVisible();
      await expectNoHorizontalScroll(page);
    });
  });
}

test('stránka Výklad: jen výklady a nástroje, Hřiště jen hry @smoke', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/vyklad/');
  await expect(page.getByRole('heading', { level: 1, name: 'Výklad' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Hlavní navigace' }).getByRole('link', { name: 'Výklad' })).toHaveAttribute('aria-current', 'page');
  await expect(card(page, 'pudy').getByRole('link', { name: 'Spustit výklad Co máme pod nohama?' })).toHaveAttribute('href', '/vyklad/pudy/');
  await expect(card(page, 'psaci-azbuka').getByRole('link', { name: 'Otevřít nástroj Psací azbuka' })).toHaveAttribute('href', '/vyklad/psaci-azbuka/');
  await expect(card(page, 'pudy')).toContainText('Výklad');
  await expect(page.locator('.app-card[data-kind="hra"]')).toHaveCount(0);
  await expect(page.locator('.app-card')).toHaveCount(VYKLADY.length + 1);
  await expect(page.locator('#count')).toHaveText(`${VYKLADY.length} výklady a 1 nástroj v katalogu`);
  await expect(page.getByLabel('Obtížnost')).toHaveCount(0);

  await page.goto('/vyklad/?tema=Voda');
  await expect(page.locator('.app-card')).toHaveCount(1);
  await expect(card(page, 'kolobeh-vody')).toBeVisible();

  await page.getByRole('link', { name: /Na Hřiště/ }).click();
  await expect(page).toHaveURL('/hriste/');
  await expect(page.locator('.app-card[data-kind="vyklad"]')).toHaveCount(0);
  await expect(card(page, 'klavesova-mise')).toBeVisible();
  expect(errors).toEqual([]);
});

test('O projektu vede na Výklad a Hřiště, ne na úvod', async ({ page }) => {
  await page.goto('/o-projektu/');
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: /Na Výklad/ })).toHaveAttribute('href', '/vyklad/');
  await expect(main.getByRole('link', { name: /Na Hřiště/ })).toHaveAttribute('href', '/hriste/');
  await expect(main.getByRole('link', { name: /katalogu her/ })).toHaveCount(0);
});
