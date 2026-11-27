// E2E testy aplikace Psací azbuka: fonetické psaní, rozložení ЙЦУКЕН podle fyzické klávesy,
// písmena na obrazovce, přepis latinky, stažení PNG, barvy, rukopisy, zalamování, uložení do localStorage a 320 px.
import { test, expect } from '@playwright/test';
import { watchErrors, expectNoHorizontalScroll } from './helpers.js';
import { makeSet } from '../fixtures/glyph-set.mjs';

const URL = '/vyklad/psaci-azbuka/';
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
  await page.getByLabel(/Ruské rozložení ЙЦУКЕН/).check();
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

test('vlastní sada písmen: nahrání, psaní sadou, export a uložení', async ({ page }) => {
  const errors = watchErrors(page);
  await page.locator('#text').fill('мама, 12');
  await page.getByText('Vlastní sada písmen (pro pokročilé)').click();
  await page.locator('#set-file').setInputFiles({ name: 'nesmysl.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
  await expect(page.locator('#feedback')).toContainText('nepodařilo');
  await page.waitForTimeout(300);
  const before = await page.locator('#preview').evaluate(c => c.toDataURL());
  await page.locator('#set-file').setInputFiles({ name: 'sada.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(makeSet())) });
  await expect(page.locator('#feedback')).toContainText('nahraná');
  await expect(page.locator('#set-status')).toContainText('Testovací sada');
  await expect.poll(() => page.locator('#preview').evaluate(c => c.toDataURL())).not.toBe(before);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Stáhnout obrázek PNG' }).click()]);
  expect(download.suggestedFilename()).toBe('mama-12.png');
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('#set-status')).toContainText('Testovací sada');
  await page.getByText('Vlastní sada písmen (pro pokročilé)').click();
  await expect(page.getByLabel(/Psát nahranou sadou/)).toBeChecked();
  await expect(page.locator('#size-info')).toContainText('nahranou sadou');
  await page.getByRole('button', { name: 'Odebrat sadu' }).click();
  await expect(page.locator('#set-status')).toContainText('Zatím není');
  expect(errors).toEqual([]);
});

test('uložená sada ze starší verze nepřebije Písanku Školeeq, pokud nebyla vybraná', async ({ page }) => {
  const set = makeSet();
  const shot = () => page.locator('#preview').evaluate(c => c.toDataURL());
  await page.evaluate(([k, set]) => localStorage.setItem(k, JSON.stringify({ text: 'мама', font: 'skoleeq', glyphSet: set })), [KEY, set]);
  await page.reload();
  await page.getByText('Vlastní sada písmen (pro pokročilé)').click();
  await expect(page.getByLabel(/Psát nahranou sadou/)).not.toBeChecked();
  await expect(page.locator('#size-info')).not.toContainText('nahranou sadou');
  await page.waitForTimeout(400);
  const builtin = await shot();
  await page.getByLabel(/Psát nahranou sadou/).check();
  await expect.poll(shot).not.toBe(builtin);
  // starší uložení s vybranou vlastní sadou ji použije dál
  await page.evaluate(([k, set]) => localStorage.setItem(k, JSON.stringify({ text: 'мама', font: 'custom', glyphSet: set })), [KEY, set]);
  await page.reload();
  await page.getByText('Vlastní sada písmen (pro pokročilé)').click();
  await expect(page.getByLabel(/Psát nahranou sadou/)).toBeChecked();
});

test('Písanka Školeeq: tištěná písanka i rukopisy z nabídky s ukázkou', async ({ page }) => {
  const errors = watchErrors(page);
  await page.locator('#text').fill('Мама мыла раму, 12.');
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').some(e => e.name.endsWith('/sada-skoleeq.json')))).toBe(true);
  await expect(page.getByLabel('Jako tištěná písanka')).toBeChecked();
  await expect(page.locator('#hands-wrap')).toBeHidden();
  await page.waitForTimeout(300);
  const print = await page.locator('#preview').evaluate(c => c.toDataURL());
  await page.getByLabel('Jako rukopis').check();
  await expect(page.locator('#hands-wrap')).toBeVisible();
  await expect(page.locator('#hands input[type="radio"]')).toHaveCount(8);
  await expect(page.getByRole('radio', { name: /Rukopis 1/ })).toBeChecked();
  await expect.poll(() => page.locator('#preview').evaluate(c => c.toDataURL())).not.toBe(print);
  const hand1 = await page.locator('#preview').evaluate(c => c.toDataURL());
  // ukázka rukopisu v nabídce je vykreslená
  expect(await page.locator('#hands canvas').first().evaluate(c => c.width)).toBeGreaterThan(50);
  await page.getByRole('radio', { name: /Rukopis 6/ }).check();
  await expect.poll(() => page.locator('#preview').evaluate(c => c.toDataURL())).not.toBe(hand1);
  await page.locator('#opt-pen').selectOption('2');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Stáhnout obrázek PNG' }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.getByRole('radio', { name: /Rukopis 6/ })).toBeChecked();
  await expect(page.locator('#opt-pen')).toHaveValue('2');
  expect(errors).toEqual([]);
});

test('barva části textu: označený text se obarví v editoru i v obrázku', async ({ page }) => {
  const errors = watchErrors(page);
  const text = page.locator('#text');
  await text.fill('мама папа');
  await text.evaluate(t => t.setSelectionRange(5, 9));
  await page.getByRole('button', { name: 'Barva: červená' }).click();
  await expect(page.locator('#mirror span').filter({ hasText: 'папа' })).toHaveCSS('color', 'rgb(185, 28, 28)');
  await expect(page.locator('#mirror span').filter({ hasText: 'мама' })).toHaveCSS('color', 'rgb(20, 33, 61)');
  // psaní pokračuje vybranou barvou
  await text.press('End');
  await text.pressSequentially(' ja');
  await expect(text).toHaveValue('мама папа я');
  await expect(page.locator('#mirror span').last()).toHaveCSS('color', 'rgb(185, 28, 28)');
  const red = () => page.locator('#preview').evaluate(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 80 && d[i + 2] < 80) n++;
    return n;
  });
  await expect.poll(red).toBeGreaterThan(50);
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('#mirror span').filter({ hasText: 'папа я' })).toHaveCSS('color', 'rgb(185, 28, 28)');
  await page.getByRole('button', { name: 'Barva: černá' }).click();
  await page.getByRole('button', { name: 'Celý text touto barvou' }).click();
  await expect.poll(red).toBe(0);
  expect(errors).toEqual([]);
});

