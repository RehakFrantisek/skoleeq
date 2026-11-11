import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

export const registry = () => JSON.parse(readFileSync(new URL('../../public/apps.json', import.meta.url), 'utf8'));
export const publishedApps = () => registry().apps.filter(a => a.status === 'published');

/** Sbírá chyby z konzole, nezachycené výjimky a neúspěšné požadavky (4xx/5xx). */
export function watchErrors(page, { allow404 = [] } = {}) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('response', r => {
    if (r.status() >= 400 && !allow404.some(p => r.url().includes(p))) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  page.on('requestfailed', r => errors.push(`failed: ${r.url()} ${r.failure()?.errorText}`));
  return errors;
}

export async function expectNoHorizontalScroll(page) {
  const { sw, w } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  expect(sw, `scrollWidth ${sw} > innerWidth ${w}`).toBeLessThanOrEqual(w);
}

export const card = (page, id) => page.locator(`.app-card[data-id="${id}"]`);
