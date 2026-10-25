import { test, expect, entries, glossesLoaded } from './fixtures'
import type { Page } from '@playwright/test'

const SAVATTHI = /සාවත්\u200d?ථී/ // (the joiner of the bandi letters is shown)

/** the paragraph menu of the first pali entry that has one */
async function entryMenu(page: Page, item: 'menu-setting') {
  await glossesLoaded(page)
  const cell = entries(page, 'pali').filter({ has: page.getByTestId('entry-options') }).first()
  await cell.hover()
  await cell.getByTestId('entry-options').click()
  await page.getByTestId(item).click()
}

test('paragraph menu: the setting of a sutta (place, names in the paragraph), a name opens its page', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await entryMenu(page, 'menu-setting')
  await expect(page.getByTestId('setting-place')).toContainText('රාජගහ')
  await expect(page.getByTestId('setting-map-link')).toBeVisible()
  await page.getByTestId('dict-tab-dict').click() // the tabs of the pane stay
  await expect(page.getByTestId('inline-dict-input')).toBeVisible()
  await page.getByTestId('dict-tab-setting').click()
  await page.getByTestId('setting-place').getByRole('link').first().click()
  await expect(page).toHaveURL(/\/names\/rajagaha/)
  await expect(page.getByTestId('name-title')).toContainText('රාජගහ')
  await expect(page.getByTestId('name-settings-place')).toBeVisible()
})

test('names: search in roman or sinhala letters, type filter', async ({ page }) => {
  await page.goto('/names')
  await page.getByTestId('names-search').fill('සාවත්ථි')
  await expect(page.getByTestId('names-list').getByRole('link').first()).toContainText(SAVATTHI)
  await page.getByTestId('names-search').fill('savatth')
  await expect(page.getByTestId('names-list').getByRole('link').first()).toContainText(SAVATTHI)
  await page.getByTestId('names-search').fill('')
  await page.getByTestId('names-type-person').click()
  await expect(page.getByTestId('names-list').getByRole('link').first()).toBeVisible()
})

test('map: a place card with the suttas taught there, a journey with its stops', async ({ page }) => {
  await page.goto('/map?place=savatthi')
  await expect(page.getByTestId('map-card-name')).toContainText(SAVATTHI)
  await expect(page.getByTestId('map-card').getByRole('link').nth(1)).toBeVisible()
  await page.getByTestId('map-journey-mahaparinibbana').click()
  await expect(page).toHaveURL(/journey=mahaparinibbana/)
  await expect(page.getByTestId('map-journey-stops').locator('li').first()).toBeVisible()
})

test('an unknown name', async ({ page }) => {
  await page.goto('/names/no-such-name')
  await expect(page.getByText('මෙම නම හමු නොවිණි.')).toBeVisible()
})
