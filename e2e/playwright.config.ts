import { defineConfig, devices } from '@playwright/test'

/**
 * E2E tests run the real Go server (server/bin/tipitaka_lk) with the built web app (web/dist) and the
 * fixture databases (e2e/fixtures/db, built from e2e/fixtures/text by `npm run build:fixture`).
 * The android-sim project loads the offline app build (web/dist-app) with a simulated native bridge.
 */
const PORT = 8410
export default defineConfig({
  testDir: '.',
  testIgnore: ['**/legacy/**', '**/fixtures/**'],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure', locale: 'si-LK' },
  webServer: {
    command: `TIPITAKA_LATEST_VERSION_URL=http://127.0.0.1:${PORT}/tipitaka-query/version ../server/bin/tipitaka_lk -no-open -listen 127.0.0.1:${PORT} -root-path .. -db-dir fixtures/db`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
  },
  projects: [
    { name: 'desktop-chromium', testIgnore: /android\.spec/, use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] } },
    { name: 'desktop-webkit', testIgnore: /android\.spec|audio\.spec|visual\.spec/, use: { ...devices['Desktop Safari'], viewport: { width: 1400, height: 900 } } },
    { name: 'desktop-firefox', testIgnore: /android\.spec|audio\.spec|visual\.spec/, use: { ...devices['Desktop Firefox'], viewport: { width: 1400, height: 900 } } },
    { name: 'mobile-chrome', testIgnore: /android\.spec|audio\.spec|visual\.spec/, use: { ...devices['Pixel 5'] } },
    { name: 'mobile-webkit', testIgnore: /android\.spec|audio\.spec|visual\.spec/, use: { ...devices['iPhone 12'] } },
    { name: 'android-sim', testMatch: /android\.spec/, use: { ...devices['Pixel 5'] } },
  ],
})
