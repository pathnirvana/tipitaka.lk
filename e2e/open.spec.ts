import { test, expect } from '@playwright/test'

// open.tipitaka.lk (web-open, server -flavor open on the fixture db): projects open-desktop and open-phone.
// The url starts with the pāḷi script; the text of the db (Sinhala script) is shown in it.
const text = '[data-testid="text-tab"]'
const openPanel = async (page: import('@playwright/test').Page) => {
  await page.evaluate(() => window.scrollTo(0, 0)) // small screens: the app bar hides when scrolling down
  await page.getByTestId('panel-toggle').click()
  await expect(page.getByTestId('side-panel')).toBeVisible()
}

test('a url without a script goes to Roman, the default', async ({ page }) => {
  await page.goto('/dn-1-1')
  await expect(page).toHaveURL(/\/latn\/dn-1-1$/)
  await expect(page.locator(`${text} .entry-text.heading`).first()).toContainText('Brahmajālasuttaṃ')
  await expect(page).toHaveTitle(/Brahmajālasuttaṃ < Dīghanikāya \| Buddha Jayanti Tipitaka/)
  await expect(page.locator('html')).toHaveAttribute('data-script', 'latn')
})

test('the text, the tree and the tab are in the script of the url', async ({ page, isMobile }) => {
  await page.goto('/thai/dn-1-1')
  await expect(page.locator(`${text} .entry-text.heading`).first()).toContainText('พฺรหฺมชาลสุตฺตํ')
  await expect(page.locator(text)).not.toContainText(/[඀-෿]/) // no Sinhala letters left
  await expect(page.getByTestId('tabs-bar')).toContainText('พฺรหฺมชาลสุตฺตํ')
  if (!isMobile) await expect(page.getByTestId('tree')).toContainText('ทีฆนิกาย')
  await page.goto('/sinh/dn-1-1') // Sinhala: as stored
  await expect(page.locator(`${text} .entry-text.heading`).first()).toContainText('බ්‍රහ') // with tipitaka.lk's joined letters
})

test('Roman: a sentence starts with a capital, a bold word does not', async ({ page }) => {
  await page.goto('/latn/dn-1-1')
  const para = page.locator(`${text} .entry-text.paragraph`).first()
  await expect(para).toContainText('Evaṃ me sutaṃ')
  const bold = await para.locator('.rt-bold').allInnerTexts()
  expect(bold.length).toBeGreaterThan(0)
  // "... nāḷandaṃ ..." in the middle of a sentence is not capitalised because it is bold
  expect(bold.filter(b => /^[a-zāīūṭḍṇñṅḷṃ]/.test(b)).length).toBeGreaterThan(0)
})

test('the side panel: choosing a script keeps the page', async ({ page, isMobile }) => {
  await page.goto('/latn/dn-1-1')
  if (!isMobile) await expect(page.getByTestId('panel-toggle')).toContainText('Roman') // small screens: the ⋮ alone
  await openPanel(page)
  await page.getByTestId('script-more').click()
  await expect(page.getByTestId('panel-script').locator('button[data-testid^="script-"]:not([data-testid="script-more"])')).toHaveCount(22)
  await page.getByTestId('script-deva').click()
  await expect(page).toHaveURL(/\/deva\/dn-1-1$/)
  await expect(page.locator(`${text} .entry-text.heading`).first()).toContainText('ब्रह्मजालसुत्तं')
  // remembered: a url without a script now goes to it
  await page.goto('/dn-1-1')
  await expect(page).toHaveURL(/\/deva\/dn-1-1$/)
})

test('the side panel: interface language, links', async ({ page }) => {
  await page.goto('/latn/dn-1-1')
  await openPanel(page)
  const panel = page.getByTestId('side-panel')
  await expect(panel).toContainText('Pali script')
  await panel.getByTestId('panel-ui-lang').locator('select').selectOption('th')
  await expect(panel).not.toContainText('Pali script')
  await expect(page.getByTestId('panel-toggle')).not.toHaveAttribute('title', 'Settings')
  await expect(panel.getByTestId('link-sinhala')).toBeVisible()
  await panel.getByTestId('menu-bookmarks').click()
  await expect(page).toHaveURL(/\/latn\/bookmarks$/)
})