test('dlouhý text se zalomí podle šířky náhledu, bez posouvání do strany', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.locator('#text').fill('Очень длинная строка текста для проверки ширины, которая должна сама переноситься на новую строку без прокрутки вбок.');
  await page.locator('#opt-size').selectOption('72');
  const fits = () => page.evaluate(() => {
    const box = document.getElementById('preview-wrap'), c = document.getElementById('preview');
    return { canvas: c.getBoundingClientRect().width, box: box.clientWidth, scroll: box.scrollWidth - box.clientWidth, h: c.getBoundingClientRect().height };
  });
  await expect.poll(async () => (await fits()).h).toBeGreaterThan(200);
  const f = await fits();
  expect(f.canvas).toBeLessThanOrEqual(f.box);
  expect(f.scroll).toBe(0);
  await expect(page.locator('#size-info')).toContainText('skutečné velikosti');
  await page.getByLabel('Zalamovat dlouhé řádky').uncheck();
  await expect(page.locator('#size-info')).toContainText('zmenšený');
});

test('velikost písma mění náhled i stažený obrázek', async ({ page }) => {
  await page.locator('#text').fill('Мама');
  const width = () => page.locator('#preview').evaluate(c => c.getBoundingClientRect().width);
  await page.locator('#opt-size').selectOption('32');
  await expect.poll(width).toBeLessThan(200);
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
