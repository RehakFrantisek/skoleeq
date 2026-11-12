// E2E testy Dokumentové záchranky: skutečné úpravy v editoru (psaní, výběr, zkratky, tlačítka),
// dohrání všech 10 misí přes UI, Zpět/Znovu, reset, vkládání jen čistého textu, postup a jeho smazání.
import { test, expect } from '@playwright/test';
import { watchErrors, expectNoHorizontalScroll } from './helpers.js';
import { MISSIONS } from '../../public/aplikace/dokumentova-zachranka/missions.js';

const URL = '/aplikace/dokumentova-zachranka/';
const KEY = 'vyukovy-portal:dokumentova-zachranka:v1';
const blk = (page, id) => page.locator(`#paper .blk[data-id="${id}"]`);

/* ---------- Pomocníci: práce v editoru jako žák ---------- */
async function focusBlock(page, id) {
  await blk(page, id).click();
  await expect(blk(page, id)).toHaveClass(/is-current/);
}
/** Označí úsek textu v bloku (jako tažení myší). */
async function selectText(page, id, text) {
  await page.evaluate(([id, text]) => {
    const n = document.querySelector(`#paper .blk[data-id="${id}"]`);
    n.focus();
    const full = n.textContent;
    const at = full.indexOf(text);
    if (at < 0) throw new Error('text nenalezen: ' + text);
    const walk = (off) => {
      const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
      let t, left = off;
      while ((t = w.nextNode())) { if (left <= t.length) return [t, left]; left -= t.length; }
      throw new Error('mimo text');
    };
    const r = document.createRange();
    r.setStart(...walk(at));
    r.setEnd(...walk(at + text.length));
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  }, [id, text]);
  await page.waitForTimeout(30); // selectionchange je asynchronní
}
async function style(page, id, type) { await focusBlock(page, id); await page.locator('#tb-style').selectOption(type); }
async function align(page, id, a) { await focusBlock(page, id); await page.locator(`[data-align="${a}"]`).click(); }
async function list(page, id, t) { await focusBlock(page, id); await page.locator(`[data-list="${t}"]`).click(); }
async function mark(page, id, text, m) { await selectText(page, id, text); await page.locator(`[data-mark="${m}"]`).click(); }
async function setText(page, id, text) {
  await focusBlock(page, id);
  await page.keyboard.press('Control+a');
  await page.keyboard.type(text);
  await expect(blk(page, id)).toHaveText(text);
}
/** Seřadí bloky jen tlačítkem „Posunout nahoru“. */
async function arrange(page, ids) {
  for (let k = 0; k < ids.length; k++) {
    for (;;) {
      const order = await page.locator('#paper [data-id]').evaluateAll(ns => ns.map(n => n.dataset.id));
      if (order.indexOf(ids[k]) <= k) break;
      await focusBlock(page, ids[k]);
      await page.locator('#tb-up').click();
    }
  }
}
async function addImage(page, afterId, label, caption, position) {
  await focusBlock(page, afterId);
  await page.locator('#tb-image').click();
  await page.getByRole('button', { name: label }).click();
  const fig = page.locator('#paper figure').filter({ has: page.locator(`img[alt="${label}"]`) });
  await fig.locator('figcaption').click();
  await page.keyboard.type(caption);
  if (position) { await fig.locator('img').click(); await page.locator(`[data-align="${position}"]`).click(); }
}