test('footnotes (variant readings) in the script of the page', async ({ page }) => {
  await page.goto('/latn/dn-1-1')
  await page.evaluate(() => localStorage.setItem('open.tipitaka.lk-settings-1', JSON.stringify({ footnoteMethod: 'click' })))
  await page.reload()
  const pointer = page.locator(`${text} .fn-pointer`).first()
  await pointer.click()
  const pop = page.getByTestId('footnote-popover')
  await expect(pop).toBeVisible()
  await expect(pop).toContainText(/[a-z]/)
  await expect(pop).not.toContainText(/[඀-෿]/)
  await pointer.click() // closes it
  await expect(pop).toBeHidden()
  // at the end of the page
  await openPanel(page)
  await page.getByTestId('panel-footnotes').locator('select').selectOption('end-page')
  await expect(page.getByTestId('footnote-list').first()).toBeVisible()
  await page.getByTestId('panel-footnotes').locator('select').selectOption('hidden')
  await expect(page.locator(`${text} .fn-pointer`)).toHaveCount(0)
})

test('the link of a paragraph has the script', async ({ page, isMobile }) => {
  test.skip(isMobile, 'clipboard permissions: the desktop project')
  await page.goto('/khmr/dn-1-1')
  await page.locator(`${text} [data-testid="share"]`).first().click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://open.tipitaka.lk/khmr/dn-1-1')
})

test('full text search: a Roman word without diacritics, and the same word in another script', async ({ page }) => {
  await page.goto('/latn/search/bhagava')
  await expect(page.getByTestId('fts-item').first()).toBeVisible()
  await expect(page.getByTestId('searched-words')).toContainText('bhagava…') // the spellings found in the texts (words starting with them)
  await expect(page.getByTestId('fts-item').first().locator('sr').first()).toContainText(/bhagav/i)
  const n = await page.getByTestId('search-message').innerText()
  // the same search typed in Devanagari and in Sinhala script, shown in Roman
  for (const q of ['भगवा', 'භගවා']) {
    await page.goto(`/latn/search/${encodeURIComponent(q)}`)
    await expect(page.getByTestId('fts-item').first().locator('sr').first()).toContainText(/bhagavā/i)
  }
  expect(n).toMatch(/\d+/)
  // a hit opens the text at the paragraph, the words highlighted
  await page.getByTestId('result-link').first().click()
  await expect(page).toHaveURL(/\/latn\/[a-z]+-[\w-]+$/)
  await expect(page.locator(`${text} .rt-highlight, ${text} sr`).first()).toBeVisible()
})

test('full text search: only the mūla, no word no results', async ({ page }) => {
  await page.goto('/thai/search/evam')
  await expect(page.getByTestId('fts-item').first()).toBeVisible()
  expect(await page.locator('[data-testid="fts-item"][data-key^="atta-"]').count()).toBe(0)
  await expect(page.getByTestId('fts-results')).not.toContainText(/[඀-෿]/)
  await page.goto('/thai/search/qqqqzz')
  await expect(page.getByTestId('search-message')).toContainText('qqqqzz')
})

test('the search filter: the parts of the tipitaka as a tree, the mūla only', async ({ page }) => {
  await page.goto('/latn/search/bhagava')
  await expect(page.getByTestId('fts-item').first()).toBeVisible()
  await page.getByTestId('filter-button').click()
  await expect(page.getByTestId('filter-count')).toHaveText(/^(\d+) \/ \1$/)
  await expect(page.getByTestId('filter-tree')).toContainText('Vinayapiṭaka')
  await expect(page.locator('[data-testid="filter-tree"] [data-testid^="filter-atta"]')).toHaveCount(0)
  await page.getByTestId('filter-all').click() // all chosen: clears them
  await expect(page.getByTestId('filter-done')).toBeDisabled()
  await page.locator('label', { has: page.getByTestId('filter-vp') }).click()
  await page.getByTestId('filter-done').click()
  await expect(page.getByTestId('filter-limited')).toHaveText(/^\d+ \/ \d+$/) // the vinaya parts of the fixture
  await expect(page.locator('[data-testid="fts-item"]:not([data-key^="vp-"])')).toHaveCount(0) // only vinaya results stay
  // the two searches have their own filters
  await page.goto('/latn/titles/brahmajala')
  await expect(page.getByTestId('title-result').first()).toBeVisible()
  await expect(page.getByTestId('filter-limited')).toHaveCount(0)
})

