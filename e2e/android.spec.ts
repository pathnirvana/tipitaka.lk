/**
 * Offline app build (web/dist-app) running against a simulated Android bridge (window.Android) that behaves like
 * /Volumes/2TB/Android/Tipitaka.lk WebAppInterface.java: runAsync + runAsyncResult, openDbs, runSqliteQuery
 * (params inlined, NULL/BLOB -> "", ints via getInt), and it fails when queried before openDbs.
 */
import { test, expect } from './fixtures'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import type { Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const distApp = path.resolve(__dirname, '../web/dist-app')
const dbs = { text: new Database(path.resolve(__dirname, 'fixtures/db/text.db'), { readonly: true }), dict: new Database(path.resolve(__dirname, 'fixtures/db/dict.db'), { readonly: true }) }
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain' }

function cursorToJson(rows: Record<string, unknown>[]): string {
  return JSON.stringify(rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => {
    if (v === null || v instanceof Buffer) return [k, '']
    if (typeof v === 'number' && Number.isInteger(v)) return [k, v | 0] // cursor.getInt
    return [k, v]
  }))), null, 2)
}

async function setupBridge(page: Page) {
  const calls: string[] = []
  let opened = false
  await page.route('http://app.local/**', route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/android_asset\//, ''))
    const file = path.join(distApp, rel || 'index.html')
    if (!file.startsWith(distApp) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' })
    return route.fulfill({ body: fs.readFileSync(file), contentType: MIME[path.extname(file)] || 'application/octet-stream' })
  })
  await page.exposeBinding('__execBridge', async (_src, funcName: string, jsonParams: string) => {
    const params = JSON.parse(jsonParams)
    calls.push(funcName)
    if (funcName === 'openDbs') { await new Promise(r => setTimeout(r, 300)); opened = true; return 'Initialized' }
    if (funcName === 'runSqliteQuery') {
      if (!opened) throw new Error('java.lang.NullPointerException: db not opened')
      const db = dbs[params.type as 'text' | 'dict']
      return cursorToJson(db.prepare(params.sql).all() as Record<string, unknown>[])
    }
    throw new Error(`NoSuchMethodException ${funcName}`)
  })
  await page.addInitScript(() => {
    const results: Record<string, string> = {}
    const w = window as unknown as Record<string, any>
    w.Android = {
      runAsync(rand: string, funcName: string, jsonParams: string) {
        w.__execBridge(funcName, jsonParams).then(
          (res: string) => { results[rand] = res; w[rand].callback(true) },
          (err: Error) => { results[rand] = String(err.message || err); w[rand].callback(false) })
      },
      runAsyncResult(rand: string) { const r = results[rand]; delete results[rand]; return r },
      getBjtParams() { return '' },
    }
  })
  return { calls }
}

test.beforeAll(() => { if (!fs.existsSync(path.join(distApp, 'index.html'))) throw new Error('run npm run build:web:app first') })

test('reads a sutta through the native bridge with hash routing', async ({ page }) => {
  const { calls } = await setupBridge(page)
  const apiRequests: string[] = []
  page.on('request', r => { if (r.url().includes('/api/')) apiRequests.push(r.url()) })
  await page.goto('http://app.local/android_asset/index.html#/dn-1-1/sinh')
  await expect(page.locator('.entry-text.heading', { hasText: 'බ්‍රහ්මජාල සූත්‍රය' })).toBeVisible()
  expect(calls[0]).toBe('openDbs')
  expect(apiRequests).toEqual([])
  expect(await page.evaluate(() => location.hash)).toBe('#/dn-1-1/sinh')
})

test('search and dictionary through the bridge', async ({ page }) => {
  await setupBridge(page)
  await page.goto('http://app.local/android_asset/index.html#/fts/බ්‍රහ්මජාල')
  await expect(page.getByTestId('fts-item').first()).toBeVisible()
  await page.goto('http://app.local/android_asset/index.html#/dict/ධම්ම')
  await expect(page.getByTestId('dict-match').first()).toBeVisible()
  await page.goto('http://app.local/android_asset/index.html#/title/brahmajala')
  await expect(page.locator('[data-testid="title-result"][data-key="dn-1-1"]')).toBeVisible()
  await page.goto("http://app.local/android_asset/index.html#/fts/කුසල OR අකුසල")
  await expect(page.getByTestId('search-message')).toBeVisible()
})

test('tree, footnotes and static data files work offline', async ({ page }) => {
  await setupBridge(page)
  await page.goto('http://app.local/android_asset/index.html#/')
  await page.getByTestId('tree-toggle').click()
  await expect(page.getByTestId('tree').locator('[data-key="sp"]')).toBeVisible()
  await page.goto('http://app.local/android_asset/index.html#/abbreviations')
  await expect(page.getByTestId('abbreviations')).toContainText('මඡසං')
})
