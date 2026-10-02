import { test, expect } from './fixtures'

test('api security and caching', async ({ request }) => {
  expect((await request.get('/api/q/nope')).status()).toBe(404)
  expect((await request.post('/sql-query', { data: { dbname: 'fts.db', query: 'SELECT 1' } })).status()).toBe(405)
  expect((await request.get('/sql-query')).status()).toBe(404)
  expect((await request.get(`/api/q/tree.node?key=${'x'.repeat(70000)}`)).status()).toBe(400)
  const v = await request.get('/tipitaka-query/version')
  expect(await v.text()).toMatch(/^Tipitaka\.lk v\d+\.\d+$/)
  expect(v.headers()['access-control-allow-origin']).toBe('*')
  const health = await (await request.get('/api/health')).json()
  const res = await request.get(`/api/q/text.entries?file=dn-1&from=0&to=3&v=${health.api_hash}`)
  expect(res.headers()['cache-control']).toContain('immutable')
  expect(res.headers()['content-encoding']).toBe('gzip')
})
