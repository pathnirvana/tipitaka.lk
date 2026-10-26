// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { HttpSource, NativeSource, Data, QueryError, QUERIES, type DataSource } from './source'
import { cacheKey } from './cache'
import { matchHits, rankOf, runFts } from './fts'
import { toRoman, toSinh, cleanInlineWord } from './dictionary'
import { titleSearch } from './title'
import { parseLabels, assignLabels } from '@/stores/audio'
import { setData } from './source'
import { LocalSource } from '@/test-utils'
import { buildMatch } from '@shared/fts-query'
import { FILTER_KEYS } from '@shared/constants'
import type { TitleRow } from './types'

describe('HttpSource', () => {
  it('GETs with params and the api hash, POSTs long requests, maps errors', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => new Response(JSON.stringify([{ url, method: init?.method || 'GET' }])))
    const s = new HttpSource(() => 'abc', fetchMock as unknown as typeof fetch)
    const [r] = await s.run<{ url: string; method: string }>('tree.node', { key: 'dn-1' })
    expect(r.url).toBe('/api/q/tree.node?key=dn-1&v=abc')
    const [p] = await s.run<{ url: string; method: string }>('dict.inline', { words: 'x'.repeat(2000), dicts: 'BUS' })
    expect(p).toMatchObject({ url: '/api/q/dict.inline', method: 'POST' })
    const err = new HttpSource(() => '', (async () => new Response('{"error":"fts_syntax"}', { status: 400 })) as unknown as typeof fetch)
    await expect(err.run('fts.count', { q: '"', lang: 2, groups: '' })).rejects.toMatchObject({ code: 'fts_syntax' })
    const net = new HttpSource(() => '', (async () => { throw new Error('offline') }) as unknown as typeof fetch)
    await expect(net.run('meta.info', {})).rejects.toBeInstanceOf(QueryError)
  })
})

describe('native bridge (the apps: the Go engine through window.TipitakaNative / webkit)', () => {
  /** answers out of order, like the native thread pool */
  function fakeEngine(answer: (req: Record<string, unknown>) => unknown) {
    const sent: Record<string, unknown>[] = []
    const s = new NativeSource((id, request) => {
      const req = JSON.parse(request)
      sent.push(req)
      setTimeout(() => window.__tipitakaResolve!(id, JSON.stringify(answer(req))), req.query === 'tree.node' ? 20 : 1)
    })
    return { s, sent }
  }
  it('sends named queries and operations, matches out of order answers', async () => {
    const { s, sent } = fakeEngine(req => ({ ok: req.query ? [{ q: req.query, key: req.key }] : { op: req.op } }))
    const [a, b] = await Promise.all([s.run<{ q: string; key: string }>('tree.node', { key: 'dn-1' }), s.op<{ op: string }>('dicts', {})])
    expect(a).toEqual([{ q: 'tree.node', key: 'dn-1' }])
    expect(b).toEqual({ op: 'dicts' })
    expect(sent).toEqual([{ query: 'tree.node', key: 'dn-1' }, { op: 'dicts' }])
  })
  it('maps the engine errors', async () => {
    const { s } = fakeEngine(req => ({ error: req.query === 'fts.count' ? 'fts_syntax' : 'internal', message: 'boom' }))
    await expect(s.run('fts.count', { q: '"', lang: 2, groups: '' })).rejects.toMatchObject({ code: 'fts_syntax' })
    await expect(s.op('dicts', {})).rejects.toMatchObject({ code: 'server', message: 'boom' })
  })
})

describe('Data cache', () => {
  it('uses ssr prefill, dedupes in flight requests and validates params', async () => {
    const src = { run: vi.fn(async () => [{ a: 1 }]) }
    const d = new Data(src as unknown as DataSource, { [cacheKey('tree.node', { key: 'x' })]: [{ pre: true }] })
    expect(await d.query('tree.node', { key: 'x' })).toEqual([{ pre: true }])
    expect(src.run).not.toHaveBeenCalled()
    await Promise.all([d.query('tree.node', { key: 'y' }), d.query('tree.node', { key: 'y' })])
    expect(src.run).toHaveBeenCalledTimes(1)
    await expect(d.query('tree.node', {})).rejects.toMatchObject({ code: 'bad_request' })
    await expect(d.query('nope', {})).rejects.toMatchObject({ code: 'bad_request' })
  })
  it('cache keys sort params (must match server/ssr.go)', () => {
    expect(cacheKey('text.entries', { to: 1, file: 'dn-1', from: 0 })).toBe('text.entries|{"file":"dn-1","from":0,"to":1}')
  })
  it('every named query is known to the client', () => { expect(QUERIES.size).toBeGreaterThan(10) })
})

