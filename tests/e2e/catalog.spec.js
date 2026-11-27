import { test, expect } from '@playwright/test';
import { watchErrors, expectNoHorizontalScroll, card, registry, publishedApps } from './helpers.js';

// Počty se berou z registru, aby testy nebylo nutné upravovat při přidání hry.
const N = publishedApps().length;
const hry = n => (n === 1 ? '1 položka' : n >= 2 && n <= 4 ? `${n} položky` : `${n} položek`);

test.describe('Katalog', () => {
  test('homepage zobrazí Klávesovou misi bez chyb @smoke', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/Školeeq/);
    await expect(card(page, 'klavesova-mise')).toBeVisible();
    await expect(card(page, 'klavesova-mise').getByRole('heading', { name: 'Klávesová mise' })).toBeVisible();
    await expect(card(page, 'klavesova-mise')).toContainText('Vyžaduje klávesnici');
    await expect(card(page, 'klavesova-mise')).toContainText('7. ročník');
    await expect(page.locator('#featured')).toContainText('Klávesová mise');
    await expect(page.locator('#count')).toHaveText(`${hry(N)} v katalogu`);
    await expect(page.locator('.app-card')).toHaveCount(N);
    await expect(page.locator('#grid')).toHaveAttribute('aria-busy', 'false');
    expect(errors).toEqual([]);
  });

  test('hledání bez diakritiky, prázdný výsledek a vymazání filtrů @smoke', async ({ page }) => {
    await page.goto('/');
    const search = page.getByLabel('Hledat', { exact: true });
    await search.fill('klavesove zkratky');           // bez háčků a čárek
    await expect(card(page, 'klavesova-mise')).toBeVisible();
    await expect(page.locator('#count')).toHaveText(`Nalezeno: 1 položka z ${N}`);
    await expect(page).toHaveURL(/\?q=klavesove\+zkratky/);

    await search.fill('MYSAK KURZIK');                  // velká písmena, popis
    await expect(card(page, 'klavesova-mise')).toBeVisible();

    await search.fill('zirafy');                      // nic takového v katalogu není
    await expect(page.locator('.app-card')).toHaveCount(0);
    await expect(page.locator('#empty')).toBeVisible();
    await expect(page.locator('#count')).toHaveText(`Nalezeno: 0 položek z ${N}`);

    await page.locator('#empty').getByRole('button', { name: 'Vymazat filtry' }).click();
    await expect(search).toHaveValue('');
    await expect(card(page, 'klavesova-mise')).toBeVisible();
    await expect(page.locator('#empty')).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
  });

  test('filtr podle ročníku, předmětu, tématu a obtížnosti', async ({ page }) => {
    await page.goto('/');
    const grade = page.getByLabel('Ročník', { exact: true });
    await expect(grade.locator('option')).toHaveCount(10); // „všechny“ + 1.–9.
    await grade.selectOption('7');
    await expect(card(page, 'klavesova-mise')).toBeVisible();
    await grade.selectOption('1');
    await expect(page.locator('.app-card')).toHaveCount(0);
    await expect(page.locator('#empty')).toBeVisible();

    await page.locator('#clear-filters').click();               // tlačítko ve formuláři
    await expect(grade).toHaveValue('');
    await expect(card(page, 'klavesova-mise')).toBeVisible();

    // možnosti předmětu/tématu se generují z registru
    const subjects = [...new Set(publishedApps().map(a => a.subject))];
    await expect(page.getByLabel('Předmět', { exact: true }).locator('option')).toHaveCount(subjects.length + 1);
    await page.getByLabel('Téma', { exact: true }).selectOption('Klávesové zkratky');
    await page.getByLabel('Obtížnost', { exact: true }).selectOption('stredni');
    await expect(card(page, 'klavesova-mise')).toBeVisible();
    await expect(page).toHaveURL(/tema=Kl%C3%A1vesov%C3%A9\+zkratky/);
  });

  test('filtr z URL přežije obnovení stránky', async ({ page }) => {
    await page.goto('/?rocnik=1');
    await expect(page.getByLabel('Ročník', { exact: true })).toHaveValue('1');
    await expect(page.locator('#empty')).toBeVisible();
    await page.goto('/?q=klav&rocnik=7');
    await expect(page.getByLabel('Hledat', { exact: true })).toHaveValue('klav');
    await expect(card(page, 'klavesova-mise')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Ročník', { exact: true })).toHaveValue('7');
    await expect(card(page, 'klavesova-mise')).toBeVisible();
    // neplatná hodnota v URL nerozbije katalog
    await page.goto('/?tema=neexistuje');
    await expect(page.getByLabel('Téma', { exact: true })).toHaveValue('');
    await expect(card(page, 'klavesova-mise')).toBeVisible();
  });

  test('selhání načtení apps.json zobrazí chybu a jde zkusit znovu', async ({ page }) => {
    let fail = true;
    await page.route('**/apps.json', route => (fail ? route.fulfill({ status: 500, body: 'chyba' }) : route.continue()));
    await page.goto('/');
    await expect(page.locator('#error')).toBeVisible();
    await expect(page.locator('#error')).toContainText('Katalog se nepodařilo načíst');
    await expect(page.locator('.app-card')).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: 'Zkusit znovu' }).click();
    await expect(page.locator('#error')).toBeHidden();
    await expect(card(page, 'klavesova-mise')).toBeVisible();
  });

  test('neplatný JSON zobrazí chybu', async ({ page }) => {
    await page.route('**/apps.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"apps": [' }));
    await page.goto('/');
    await expect(page.locator('#error')).toBeVisible();
  });

  test('nová hra v registru se zobrazí bez úprav homepage; neplatné a nepublikované záznamy ne', async ({ page }) => {
    const base = registry();
    const extra = {
      id: 'binarni-vyzva', title: 'Binární výzva', subtitle: 'Nuly a jedničky',
      description: 'Převáděj čísla mezi desítkovou a dvojkovou soustavou.', url: '/aplikace/binarni-vyzva/',
      subject: 'Informatika', grades: [7, 9], topics: ['Číselné soustavy'], difficulty: 'narocna',
      durationMinutes: 15, icon: 'binary', color: 'teal', featured: false, requiresKeyboard: false, status: 'published'
    };
    const draft = { ...extra, id: 'rozpracovana', title: 'Rozpracovaná', url: '/aplikace/rozpracovana/', status: 'draft' };
    const evil = { ...extra, id: 'zla', url: '/aplikace/zla/', title: '<img src=x onerror="window.__xss=1">' };
    const badUrl = { ...extra, id: 'mimo', url: 'https://example.com/', title: 'Mimo portál' };
    await page.route('**/apps.json', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ...base, apps: [...base.apps, extra, draft, evil, badUrl] })
    }));
    await page.goto('/');
    await expect(page.locator('.app-card')).toHaveCount(N + 1);
    await expect(card(page, 'binarni-vyzva')).toContainText('7. a 9. ročník');
    await expect(card(page, 'binarni-vyzva')).toContainText('Obtížnost: Náročná');
    await expect(card(page, 'binarni-vyzva')).not.toContainText('Vyžaduje klávesnici');
    await expect(card(page, 'binarni-vyzva').getByRole('link', { name: 'Spustit hru Binární výzva' })).toHaveAttribute('href', '/aplikace/binarni-vyzva/');
    await expect(page.getByLabel('Téma', { exact: true }).locator('option', { hasText: 'Číselné soustavy' })).toHaveCount(1);
    await expect(page.locator('#count')).toHaveText(`${hry(N + 1)} v katalogu`);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();

    await page.getByLabel('Ročník', { exact: true }).selectOption('9');
    await page.getByLabel('Hledat', { exact: true }).fill('binarni');
    await expect(page.locator('.app-card')).toHaveCount(1);
    await expect(card(page, 'binarni-vyzva')).toBeVisible();
  });

  test('kliknutí na kartu otevře samostatnou URL hry @smoke', async ({ page }) => {
    await page.goto('/');
    // klik kamkoli na kartu (odkaz „Spustit“ je roztažený přes celou kartu)
    await card(page, 'klavesova-mise').click({ position: { x: 40, y: 260 } });
    await expect(page).toHaveURL('/aplikace/klavesova-mise/');
    await expect(page).toHaveTitle('Klávesová mise – Kurzík a školní výlet');
  });

  test('klávesnicí: Tab dojde na odkaz Spustit a Enter hru otevře', async ({ page }) => {
    await page.goto('/');
    const link = card(page, 'klavesova-mise').getByRole('link', { name: /Spustit hru/ });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/aplikace/klavesova-mise/');
  });
});

