// Integrační testy Klávesové mise na adrese /aplikace/klavesova-mise/.
// Používají skutečnou myš a klávesnici Playwrightu (ne syntetické eventy jako test.html).
import { test, expect } from '@playwright/test';
import { watchErrors } from './helpers.js';

const URL = '/aplikace/klavesova-mise/';
const STORE_KEY = 'klavesova-mise-v2'; // původní klíč hry – nesmí se změnit
const stored = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), STORE_KEY);
const waitUnlocked = (page, obj = 'S') => page.waitForFunction(o => Date.now() > globalThis.eval(o).lock, obj);
const waitStep = (page, n) => page.waitForFunction(x => globalThis.eval('S.step') === x, n);

/** Označí text části dokumentu tažením myši od prvního do posledního znaku. */
async function dragSelect(page, id) {
  // počkat, až doběhnou animace obrazovky/editoru (posouvají souřadnice textu)
  await page.waitForFunction(() => [...document.querySelectorAll('#story, #editor, #paper')]
    .every(e => e.getAnimations().every(a => a.playState !== 'running')));
  const box = await page.evaluate(id => {
    const node = document.querySelector(`.part[data-id="${id}"]`).firstChild;
    const r = document.createRange();
    r.setStart(node, 0); r.setEnd(node, 1);
    const a = r.getBoundingClientRect();
    r.setStart(node, node.length - 1); r.setEnd(node, node.length);
    const b = r.getBoundingClientRect();
    return { x1: a.left + 1, y1: a.top + a.height / 2, x2: b.right - 1, y2: b.top + b.height / 2 };
  }, id);
  await page.mouse.move(box.x1, box.y1);
  await page.mouse.down();
  await page.mouse.move(box.x2, box.y2, { steps: 8 });
  await page.mouse.up();
}

