import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import { test, expect, entries, isMobile, openDrawerIfClosed } from './fixtures'

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

test('the top level of the tree has no recitation buttons', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await expect(page.locator('[data-testid=tree-node][data-key="dn-1-1"] [data-testid=tree-audio]')).toHaveCount(1)
  for (const key of ['vp', 'sp', 'ap']) await expect(page.locator(`[data-testid=tree-node][data-key="${key}"] [data-testid=tree-audio]`)).toHaveCount(0)
})

test('play recitation from the tree re-uses the open tab, in text mode at the start of the sutta', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  await page.getByTestId('page-number').nth(1).click() // scan mode, scrolled down to the second page
  await expect(page.getByTestId('page-number')).toHaveCount(0)
  await openDrawerIfClosed(page)
  const row = page.locator('[data-testid=tree-node][data-key="dn-1-1"]')
  await row.hover()
  await row.getByTestId('tree-audio').click()
  await expect(page.getByTestId('tab')).toHaveCount(1)
  await expect(page.getByTestId('page-number').first()).toBeVisible() // text mode
  await expect(page.locator('.entry-text.audio-playing').first()).toBeInViewport()
})

test('word timings highlight the chanted word and, with the alignment view, its sinhala words', async ({ page }) => {
  test.skip(isMobile(page), 'one column on small screens')
  // timings for every dn-1 label (the stubbed labels are 0.4 s long, 0.5 s apart): word 0 then word 1 after 0.1 s
  const db = new Database('e2e/fixtures/db/text.db', { readonly: true })
  const rows = db.prepare(`SELECT e.audio_idx, e.p_text FROM entry e JOIN file f ON f.id = e.file_id WHERE f.name = 'dn-1' AND e.audio_idx IS NOT NULL`).all() as { audio_idx: number; p_text: string }[]
  db.close()
  const entries = Object.fromEntries(rows.map(r => [r.audio_idx + 1, { ph: crypto.createHash('sha1').update(r.p_text).digest('hex').slice(0, 12), t: '0:0-10,1:10-40' }]))
  await page.route('https://sajjha.sgp1.cdn.digitaloceanspaces.com/**/*.words.json', r =>
    r.fulfill({ json: { v: 1, tok: 'v1', entries }, headers: { 'Access-Control-Allow-Origin': '*' } }))
  await page.addInitScript(() => localStorage.setItem('tipitaka.lk-settings-2', JSON.stringify({ alignmentView: true })))
  await page.goto('/dn-1-1')
  const cell = page.locator('[data-testid="text-tab"]:visible [data-eind="0-6"] .entry[data-lang="pali"]')
  await cell.hover()
  await cell.getByTestId('entry-options').click()
  await page.getByText('සජ්ඣායනය අසන්න').click()
  // dn-1 0:6 is aligned "0>0 | 1>3 | ..." in the fixture alignments: one of its first two words is lit with its sinhala word
  await expect(page.locator('[data-lang="pali"] [data-w].chanting').first()).toBeAttached()
  await expect(page.locator('[data-lang="sinh"] [data-w].chanting-target').first()).toBeAttached()
  await page.getByTestId('audio-toggle').click()
  await expect(page.locator('.chanting')).toHaveCount(0)
})

test('v2 timing files: paragraphs matched by text hash, with word timings', async ({ page }) => {
  // one <label>.json for the recordings of dn-1: every chanted entry 0.4 s long, 0.5 s apart, word 0 then word 1
  const db = new Database('e2e/fixtures/db/text.db', { readonly: true })
  const rows = db.prepare(`SELECT e.audio_ph FROM entry e JOIN file f ON f.id = e.file_id WHERE f.name = 'dn-1' AND e.audio_idx IS NOT NULL ORDER BY e.audio_idx`).all() as { audio_ph: string }[]
  db.close()
  const doc = { v: 2, tok: 'v1', audio: 'x.m4a', dur: 600, entries: rows.map((r, i) => ({ ph: r.audio_ph, s: i * 50, e: i * 50 + 40, t: '0:0-10,1:10-40' })) }
  await page.route(/sajjha\.sgp1\.cdn\.digitaloceanspaces\.com\/.*[^s]\.json$/, r => r.fulfill({ json: doc, headers: { 'Access-Control-Allow-Origin': '*' } }))
  let txt = 0
  page.on('request', r => { if (r.url().endsWith('.txt')) txt++ })
  await page.goto('/dn-1-1')
  const cell = page.locator('[data-testid="text-tab"]:visible [data-eind="0-6"] .entry[data-lang="pali"]')
  await cell.hover()
  await cell.getByTestId('entry-options').click()
  await page.getByText('සජ්ඣායනය අසන්න').click()
  await expect(page.locator('[data-lang="pali"] [data-w].chanting').first()).toBeAttached()
  expect(txt).toBe(0) // the Audacity labels are not needed
  await page.getByTestId('audio-toggle').click()
  await expect(page.locator('.chanting')).toHaveCount(0)
})

test('the playing tab shows a speaker icon while the recitation plays', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  const cell = entries(page, 'pali').filter({ has: page.getByTestId('entry-options') }).first()
  await cell.hover()
  await cell.getByTestId('entry-options').click()
  await page.getByText('සජ්ඣායනය අසන්න').click()
  await expect(page.getByTestId('tab').first().getByTestId('tab-audio')).toBeVisible()
  await page.getByTestId('audio-toggle').click()
  await expect(page.getByTestId('tab-audio')).toHaveCount(0)
})

test('sync keeps the chanted paragraph on screen', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 450 })
  await page.goto('/dn-1-1/pali')
  const cell = entries(page, 'pali').filter({ has: page.getByTestId('entry-options') }).first()
  await cell.hover()
  await cell.getByTestId('entry-options').click()
  await page.getByText('සජ්ඣායනය අසන්න').click()
  await expect(page.getByTestId('audio-follow')).toHaveAttribute('aria-pressed', 'true') // on by default
  const playing = page.locator('[data-testid="text-tab"]:visible .entry-text.audio-playing').first()
  await expect(playing).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)) // away from the chanted paragraph
  await expect(playing).not.toBeInViewport()
  await page.getByTestId('audio-next').click()
  await expect(playing).toBeInViewport()
  await page.getByTestId('audio-follow').click() // off: no more scrolling, remembered
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tipitaka.lk-settings-2') || '{}').audioFollow)).toBe(false)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.getByTestId('audio-next').click()
  await expect(playing).not.toBeInViewport()
})