test.describe('Datoví detektivové a připravované hry v katalogu', () => {
  test('katalog → hra → zpět do katalogu @smoke', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(card(page, 'datovi-detektivove')).toContainText('6. ročník');
    await card(page, 'datovi-detektivove').getByRole('link', { name: 'Spustit hru Datoví detektivové' }).click();
    await expect(page).toHaveURL('/aplikace/datovi-detektivove/');
    await expect(page.getByRole('heading', { level: 1, name: 'Datoví detektivové' })).toBeVisible();
    await page.getByRole('link', { name: 'Zpět do katalogu her' }).click();
    await expect(page).toHaveURL('/');
    await expect(card(page, 'datovi-detektivove')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('bez připravovaných her se sekce Připravujeme nezobrazí', async ({ page }) => {
    expect(registry().apps.filter(a => a.status === 'planned')).toEqual([]);
    await page.goto('/');
    await expect(page.locator('.app-card').first()).toBeVisible();
    await expect(page.locator('#planned')).toBeHidden();
  });

  test('připravované hry jsou vidět, ale nejdou spustit; filtr podle tématu', async ({ page }) => {
    // Registr teď připravované hry nemá – zkoušíme na podstrčeném záznamu.
    const base = registry();
    const planned = [{
      id: 'prezentacni-studio', title: 'Prezentační studio', description: 'Oprav přeplněné snímky.',
      url: '/aplikace/prezentacni-studio/', subject: 'Informatika', grades: [7, 9], topics: ['Prezentace'],
      difficulty: 'stredni', durationMinutes: 15, icon: 'slides', color: 'pink', requiresKeyboard: false, status: 'planned'
    }];
    await page.route('**/apps.json', route => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ ...base, apps: [...base.apps, ...planned] })
    }));
    await page.goto('/');
    const section = page.locator('#planned');
    await expect(section.getByRole('heading', { name: 'Připravujeme' })).toBeVisible();
    await expect(section.locator('.plan-card')).toHaveCount(planned.length);
    for (const app of planned) {
      const c = section.locator(`.plan-card[data-id="${app.id}"]`);
      await expect(c).toContainText('Připravujeme');
      await expect(c.locator(`a[href="${app.url}"]`)).toHaveCount(0);
    }
    await page.getByLabel('Téma', { exact: true }).selectOption('Tabulky a grafy');
    await expect(page.locator('.app-card')).toHaveCount(1);
    await expect(card(page, 'datovi-detektivove')).toBeVisible();
    await expect(section).toBeHidden();
    await page.goto('/?rocnik=7');
    await expect(section.locator('.plan-card[data-id="prezentacni-studio"]')).toBeVisible();
    await page.goto('/?rocnik=6');
    await expect(section).toBeHidden(); // prezentace jsou až od 7. ročníku
  });

  test('karta Pro učitele jde otevřít přímým odkazem a cituje ŠVP', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await card(page, 'datovi-detektivove').getByRole('link', { name: 'Pro učitele: Datoví detektivové' }).click();
    await expect(page).toHaveURL('/pro-ucitele/#datovi-detektivove');
    const art = page.locator('article#datovi-detektivove');
    await expect(art.getByRole('heading', { name: 'Datoví detektivové' })).toBeFocused();
    await expect(art).toContainText('„odpoví na otázky na základě dat v tabulce“');
    await expect(art).toContainText('Otázky k reflexi');
    await expect(art.locator('h3', { hasText: 'Otázky k reflexi' }).locator('+ ul li')).toHaveCount(3);
    await expect(art).toContainText('Rychlí a začínající žáci');
    await expect(art).toContainText('Ve 45minutové hodině');
    for (const id of ['dokumentova-zachranka', 'roboti-dilna']) {
      await page.goto(`/pro-ucitele/#${id}`);
      await expect(page.locator(`article#${id}`)).toContainText('Hratelné');
      await expect(page.locator(`article#${id}`).getByRole('link', { name: /Otevřít hru/ })).toHaveAttribute('href', `/aplikace/${id}/`);
    }
    expect(errors).toEqual([]);
  });
});

