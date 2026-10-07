import { test, expect, entries, isMobile, openDrawerIfClosed } from './fixtures'
import type { Page } from '@playwright/test'

const node = async (page: Page, key: string) => (await (await page.request.get(`/api/q/tree.node?key=${key}`)).json())[0]

test('welcome page, open a sutta from the tree', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('ශ්‍රී ලංකා තිපිටක පෙළ, අටුවා සහ සිංහල පරිවර්තනය')).toBeVisible()
  await openDrawerIfClosed(page)
  const tree = page.getByTestId('tree')
  await tree.getByLabel('dn', { exact: true }).click() // expand dn (sp is open by default)
  await tree.getByLabel('dn-1', { exact: true }).click()
  await tree.locator('[data-key="dn-1-1"] span.pl-1').click()
  await expect(page).toHaveURL(/\/dn-1-1$/)
  await expect(page).toHaveTitle(/බ්‍රහ්මජාල.* < .* \| බුද්ධ ජයන්ති ත්‍රිපිටකය/)
  await expect(page.getByTestId('tab')).toHaveCount(1)
})

test('deep link with language opens only that column', async ({ page }) => {
  await page.goto('/dn-1-1/sinh')
  await expect(page.locator('.entry-text.heading', { hasText: 'බ්‍රහ්මජාල සූත්‍රය' })).toBeVisible()
  await expect(entries(page, 'pali')).toHaveCount(0)
  await expect(entries(page, 'sinh').first()).toBeVisible()
})

test('deep link with an entry index starts at that entry', async ({ page }) => {
  await page.goto('/dn-1/1-3/pali')
  const first = page.locator('[data-testid="text-tab"]:visible [data-eind]').first()
  await expect(first).toHaveAttribute('data-eind', '1-3')
  await page.getByTestId('load-prev').click()
  await expect(page.locator('[data-testid="text-tab"]:visible [data-eind]').first()).toHaveAttribute('data-eind', '1-0')
  await page.getByTestId('load-prev').click()
  await expect(page.locator('[data-testid="text-tab"]:visible [data-eind]').first()).toHaveAttribute('data-eind', '0-0')
})

test('server rendered article is shown without javascript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false })
  const page = await ctx.newPage()
  const res = await page.goto('/dn-1-1/sinh')
  expect(res?.status()).toBe(200)
  await expect(page.locator('#ssr')).toContainText('බ්‍රහ්මජාල සූත්‍රය')
  await expect(page).toHaveTitle(/\| බුද්ධ ජයන්ති ත්‍රිපිටකය/)
  expect(await page.locator('link[rel=canonical]').getAttribute('href')).toBe('https://tipitaka.lk/dn-1-1/sinh')
  expect(await page.locator('#ssr-data').count()).toBe(1)
  await ctx.close()
})

test('the reader renders from the server data without a loading state and removes the article', async ({ page }) => {
  const apiCalls: string[] = []
  page.on('request', r => { if (r.url().includes('/api/q/text.')) apiCalls.push(r.url()) })
  await page.goto('/dn-1-1/pali')
  await expect(entries(page, 'pali').first()).toBeVisible()
  await expect(page.locator('#ssr')).toHaveCount(0)
  expect(apiCalls).toEqual([]) // text came from #ssr-data
})

test('back / forward switch between open suttas (A7)', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await expect(entries(page, 'pali').first()).toBeVisible()
  await openDrawerIfClosed(page)
  await page.getByTestId('tree').getByLabel('kn', { exact: true }).click()
  await page.getByTestId('tree').getByLabel('kn-dhp', { exact: true }).click()
  await page.getByTestId('tree').locator('[data-key="kn-dhp-1"] span.pl-1').click()
  await expect(page).toHaveURL(/\/kn-dhp-1$/)
  await expect(page.getByTestId('tab')).toHaveCount(2)
  await page.goBack()
  await expect(page).toHaveURL(/\/dn-1-1/)
  await expect(page.locator('[data-testid="tab"][aria-selected="true"]')).toContainText('බ්')
  await page.goForward()
  await expect(page).toHaveURL(/\/kn-dhp-1$/)
  await expect(page.locator('[data-testid="tab"][aria-selected="true"]')).toContainText('යමක')
})

test('unknown sutta key shows not found with a 404 status', async ({ page }) => {
  const res = await page.goto('/no-such-key/pali')
  expect(res?.status()).toBe(404)
  await expect(page.getByTestId('not-found')).toBeVisible()
})

test('column selector', async ({ page }) => {
  await page.goto('/dn-1-1')
  if (isMobile(page)) {
    await expect(entries(page, 'sinh')).toHaveCount(0) // the default "both" falls back to one column on small screens
    await page.getByTestId('panel-toggle').click()
    const panel = page.getByTestId('side-panel')
    await panel.getByTestId('columns-1').click()
    await expect(entries(page, 'pali')).toHaveCount(0)
    await panel.getByTestId('columns-2').click() // chosen explicitly -> both columns even on a small screen
    await expect(entries(page, 'pali').first()).toBeVisible()
    await expect(entries(page, 'sinh').first()).toBeVisible()
    return
  }
  await expect(entries(page, 'pali').first()).toBeVisible()
  await expect(entries(page, 'sinh').first()).toBeVisible()
  await page.getByTestId('columns-0').click()
  await expect(entries(page, 'sinh')).toHaveCount(0)
  await page.getByTestId('columns-1').click()
  await expect(entries(page, 'pali')).toHaveCount(0)
})

