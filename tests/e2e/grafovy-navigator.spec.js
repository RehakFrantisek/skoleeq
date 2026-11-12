// E2E testy Grafového navigátoru: titulní obrazovka, ukázka, celá mise přes skutečné ovládání (uzly, trasy,
// kabely, automat, plánovač), chyby s vysvětlením, klávesnice v grafu, rychlý režim z URL, 320 px, smazání výsledků.
import { test, expect } from '@playwright/test';
import { watchErrors, expectNoHorizontalScroll } from './helpers.js';
import * as L from '../../public/aplikace/grafovy-navigator/logic.js';

const URL = '/aplikace/grafovy-navigator/';
const KEY = 'vyukovy-portal:grafovy-navigator:v1';
const node = (page, id) => page.locator(`#tool .g-node[data-id="${id}"]`);

async function solve(page, t) {
  const a = L.solution(t);
  switch (t.type) {
    case 'pick': for (const id of a.nodes) await node(page, id).click(); break;
    case 'path': for (const id of a.path.slice(1)) await node(page, id).click(); break;
    case 'network':
      for (const k of a.edges) {
        const e = t.graph.edges.find(x => L.edgeKey(x.a, x.b) === k);
        await page.getByRole('button', { name: `Kabel ${e.a}–${e.b}, cena ${e.w}`, exact: true }).click();
      }
      break;
    case 'automat': await page.getByRole('button', { name: `Stav ${L.stateName(t.automaton, a.state)}` }).click(); break;
    case 'schedule':
      for (const j of t.jobs) {
        const s = a.schedule[j.id];
        await page.getByRole('group', { name: `${j.name}: robot` }).getByLabel(`Robot ${s.lane}`).check();
        const from = L.defaultSchedule(t.jobs)[j.id].start;
        const btn = s.start > from ? 'později' : 'dřív';
        for (let k = 0; k < Math.abs(s.start - from); k++) await page.getByRole('button', { name: `${j.name}: začít o hodinu ${btn}` }).click();
      }
      break;
    default: throw new Error(t.type);
  }
}
async function passIntro(page) {
  if (await page.locator('#s-intro').isVisible()) await page.getByRole('button', { name: 'Pustit se do toho →' }).click();
}

