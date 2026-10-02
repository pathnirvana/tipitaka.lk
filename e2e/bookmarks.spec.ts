import { test, expect } from './fixtures'

test('star a heading and see it in bookmarks', async ({ page }) => {
  await page.goto('/dn-1-1/pali')
  const star = page.locator('[data-testid="text-tab"]:visible .entry-text.heading [data-testid="bookmark"]').first()
  await star.click()
  await expect(star).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/bookmarks')
  await expect(page.getByTestId('bookmark-item')).toHaveCount(1)
  await page.getByTestId('bookmark-item').getByTestId('bookmark').click()
  await expect(page.getByTestId('bookmarks-message')).toContainText('තරු යොදා නැත')
})

test('legacy bookmarks render formatted text and show as starred (A11)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tipitaka.lk-bookmarks-1', JSON.stringify({
    'dn-1-1:0-7:pali': { key: 'dn-1-1', language: 'pali', eInd: [0, 7], type: 'paragraph', text: '**තත්ර** සුදං{1}', hText: null },
    'dn-1-1:2-0:sinh': { key: 'dn-1-1', language: 'sinh', eInd: [2, 0], type: 'paragraph', text: null, hText: 'a <sr>b</sr> <b>…</b><script>x</script>' },
  })))
  await page.goto('/bookmarks')
  await expect(page.getByTestId('bookmark-item')).toHaveCount(2)
  const first = page.getByTestId('bookmark-item').first()
  expect((await first.locator('.rt-bold').innerText()).replace(/\u200d/g, '')).toBe('තත්ර')
  await expect(first).not.toContainText('**')
  await expect(page.locator('sr')).toHaveText('b')
  expect(await page.locator('[data-testid="bookmark-item"] script').count()).toBe(0)
})