describe('fts ranking', () => {
  it('decodes matchinfo x', () => {
    expect(matchHits('01000000E8000000A8000000')).toBe(1)
    expect(matchHits('020000000300000002000000' + '030000000300000002000000')).toBe(5)
    expect(rankOf(2, 1)).toBe(2) // len guarded
  })
  it('runs a search on the fixture db', async () => {
    setData(new Data(new LocalSource()))
    const m = buildMatch('බ්‍රහ්මජාල', { exactWord: 0, matchPhrase: 0, wordDistance: 10 })
    if (!m.ok) throw new Error(m.error)
    const res = await runFts(m.match, m.highlight, 2, null, { bandiLetters: false, specialLetters: false })
    expect(res.total).toBeGreaterThan(0)
    expect(res.groups[0].items[0].hText).toContain('<sr>')
    const an1 = buildMatch('තථාගත', { exactWord: 0, matchPhrase: 0, wordDistance: 10 })
    if (!an1.ok) throw new Error()
    const r2 = await runFts(an1.match, an1.highlight, 2, [FILTER_KEYS.indexOf('an-1')], { bandiLetters: false, specialLetters: false })
    expect(r2.groups.every(g => g.items.every(i => i.file === 'an-1'))).toBe(true)
  })
})

describe('dictionary words', () => {
  it('Sinhala <-> Roman (the dictionary db is Roman), clicked words lose punctuation', () => {
    expect(toRoman('ධම්මං')).toBe('dhammaṃ')
    expect(toRoman('බ්‍රහ්මජාල')).toBe('brahmajāla')
    expect(toSinh('brahmajāla')).toBe('බ්රහ්මජාල')
    expect(cleanInlineWord('“ධම්මං,')).toBe('ධම්මං')
  })
})

describe('title search', () => {
  const index: TitleRow[] = [
    { id: 1, key: 'an-1-1', pali: 'පඨමවග්ගො', sinh: 'පළමු වර්‍ගය', grp: FILTER_KEYS.indexOf('an-1'), page_idx: 0, entry_idx: 1 },
    { id: 2, key: 'an-10-1', pali: 'පඨමවග්ගො', sinh: 'පළමු වර්‍ගය', grp: FILTER_KEYS.indexOf('an-10'), page_idx: 0, entry_idx: 1 },
  ]
  it('filters by group (A5) and ignores zwj (A32)', async () => {
    expect((await titleSearch(index, 'වග්ග', { keys: ['an-1'], columns: [0, 1] })).map(r => r.key)).toEqual(['an-1-1'])
    expect((await titleSearch(index, 'වර්‍ග', { keys: [...FILTER_KEYS], columns: [1] })).map(r => r.language)).toEqual(['sinh', 'sinh'])
    expect(await titleSearch(index, 'වග්ග', { keys: [], columns: [0, 1] })).toEqual([])
  })
})

describe('audio labels', () => {
  it('parses CRLF, missing trailing newline and drops fractional labels (A20)', () => {
    const l = parseLabels('1.0\t2.0\t01\r\n2.5\t3.0\t2\r\n2.7\t2.8\t2.1\n4\t5\t3', 'x.m4a')
    expect(l.map(x => x.num)).toEqual([1, 2, 2.1, 3])
    const e = assignLabels([{ audio_idx: 0, page_idx: 0, entry_idx: 0 }, { audio_idx: 1, page_idx: 0, entry_idx: 2 }, { audio_idx: 2, page_idx: 1, entry_idx: 0 }], [l])
    expect(e.map(x => x.label?.start)).toEqual([1, 2.5, 4])
  })
})
