import { defineConfig, devices } from '@playwright/test'

/**
 * E2E tests run the real Go server (server/bin/tipitaka_lk) with the built web app (web/dist) and the
 * fixture databases (e2e/fixtures/db, built from e2e/fixtures/text by `npm run build:fixture`).
 * The android-sim project loads the offline app build (web/dist-app) with a simulated native bridge.
 * The pitaka-* projects test the pitaka.lk reader (web-pitaka/dist, server -flavor pitaka) under /main/.
 */
const PORT = 8410, PITAKA_PORT = 8411
const LK = /android\.spec|pitaka\.spec/
export default defineConfig({
  testDir: '.',
  testIgnore: ['**/legacy/**', '**/fixtures/**'],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure', locale: 'si-LK' },
  webServer: [{
    command: `TIPITAKA_LATEST_VERSION_URL=http://127.0.0.1:${PORT}/tipitaka-query/version ../server/bin/tipitaka_lk -no-open -listen 127.0.0.1:${PORT} -root-path .. -db-dir fixtures/db`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
  }, {
    command: `../server/bin/tipitaka_lk -flavor pitaka -no-open -listen 127.0.0.1:${PITAKA_PORT} -root-path .. -db-dir fixtures/db`,
    url: `http://127.0.0.1:${PITAKA_PORT}/main/api/health`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
  }],
  projects: [
    { name: 'desktop-chromium', testIgnore: LK, use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] } },
    { name: 'desktop-webkit', testIgnore: /android\.spec|pitaka\.spec|audio\.spec|visual\.spec/, use: { ...devices['Desktop Safari'], viewport: { width: 1400, height: 900 } } },
    { name: 'desktop-firefox', testIgnore: /android\.spec|pitaka\.spec|audio\.spec|visual\.spec/, use: { ...devices['Desktop Firefox'], viewport: { width: 1400, height: 900 } } },
    { name: 'mobile-chrome', testIgnore: /android\.spec|pitaka\.spec|audio\.spec|visual\.spec/, use: { ...devices['Pixel 5'] } },
    { name: 'mobile-webkit', testIgnore: /android\.spec|pitaka\.spec|audio\.spec|visual\.spec/, use: { ...devices['iPhone 12'] } },
    { name: 'android-sim', testMatch: /android\.spec/, use: { ...devices['Pixel 5'] } },
    { name: 'pitaka-desktop', testMatch: /pitaka\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 }, baseURL: `http://127.0.0.1:${PITAKA_PORT}/main/` } },
    { name: 'pitaka-phone', testMatch: /pitaka\.spec/, use: { ...devices['Pixel 5'], baseURL: `http://127.0.0.1:${PITAKA_PORT}/main/` } },
  ],
})