/** Řešení misí přes UI (stejná logika jako unit testy, ale kliknutím a psaním). */
const SOLVE = {
  'ztraceny-titulek': async p => { await style(p, 'titul', 'heading1'); await style(p, 'podtitul', 'heading2'); },
  'dulezita-zprava': async p => {
    await selectText(p, 'p', 've čtvrtek 14. listopadu');
    await p.keyboard.press('Control+b'); // klávesová zkratka
    await mark(p, 'p', 'Krabice prosím rozložte', 'i');
  },
  'rozsypane-informace': async p => { for (const id of ['l1', 'l2', 'l3', 'l4']) await list(p, id, 'bullet'); },
  'pozvanka': async p => { await align(p, 'h', 'center'); for (const id of ['p1', 'p2', 'p3']) await align(p, id, 'left'); },
  'rozbita-reportaz': async p => arrange(p, ['h', 'a', 'b', 'c', 'd', 'e']),
  'skolni-pravidla': async p => { await arrange(p, ['h', 'p', 's1', 's2', 's3', 's4', 's5']); for (const id of ['s1', 's2', 's3', 's4', 's5']) await list(p, id, 'number'); },
  'obrazek-na-uteku': async p => addImage(p, 'p2', 'Záhon se zeleninou', 'Nové vyvýšené záhony se zeleninou'),
  'typograficky-audit': async p => {
    await setText(p, 'p1', 'Ve středu 15. 10. 2026 se v tělocvičně koná turnaj ve florbale.');
    await setText(p, 'p2', 'Hrají se zápasy pětičlenných týmů, každý tým má aspoň jednu dívku.');
    await setText(p, 'p3', 'Přihlášky odevzdejte do pátku 10. 10. 2026 u třídní učitelky!');
    await setText(p, 'p4', 'Vstup pro diváky je zdarma. Přijďte fandit!');
  },
  'clanek-do-casopisu': async p => {
    await style(p, 't', 'heading1'); await align(p, 't', 'center');
    await style(p, 'sub', 'heading2'); await align(p, 'sub', 'center');
    await style(p, 's1', 'heading2'); await style(p, 's2', 'heading2');
    for (const id of ['p1', 'p2', 'p4']) await align(p, id, 'left');
    for (const id of ['l1', 'l2', 'l3']) await list(p, id, 'bullet');
    await mark(p, 'p1', 'Šroubci', 'b');
    await addImage(p, 'p1', 'Soutěžní robot', 'Robot týmu Šroubci na dráze');
  },
  'redaktor-pod-tlakem': async p => {
    await style(p, 't', 'heading1'); await style(p, 's1', 'heading2'); await style(p, 's2', 'heading2');
    for (const id of ['l1', 'l2', 'l3']) await list(p, id, 'bullet');
    await focusBlock(p, 's2'); await p.keyboard.press('Alt+Shift+ArrowUp'); // přesun klávesnicí
    await setText(p, 'p1', 'Od pondělí si můžete půjčit přes sto nových titulů. Knihy vybírali sami žáci v anketě.');
    await setText(p, 'p3', 'Knihovna je otevřená v úterý a ve čtvrtek od 12:30 do 14:00. Výpůjčka trvá tři týdny, pak je potřeba knihu vrátit.');
    await setText(p, 'p4', 'Slavnostní otevření nového oddělení proběhne 3. 11. 2026 ve velké přestávce.');
    await selectText(p, 'p4', 'Slavnostní otevření nového oddělení proběhne 3. 11. 2026 ve velké přestávce.');
    await p.locator('[data-mark="b"]').click(); // zrušit tučné
    const fig = p.locator('#paper figure');
    await fig.locator('figcaption').click();
    await p.keyboard.type('Nové knihy v regálu');
    await fig.locator('img').click();
    await p.locator('[data-align="center"]').click();
  }
};

