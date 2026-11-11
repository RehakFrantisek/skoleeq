// Playwright – smoke testy katalogu a integrace her.
// Prohlížeče: `npx playwright install chromium firefox` (jednorázově, viz README).
// Volitelně systémový prohlížeč místo staženého Chromia: PW_CHANNEL=msedge nebo PW_CHANNEL=chrome.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PW_PORT || 4173);
const channel = process.env.PW_CHANNEL || undefined;
const withFirefox = !!(process.env.CI || process.env.PW_FIREFOX);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'cs-CZ',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1280, height: 900 } }, grepInvert: /@mobile/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel }, grep: /@mobile/ },
    // Firefox smoke: vždy v CI, lokálně jen s PW_FIREFOX=1 (na Windows ho může blokovat Smart App Control)
    ...(withFirefox ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 } }, grep: /@smoke/ }] : [])
  ],
  webServer: {
    command: `node scripts/serve.mjs --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    env: { QUIET: '1' },
    reuseExistingServer: !process.env.CI,
    timeout: 20_000
  }
});
