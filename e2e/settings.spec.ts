import { test, expect, entries, isMobile } from './fixtures'
import type { Page } from '@playwright/test'

const seed = (page: Page, key: string, value: unknown) =>
  page.addInitScript(([k, v]) => localStorage.setItem(k as string, JSON.stringify(v)), [key, value])

test('legacy settings are honoured (default columns, font size)', async ({ page }) => {
  await seed(page, 'tipitaka.lk-settings-2', { defaultColumns: 0, fontSize: 3, footnoteMethod: 'click', darkMode: true })
  await page.goto('/dn-1-1')
  await expect(entries(page, 'pali').first()).toBeVisible()
  await expect(entries(page, 'sinh')).toHaveCount(0)
  await expect(page.getByTestId('text-tab').first()).toHaveAttribute('style', /font-size: 19px/)
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('settings persist across reloads', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('dark-toggle').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByTestId('fn-end-page').check()
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByTestId('fn-end-page')).toBeChecked()
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tipitaka.lk-settings-2')!))
  expect(stored).toMatchObject({ darkMode: true, footnoteMethod: 'end-page' })
})

for (const mode of ['click', 'hover', 'end-page', 'hidden'] as const) {
  test(`footnotes: ${mode}`, async ({ page }) => {
    test.skip(mode === 'hover' && isMobile(page), 'no hover on touch screens')
    await seed(page, 'tipitaka.lk-settings-2', { footnoteMethod: mode, defaultColumns: 0 })
    await page.goto('/dn-1/0-0/pali')
    const pointer = page.locator('[data-testid="text-tab"]:visible .fn-pointer').first()
    if (mode === 'hidden') { await expect(entries(page, 'pali').first()).toBeVisible(); await expect(pointer).toHaveCount(0); return }
    if (mode === 'end-page') { await expect(page.getByTestId('footnote-list').first()).toContainText('මඡසං'); return }
    if (mode === 'click') await pointer.click()
    else await pointer.hover()
    const pop = page.getByTestId('footnote-popover')
    await expect(pop).toBeVisible()
    await expect(pop).toContainText('.')
    const abbr = pop.locator('.fn-abbr').first()
    if (await abbr.count()) {
      await abbr.click()
      await expect(page.getByTestId('abbr-desc')).not.toBeEmpty()
    }
  })
}

test('bandi letters setting changes the rendered pali text', async ({ page }) => {
  await page.goto('/settings')
  await page.evaluate(() => localStorage.setItem('tipitaka.lk-settings-2', JSON.stringify({ bandiLetters: true, defaultColumns: 0 })))
  await page.goto('/dn-1-1/pali')
  const withBandi = await entries(page, 'pali').nth(3).innerText()
  await page.goto('/settings')
  await page.getByTestId('setting-bandiLetters').uncheck()
  await page.goto('/dn-1-1/pali')
  const without = await entries(page, 'pali').nth(3).innerText()
  expect(withBandi).not.toBe(without)
  expect((withBandi.match(/‍්/g) || []).length).toBeGreaterThan(0)
  expect((without.match(/‍්/g) || []).length).toBe(0)
})

test('abbreviations page', async ({ page }) => {
  await page.goto('/abbreviations')
  await expect(page.getByTestId('abbreviations').locator('tbody tr').first()).toBeVisible()
  await expect(page.getByTestId('abbreviations')).toContainText('මඡසං')
})

test('version check shows up to date (no cross-origin request)', async ({ page }) => {
  const external: string[] = []
  page.on('request', r => { if (r.url().startsWith('https://tipitaka.lk')) external.push(r.url()) })
  await page.goto('/settings')
  await expect(page.getByTestId('version-text')).toContainText('නවතම අනුවාදය')
  expect(external).toEqual([])
})

test('default columns: "both" is offered in settings on every screen', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('columns-0').click()
  await page.getByTestId('columns-2').click()
  if (isMobile(page)) await expect(page.getByText('කුඩා තිර වල එක් තීරුවක් පමණක් පෙන්වේ.')).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tipitaka.lk-settings-2')!).defaultColumns)).toBe(2)
})

test('tree pane slides in and out', async ({ page }) => {
  await page.goto('/')
  const drawer = page.getByTestId('drawer')
  if (!(await drawer.isVisible())) await page.getByTestId('tree-toggle').click()
  await expect(drawer).toBeVisible()
  await page.getByTestId('tree-toggle').click()
  await expect(drawer).toBeHidden()
  await page.getByTestId('tree-toggle').click()
  await expect(drawer).toBeVisible()
})