test.describe('Dokumentová záchranka', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('přehled misí: 10 misí ve 3 obtížnostech, odemknutá jen první, odkazy @smoke', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('heading', { level: 1, name: 'Dokumentová záchranka' })).toBeVisible();
    await expect(page.locator('.mcard')).toHaveCount(10);
    for (const h of ['Začátečník', 'Pokročilý', 'Expert']) await expect(page.getByRole('heading', { level: 2, name: h })).toBeVisible();
    await expect(page.locator('.mcard button')).toHaveCount(1);
    await expect(page.locator('.mcard.is-locked')).toHaveCount(9);
    await expect(page.getByRole('link', { name: 'Zpět do katalogu her' })).toHaveAttribute('href', '/');
    await expect(page.getByRole('link', { name: /Pro učitele/ })).toHaveAttribute('href', '/pro-ucitele/#dokumentova-zachranka');
    expect(errors).toEqual([]);
  });

  test('všech 10 misí jde dohrát přes editor, mise se postupně odemykají @smoke', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await page.goto(URL);
    await page.getByRole('button', { name: `Spustit misi 1: ${MISSIONS[0].title}` }).click();
    for (const [i, m] of MISSIONS.entries()) {
      await expect(page.locator('#m-title'), m.id).toHaveText(m.title);
      await SOLVE[m.id](page);
      await page.getByRole('button', { name: 'Zkontrolovat práci' }).click();
      await expect(page.locator('#dlg-done'), `${m.id}: ${await page.locator('#results').innerText()}`).toBeVisible();
      await expect(page.locator('#done-before')).not.toBeEmpty();
      await expect(page.locator('#done-after')).not.toBeEmpty();
      if (i < MISSIONS.length - 1) await page.locator('#btn-next').click();
      else await page.locator('#btn-done-overview').click();
    }
    await expect(page.locator('#progress-summary')).toContainText('Dokončeno 10 z 10 misí');
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    expect(Object.values(saved.missions).filter(x => x.done)).toHaveLength(10);
    expect(errors).toEqual([]);
  });

  test('zvýraznění jen části textu, chybná varianta, Zpět/Znovu klávesnicí a více kol kontroly', async ({ page }) => {
    await page.goto(URL + '?vse=1#dulezita-zprava');
    await expect(page.locator('#m-title')).toHaveText('Důležitá zpráva');
    // chyba: tučně celý odstavec
    await focusBlock(page, 'p');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+b');
    await expect(blk(page, 'p').locator('strong')).toHaveCount(1);
    await page.getByRole('button', { name: 'Zkontrolovat práci' }).click();
    await expect(page.locator('#results')).toContainText('Zvýrazni jen zadaný úsek');
    await expect(page.locator('#checklist .ck--bad')).not.toHaveCount(0);
    // Zpět klávesnicí vrátí formátování, Znovu ho vrátí
    await page.keyboard.press('Control+z');
    await expect(blk(page, 'p').locator('strong')).toHaveCount(0);
    await page.keyboard.press('Control+y');
    await expect(blk(page, 'p').locator('strong')).toHaveCount(1);
    await page.locator('#tb-undo').click();
    await expect(blk(page, 'p').locator('strong')).toHaveCount(0);
    await expect(page.locator('#log')).toContainText('Zpět: Tučně');
    // správně: jen datum, druhé kolo kontroly
    await mark(page, 'p', 've čtvrtek 14. listopadu', 'b');
    await expect(page.locator('[data-mark="b"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(blk(page, 'p').locator('strong')).toHaveText('ve čtvrtek 14. listopadu');
    await page.getByRole('button', { name: 'Zkontrolovat práci' }).click();
    await expect(page.locator('#checklist .ck--ok')).toContainText(['Datum „ve čtvrtek 14. listopadu“ je tučně (a nic jiného)']);
    await expect(page.locator('#results')).toContainText('Splněno');
    await mark(page, 'p', 'Krabice prosím rozložte', 'i');
    await page.getByRole('button', { name: 'Zkontrolovat práci' }).click();
    await expect(page.locator('#dlg-done')).toBeVisible();
    await expect(page.locator('#done-stats')).toContainText('Kontrol: 3');
  });

  test('psaní v editoru, Nový pokus a jeho vrácení', async ({ page }) => {
    await page.goto(URL + '?vse=1#typograficky-audit');
    await focusBlock(page, 'p4');
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Backspace'); // smaže mezeru před „!“
    await expect(blk(page, 'p4')).toHaveText('Vstup pro diváky je zdarma.Přijďte fandit!');
    await page.keyboard.press('Enter'); // nový odstavec se nevytváří
    await expect(page.locator('#status')).toContainText('Nový odstavec');
    await expect(page.locator('#paper .blk')).toHaveCount(5);
    await page.getByRole('button', { name: 'Nový pokus' }).click();
    await expect(blk(page, 'p4')).toHaveText('Vstup pro diváky je zdarma.Přijďte fandit !');
    await page.locator('#tb-undo').click();
    await expect(blk(page, 'p4')).toHaveText('Vstup pro diváky je zdarma.Přijďte fandit!');
  });

  test('vložení ze schránky přijme jen čistý text', async ({ page }) => {
    await page.goto(URL + '?vse=1#ztraceny-titulek');
    await focusBlock(page, 'p2');
    await page.keyboard.press('End');
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/html', '<img src=x onerror="window.__xss=1"><b>tučně</b>');
      dt.setData('text/plain', ' Ahoj\nsvěte');
      document.querySelector('#paper .blk[data-id="p2"]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(blk(page, 'p2')).toContainText('Ahoj světe');
    await expect(page.locator('#paper img, #paper b')).toHaveCount(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test('expertní mise bez nápovědy: kontrola řekne jen počet chyb', async ({ page }) => {
    await page.goto(URL + '?vse=1#redaktor-pod-tlakem');
    await expect(page.getByRole('button', { name: 'Ukázat nápovědu' })).toBeHidden();
    await page.getByRole('button', { name: 'Zkontrolovat práci' }).click();
    await expect(page.locator('#results')).toContainText(/Zbývá opravit \d+ chyb/);
    await expect(page.locator('#results .res')).toHaveCount(0);
  });

  test('nápověda ve třech úrovních a sdílení stavu mezi koly', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: /Spustit misi 1/ }).click();
    for (const lvl of ['1. Princip', '2. Kde hledat', '3. Postup']) {
      await page.locator('#btn-hint').click();
      await expect(page.locator('#hints')).toContainText(lvl);
    }
    await expect(page.locator('#btn-hint')).toBeDisabled();
    await style(page, 'titul', 'heading1');
    await page.getByRole('button', { name: 'Zkontrolovat práci' }).click();
    await expect(page.locator('#paper h1.blk[data-id="titul"]')).toBeVisible(); // stav zůstal
    await style(page, 'podtitul', 'heading2');
    await page.getByRole('button', { name: 'Zkontrolovat práci' }).click();
    await expect(page.locator('#done-stats')).toContainText('Nápověd: 3');
  });

  test('smazání postupu smaže jen tuto hru', async ({ page }) => {
    await page.goto(URL);
    await page.evaluate(k => {
      localStorage.setItem(k, JSON.stringify({ missions: { 'ztraceny-titulek': { done: true, stars: 3, points: 70 } } }));
      localStorage.setItem('klavesova-mise-v2', '{"keep":1}');
      localStorage.setItem('vyukovy-portal:datovi-detektivove:v1', '{"keep":1}');
    }, KEY);
    await page.reload();
    await expect(page.locator('#progress-summary')).toContainText('Dokončeno 1 z 10');
    await expect(page.locator('.mcard button')).toHaveCount(2); // druhá mise odemčená
    await page.getByRole('button', { name: 'Smazat postup této hry' }).click();
    await page.getByRole('button', { name: 'Ano, smazat' }).click();
    await expect(page.locator('#progress-summary')).toContainText('Dokončeno 0 z 10');
    const left = await page.evaluate(() => [localStorage.getItem('klavesova-mise-v2'), localStorage.getItem('vyukovy-portal:datovi-detektivove:v1')]);
    expect(left).toEqual(['{"keep":1}', '{"keep":1}']);
  });
});

test.describe('Dokumentová záchranka – mobil', () => {
  test('320 px: přehled i editor bez vodorovného scrollu @mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(URL);
    await expectNoHorizontalScroll(page);
    await page.goto(URL + '?vse=1#clanek-do-casopisu');
    await expect(page.locator('#paper .blk').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
