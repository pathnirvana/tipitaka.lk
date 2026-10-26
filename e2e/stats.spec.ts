import { test, expect, isMobile } from './fixtures'

test('usage counts: a visit once the visitor interacts, with the device; then the pages, requests and features', async ({ page }) => {
  const beacons: Record<string, unknown>[] = []
  await page.addInitScript(() => { (window as { __tipitakaStatsTest?: boolean }).__tipitakaStatsTest = true })
  await page.route('**/api/beacon', route => { beacons.push(JSON.parse(route.request().postData() ?? '{}')); return route.fulfill({ status: 204 }) })

  await page.goto('/dn-1-1/pali')
  await expect(page.getByTestId('text-tab').first()).toBeVisible()
  await page.waitForTimeout(300)
  expect(beacons).toEqual([]) // no interaction yet

  await page.getByTestId('page-number').first().click() // the scanned page: a feature without a request
  await expect.poll(() => beacons.length).toBe(1)
  const device = isMobile(page) ? { form: 'phone' } : { form: 'desktop' }
  expect(beacons[0]).toMatchObject({ visit: { new: true, day: true, week: true, month: true, ...device } })
  expect(['android', 'ios', 'mac', 'windows', 'linux', 'chromeos', 'other']).toContain((beacons[0].visit as { os: string }).os)

  await page.evaluate(() => { // the page is hidden (another tab or app): the counts so far are sent
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => beacons.length).toBe(2)
  expect(beacons[1]).toMatchObject({ pages: { Home: 1 }, ops: { 'tree.children': expect.any(Number) } /* (the first text page comes with the server rendered page) */, features: { scan: 1 } })
})

test('not counted for test automation (navigator.webdriver)', async ({ page }) => {
  const beacons: unknown[] = []
  await page.route('**/api/beacon', route => { beacons.push(1); return route.fulfill({ status: 204 }) })
  await page.goto('/dn-1-1/pali')
  await page.mouse.click(5, 300)
  await page.waitForTimeout(300)
  expect(beacons).toEqual([])
})
