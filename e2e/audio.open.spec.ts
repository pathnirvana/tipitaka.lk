import Database from 'better-sqlite3'
import { test, expect } from './fixtures'

// the recitation on open.tipitaka.lk (projects open-*): the same recordings and timing files as tipitaka.lk, which refer
// to the stored (Sinhala script) text; the chanted word is marked in the script of the page
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } })
const text = '[data-testid="text-tab"]:visible'

async function stubTimings(page: import('@playwright/test').Page) {
  // one <label>.json for the recordings of dn-1: every chanted entry 0.4 s long, 0.5 s apart, word 0 then word 1
  const db = new Database('e2e/fixtures/db/text.db', { readonly: true })
  const rows = db.prepare(`SELECT e.audio_ph FROM entry e JOIN file f ON f.id = e.file_id WHERE f.name = 'dn-1' AND e.audio_idx IS NOT NULL ORDER BY e.audio_idx`).all() as { audio_ph: string }[]
  db.close()
  const doc = { v: 2, tok: 'v1', audio: 'x.m4a', dur: 600, entries: rows.map((r, i) => ({ ph: r.audio_ph, s: i * 50, e: i * 50 + 40, t: '0:0-10,1:10-40' })) }
  await page.route(/cdn\.tipitaka\.lk\/.*[^s]\.json$/, r => r.fulfill({ json: doc, headers: { 'Access-Control-Allow-Origin': '*' } }))
}

test('a paragraph is chanted: the bar in the language of the interface, the word marked in the script of the page', async ({ page }) => {
  await stubTimings(page)
  await page.goto('/thai/dn-1-1')
  const para = page.locator(`${text} [data-eind="0-6"] .entry`)
  await para.hover()
  await para.getByTestId('entry-options').click()
  await expect(page.getByTestId('menu-audio')).toContainText('Listen to the recitation')
  await page.getByTestId('menu-audio').click()
  const bar = page.getByTestId('audio-control')
  await expect(bar).toBeVisible()
  await expect(bar).not.toContainText(/[඀-෿]/)
  await expect(bar.getByTestId('audio-toggle')).toHaveAttribute('title', 'Pause')
  await expect(bar.getByTestId('audio-follow')).toHaveAttribute('title', 'Follow the recitation')
  await expect(page.locator(`${text} .entry-text.audio-playing`).first()).toBeVisible()
  // the chanted word: a Thai word (no Sinhala letters), one of the first two of the paragraph
  const word = page.locator(`${text} [data-w].chanting`).first()
  await expect(word).toBeAttached()
  expect(await word.innerText()).toMatch(/^[฀-๿]+$/)
  expect(Number(await word.getAttribute('data-w'))).toBeLessThan(2)
  await bar.getByTestId('audio-toggle').click()
  await expect(page.locator('.chanting')).toHaveCount(0)
  await expect(bar.getByTestId('audio-toggle')).toHaveAttribute('title', 'Play')
  await bar.getByTestId('audio-close').click()
  await expect(bar).toBeHidden()
})

test('the words of the chanted paragraph read as the others do (Roman capitals kept)', async ({ page }) => {
  await stubTimings(page)
  await page.goto('/latn/dn-1-1')
  const para = page.locator(`${text} [data-eind="0-6"] .entry`)
  const before = await para.locator('.entry-text').innerText()
  await para.hover()
  await para.getByTestId('entry-options').click()
  await page.getByTestId('menu-audio').click()
  await expect(page.locator(`${text} [data-w].chanting`).first()).toBeAttached()
  expect(await para.locator('.entry-text').innerText()).toBe(before)
})

test('the tree: recitation button with its label, tabs menu and bookmarks page in the language of the interface', async ({ page, isMobile }) => {
  await page.goto('/latn/dn-1-1')
  await page.locator(`${text} .entry`).first().waitFor()
  if (isMobile) await page.getByTestId('tree-toggle').click()
  const row = page.locator('[data-testid=tree-node][data-key="dn-1-1"]')
  await row.hover()
  await expect(row.getByTestId('tree-audio')).toHaveAttribute('title', 'Listen to the recitation')
  await row.getByTestId('tree-audio').click()
  await expect(page.getByTestId('audio-control')).toBeVisible()
  await page.getByTestId('audio-close').click()
  // a starred paragraph on the bookmarks page, in the script of the page
  await page.locator(`${text} [data-testid="bookmark"]`).first().click()
  await page.goto('/latn/bookmarks')
  await expect(page.getByTestId('bookmark-item')).toHaveCount(1)
  await expect(page.locator('main')).not.toContainText(/[඀-෿]/)
  await expect(page.getByTestId('history-item').first()).toContainText('Brahmajālasuttaṃ')
  await page.getByTestId('bookmark-remove').click()
  await expect(page.getByTestId('bookmarks-message')).toBeVisible()
  await page.goto('/latn/no-such-text')
  await expect(page.getByTestId('not-found')).toContainText('Page not found')
})