test.describe('Grafový navigátor', () => {
  test.use({ viewport: { width: 1366, height: 860 } });

  test('titulní obrazovka a odkazy @smoke', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('heading', { level: 1, name: 'Grafový navigátor' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pro učitele/ })).toHaveAttribute('href', '/pro-ucitele/#grafovy-navigator');
    await expect(page.getByRole('link', { name: 'Zpět do katalogu her' })).toHaveAttribute('href', '/');
    expect(errors).toEqual([]);
  });

  test('ukázka + celá mise (varianta A) přes všechny nástroje @smoke', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await page.goto(URL);
    await page.getByRole('button', { name: 'Začít ukázkou' }).click();
    await solve(page, L.tutorialTask());
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText('Správně');
    await page.getByRole('button', { name: 'Spustit misi →' }).click();
    const tasks = L.buildGame('A');
    let intros = 0;
    for (const [i, t] of tasks.entries()) {
      if (await page.locator('#s-intro').isVisible()) intros++;
      await passIntro(page);
      await expect(page.locator('#task-h'), t.id).toHaveText(t.title);
      await solve(page, t);
      await page.getByRole('button', { name: 'Zkontrolovat' }).click();
      await expect(page.locator('#feedback'), `${t.id}: ${await page.locator('#feedback').innerText()}`).toContainText('Správně');
      await expect(page.locator('#photo .net__node.is-on')).toHaveCount(i + 1);
      await page.locator('#btn-next').click();
    }
    expect(intros).toBe(5);
    await expect(page.locator('#result')).toContainText('11 z 11 úloh, 11 napoprvé');
    await expect(page.locator('#photo-end .net__node.is-on')).toHaveCount(11);
    const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
    expect(saved.best.cela).toMatchObject({ firstTry: 11, total: 11, hints: 0 });
    expect(errors).toEqual([]);
  });

  test('chyby s vysvětlením: neexistující cesta, dražší trasa, krok zpět, okruh v síti, řešení', async ({ page }) => {
    await page.goto(URL + '?vse');
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    const tasks = L.buildGame('A');
    // úloha 3 = nejúspornější trasa
    for (let i = 0; i < 2; i++) { await passIntro(page); await solve(page, tasks[i]); await page.getByRole('button', { name: 'Zkontrolovat' }).click(); await page.locator('#btn-next').click(); }
    await passIntro(page);
    const sh = tasks[2];
    const nonAdj = sh.graph.nodes.map(n => n.id).find(id => id !== sh.from && !L.findEdge(sh.graph, sh.from, id));
    await node(page, nonAdj).click();
    await expect(page.locator('#tool .status')).toContainText(`Ze ${sh.from} do ${nonAdj} nevede přímá cesta`);
    // libovolná dražší (ale platná) trasa
    const paths = [];
    const dfs = p => { if (p.at(-1) === sh.to) { paths.push(p); return; } for (const { to } of L.neighbors(sh.graph, p.at(-1))) if (!p.includes(to)) dfs([...p, to]); };
    dfs([sh.from]);
    const hops = paths.find(p => L.pathInfo(sh.graph, p).cost > sh.best);
    for (const id of hops.slice(1)) await node(page, id).click();
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText(`stojí ${L.pathInfo(sh.graph, hops).cost}, jde to za ${sh.best}`);
    // klik na předchozí základnu = krok zpět
    await node(page, hops.at(-2)).click();
    await expect(page.locator('#tool .status')).toContainText(`Trasa: ${hops.slice(0, -1).join(' → ')}`);
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await page.getByRole('button', { name: 'Ukázat řešení' }).click();
    await expect(page.locator('#feedback')).toContainText('Řešení:');
    await expect(page.locator('#photo .net__node.is-dim')).toHaveCount(1);
    await page.locator('#btn-next').click();
    // úloha 4 přeskočit řešením, úloha 5 = síť: okruh
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await page.getByRole('button', { name: 'Ukázat řešení' }).click();
    await page.locator('#btn-next').click();
    await passIntro(page);
    const mst = tasks[4];
    for (const e of mst.graph.edges.slice(0, 3).concat(mst.graph.edges)) {
      const btn = page.getByRole('button', { name: `Kabel ${e.a}–${e.b}, cena ${e.w}`, exact: true });
      if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click();
    }
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText('okruh');
  });

  test('rychlý režim z URL; graf jde ovládat klávesnicí (Tab + Enter)', async ({ page }) => {
    await page.goto(URL + '?varianta=C&rezim=rychly');
    await expect(page.getByRole('radio', { name: 'C', exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    const tasks = L.buildGame('C', 'rychly');
    for (const [i, t] of tasks.entries()) {
      await passIntro(page);
      await expect(page.locator('#hud-task')).toHaveText(`${i + 1}/5`);
      if (t.type === 'path') {
        for (const id of L.solution(t).path.slice(1)) { await node(page, id).focus(); await page.keyboard.press('Enter'); }
      } else await solve(page, t);
      await page.getByRole('button', { name: 'Zkontrolovat' }).click();
      await expect(page.locator('#feedback')).toContainText('Správně');
      await page.locator('#btn-next').click();
    }
    await expect(page.locator('#result')).toContainText('5 z 5');
  });

  test('plánovač: souběh na jednom robotovi a nesplněná závislost jsou vysvětlené', async ({ page }) => {
    await page.goto(URL + '?rezim=rychly');
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    const tasks = L.buildGame('A', 'rychly');
    for (const t of tasks.slice(0, 4)) { await passIntro(page); await solve(page, t); await page.getByRole('button', { name: 'Zkontrolovat' }).click(); await page.locator('#btn-next').click(); }
    await passIntro(page);
    const plan = tasks[4];
    // výchozí plán (vše u robota A za sebou) je platný, ale pomalý
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText(`Cíl je ${plan.best} h`);
    // druhou práci posunout na začátek → čeká na první práci a zároveň se s ní překrývá
    const second = plan.jobs[1];
    for (let k = 0; k < plan.jobs[0].d; k++) await page.getByRole('button', { name: `${second.name}: začít o hodinu dřív` }).click();
    await expect(page.locator('.job.is-bad')).not.toHaveCount(0);
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText(/musí počkat|dvě práce zároveň/);
  });

  test('tlačítko Menu hry: bez postupu rovnou, po vyřešené úloze se zeptá; Hrát dál / Ano, do menu', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(URL);
    await expect(page.getByRole('button', { name: 'Menu hry' })).toBeHidden(); // na úvodu není potřeba
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntro(page);
    // nic vyřešeno → rovnou do menu hry (ne do katalogu)
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Grafový navigátor' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(URL));
    // znovu a jednu úlohu vyřešit
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    await passIntro(page);
    await solve(page, L.buildGame('A')[0]);
    await page.getByRole('button', { name: 'Zkontrolovat' }).click();
    await expect(page.locator('#feedback')).toContainText('Správně');
    await page.locator('#btn-next').click();
    await passIntro(page);
    const title = await page.locator('#task-h').innerText();
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await expect(page.getByRole('dialog', { name: 'Odejít do menu hry?' })).toBeVisible();
    await page.getByRole('button', { name: 'Hrát dál' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.locator('#task-h')).toHaveText(title);
    await page.getByRole('button', { name: 'Menu hry' }).click();
    await page.getByRole('button', { name: 'Ano, do menu' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Grafový navigátor' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Menu hry' })).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('smazání výsledků jen této hry', async ({ page }) => {
    await page.goto(URL);
    await page.evaluate(k => {
      localStorage.setItem(k, JSON.stringify({ best: { cela: { firstTry: 7, total: 11, hints: 1 } } }));
      localStorage.setItem('vyukovy-portal:sifrovaci-laborator:v1', '{"keep":1}');
    }, KEY);
    await page.reload();
    await expect(page.locator('#best')).toContainText('napoprvé 7 z 11');
    await page.getByRole('button', { name: 'Smazat moje výsledky' }).click();
    await page.getByRole('button', { name: 'Ano, smazat' }).click();
    await expect(page.locator('#best')).toContainText('Zatím žádný výsledek');
    expect(await page.evaluate(() => localStorage.getItem('vyukovy-portal:sifrovaci-laborator:v1'))).toBe('{"keep":1}');
  });
});

test.describe('Grafový navigátor – mobil', () => {
  test('320 px: všechny typy úloh bez vodorovného scrollu @mobile', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(URL);
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Přeskočit ukázku' }).click();
    for (const t of L.buildGame('A')) {
      await passIntro(page);
      await expect(page.locator('#task-h')).toHaveText(t.title);
      await expectNoHorizontalScroll(page);
      await page.getByRole('button', { name: 'Zkontrolovat' }).tap();
      await page.getByRole('button', { name: 'Zkontrolovat' }).tap();
      await page.getByRole('button', { name: 'Ukázat řešení' }).tap();
      await page.locator('#btn-next').tap();
    }
    await expect(page.locator('#s-end')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
