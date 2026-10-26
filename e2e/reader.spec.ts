import { test, expect, entries, isMobile, openDrawerIfClosed, glossesLoaded } from './fixtures'
import type { Page } from '@playwright/test'

const node = async (page: Page, key: string) => (await (await page.request.get(`/api/q/tree.node?key=${key}`)).json())[0]

test('welcome page, open a sutta from the tree', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('ශ්‍රී ලංකා තිපිටක පෙළ, අටුවා සහ සිංහල පරිවර්තනය')).toBeVisible()
  await openDrawerIfClosed(page)
  const tree = page.getByTestId('tree')
  await tree.locator('[data-key="dn"] > [data-testid=tree-toggle-branch]').click() // expand dn (sp is open by default)
  await tree.locator('[data-key="dn-1"] > [data-testid=tree-toggle-branch]').click()
  await tree.locator('[data-key="dn-1-1"] [data-testid=tree-label]').click()
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
  page.on('request', r => { if (/\/api\/q\/text\.(entries|footnotes)/.test(r.url())) apiCalls.push(r.url()) }) // alignments load separately
  await page.goto('/dn-1-1/pali')
  await expect(entries(page, 'pali').first()).toBeVisible()
  await expect(page.locator('#ssr')).toHaveCount(0)
  expect(apiCalls).toEqual([]) // text came from #ssr-data
})

test('back / forward switch between open suttas (A7)', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await expect(entries(page, 'pali').first()).toBeVisible()
  await openDrawerIfClosed(page)
  await page.getByTestId('tree').locator('[data-key="kn"] > [data-testid=tree-toggle-branch]').click()
  await page.getByTestId('tree').locator('[data-key="kn-dhp"] > [data-testid=tree-toggle-branch]').click()
  await page.getByTestId('tree').locator('[data-key="kn-dhp-1"] [data-testid=tree-label]').click()
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
    await expect(entries(page, 'sinh')).toHaveCount(0) // small screens show one column (v2)
    await page.getByTestId('panel-toggle').click()
    const panel = page.getByTestId('side-panel')
    await expect(panel.getByTestId('columns-2')).toHaveCount(0) // no "both" on small screens
    await panel.getByTestId('columns-1').click()
    await expect(entries(page, 'pali')).toHaveCount(0)
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
  await glossesLoaded(page)
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

test('each tab keeps its own scroll position', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await page.locator('.entry-text.heading [data-testid="atuwa-link"]').first().click()
  await expect(page.getByTestId('tab')).toHaveCount(2)
  const scrollY = () => page.evaluate(() => Math.round(window.scrollY))
  await page.getByTestId('tab').first().click() // the mula (the fixture atuwa is too short to scroll)
  await page.evaluate(() => window.scrollTo(0, 200))
  await expect.poll(scrollY).toBe(200)
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))) // the scroll event is delivered
  await page.evaluate(() => window.scrollTo(0, 190)) // small screens show the app bar (with the tabs) again on scrolling up
  await expect.poll(scrollY).toBe(190)
  // dispatched: before a click, WebKit scrolls the sticky tab strip "into view" (to the top of the page), which a tap does not
  await page.getByTestId('tab').nth(1).dispatchEvent('click')
  await expect.poll(scrollY).toBe(0)
  await page.getByTestId('tab').first().dispatchEvent('click')
  await expect.poll(scrollY).toBe(190)
})