test.describe('Klávesová mise', () => {
  test('příběh: kapitola 1 klávesnicí a myší, chyba = krok zpět, postup v localStorage @smoke', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.locator('.chapter')).toHaveCount(6);
    await expect(page.locator('.chapter:disabled')).toHaveCount(5);

    await page.locator('#storyStart').click();
    await expect(page.locator('#intro')).toBeVisible();
    await page.locator('#introGo').click();
    await expect(page.locator('#story')).toBeVisible();

    // 1) označit nadpis
    await dragSelect(page, 'nadpis');
    await waitStep(page, 1);
    // chyba: Ctrl+I místo Ctrl+B => krok zpátky
    await waitUnlocked(page);
    await page.keyboard.press('Control+i');
    await waitStep(page, 0);
    expect(await page.evaluate(() => S.mistakes)).toBe(1);
    await expect(page.locator('#storyFeedback')).toContainText('krok zpátky');

    // znovu správně
    await waitUnlocked(page);
    await dragSelect(page, 'nadpis');
    await waitStep(page, 1);
    await waitUnlocked(page);
    await page.keyboard.press('Control+b');
    await waitStep(page, 2);
    await expect(page.locator('.part[data-id="nadpis"]')).toHaveClass(/fb/);

    await waitUnlocked(page);
    await dragSelect(page, 'misto');
    await waitStep(page, 3);
    await waitUnlocked(page);
    await page.keyboard.press('Control+c');
    await waitStep(page, 4);
    await expect(page.locator('#clipText')).toContainText('hlavního nádraží');

    await waitUnlocked(page);
    await page.locator('.slot[data-id="s1"]').click({ force: true }); // rámeček nepřetržitě bliká (animace)
    await waitStep(page, 5);
    await waitUnlocked(page);
    await page.keyboard.press('Control+v');
    await waitStep(page, 6);
    await expect(page.locator('[data-id="s1"]')).toHaveText('hlavního nádraží');

    await waitUnlocked(page);
    await page.keyboard.press('Control+s');
    await expect(page.locator('#chapterDone')).toBeVisible();
    await expect(page.locator('#doneStars .star.on')).toHaveCount(2); // 1 chyba = 2 hvězdy

    const data = await stored(page);
    expect(data.stars[0]).toBe(2);

    // obnovení stránky zachová postup
    await page.reload();
    await expect(page.locator('.chapter:disabled')).toHaveCount(4);
    await expect(page.locator('#storyStart')).toHaveText(/Pokračovat: kapitola 2/);
    expect(errors).toEqual([]);
  });

  test('trénink: 12 zkratek, rekord se uloží a přežije obnovení', async ({ page }) => {
    await page.goto(URL);
    await page.locator('#trainStart').click();
    await expect(page.locator('#train')).toBeVisible();
    for (let i = 0; i < 12; i++) {
      await waitUnlocked(page, 'T');
      const k = await page.evaluate(() => T.queue[T.i]);
      await page.keyboard.press(`Control+${k}`);
      await page.waitForFunction(n => T.i === n, i + 1);
    }
    await expect(page.locator('#trainEnd')).toBeVisible();
    await expect(page.locator('#teRecord')).toHaveText('🎉 Nový osobní rekord!');
    const data = await stored(page);
    expect(data.best.score).toBeGreaterThan(0);

    await page.reload();
    await expect(page.locator('#trainBest')).toContainText('Tvůj rekord');
  });

  test('zkratky Ctrl+A/C/X/V/S/P/F/Z/Y/B/I/U se ve hře zachytí (preventDefault), funguje i ⌘', async ({ page }) => {
    await page.goto(URL);
    await page.locator('#trainStart').click();
    await page.evaluate(() => {
      window.__prevented = {};
      // posluchač v bublání na window – běží až po capture handleru hry na document
      window.addEventListener('keydown', e => { window.__prevented[e.key.toLowerCase()] = e.defaultPrevented; });
    });
    for (const k of 'acxvspfzybiu') {
      await waitUnlocked(page, 'T');
      await page.keyboard.press(`Control+${k}`);
    }
    const prevented = await page.evaluate(() => window.__prevented);
    for (const k of 'acxvspfzybiu') expect(prevented[k], `Ctrl+${k.toUpperCase()}`).toBe(true);

    // macOS: ⌘ místo Ctrl (metaKey)
    await waitUnlocked(page, 'T');
    const before = await page.evaluate(() => T.i);
    const k = await page.evaluate(() => T.queue[T.i]);
    await page.keyboard.press(`Meta+${k}`);
    await page.waitForFunction(n => T.i === n + 1, before);
  });

  test('české QWERTZ: rozhoduje znak (event.key), ne fyzická pozice klávesy', async ({ page }) => {
    await page.goto(URL);
    // Na QWERTZ dává fyzická klávesa KeyY znak "z" a KeyZ znak "y".
    const r = await page.evaluate(() => [
      keyLetter({ key: 'z', code: 'KeyY' }),
      keyLetter({ key: 'y', code: 'KeyZ' }),
      keyLetter({ key: 'Z', code: 'KeyY' }),
      keyLetter({ key: 'Unidentified', code: 'KeyB' }) // záloha podle code
    ]);
    expect(r).toEqual(['z', 'y', 'z', 'b']);
  });

  test('kopírování výsledku: Clipboard API i záložní označení textu', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'oprávnění ke schránce testujeme v Chromiu');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(URL);
    await page.locator('#trainStart').click();
    for (let i = 0; i < 12; i++) {
      await waitUnlocked(page, 'T');
      await page.keyboard.press(`Control+${await page.evaluate(() => T.queue[T.i])}`);
      await page.waitForFunction(n => T.i === n, i + 1);
    }
    await page.locator('#teName').fill('Terka');
    await page.locator('#teCopy').click();
    await expect(page.locator('#teCopy')).toHaveText('✓ Zkopírováno');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^Terka \| Trénink zkratek \|/);

    // zamítnuté oprávnění => text se označí a hra poradí Ctrl+C
    await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new DOMException('denied', 'NotAllowedError')); });
    await page.waitForTimeout(2300); // tlačítko se vrátí do výchozího textu
    await page.locator('#teCopy').click();
    await expect(page.locator('#teCopy')).toContainText('zkopíruj Ctrl + C');
    expect(await page.evaluate(() => String(getSelection()))).toContain('Trénink zkratek');
  });

  test('odkaz zpět do katalogu nepřekrývá ovládání hry', async ({ page }) => {
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(URL);
      const back = page.locator('.portal-back');
      await expect(back).toBeVisible();
      await expect(back).toHaveAttribute('href', '/hriste/');
      const [b, logo, sound] = await Promise.all([back, page.locator('#logoBtn'), page.locator('#soundBtn')].map(l => l.boundingBox()));
      const overlap = (p, q) => p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;
      expect(overlap(b, logo), `${width}px: odkaz × logo`).toBe(false);
      expect(overlap(b, sound), `${width}px: odkaz × zvuk`).toBe(false);
      expect(sound.x + sound.width, `${width}px: zvuk mimo obrazovku`).toBeLessThanOrEqual(width);
    }
    await page.locator('.portal-back').click();
    await expect(page).toHaveURL('/hriste/');
  });

  test('kapitola Bez myši skutečnou klávesnicí; starý postup s 5 kapitolami se doplní', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await page.evaluate(() => localStorage.setItem('klavesova-mise-v2', JSON.stringify({ stars: [3, 2, 3, 1, 2], best: null, sound: false })));
    await page.reload();
    await expect(page.locator('.chapter')).toHaveCount(6);
    await expect(page.locator('.chapter:disabled')).toHaveCount(0);
    await expect(page.locator('#storyStart')).toHaveText(/Pokračovat: kapitola 6/);
    await page.locator('#storyStart').click();
    await expect(page.locator('#introTitle')).toHaveText('Bez myši');
    await page.locator('#introGo').click();
    const caret = () => page.evaluate(() => findPart(S.g, 'line').caret);
    const step = () => page.evaluate(() => S.step);
    const waitStep = async n => { await expect.poll(step).toBe(n); await expect.poll(() => page.evaluate(() => Date.now() >= S.lock)).toBe(true); };
    await expect(page.locator('#taskChip')).toContainText('Jen klávesnice');
    await page.locator('#paper').click(); // myš odpočívá
    await expect(page.locator('#storyFeedback')).toContainText('Myš teď odpočívá');
    await page.keyboard.press('End'); await waitStep(1);
    await page.keyboard.press('Home'); await waitStep(2);
    for (let i = 0; i < 4; i++) await page.keyboard.press('Control+ArrowRight');
    await waitStep(3);
    expect(await caret()).toBe(23);
    await page.keyboard.press('Shift+Control+ArrowRight'); await waitStep(4);
    await expect(page.locator('.ksel')).toHaveText('byl ');
    await page.keyboard.press('Delete'); await waitStep(5);
    await page.keyboard.press('End'); await page.keyboard.press('Backspace'); await page.keyboard.type('!'); await waitStep(6);
    await page.keyboard.press('Shift+Home'); await waitStep(7);
    await page.keyboard.press('Control+b'); await waitStep(8);
    await expect(page.locator('[data-id="line"]')).toHaveClass(/fb/);
    await expect(page.locator('[data-id="line"]')).toHaveText('Výlet na Karlštejn byl skvělý a cesta do kopce nás vůbec neunavila!');
    await page.keyboard.press('Control+s');
    await expect(page.locator('#chapterDone')).toBeVisible();
    await expect(page.locator('#doneStars .star.on')).toHaveCount(3);
    await page.locator('#doneNext').click();
    await expect(page.locator('#finalStars .star')).toHaveCount(18);
    const data = await stored(page);
    expect(data.stars).toEqual([3, 2, 3, 1, 2, 3]);
    expect(errors).toEqual([]);
  });

  test('původní test.html hlásí PASS @smoke', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(URL + 'test.html');
    await expect(page.locator('#out')).toHaveAttribute('data-done', '1', { timeout: 170_000 });
    const out = await page.locator('#out').textContent();
    expect(out.trim().split('\n').pop(), out).toBe('PASS');
  });
});