test('pali only files have no sinhala column', async ({ page }) => {
  await page.goto('/ap-pat/sinh')
  await expect(entries(page, 'pali').first()).toBeVisible()
  await expect(entries(page, 'sinh')).toHaveCount(0)
})

test('atuwa files have no page numbers or scans, atuwa links work', async ({ page }) => {
  await page.goto('/atta-dn-1-1/pali')
  await expect(entries(page, 'pali').first()).toBeVisible()
  await expect(page.getByTestId('page-number')).toHaveCount(0)
  await page.locator('.entry-text.heading [data-testid="atuwa-link"]').first().click()
  await expect(page).toHaveURL(/\/dn-1-1$/)
})

test('page numbers open the scanned page', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await page.getByTestId('page-number').first().click()
  const img = page.getByTestId('scan-img').first()
  await expect(img).toBeVisible()
  expect(await img.getAttribute('src')).toMatch(/^https:\/\/pitaka\.lk\/bjt\/newbooks\/10\/DN1_Page_\d{3}\.jpg$/)
})

test('infinite scroll loads more pages', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  const sections = page.locator('[data-testid="text-tab"]:visible section.page')
  await expect(sections).toHaveCount(2)
  await page.getByTestId('next-section').scrollIntoViewIfNeeded()
  await expect.poll(() => sections.count()).toBeGreaterThan(2)
})

test('next / previous sutta opens the new sutta at its start (A36)', async ({ page }) => {
  await page.goto('/kn-dhp-1/5-2/pali')
  await expect(entries(page, 'pali').first()).toBeVisible()
  if (isMobile(page)) await page.getByTestId('panel-toggle').click()
  await page.locator('[data-testid="next-sutta"]:visible').first().click()
  await expect(page).not.toHaveURL(/kn-dhp-1\b/)
  const key = new URL(page.url()).pathname.slice(1)
  const n = await node(page, key)
  await expect(page.locator('[data-testid="text-tab"]:visible [data-eind]').first()).toHaveAttribute('data-eind', `${n.page_idx}-${n.entry_idx}`)
})

test('tabs: open, switch, close; closing the last goes home', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await expect(page.getByTestId('tab')).toHaveCount(1)
  await page.locator('.entry-text.heading [data-testid="atuwa-link"]').first().click() // opens atuwa in a new tab
  await expect(page.getByTestId('tab')).toHaveCount(2)
  await page.getByTestId('tab').first().click()
  await expect(page).toHaveURL(/\/dn-1-1/)
  await page.getByTestId('tab-close').first().click()
  await page.getByTestId('tab-close').first().click()
  await expect(page).toHaveURL(/\/$/)
})

test('copy link from the entry menu', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium' || isMobile(page), 'clipboard permissions are chromium only')
  await page.goto('/dn-1-1/pali')
  const cell = entries(page, 'pali').filter({ has: page.getByTestId('entry-options') }).first()
  await cell.hover()
  await cell.getByTestId('entry-options').click()
  await page.getByText('link එකක් ලබාගන්න').click()
  await expect(page.getByTestId('snackbar')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^https:\/\/tipitaka\.lk\/dn-1-1\/\d+-\d+\/pali$/)
})

test('opening an already open sutta re-uses its tab', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await page.locator('.entry-text.heading [data-testid="atuwa-link"]').first().click()
  await expect(page.getByTestId('tab')).toHaveCount(2)
  await page.locator('[data-testid="text-tab"]:visible .entry-text.heading [data-testid="atuwa-link"]').first().click() // back to the mula
  await expect(page.getByTestId('tab')).toHaveCount(2)
  await expect(page).toHaveURL(/\/dn-1-1$/)
})

test('tabs list: switch and close other tabs', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await page.locator('.entry-text.heading [data-testid="atuwa-link"]').first().click()
  await expect(page.getByTestId('tab')).toHaveCount(2)
  await page.getByTestId('tabs-list').click()
  const menu = page.getByTestId('tabs-list-menu')
  await expect(menu.getByTestId('tabs-list-item')).toHaveCount(2)
  await page.getByTestId('close-other-tabs').click()
  await expect(page.getByTestId('tab')).toHaveCount(1)
})

test('side panel: dark mode, font size, links', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await page.getByTestId('panel-toggle').click()
  const panel = page.getByTestId('side-panel')
  await panel.getByTestId('panel-dark').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await panel.getByTestId('panel-font-up').click()
  await expect(panel.getByTestId('panel-font-size')).toHaveText('+1')
  await expect(page.getByTestId('text-tab').first()).toHaveAttribute('style', /font-size: 17px/)
  await panel.getByTestId('menu-bookmarks').click()
  await expect(page).toHaveURL(/\/bookmarks$/)
  await expect(panel).toHaveCount(0)
})