test.describe('Nové hry v katalogu', () => {
  test('katalog načte obě nové hry, přímé URL fungují a odkazují zpět @smoke', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    for (const [id, title] of [['dokumentova-zachranka', 'Dokumentová záchranka'], ['roboti-dilna', 'Robotí dílna']]) {
      await expect(card(page, id)).toBeVisible();
      await card(page, id).getByRole('link', { name: `Spustit hru ${title}` }).click();
      await expect(page).toHaveURL(`/aplikace/${id}/`);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await page.getByRole('link', { name: 'Zpět do katalogu her' }).click();
      await expect(page).toHaveURL('/');
    }
    // přímý odkaz na konkrétní misi
    await page.goto('/aplikace/roboti-dilna/#start-motoru');
    await expect(page.locator('#m-title')).toHaveText('Start motorů');
    await page.goto('/aplikace/dokumentova-zachranka/#ztraceny-titulek');
    await expect(page.locator('#m-title')).toHaveText('Ztracený titulek');
    expect(errors).toEqual([]);
  });

  test('hry mají oddělené klíče v localStorage', async ({ page }) => {
    await page.goto('/aplikace/dokumentova-zachranka/');
    await page.getByRole('checkbox', { name: /Odemknout všechny mise/ }).check();
    await page.goto('/aplikace/roboti-dilna/');
    await page.getByRole('checkbox', { name: /Odemknout všechny mise/ }).check();
    await page.goto('/aplikace/datovi-detektivove/');
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    const keys = await page.evaluate(() => Object.keys(localStorage).sort());
    expect(keys).toEqual(['vyukovy-portal:datovi-detektivove:v1', 'vyukovy-portal:dokumentova-zachranka:v1', 'vyukovy-portal:roboti-dilna:v1']);
  });
});

