import { test, expect } from '@playwright/test'

// the pitaka.lk reader (web-pitaka, server -flavor pitaka on the fixture db): projects pitaka-desktop and pitaka-phone,
// baseURL .../main/
const text = '[data-testid="text-tab"]'
const setMode = async (page: import('@playwright/test').Page, mode: string) => {
  await page.evaluate(m => localStorage.setItem('pitaka.lk-settings-1', JSON.stringify({ readingMode: m })), mode)
  await page.reload()
  await page.locator(`${text} .entry`).first().waitFor()
}

test('home page: the name and where to start', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByTestId('welcome')).toContainText('සරල සිංහල ත්‍රිපිටකය')
  await page.getByTestId('start-links').getByText('ධම්මපදය').click()
  await expect(page).toHaveURL(/\/main\/kn-dhp$/)
  await expect(page.locator(`${text} [data-lang="sinh"]`).first()).toBeVisible()
})

test('Sinhala is the default reading mode, the pāḷi only where there is no translation', async ({ page }) => {
  await page.goto('dn-1-1')
  await expect(page.locator(text)).toHaveAttribute('data-mode', 'sinh')
  await expect(page.locator(`${text} [data-lang="sinh"]`).filter({ hasText: 'භාග්‍යවතුන්' }).first()).toBeVisible()
  // every pāḷi entry shown in the Sinhala mode is an untranslated one
  const pali = await page.locator(`${text} [data-lang="pali"]`).count()
  expect(await page.locator(`${text} .untranslated[data-lang="pali"]`).count()).toBe(pali)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://pitaka.lk/main/dn-1-1')
})

test('the reading modes', async ({ page, isMobile }) => {
  await page.goto('dn-1-1')
  await setMode(page, 'pali')
  await expect(page.locator(text)).toHaveAttribute('data-mode', 'pali')
  await expect(page.locator(`${text} [data-lang="sinh"]`)).toHaveCount(0)
  await setMode(page, 'interleaved')
  await expect(page.locator(text)).toHaveAttribute('data-mode', 'interleaved')
  await expect(page.locator(`${text} .entry-sinh-under`).first()).toBeVisible()
  await expect(page.locator(`${text} .entry-pali-under`).first()).toBeVisible()
  // side by side on wide screens; a phone shows it interleaved
  await setMode(page, 'side')
  await expect(page.locator(text)).toHaveAttribute('data-mode', isMobile ? 'interleaved' : 'side')
  await expect(page.locator(`${text} .pair-2`)).toHaveCount(isMobile ? 0 : await page.locator(`${text} [data-eind]`).count())
})

test('the mode picker and its setting', async ({ page, isMobile }) => {
  await page.goto('dn-1-1')
  await page.locator(`${text} .entry`).first().waitFor()
  if (isMobile) await page.getByTestId('panel-toggle').click()
  const picker = page.getByTestId(isMobile ? 'panel-mode' : 'app-bar').getByTestId('reading-mode')
  await picker.getByTestId('mode-interleaved').click()
  await expect(page.locator(text)).toHaveAttribute('data-mode', 'interleaved')
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('pitaka.lk-settings-1') || '{}')).readingMode).toBe('interleaved')
  expect(await page.evaluate(() => localStorage.getItem('tipitaka.lk-settings-2'))).toBeNull()
})

test('a part without translation: the pāḷi with a note, no mode picker', async ({ page }) => {
  await page.goto('vp-prj')
  await expect(page.getByTestId('translation-coming')).toBeVisible()
  await expect(page.locator(text)).toHaveAttribute('data-mode', 'pali')
  await expect(page.getByTestId('reading-mode')).toHaveCount(0)
})

test('a pāḷi word opens the dictionary, without an aṭṭhakathā tab', async ({ page }) => {
  await page.goto('dn-1-1')
  await setMode(page, 'pali')
  await page.locator(`${text} [data-lang="pali"] .w`).nth(5).click()
  await expect(page.getByTestId('inline-dict')).toBeVisible()
  await expect(page.getByTestId('dict-tab-setting')).toBeVisible()
  await expect(page.getByTestId('dict-tab-atta')).toHaveCount(0)
})

test('no footnotes, scans or columns', async ({ page }) => {
  await page.goto('dn-1')
  await page.locator(`${text} .entry`).first().waitFor()
  await setMode(page, 'side')
  await expect(page.locator('.fn-pointer')).toHaveCount(0)
  await expect(page.getByTestId('page-number')).toHaveCount(0)
  await expect(page.getByTestId('scan-toggle')).toHaveCount(0)
  await expect(page.getByTestId('tabs-bar')).toHaveCount(0)
})

test('next / previous sutta: one sutta at a time, its url under /main', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the app bar has the prev / next buttons on wide screens')
  await page.goto('dn-1')
  await page.locator(`${text} .entry`).first().waitFor()
  await page.getByTestId('next-sutta').click()
  await expect(page).toHaveURL(/\/main\/dn-1-1$/)
  await page.getByTestId('prev-sutta').click()
  await expect(page).toHaveURL(/\/main\/dn-1$/)
  await expect(page.locator(text)).toHaveCount(1)
})
