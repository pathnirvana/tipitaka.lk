import { test, expect, entries } from './fixtures'

test('dictionary: sinhala word, prefix words, filter', async ({ page }) => {
  await page.goto('/dict/ධම්ම')
  await expect(page.getByTestId('dict-match').first()).toBeVisible()
  await expect(page.getByTestId('search-message')).toContainText('හමුවිය')
  const chip = page.getByTestId('dict-prefix').first()
  await expect(chip).toBeVisible()
  const word = await chip.innerText()
  await chip.click()
  await expect.poll(() => decodeURIComponent(page.url())).toContain('/dict/' + word.trim())
  await page.goBack()
  await expect(page).toHaveURL(/\/dict\/%E0/)
})

test('dictionary: singlish input', async ({ page }) => {
  await page.goto('/dict/dhamma')
  await expect(page.getByTestId('dict-match').first()).toBeVisible()
})

test('dictionary filter limits the dictionaries', async ({ page }) => {
  await page.goto('/dict/ධම්ම')
  await expect(page.getByTestId('dict-match').first()).toBeVisible()
  await page.getByTestId('dict-filter').click()
  for (const d of ['MS', 'BUE', 'ND', 'PTS', 'PN', 'VRI', 'CR']) await page.getByTestId(`dict-${d}`).uncheck()
  await page.keyboard.press('Escape')
  await page.locator('.fixed.inset-0').first().click({ position: { x: 5, y: 5 } })
  await expect.poll(async () => (await page.getByTestId('dict-match').locator('.chip').allInnerTexts()).every(t => t.trim() === 'BUS')).toBe(true)
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
  await expect(sheet.getByTestId('dict-match').first()).toBeVisible()
  await page.getByTestId('inline-backspace').click()
  await expect(page.getByTestId('inline-dict-input')).toHaveValue('ධම්')
  await page.getByTestId('inline-fts').click()
  await expect(page).toHaveURL(/\/fts\//)
})
