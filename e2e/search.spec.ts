import { test, expect, entries, isMobile } from './fixtures'
import type { Page } from '@playwright/test'

const seedSearch = (page: Page, value: unknown) =>
  page.addInitScript(v => localStorage.setItem('tipitaka.lk-search-settings-1', JSON.stringify(v)), value)
const results = (page: Page) => page.getByTestId('title-result')

test('title search in sinhala with zwj, restricted to the sinhala column (A32)', async ({ page }) => {
  await seedSearch(page, { filter: { title: { keys: ['dn-1'], columns: [1] } } })
  await page.goto('/title/බ්‍රහ්මජාල')
  await expect(results(page).first()).toBeVisible()
  await expect(page.locator('[data-testid="title-result"][data-key="dn-1-1"]')).toBeVisible()
  await expect(page.getByTestId('search-message')).toContainText('ගැළපෙන වචන')
})

test('title search with singlish and opening a result', async ({ page }) => {
  await page.goto('/title/brahmajala')
  await expect(page.locator('[data-testid="title-result"][data-key="dn-1-1"]')).toBeVisible()
  await page.locator('[data-testid="title-result"][data-key="dn-1-1"] [data-testid="tipitaka-link"]').click()
  await expect(page).toHaveURL(/\/dn-1-1$/)
})

test('title search filter an-1 does not include an-10 (A5)', async ({ page }) => {
  await seedSearch(page, { filter: { title: { keys: ['an-1'], columns: [0, 1] } } })
  await page.goto('/title/වග්ග')
  await expect(results(page).first()).toBeVisible()
  const keys = await results(page).evaluateAll(els => els.map(e => e.getAttribute('data-key')))
  expect(keys.length).toBeGreaterThan(0)
  expect(keys.every(k => k === 'an-1' || k!.startsWith('an-1-'))).toBe(true)
})

test('title search input rules', async ({ page }) => {
  await page.goto('/title/a b')
  await expect(page.getByTestId('search-error')).toBeVisible()
})

test('typing in the search box routes to the search page', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('search-input').fill('brahmajala')
  await expect(page).toHaveURL(/\/title\/brahmajala/)
  await page.getByTestId('search-type').click()
  await page.getByTestId('search-type-dict').click()
  await expect(page).toHaveURL(/\/dict\/brahmajala/)
})

test('full text search: results, opening one highlights the words', async ({ page }) => {
  await page.goto('/fts/බ්‍රහ්මජාල')
  const item = page.getByTestId('fts-item').first()
  await expect(item).toBeVisible()
  await expect(item.locator('sr').first()).toBeVisible()
  await expect(page.getByTestId('search-message')).toContainText('හමුවිය')
  await item.getByTestId('tipitaka-link').click()
  await expect(page).toHaveURL(/\/(atta-)?dn-1/)
  await expect(page.locator('[data-testid="text-tab"]:visible .rt-highlight').first()).toBeVisible()
})

test('full text search phrase / near / OR / prefix', async ({ page }) => {
  for (const url of ['/fts/එවං මෙ සුතං/1-1-10', '/fts/එවං සුතං/0-0-5', '/fts/කුසල OR අකුසල', '/fts/^එවං', '/fts/පඨම*']) {
    await page.goto(url)
    await expect(page.getByTestId('search-message'), url).toBeVisible()
    await expect(page.getByTestId('fts-error')).toHaveCount(0)
  }
  await page.goto('/fts/එවං සුතං/0-0-5')
  await expect(page.getByTestId('word-distance')).toHaveValue('5')
  await expect(page.getByTestId('phrase-0')).toBeChecked()
})

test('full text search rejects NOT with a message', async ({ page }) => {
  await page.goto('/fts/කුසල NOT අකුසල')
  await expect(page.getByTestId('search-error')).toContainText('NOT')
})

