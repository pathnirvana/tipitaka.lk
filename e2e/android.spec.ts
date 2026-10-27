/**
 * Offline app build (web/dist-app) running against a simulated native bridge (window.TipitakaNative.query(id, request),
 * as the v3 apps' TipitakaBridge.java / App.swift): requests ({"query": name, params} or {"op": ..., params}) go to the
 * Go engine - here the test server's /api, which runs the same named queries and operations - and the answers come
 * back asynchronously through window.__tipitakaResolve(id, response).
 */
import { test, expect } from './fixtures'
import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const distApp = path.resolve(__dirname, '../web/dist-app')
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain' }

async function setupBridge(page: Page) {
  const requests: Record<string, string>[] = []
  await page.route('http://app.local/**', route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/android_asset\//, ''))
    const file = path.join(distApp, rel || 'index.html')
    if (!file.startsWith(distApp) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' })
    return route.fulfill({ body: fs.readFileSync(file), contentType: MIME[path.extname(file)] || 'application/octet-stream' })
  })
  // the engine: the test server's api (the same queries and operations), answered as engine.QueryJSON does
  await page.exposeBinding('__engine', async (_src, request: string) => {
    const { query, op, ...params } = JSON.parse(request) as Record<string, string>
    requests.push(JSON.parse(request))
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
    const res = await page.request.get(`/api/${query ? 'q/' + query : op}?${qs}`)
    const body = await res.json().catch(() => null)
    if (res.ok()) return JSON.stringify({ ok: body })
    return JSON.stringify({ error: body?.error === 'fts_syntax' ? 'fts_syntax' : 'internal', message: body?.message ?? body?.error ?? res.status() })
  })
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, any>
    w.TipitakaNative = { query(id: string, request: string) { w.__engine(request).then((r: string) => setTimeout(() => w.__tipitakaResolve(id, r), 5)) } }
  })
  return { requests }
}

test.beforeAll(() => { if (!fs.existsSync(path.join(distApp, 'index.html'))) throw new Error('run npm run build:web:app first') })

test('reads a sutta through the native bridge with hash routing', async ({ page }) => {
  const { requests } = await setupBridge(page)
  const apiRequests: string[] = []
  page.on('request', r => { if (r.url().includes('/api/')) apiRequests.push(r.url()) })
  await page.goto('http://app.local/android_asset/index.html#/dn-1-1/sinh')
  await expect(page.locator('.entry-text.heading', { hasText: 'බ්‍රහ්මජාල සූත්‍රය' })).toBeVisible()
  expect(requests.some(r => r.query === 'text.entries')).toBe(true)
  expect(apiRequests).toEqual([]) // the page never calls the network api
  expect(await page.evaluate(() => location.hash)).toBe('#/dn-1-1/sinh')
})

test('search and dictionary through the bridge', async ({ page }) => {
  await setupBridge(page)
  await page.goto('http://app.local/android_asset/index.html#/fts/බ්‍රහ්මජාල')
  await expect(page.getByTestId('fts-item').first()).toBeVisible()
  // the dictionary: an engine operation
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

test('store apps: no download links, no section on the other apps in the guide (Microsoft Store 10.1.5, App Store 2.3.10)', async ({ page }) => {
  await setupBridge(page)
  await page.goto('http://app.local/android_asset/index.html#/')
  await expect(page.getByTestId('welcome-logos')).toBeVisible()
  await expect(page.getByTestId('downloads')).toHaveCount(0)
  await page.goto('http://app.local/android_asset/index.html#/help')
  await expect(page.getByTestId('help')).toBeVisible()
  await expect(page.locator('#offline')).toHaveCount(0)
  await expect(page.getByTestId('help-toc')).not.toContainText('අන්තර්ජාලය නැතිව')
})
