import { test, expect } from './fixtures'

// transfer budget for a cold deep link (v2 downloaded ~2 MB+: tree.json, the whole text file, ttf fonts)
test('cold deep link transfer budget', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'uses the chromium devtools protocol')
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  let bytes = 0
  cdp.on('Network.loadingFinished', e => { bytes += e.encodedDataLength })
  await page.goto('/dn-1-1/sinh', { waitUntil: 'networkidle' })
  await expect(page.locator('.entry-text').first()).toBeVisible()
  console.log(`transferred ${(bytes / 1024).toFixed(0)} KB`)
  expect(bytes).toBeLessThan(450 * 1024)
})