test('tree: keyboard, links, following the open sutta without closing other branches', async ({ page }) => {
  test.skip(isMobile(page), 'keyboard')
  await page.goto('/dn-1-1/pali')
  await openDrawerIfClosed(page)
  const tree = page.getByTestId('tree')
  await expect(tree.locator('[aria-current="page"]')).toHaveAttribute('href', '/dn-1-1')
  await expect(tree.locator('[data-key="dn-1-1"] [data-testid=tree-label]')).toHaveAttribute('href', '/dn-1-1')
  const kn = tree.locator('[data-key="kn"]')
  await kn.locator('[data-testid=tree-toggle-branch]').focus()
  await page.keyboard.press('ArrowRight')
  await expect(kn.locator('[data-testid=tree-toggle-branch]')).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(kn.locator('[data-testid=tree-toggle-branch]')).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('ArrowRight')
  await tree.locator('[data-key="kn-dhp"] > [data-testid=tree-toggle-branch]').click()
  await tree.locator('[data-key="kn-dhp-1"] [data-testid=tree-label]').click()
  await expect(page).toHaveURL(/\/kn-dhp-1$/)
  await page.getByTestId('tab').first().click() // back to dn-1-1: its branch opens again, kn stays open
  await expect(tree.locator('[aria-current="page"]')).toHaveAttribute('href', '/dn-1-1')
  await expect(kn.locator('[data-testid=tree-toggle-branch]')).toHaveAttribute('aria-expanded', 'true')
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
  await panel.getByTestId('theme-dark').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await panel.getByTestId('panel-font-up').click()
  await expect(panel.getByTestId('panel-font-size')).toHaveText('+1')
  await expect(page.getByTestId('text-tab').first()).toHaveAttribute('style', /font-size: 19px/)
  await panel.getByTestId('menu-bookmarks').click()
  await expect(page).toHaveURL(/\/bookmarks$/)
  await expect(panel).toHaveCount(0)
})

test('side panel: below the app bar, pinned as a column on wide screens', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await page.getByTestId('panel-toggle').click()
  const panel = page.getByTestId('side-panel')
  expect((await panel.boundingBox())!.y).toBeGreaterThanOrEqual((await page.getByTestId('app-bar').boundingBox())!.height - 1)
  if (isMobile(page)) {
    await expect(panel.getByTestId('side-panel-pin')).toHaveCount(0) // no room for a column
    return
  }
  await panel.getByTestId('side-panel-pin').click()
  await expect(panel).toHaveAttribute('data-pinned', 'true')
  await page.locator('main').click({ position: { x: 600, y: 300 } }) // the text can be used with the panel open
  await expect(panel).toBeVisible()
  await page.reload() // stays pinned
  await expect(page.getByTestId('side-panel')).toHaveAttribute('data-pinned', 'true')
  await page.getByTestId('side-panel-close').click() // unpins
  await expect(page.getByTestId('side-panel')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('side-panel')).toHaveCount(0)
})

test('the tab strip is at the top of the text, left aligned', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  const tab = (await page.getByTestId('tab').first().boundingBox())!
  const bar = (await page.getByTestId('tabs-bar').boundingBox())!
  expect(tab.x - bar.x).toBeLessThan(5)
  expect(Math.abs(bar.y - (await page.getByTestId('app-bar').boundingBox())!.height)).toBeLessThan(2)
})

test('alignment view: hovering a pali word highlights its sinhala rendering', async ({ page }) => {
  test.skip(isMobile(page), 'one column on small screens, no hover')
  await page.addInitScript(() => localStorage.setItem('tipitaka.lk-settings-2', JSON.stringify({ alignmentView: true })))
  await page.goto('/dn-1-1')
  // dn-1 0:6 is aligned "... 2>1,2 ..." (fixture e2e/fixtures/alignments/dn-1.json)
  const pair = page.locator('[data-testid="text-tab"]:visible [data-eind="0-6"]')
  await pair.locator('[data-lang="pali"] [data-w="2"]').hover()
  await expect(pair.locator('[data-lang="sinh"] [data-w="1"]')).toHaveClass(/aligned/)
  await expect(pair.locator('[data-lang="sinh"] [data-w="2"]')).toHaveClass(/aligned/)
  await expect(pair.locator('[data-lang="sinh"] [data-w="0"]')).not.toHaveClass(/aligned/)
  await pair.locator('[data-lang="sinh"] [data-w="3"]').hover() // and from the sinhala side back to pali word 1
  await expect(pair.locator('[data-lang="pali"] [data-w="1"]')).toHaveClass(/aligned/)
  await expect(pair.locator('[data-lang="pali"] [data-w="2"]')).not.toHaveClass(/aligned/)
})
