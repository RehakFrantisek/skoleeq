// E2E testy aplikace Psací azbuka: fonetické psaní, rozložení ЙЦУКЕН podle fyzické klávesy,
// písmena na obrazovce, přepis latinky, stažení PNG, uložení do localStorage a 320 px.
import { test, expect } from '@playwright/test';
import { watchErrors, expectNoHorizontalScroll } from './helpers.js';
import { makeSet } from '../fixtures/glyph-set.mjs';

const URL = '/aplikace/psaci-azbuka/';
const KEY = 'vyukovy-portal:psaci-azbuka:v1';

test.beforeEach(async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(k => localStorage.removeItem(k), KEY);
  await page.reload();
});

test('fonetické psaní na české klávesnici vytvoří azbuku @smoke', async ({ page }) => {
  const errors = watchErrors(page);
  const text = page.locator('#text');
  await text.fill('');
  await text.click();
  await page.keyboard.type('Privet, ja Anna! Chorošo, ščuka.');
  await expect(text).toHaveValue('Привет, я Анна! Хорошо, щука.');
  await expect(page.locator('#preview')).toHaveAttribute('aria-label', /Привет, я Анна/);
  expect(errors).toEqual([]);
});

test('režim ЙЦУКЕН: rozhoduje fyzická klávesa', async ({ page }) => {
  await page.getByLabel(/ruské rozložení ЙЦУКЕН/).check();
  const text = page.locator('#text');
  await text.fill('');
  await text.click();
  for (const code of ['KeyG', 'KeyH', 'KeyB', 'KeyD', 'KeyT', 'KeyN']) await page.keyboard.press(code);
  await page.keyboard.press('Space');
  await page.keyboard.press('Shift+KeyZ');
  await page.keyboard.press('Slash');
  await expect(text).toHaveValue('привет Я.');
  await expect(page.locator('.key[data-code="KeyQ"]')).toContainText('й');
});

test('písmena na obrazovce, přepis latinky, abeceda', async ({ page }) => {
  const text = page.locator('#text');
  await text.fill('');
  await page.locator('#kbd-wrap summary').click();
  await page.getByRole('button', { name: 'Vložit ж' }).click();
  await page.getByLabel('Velká písmena').check();
  await page.getByRole('button', { name: 'Vložit Я' }).click();
  await expect(text).toHaveValue('жЯ');
  await text.fill('Dobryj děň');
  await page.getByRole('button', { name: 'Přepsat latinku na azbuku' }).click();
  await expect(text).toHaveValue('Добрый день');
  await page.getByRole('button', { name: 'Smazat text' }).click();
  await page.getByRole('button', { name: 'Vložit celou abecedu' }).click();
  await expect(text).toHaveValue(/^Аа Бб/);
});

test('stažení PNG psacího písma a uložení nastavení', async ({ page }) => {
  await page.locator('#text').fill('Мама мыла раму');
  await page.locator('#opt-lines').selectOption('school');
  await page.locator('#opt-scale').selectOption('2');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Stáhnout obrázek PNG' }).click()]);
  expect(download.suggestedFilename()).toBe('mama-myla-ramu.png');
  const buf = await (await download.createReadStream()).toArray().then(c => Buffer.concat(c));
  expect(buf.subarray(1, 4).toString()).toBe('PNG');
  expect(buf.readUInt32BE(16)).toBeGreaterThan(300); // šířka obrázku
  await expect(page.locator('#feedback')).toContainText('stahuje');
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('#text')).toHaveValue('Мама мыла раму');
  await expect(page.locator('#opt-lines')).toHaveValue('school');
});

test('vlastní sada písmen: nahrání, výběr, jiný rukopis, export a uložení', async ({ page }) => {
  const errors = watchErrors(page);
  await page.locator('#text').fill('мама, 12');
  await expect(page.locator('#opt-font-custom')).toBeHidden();
  await page.locator('#set-file').setInputFiles({ name: 'nesmysl.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
  await expect(page.locator('#feedback')).toContainText('nepodařilo');
  await page.locator('#set-file').setInputFiles({ name: 'sada.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeSet())) });
  await expect(page.locator('#feedback')).toContainText('nahraná');
  await expect(page.locator('#opt-font')).toHaveValue('custom');
  await expect(page.locator('#set-status')).toContainText('Testovací sada');
  const before = await page.locator('#preview').evaluate(c => c.toDataURL());
  await page.getByRole('button', { name: 'Jiný rukopis' }).click();
  await expect.poll(() => page.locator('#preview').evaluate(c => c.toDataURL())).not.toBe(before);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Stáhnout obrázek PNG' }).click()]);
  expect(download.suggestedFilename()).toBe('mama-12.png');
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('#opt-font')).toHaveValue('custom');
  await page.getByRole('button', { name: 'Odebrat sadu' }).click();
  await expect(page.locator('#opt-font')).toHaveValue('Marck Script');
  expect(errors).toEqual([]);
});

test('velikost písma mění náhled i stažený obrázek', async ({ page }) => {
  await page.locator('#text').fill('Мама мыла раму');
  const width = () => page.locator('#preview').evaluate(c => c.getBoundingClientRect().width);
  await page.locator('#opt-size').selectOption('32');
  await expect(page.locator('#size-info')).toContainText('px');
  const small = await width();
  await page.locator('#opt-size').selectOption('110');
  await expect.poll(width).toBeGreaterThan(small * 2.5);
});

test('320 px bez vodorovného scrollu @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.locator('#text').fill('Очень длинная строка текста для проверки ширины');
  await page.locator('#opt-size').selectOption('110');
  await page.locator('#kbd-wrap summary').click();
  await expectNoHorizontalScroll(page);
});
