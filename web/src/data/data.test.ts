// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HttpSource, AndroidSource, Data, QueryError, callAndroidAsync, QUERIES, type DataSource } from './source'
import { cacheKey } from './cache'
import { matchHits, rankOf, runFts } from './fts'
import { processDictRows } from './dictionary'
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

describe('Android bridge', () => {
  beforeEach(() => { delete (window as { Android?: unknown }).Android })
  function fakeBridge(opts: { openDelay?: number; sync?: boolean } = {}) {
    const results: Record<string, string> = {}
    const log: string[] = []
    let opened = false
    window.Android = {
      runAsync(rand, func, json) {
        log.push(func)
        const done = (ok: boolean, v: string) => { results[rand] = v; (window as any)[rand].callback(ok) }
        const work = () => {
          if (func === 'openDbs') { opened = true; return done(true, 'Initialized') }
          if (!opened) return done(false, 'java.lang.NullPointerException')
          const { sql } = JSON.parse(json)
          if (sql.includes('MATCH')) return done(false, 'android.database.sqlite.SQLiteException: malformed MATCH expression')
          return done(true, JSON.stringify([{ sql }]))
        }
        if (opts.sync) work()
        else setTimeout(work, func === 'openDbs' ? opts.openDelay ?? 20 : 1)
      },
      runAsyncResult: rand => results[rand],
    }
    return log
  }
  it('installs the resolvers before calling native (sync callback works)', async () => {
    fakeBridge({ sync: true })
    await expect(callAndroidAsync('openDbs', {})).resolves.toBe('Initialized')
  })
  it('gates every query on openDbs and inlines params', async () => {
    const log = fakeBridge({ openDelay: 30 })
    const busy: boolean[] = []
    const s = new AndroidSource({ text: 1, dict: 2 }, b => busy.push(b))
    const [a, b] = await Promise.all([s.run<{ sql: string }>('tree.node', { key: "it's" }), s.run<{ sql: string }>('meta.info', {})])
    expect(log[0]).toBe('openDbs')
    expect(log.filter(l => l === 'openDbs').length).toBe(1)
    expect(a[0].sql).toContain("n.key = 'it''s'")
    expect(b.length).toBe(1)
    expect(busy).toEqual([true, false])
  })
  it('maps MATCH errors to fts_syntax', async () => {
    fakeBridge()
    const s = new AndroidSource({ text: 1, dict: 2 })
    await expect(s.run('fts.count', { q: 'x', lang: 2, groups: '' })).rejects.toMatchObject({ code: 'fts_syntax' })
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
    const res = await runFts(m.match, m.terms, 2, null, { bandiLetters: false, specialLetters: false })
    expect(res.total).toBeGreaterThan(0)
    expect(res.groups[0].items[0].hText).toContain('<sr>')
    const an1 = buildMatch('තථාගත', { exactWord: 0, matchPhrase: 0, wordDistance: 10 })
    if (!an1.ok) throw new Error()
    const r2 = await runFts(an1.match, an1.terms, 2, [FILTER_KEYS.indexOf('an-1')], { bandiLetters: false, specialLetters: false })
    expect(r2.groups.every(g => g.items.every(i => i.file === 'an-1'))).toBe(true)
  })
})

describe('dictionary rows', () => {
  it('splits matches, breakups and prefix words', () => {
    const r = processDictRows([
      { word: 'a', dict: 'BR', meaning: 'n|x+y' }, { word: 'a', dict: 'BUS', meaning: 'm' },
      { word: 'a', dict: 3, meaning: 'like' }, { word: 'ab', dict: 2, meaning: 'like' },
    ])
    expect(r.breakups).toEqual([{ word: 'a', type: 'n', breakup: 'x+y' }])
    expect(r.matches).toEqual([{ word: 'a', dict: 'BUS', meaning: 'm' }])
    expect(r.prefixWords).toEqual([{ word: 'ab', count: 2 }])
  })
})

describe('title search', () => {
  const index: TitleRow[] = [
    { id: 1, key: 'an-1-1', pali: 'පඨමවග්ගො', sinh: 'පළමු වර්‍ගය', grp: FILTER_KEYS.indexOf('an-1'), page_idx: 0, entry_idx: 1 },
    { id: 2, key: 'an-10-1', pali: 'පඨමවග්ගො', sinh: 'පළමු වර්‍ගය', grp: FILTER_KEYS.indexOf('an-10'), page_idx: 0, entry_idx: 1 },
  ]
  it('filters by group (A5) and ignores zwj (A32)', () => {
    expect(titleSearch(index, 'වග්ග', { keys: ['an-1'], columns: [0, 1] }).map(r => r.key)).toEqual(['an-1-1'])
    expect(titleSearch(index, 'වර්‍ග', { keys: [...FILTER_KEYS], columns: [1] }).map(r => r.language)).toEqual(['sinh', 'sinh'])
    expect(titleSearch(index, 'වග්ග', { keys: [], columns: [0, 1] })).toEqual([])
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
