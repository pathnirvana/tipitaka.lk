import { test, expect, entries, isMobile, openDrawerIfClosed, glossesLoaded } from './fixtures'
import type { Page } from '@playwright/test'

const SAVATTHI = /සාවත්\u200d?ථී/

/** the paragraph menu of the first pali entry that has one: "read with the aṭṭhakathā" */
async function readAlongside(page: Page) {
  await glossesLoaded(page)
  const cell = entries(page, 'pali').filter({ has: page.getByTestId('entry-options') }).first()
  await cell.hover()
  await cell.getByTestId('entry-options').click()
  await page.getByTestId('menu-alongside').click()
}
async function tabView(page: Page, v: 'single' | 'tabs' | 'columns') {
  await page.goto('/settings')
  await page.getByTestId(`tab-view-${v}`).check()
}

test('paragraph menu: one item reads the aṭṭhakathā alongside, in the columns view (from any view)', async ({ page }) => {
  await tabView(page, 'single')
  await page.goto('/dn-1-1/pali')
  await readAlongside(page)
  await expect(page.getByTestId('column')).toHaveCount(2)
  await expect(page).toHaveURL(/\/dn-1-1/) // the mūla stays the active text
  await expect(page.getByTestId('menu-links')).toHaveCount(0)
  await page.goto('/settings')
  await expect(page.getByTestId('tab-view-columns')).toBeChecked()
})

test('one sutta at a time: opening another replaces it', async ({ page }) => {
  await tabView(page, 'single')
  await page.goto('/kn-dhp-1/pali')
  await openDrawerIfClosed(page)
  const tree = page.getByTestId('tree')
  await tree.locator('[data-key="dn"] > [data-testid=tree-toggle-branch]').click()
  await tree.locator('[data-key="dn-1"] > [data-testid=tree-toggle-branch]').click()
  await tree.locator('[data-key="dn-1-1"] [data-testid=tree-label]').click() // (the tree opens a new tab in the tabs view)
  await expect(page).toHaveURL(/\/dn-1-1$/)
  await expect(page.getByTestId('tab')).toHaveCount(1)
})

test('the Setting tab follows the active text (a new tab, a tab switched to)', async ({ page }) => {
  await page.goto('/kn-dhp-1/pali')
  await expect(entries(page, 'pali').first()).toBeVisible()
  const cell = entries(page, 'pali').filter({ has: page.getByTestId('entry-options') }).first()
  await cell.hover()
  await cell.getByTestId('entry-options').click()
  await page.getByTestId('menu-setting').click()
  await expect(page.getByTestId('setting-place')).toContainText(SAVATTHI)
  await openDrawerIfClosed(page)
  const tree = page.getByTestId('tree')
  await tree.locator('[data-key="dn"] > [data-testid=tree-toggle-branch]').click()
  await tree.locator('[data-key="dn-1"] > [data-testid=tree-toggle-branch]').click()
  await tree.locator('[data-key="dn-1-1"] [data-testid=tree-label]').click()
  await expect(page.getByTestId('tab')).toHaveCount(2)
  await expect(page.getByTestId('setting-place')).toContainText('රාජගහ')
  if (isMobile(page)) await page.keyboard.press('Escape')
  await page.getByTestId('tab').first().click()
  await expect(page.getByTestId('setting-place')).toContainText(SAVATTHI)
})

test('the aṭṭhakathā pane: the passage justified, at the reading size', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await page.locator('[data-testid="text-tab"]:visible [data-lang="pali"] .gl').nth(3).click()
  await page.getByTestId('dict-tab-atta').click()
  const p = page.getByTestId('gloss-item').first().locator('.entry-text').first()
  await expect(p).toHaveCSS('text-align', 'justify')
  expect(parseFloat(await p.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThan(18)
})

test('columns: the texts side by side, the text stays active, closing a column', async ({ page }) => {
  test.skip(isMobile(page), 'two columns of a phone are tested in the single view test')
  await tabView(page, 'columns')
  await page.goto('/dn-1-1/pali')
  await readAlongside(page)
  const cols = page.getByTestId('column')
  await expect(cols).toHaveCount(2)
  await expect(page).toHaveURL(/\/dn-1-1/) // the mūla stays the active text
  await expect(cols.nth(1).locator('[data-eind]').first()).toBeVisible()
  await cols.nth(1).getByTestId('column-close').click()
  await expect(cols).toHaveCount(0)
  await expect(page.getByTestId('text-tab')).toHaveCount(1)
})

test('underlined words: the aṭṭhakathā of a word in the pane, read alongside from there', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  const gl = page.locator('[data-testid="text-tab"]:visible [data-lang="pali"] .gl').first()
  await expect(gl).toBeVisible()
  await gl.click()
  await expect(page.getByTestId('inline-dict')).toBeVisible() // the dictionary as before
  await expect(page.getByTestId('dict-tab-atta')).toContainText(/\(\d+\)/)
  await page.getByTestId('dict-tab-atta').click()
  const item = page.getByTestId('gloss-item').first()
  await expect(item.locator('.gl-hover').first()).toBeVisible() // the lemma
  await item.getByTestId('gloss-alongside').click()
  await expect(page.getByTestId('column')).toHaveCount(2)
  await expect(page.getByTestId('tabs-bar')).toHaveCount(0) // one level: the columns' headers, the list in the last one
  await page.getByTestId('tabs-list').click()
  await expect(page.getByTestId('tabs-list-item')).toHaveCount(2)
})

test('underlines can be turned off', async ({ page }) => {
  await page.goto('/settings')
  await page.getByTestId('setting-glossUnderline').uncheck()
  await page.goto('/dn-1-1/pali')
  await expect(entries(page, 'pali').first()).toBeVisible()
  await expect(page.locator('.gl')).toHaveCount(0)
})

test('columns: the aṭṭhakathā follows the mūla while scrolling, hovering highlights both sides', async ({ page }) => {
  test.skip(isMobile(page), 'wheel')
  await tabView(page, 'columns')
  await page.goto('/dn-1-1/pali')
  await readAlongside(page)
  const panes = page.locator('[data-pane]')
  await expect(panes).toHaveCount(2)
  await expect(panes.nth(1).locator('.gl').first()).toBeVisible()
  const top = (i: number) => panes.nth(i).evaluate(el => el.scrollTop)
  const before = await top(1)
  await panes.nth(0).hover()
  await page.mouse.wheel(0, 900)
  await expect.poll(() => top(0)).toBeGreaterThan(0)
  await expect.poll(() => top(1)).not.toBe(before)
  const g = (await panes.nth(1).locator('.gl').first().getAttribute('data-g'))!.split(' ')[0]
  await panes.nth(1).locator(`.gl[data-g~="${g}"]`).first().hover()
  await expect(panes.nth(0).locator(`.gl[data-g~="${g}"]`).first()).toHaveClass(/gl-hover/)
})
