import { test, expect, entries, isMobile } from './fixtures'
import type { Locator } from '@playwright/test'

/** text without the zero width joiners of the bandi letters (display only) */
const plain = async (l: Locator) => ((await l.textContent()) ?? '').replace(/‍/g, '').trim()

test('dictionary: a sinhala word - DPD headwords and the dictionaries', async ({ page }) => {
  await page.goto('/dict/ධම්ම')
  await expect.poll(() => plain(page.getByTestId('dict-word'))).toBe('ධම්ම')
  await expect(page.getByTestId('dict-dpd-section').getByTestId('dpd-head').first()).toBeVisible()
  await expect(page.getByTestId('dict-match').first()).toBeVisible()
  await page.getByTestId('dpd-head').first().locator('button').click() // a headword opens its grammar, root, construction
  await expect(page.getByTestId('dpd-head').first().locator('table')).toBeVisible()
  await expect(page.getByTestId('search-message')).toContainText('හමුවිය')
})

test('dictionary: roman and singlish input', async ({ page }) => {
  await page.goto('/dict/dhamma')
  await expect.poll(() => plain(page.getByTestId('dict-word'))).toBe('ධම්ම')
  await expect(page.getByTestId('dict-match').first()).toBeVisible()
  await page.goto('/dict/nibbana') // no diacritics
  await expect(page.getByTestId('dpd-head').filter({ hasText: /නිබ‍?්බාන/ }).first()).toBeVisible() // nibbāna (and nibbana, desireless); bandi letters: joiners
})

test('dictionary filter limits the dictionaries (remembered)', async ({ page }) => {
  await page.goto('/dict/ධම්ම')
  await expect(page.getByTestId('dict-match').first()).toBeVisible()
  await page.getByTestId('dict-filter').click()
  for (const d of ['dpd', 'en-ncped', 'en-nyanatiloka', 'en-pts', 'en-dppn', 'en-vri', 'en-critical', 'si-sumangala']) await page.getByTestId(`dict-${d}`).uncheck()
  await page.getByTestId('dicts-done').click()
  await expect(page.getByTestId('dict-dpd-section')).toHaveCount(0)
  await expect.poll(async () => (await page.getByTestId('dict-match').evaluateAll(els => els.map(e => e.getAttribute('data-dict-code')))).every(c => c === 'si-buddhadatta')).toBe(true)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tipitaka.lk-settings-2')!).dicts)).toEqual(['si-buddhadatta'])
  await page.goto('/settings')
  await expect(page.getByTestId('settings-dicts').getByTestId('dict-si-buddhadatta')).toBeChecked()
  await expect(page.getByTestId('settings-dicts').getByTestId('dict-dpd')).not.toBeChecked()
})

test('dictionary input rules', async ({ page }) => {
  await page.goto("/dict/ධම්'")
  await expect(page.getByTestId('search-error')).toBeVisible()
})

test('inline dictionary from a pali word, quotes do not break it (A4)', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await entries(page, 'pali').locator('.w').nth(5).click()
  const sheet = page.getByTestId('inline-dict')
  await expect(sheet).toBeVisible()
  await expect(page.locator('.w.selected-word')).toHaveCount(1)
  await page.getByTestId('inline-dict-input').fill("ධම්'ම")
  await expect(sheet.locator('.banner.border-error')).toHaveCount(0)
  await page.getByTestId('inline-dict-input').fill('ධම්ම')
  await expect.poll(() => plain(sheet.getByTestId('dict-word'))).toBe('ධම්ම')
  await expect(sheet.getByTestId('dict-match').first()).toBeVisible()
  await page.getByTestId('inline-backspace').click()
  await expect(page.getByTestId('inline-dict-input')).toHaveValue('ධම්')
  await page.getByTestId('inline-fts').click()
  await expect(page).toHaveURL(/\/fts\//)
})

test('dictionary pane: a column on the right of wide screens, the text is not covered', async ({ page }) => {
  test.skip(isMobile(page), 'wide screens')
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/dn-1-1/pali')
  await entries(page, 'pali').locator('.w').nth(5).click()
  const pane = page.getByTestId('inline-dict')
  await expect(pane).toBeVisible()
  await expect(page.getByTestId('sheet-handle')).toHaveCount(0)
  const box = (await pane.boundingBox())!, text = page.locator('[data-testid="text-tab"]:visible')
  expect(Math.round(box.x + box.width)).toBe(1600)
  await expect.poll(async () => { const t = (await text.boundingBox())!; return t.x + t.width <= box.x + 1 }).toBe(true) // the padding transitions
  await page.getByTestId('inline-dict-close').click()
  await expect(pane).toHaveCount(0)
})

test('dictionary sheet on small screens: drag the handle to resize (remembered) or down to close', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto('/dn-1-1/pali')
  await entries(page, 'pali').locator('.w').nth(5).click()
  const sheet = page.getByTestId('inline-dict'), handle = page.getByTestId('sheet-handle')
  await expect(sheet).toBeVisible()
  expect(Math.round((await sheet.boundingBox())!.height)).toBe(320) // 40 % of the screen
  const drag = async (dy: number) => {
    const h = (await handle.boundingBox())!
    await page.mouse.move(h.x + h.width / 2, h.y + 5)
    await page.mouse.down()
    await page.mouse.move(h.x + h.width / 2, h.y + 5 + dy, { steps: 4 })
    await page.mouse.up()
  }
  await drag(-160) // up by 20 % of the screen
  await expect.poll(async () => Math.round((await sheet.boundingBox())!.height)).toBe(480)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tipitaka.lk-settings-2')!).dictSheetHeight)).toBe(60)
  await drag(600) // down past the bottom: closes
  await expect(sheet).toHaveCount(0)
})

test('a clicked word: the DPD analysis of the form (inflection, headwords)', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await entries(page, 'pali').locator('.w').filter({ hasText: /^ධම‍?්මස‍?්ස$/ }).first().click() // (bandi letters: joiners)
  const sheet = page.getByTestId('inline-dict')
  await expect.poll(() => plain(sheet.getByTestId('dict-word'))).toBe('ධම්මස්ස')
  await expect(sheet.getByTestId('dict-analysis')).toBeVisible()
  await expect(sheet.getByTestId('dpd-head').first()).toBeVisible()
})

test('closing the paragraph menu with a click on a word does not look the word up', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  const cell = entries(page, 'pali').filter({ has: page.getByTestId('entry-options') }).first()
  await cell.hover()
  await cell.getByTestId('entry-options').click()
  await expect(page.getByText('සජ්ඣායනය අසන්න')).toBeVisible()
  await entries(page, 'pali').locator('.w').nth(5).click() // closes the menu only
  await expect(page.getByText('සජ්ඣායනය අසන්න')).toHaveCount(0)
  await expect(page.getByTestId('inline-dict')).toHaveCount(0)
  await entries(page, 'pali').locator('.w').nth(5).click() // now a lookup
  await expect(page.getByTestId('inline-dict')).toBeVisible()
})

test('dictionary pali is shown with the joined (bandi) letters of the text', async ({ page }) => {
  await page.goto('/dict/brahmajāla')
  await expect.poll(() => plain(page.getByTestId('dict-word'))).toBe('බ්රහ්මජාල')
  expect(await page.getByTestId('dict-word').textContent()).toContain('‍') // the joiners of the conjuncts, like the text
})
