import { test, expect, entries } from './fixtures'

test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } })

test('play recitation from a paragraph', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  const cell = entries(page, 'pali').filter({ has: page.getByTestId('entry-options') }).first()
  await cell.hover()
  await cell.getByTestId('entry-options').click()
  await page.getByText('සජ්ඣායනය අසන්න').click()
  await expect(page.getByTestId('audio-control')).toBeVisible()
  await expect(page.locator('.entry-text.audio-playing').first()).toBeVisible()
  await page.getByTestId('audio-toggle').click()
  await expect(page.locator('.entry-text.audio-playing')).toHaveCount(0)
})

test('play recitation from the tree', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  const row = page.locator('[data-testid=tree-node][data-key="dn-1-1"]')
  await row.hover()
  await row.getByTestId('tree-audio').click()
  await expect(page.getByTestId('audio-control')).toBeVisible()
  await expect(page.locator('.entry-text.audio-playing').first()).toBeVisible()
})
