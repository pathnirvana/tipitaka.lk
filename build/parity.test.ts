/**
 * Parity with the v2 (legacy) system using the goldens captured by e2e/legacy/capture.mjs.
 * FULL=1 only (needs db/text.db and db/dict.db). Accepted differences: e2e/legacy/accepted-diffs.md
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { parseQueries } from '../shared/queries'
import { joinList, FILTER_KEYS } from '../shared/constants'
import { titleSearch } from '../web/src/data/title'
import type { TitleRow } from '../web/src/data/types'

const FULL = !!process.env.FULL
const queries = parseQueries(fs.readFileSync('server/queries.sql', 'utf-8'))
const golden = (f: string) => JSON.parse(fs.readFileSync(`e2e/legacy/goldens/${f}`, 'utf-8'))
const DICTS = ['BUS', 'MS', 'BUE', 'ND', 'PTS', 'PN', 'VRI', 'CR']
type Row = { word: string; dict: string | number; meaning: string }
const key = (r: Row) => `${r.word}|${r.dict}|${r.meaning}`

describe.runIf(FULL)('dictionary parity (same word lists -> same rows)', () => {
  const db = new Database('db/dict.db', { readonly: true })
  for (const g of golden('dict.json') as { input: string; words: string[]; page: Row[]; inline: Row[] }[]) {
    it(g.input, () => {
      const page = db.prepare(queries.get('dict.page')!.sql).all({ words: joinList(g.words), dicts: joinList(DICTS), prefix: g.words.length > 100 ? 0 : 1 }) as Row[]
      const inline = db.prepare(queries.get('dict.inline')!.sql).all({ words: joinList(g.words), dicts: joinList([...DICTS, 'BR']) }) as Row[]
      for (const [mine, legacy] of [[page, g.page], [inline, g.inline]] as const) {
        // ORDER BY word LIMIT 50: rows of the last (tied) word can differ - compare the words before it
        const limitHit = legacy.length >= 50
        const lastWord = limitHit ? legacy[legacy.length - 1].word : null
        const norm = (rows: Row[]) => rows.filter(r => !lastWord || r.word < lastWord).map(key).sort()
        expect(norm(mine)).toEqual(norm(legacy))
      }
    })
  }
})

describe.runIf(FULL)('title search parity (legacy results are kept)', () => {
  const db = new Database('db/text.db', { readonly: true })
  const index = db.prepare(queries.get('tree.titleIndex')!.sql).all() as TitleRow[]
  for (const g of golden('title.json') as { input: string; filter?: { keys?: string[]; columns?: number[] }; results: { key: string }[] }[]) {
    if (/[a-z]/i.test(g.input)) continue // singlish word lists changed with @pnfo/singlish-search 1.2
    it(`${g.input} ${JSON.stringify(g.filter || {})}`, async () => {
      const filter = { keys: g.filter?.keys || [...FILTER_KEYS], columns: g.filter?.columns || [0, 1] }
      const mine = new Set((await titleSearch(index, g.input, filter, 100000)).map(r => r.key))
      // A5: v2 'an-1' filter also matched an-10/an-11
      const legacy = g.results.map(r => r.key).filter(k => !g.filter?.keys || g.filter.keys.some(f => k === f || k.startsWith(f + '-')))
      const missing = legacy.filter(k => !mine.has(k))
      expect(missing).toEqual([])
    })
  }
})
