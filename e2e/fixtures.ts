/** shared test helpers: stubs external hosts (scans, audio CDN, version check) */
import { test as base, expect, type Page } from '@playwright/test'

// 1x1 png
export const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

/** a short silent PCM wav (served instead of the m4a recordings) */
export function silentWav(seconds = 30, rate = 8000): Buffer {
  const n = seconds * rate, b = Buffer.alloc(44 + n)
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVE', 8); b.write('fmt ', 12)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40)
  b.fill(128, 44)
  return b
}

export async function stubExternal(page: Page) {
  await page.route('https://pitaka.lk/**', r => r.fulfill({ body: PNG, contentType: 'image/png' }))
  await page.route('https://tipitaka.lk/tipitaka-query/version', r => r.fulfill({ body: 'Tipitaka.lk v3.0', headers: { 'Access-Control-Allow-Origin': '*' } }))
  await page.route('https://sajjha.sgp1.cdn.digitaloceanspaces.com/**', r => {
    const url = r.request().url()
    if (url.endsWith('.txt')) {
      const lines = Array.from({ length: 40 }, (_, i) => `${(i * 0.5).toFixed(6)}\t${(i * 0.5 + 0.4).toFixed(6)}\t${i + 1}`)
      return r.fulfill({ body: lines.join('\n') + '\n', contentType: 'text/plain', headers: { 'Access-Control-Allow-Origin': '*' } })
    }
    return r.fulfill({ body: silentWav(), contentType: 'audio/wav', headers: { 'Access-Control-Allow-Origin': '*' } })
  })
}

export const test = base.extend<{ stubbed: void }>({
  stubbed: [async ({ page }, use) => { await stubExternal(page); await use() }, { auto: true }],
})
export { expect }

export const isMobile = (page: Page) => (page.viewportSize()?.width || 1000) < 600
/** reader text of the given language column */
export const entries = (page: Page, lang: 'pali' | 'sinh') => page.locator(`[data-testid="text-tab"]:visible .entry[data-lang="${lang}"]`)
export async function openDrawerIfClosed(page: Page) {
  if (!(await page.getByTestId('drawer').isVisible())) await page.getByTestId('tree-toggle').click()
}
