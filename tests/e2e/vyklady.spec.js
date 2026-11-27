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

    test('odkaz zpět vede do katalogu na výklady', async ({ page }) => {
      await page.goto(v.url);
      await page.locator('a.back').click();
      await expect(page).toHaveURL(/\/\?druh=vyklad/);
      await expect(page.locator('#f-druh')).toHaveValue('vyklad');
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

test('katalog: filtr Druh odliší hry, výklady a nástroje @smoke', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(card(page, 'pudy')).toBeVisible();
  await expect(card(page, 'pudy').getByRole('link', { name: 'Spustit výklad Co máme pod nohama?' })).toHaveAttribute('href', '/vyklad/pudy/');
  await expect(card(page, 'psaci-azbuka').getByRole('link', { name: 'Otevřít nástroj Psací azbuka' })).toHaveAttribute('href', '/vyklad/psaci-azbuka/');
  await expect(card(page, 'pudy')).toContainText('Výklad');

  await page.getByLabel('Druh').selectOption('vyklad');
  await expect(page).toHaveURL(/druh=vyklad/);
  await expect(page.locator('.app-card')).toHaveCount(VYKLADY.length);
  await expect(page.locator('.app-card[data-kind="hra"]')).toHaveCount(0);

  await page.getByLabel('Druh').selectOption('hra');
  await expect(card(page, 'pudy')).toHaveCount(0);
  await expect(card(page, 'klavesova-mise')).toBeVisible();

  await page.goto('/?tema=Voda');
  await expect(page.locator('.app-card')).toHaveCount(1);
  await expect(card(page, 'kolobeh-vody')).toBeVisible();
  expect(errors).toEqual([]);
});