test.describe('Ostatní stránky', () => {
  test('O projektu @smoke', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/o-projektu/');
    await expect(page.getByRole('heading', { level: 1, name: 'O projektu' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Hlavní navigace' }).getByRole('link', { name: 'O projektu' })).toHaveAttribute('aria-current', 'page');
    expect(errors).toEqual([]);
  });

  test('neexistující adresa vrátí skutečnou 404 se stránkou portálu', async ({ page }) => {
    const res = await page.goto('/tohle-neexistuje/');
    expect(res.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Tuhle stránku jsme nenašli' })).toBeVisible();
    await page.getByRole('link', { name: 'Zpět do katalogu' }).click();
    await expect(page).toHaveURL('/');
  });

  test('bezpečnostní hlavičky z _headers', async ({ request }) => {
    const res = await request.get('/');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
    const t = await request.get('/aplikace/klavesova-mise/test.html');
    expect(t.headers()['x-robots-tag']).toContain('noindex');
  });

  test('každá publikovaná hra má funkční přímou URL bez chyb @smoke', async ({ page }) => {
    for (const app of publishedApps()) {
      const errors = watchErrors(page);
      const res = await page.goto(app.url);
      expect(res.status(), app.url).toBe(200);
      await expect(page.locator('body')).not.toBeEmpty();
      await page.waitForLoadState('networkidle');
      expect(errors, app.url).toEqual([]);
    }
  });
});

test.describe('Mobil', () => {
  for (const width of [320, 360, 390]) {
    test(`bez vodorovného scrollu na ${width} px @mobile`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const url of ['/', '/o-projektu/', '/pro-ucitele/', '/tohle-neexistuje/', '/aplikace/klavesova-mise/', '/aplikace/datovi-detektivove/', '/aplikace/dokumentova-zachranka/', '/aplikace/roboti-dilna/']) {
        await page.goto(url);
        if (url === '/') await expect(page.locator('.app-card').first()).toBeVisible();
        await expectNoHorizontalScroll(page);
      }
    });
  }

  test('na dotykovém zařízení se zobrazí upozornění na klávesnici, hra zůstane v katalogu @mobile', async ({ page }) => {
    await page.goto('/');
    await expect(card(page, 'klavesova-mise')).toBeVisible();
    await expect(page.locator('#touch-hint')).toBeVisible();
  });
});