test('full text search filter (A5) and language column', async ({ page }) => {
  await seedSearch(page, { filter: { fts: { keys: ['an-10'], columns: [1] } } })
  await page.goto('/fts/තථාගත')
  await expect(page.getByTestId('fts-item').first()).toBeVisible()
  const keys = await page.getByTestId('fts-item').evaluateAll(els => els.map(e => [e.getAttribute('data-key'), e.getAttribute('data-lang')]))
  expect(keys.every(([k, l]) => k!.startsWith('an-10') && l === 'sinh')).toBe(true)
})

test('full text search groups expand', async ({ page }) => {
  await page.goto('/fts/භික්ඛවෙ')
  const toggle = page.getByTestId('fts-group-toggle').first()
  await expect(toggle).toBeVisible()
  const group = page.getByTestId('fts-group').filter({ has: page.getByTestId('fts-group-toggle') }).first()
  await expect(group.getByTestId('fts-item')).toHaveCount(1)
  await toggle.click()
  await expect.poll(() => group.getByTestId('fts-item').count()).toBeGreaterThan(1)
})

test('full text search: going back and opening a result in an already open sutta opens it in a new tab (v2)', async ({ page }) => {
  await page.goto('/fts/භික්ඛවෙ')
  const link = page.getByTestId('tipitaka-link').first()
  await link.click()
  await expect(page).not.toHaveURL(/\/fts\//)
  const url = page.url()
  await page.goBack()
  await expect(page).toHaveURL(/\/fts\//)
  await link.click()
  await expect(page).toHaveURL(url)
  await expect(page.getByTestId('tab')).toHaveCount(2)
})

test('full text search in singlish: the sinhala words of the texts are searched and shown', async ({ page }) => {
  await page.goto('/fts/bhikkhave')
  await expect(page.getByTestId('fts-item').first()).toBeVisible()
  await expect(page.getByTestId('singlish-hint')).toContainText('සෙවූ සිංහල වචන')
  await expect(page.getByTestId('singlish-hint')).toContainText('භික්ඛවෙ')
  await expect(page.getByTestId('fts-item').first().locator('sr').first()).toBeVisible()
  // a phrase of two singlish words
  await page.goto('/fts/evan me/1-1-10')
  await expect(page.getByTestId('fts-item').first()).toBeVisible()
  await expect(page.getByTestId('fts-error')).toHaveCount(0)
  // no sinhala word for it
  await page.goto('/fts/qxzvbnm')
  await expect(page.getByTestId('search-message')).toContainText('හමු නොවිණි')
})

test('singlish full text search suggests sinhala letters; results open with the default columns', async ({ page }) => {
  await page.goto('/fts/bhikkhave')
  await expect(page.getByTestId('singlish-hint')).toBeVisible()
  await page.goto('/fts/භික්ඛවෙ')
  await expect(page.getByTestId('fts-item').first()).toBeVisible()
  await expect(page.getByTestId('singlish-hint')).toHaveCount(0)
  await page.getByTestId('fts-item').first().getByTestId('tipitaka-link').click()
  if (!isMobile(page)) await expect(entries(page, 'sinh').first()).toBeVisible() // both columns (the default), not only the hit's
  await expect(entries(page, 'pali').first()).toBeVisible()
})

test('search filter dialog: parts, columns, never nothing', async ({ page }) => {
  await page.goto('/fts/ධම්ම')
  await page.getByTestId('filter-button').click()
  await expect(page.getByTestId('filter-count')).toHaveText(/^(\d+) \/ \1$/)
  await page.getByTestId('filter-all').click() // all chosen: clears them
  await expect(page.getByTestId('filter-done')).toBeDisabled()
  await page.locator('label', { has: page.getByTestId('filter-vp') }).click()
  await expect(page.getByTestId('filter-done')).toBeEnabled()
  await page.getByTestId('filter-col-0').click() // pali off (sinhala stays)
  await expect(page.getByTestId('filter-col-0')).toHaveAttribute('aria-pressed', 'false')
  await page.getByTestId('filter-col-1').click() // the last column can not be turned off
  await expect(page.getByTestId('filter-col-1')).toHaveAttribute('aria-pressed', 'true')
  await page.getByTestId('filter-done').click()
  await expect(page.getByTestId('filter-button')).toContainText('සීමා වී ඇත')
})