test('title search from the search box', async ({ page, isMobile }) => {
  await page.goto('/latn/')
  if (isMobile) await expect(page.getByTestId('search-type-toggle')).toHaveAttribute('data-type', 'title') // small screens: one button for the kind of search
  else await page.getByTestId('search-type-title').click()
  await page.getByTestId('search-input').fill('brahmajala')
  await expect(page).toHaveURL(/\/latn\/titles\/brahmajala$/)
  const hit = page.getByTestId('title-result').first()
  await expect(hit).toContainText('Brahmajālasuttaṃ')
  await hit.getByTestId('result-link').click()
  await expect(page).toHaveURL(/\/latn\/dn-1-1$/)
  // in another script, and with the diacritics
  await page.goto(`/deva/titles/${encodeURIComponent('ब्रह्मजाल')}`)
  await expect(page.getByTestId('title-result').first()).toContainText('ब्रह्मजालसुत्तं')
  await page.goto(`/latn/titles/${encodeURIComponent('brahmajāla')}`)
  await expect(page.getByTestId('title-result').first()).toContainText('Brahmajālasuttaṃ')
})

test('the other editions: links of the side panel and of a paragraph', async ({ page }) => {
  await page.goto('/thai/')
  await openPanel(page)
  const links = page.getByTestId('panel-links').locator('a')
  await expect(links.nth(0)).toContainText('Chaṭṭha Saṅgāyana edition')
  await expect(links.nth(1)).toContainText('BJ Sinhala translation')
  await expect(page.getByTestId('link-cst')).toHaveAttribute('href', 'https://tipitaka.app/thai')
  await expect(page.getByTestId('link-sinhala')).toHaveAttribute('href', 'https://tipitaka.lk')
  // with a text open: the same text there
  await page.goto('/thai/dn-1-1')
  await page.locator(`${text} .entry`).first().waitFor()
  await openPanel(page)
  await expect(page.getByTestId('link-cst')).toHaveAttribute('href', /^https:\/\/tipitaka\.app\/thai\/dn-1#p\d+$/)
  await expect(page.getByTestId('link-sinhala')).toHaveAttribute('href', 'https://tipitaka.lk/dn-1-1/sinh')
  await page.getByTestId('side-panel-close').click()
  // the menu of a paragraph
  const para = page.locator(`${text} .entry`).filter({ has: page.locator('.entry-text.paragraph') }).first()
  await para.hover()
  await para.getByTestId('entry-options').click()
  await expect(page.getByTestId('menu-cst')).toHaveAttribute('href', /^https:\/\/tipitaka\.app\/thai\/dn-1#p\d+$/)
  await expect(page.getByTestId('menu-sinhala')).toHaveAttribute('href', /^https:\/\/tipitaka\.lk\/dn-1-1\/\d+-\d+\/sinh$/)
})

test('tab views: tabs, columns, single', async ({ page, isMobile }) => {
  test.skip(isMobile, 'two columns: the desktop project')
  await page.goto('/latn/dn-1-1')
  await page.locator(`${text} .entry`).first().waitFor()
  // a second text: found by its title, a result opens in a new tab
  await page.getByTestId('search-type-title').click()
  await page.getByTestId('search-input').fill('yamakavagg')
  await page.getByTestId('result-link').first().click()
  await expect(page).toHaveURL(/\/latn\/kn-dhp-1$/)
  await expect(page.getByTestId('tabs-bar').locator('[role="tab"]')).toHaveCount(2)
  await openPanel(page)
  const view = page.getByTestId('panel-tab-view').locator('select')
  await expect(view.locator('option')).toHaveCount(3)
  await view.selectOption('columns')
  await expect(page.getByTestId('column')).toHaveCount(2)
  await expect(page.getByTestId('column').first()).toContainText('Brahmajālasuttaṃ')
  await view.selectOption('single')
  await expect(page.getByTestId('columns')).toHaveCount(0)
  await expect(page.locator(`${text}:visible`)).toHaveCount(1)
})
