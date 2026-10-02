import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import Database from 'better-sqlite3'
import { loadCorpus, type JFile } from './corpus'
import { buildTree, dfsOrder, type TreeTuple } from './tree'
import { runLegacyBuildTree } from './legacy-tree'
import { mapEntriesToNodes } from './entry-nodes'
import { validateCorpus, toBaseline, newWarnings } from './validate'
import { writeDb, fileGroup } from './write-db'
import { parseQueries } from '../shared/queries'
import { buildMatch } from '../shared/fts-query'
import { FILTER_KEYS, joinList } from '../shared/constants'

const FULL = !!process.env.FULL
const queries = parseQueries(fs.readFileSync('server/queries.sql', 'utf-8'))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tipitaka-build-'))

function buildAll(textDir: string, out: string, dropPlaceholders: boolean) {
  const corpus = loadCorpus(textDir)
  const res = buildTree(corpus.files)
  if (dropPlaceholders) for (const [k, v] of res.tree) if (!v.length) res.tree.delete(k)
  const tree = res.tree as Map<string, TreeTuple>
  const order = dfsOrder(tree)
  const entryNodes = mapEntriesToNodes(corpus.files, tree, order)
  writeDb(out, { corpus, tree, order, entryNodes, meta: { schema_version: '1' } })
  return { corpus, res, tree, order, entryNodes }
}

function naiveMapping(f: JFile, tree: Map<string, TreeTuple>, order: string[]) { // v2 getKeyForEInd
  return f.pages.map((p, pi) => p.pali.entries.map((_, ei) => {
    for (let i = order.length - 1; i >= 0; i--) {
      const v = tree.get(order[i])!
      if (v[5] === f.filename && (v[3][0] < pi || (v[3][0] === pi && v[3][1] <= ei))) return i
    }
    return -1
  }))
}

function roundTrip(corpus: ReturnType<typeof loadCorpus>, dbFile: string) {
  const db = new Database(dbFile, { readonly: true })
  const rows = db.prepare('SELECT e.*, f.name FROM entry e JOIN file f ON f.id = e.file_id ORDER BY e.id').all() as any[]
  const types = ['centered', 'heading', 'paragraph', 'gatha', 'unindented']
  let k = 0, fnCount = 0
  for (const f of corpus.files) f.pages.forEach((p, pi) => {
    p.pali.entries.forEach((pe, ei) => {
      const r = rows[k++]
      const se = p.sinh.entries[ei]
      const ok = r.name === f.filename && r.page_idx === pi && r.entry_idx === ei && r.p_text === pe.text && types[r.p_type] === pe.type &&
        r.p_level === (pe.level ?? null) && !!r.no_audio === !!pe.noAudio && r.key_offset === (pe.keyOffset ?? null) &&
        (se ? r.s_text === se.text && types[r.s_type] === se.type && r.s_level === (se.level ?? null) : r.s_text === null)
      if (!ok) throw new Error(`round trip mismatch ${f.filename} ${pi}-${ei}`)
    })
    fnCount += p.pali.footnotes.length + p.sinh.footnotes.length
  })
  expect(k).toBe(rows.length)
  expect((db.prepare('SELECT count(*) n FROM footnote').get() as any).n).toBe(fnCount)
  const pageCount = corpus.files.reduce((a, f) => a + f.pages.length, 0)
  expect((db.prepare('SELECT count(*) n FROM page').get() as any).n).toBe(pageCount)
  db.close()
}

function runQuery(db: Database.Database, name: string, params: Record<string, string | number>) {
  return db.prepare(queries.get(name)!.sql).all(params) as any[]
}

describe('fixture corpus', () => {
  const dbFile = path.join(tmp, 'fixture.db')
  let b: ReturnType<typeof buildAll>
  beforeAll(() => { b = buildAll('e2e/fixtures/text', dbFile, true) })

  it('tree is identical to the legacy dev/build-tree.js output', () => {
    const legacy = runLegacyBuildTree('e2e/fixtures/text')
    const mine = Object.fromEntries(buildTree(loadCorpus('e2e/fixtures/text').files).tree)
    expect(isDeepStrictEqual(mine, legacy)).toBe(true)
    expect(Object.keys(mine)).toEqual(Object.keys(legacy))
  })
  it('DFS order algorithm matches v2 (on the committed tree.json)', () => {
    const tj = JSON.parse(fs.readFileSync('public/static/data/tree.json', 'utf-8'))
    const golden = JSON.parse(fs.readFileSync('e2e/legacy/goldens/ordered-keys.json', 'utf-8'))
    expect(dfsOrder(new Map(Object.entries(tj)) as Map<string, TreeTuple>)).toEqual(golden)
  })
  it('entry -> node sweep equals the naive v2 algorithm', () => {
    for (const f of b.corpus.files) expect(b.entryNodes.get(f.filename)).toEqual(naiveMapping(f, b.tree, b.order))
  })
  it('round trip json -> db', () => roundTrip(b.corpus, dbFile))
  it('every node with a file points at an existing entry and headings are covered', () => {
    const db = new Database(dbFile, { readonly: true })
    const missing = db.prepare(`SELECT n.key FROM node n WHERE n.file_id IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM entry e WHERE e.file_id = n.file_id AND e.page_idx = n.page_idx AND e.entry_idx = n.entry_idx)`).all()
    expect(missing).toEqual([])
    const uncovered = db.prepare('SELECT count(*) n FROM entry WHERE p_type = 1 AND node_id IS NULL').get() as any
    expect(uncovered.n).toBe(0)
    db.close()
  })
  it('filter groups: an-1 and an-10 are separate (A5)', () => {
    expect(FILTER_KEYS[fileGroup('an-1')!]).toBe('an-1')
    expect(FILTER_KEYS[fileGroup('an-10')!]).toBe('an-10')
    expect(FILTER_KEYS[fileGroup('atta-kn-dhp-19')!]).toBe('atta-kn')
    expect(FILTER_KEYS[fileGroup('ap-pat-2-83')!]).toBe('ap-pat')
    const db = new Database(dbFile, { readonly: true })
    const an1 = runQuery(db, 'fts.candidates', { q: 'තථාගත*', lang: 2, groups: joinList([FILTER_KEYS.indexOf('an-1')]), limit: 2000 })
    expect(an1.length).toBeGreaterThan(0)
    expect(an1.every(r => r.file === 'an-1')).toBe(true)
    db.close()
  })
  it('mirror keys (atuwa links)', () => {
    const db = new Database(dbFile, { readonly: true })
    expect((runQuery(db, 'tree.node', { key: 'dn-1-1' })[0]).mirror_key).toBe('atta-dn-1-1')
    expect((runQuery(db, 'tree.node', { key: 'atta-dn-1-1' })[0]).mirror_key).toBe('dn-1-1')
    db.close()
  })
  it('every named query runs and returns no NULLs (bridge requirement)', () => {
    const samples = JSON.parse(fs.readFileSync('server/queries.samples.json', 'utf-8')) as Record<string, Record<string, string | number>[]>
    const text = new Database(dbFile, { readonly: true }), dict = new Database('e2e/fixtures/db/dict.db', { readonly: true })
    for (const [name, q] of queries) {
      expect(samples[name], `samples for ${name}`).toBeTruthy()
      for (const params of samples[name]) {
        const rows = (q.db === 'text' ? text : dict).prepare(q.sql).all(params) as any[]
        expect(rows.length, `${name} ${JSON.stringify(params)}`).toBeGreaterThan(0)
        for (const r of rows) for (const [c, v] of Object.entries(r)) expect(v, `${name}.${c}`).not.toBeNull()
      }
    }
    text.close(); dict.close()
  })
  it('validation finds problems in broken files', () => {
    const f = JSON.parse(fs.readFileSync('e2e/fixtures/text/kn-khp.json', 'utf-8')) as JFile
    const bad: JFile = { ...f, filename: 'x', bookId: 0, pages: [f.pages[1], f.pages[0]] }
    bad.pages = bad.pages.map(p => ({ ...p, sinh: { ...p.sinh, entries: p.sinh.entries.slice(1) } }))
    bad.pages[0].pali.entries = [...bad.pages[0].pali.entries, { type: 'paragraph', text: '**x{9}', keyOffset: 2 }]
    const codes = new Set(validateCorpus([bad], ['kn-khp']).errors.map(e => e.code))
    for (const c of ['filename', 'bookId', 'pageOrder', 'entryCount', 'keyOffset']) expect(codes.has(c), c).toBe(true)
    const w = validateCorpus([bad], ['kn-khp']).warnings
    expect(w.some(x => x.code === 'unbalancedBold')).toBe(true)
    expect(w.some(x => x.code === 'footnoteRef')).toBe(true)
    expect(newWarnings(w, toBaseline(w))).toEqual([])
    expect(newWarnings([...w, w[0]], toBaseline(w)).length).toBe(1)
  })
})

describe.runIf(FULL)('full corpus', () => {
  const dbFile = path.join(tmp, 'full.db')
  let b: ReturnType<typeof buildAll>
  beforeAll(() => { b = buildAll('public/static/text', dbFile, false) })

  it('tree is identical to the legacy dev/build-tree.js output', () => {
    const legacy = runLegacyBuildTree('public/static/text')
    expect(b.res.errors).toEqual([])
    const mine = Object.fromEntries(b.tree)
    expect(isDeepStrictEqual(mine, legacy)).toBe(true)
    expect(Object.keys(mine)).toEqual(Object.keys(legacy))
  })
  it('validation has no errors', () => {
    expect(validateCorpus(b.corpus.files, b.corpus.names).errors).toEqual([])
  })
  it('round trip json -> db', () => roundTrip(b.corpus, dbFile))
  it('FTS finds >= 95% of the legacy matches', () => {
    const db = new Database(dbFile, { readonly: true })
    const golden = JSON.parse(fs.readFileSync('e2e/legacy/goldens/fts.json', 'utf-8')) as any[]
    const report: string[] = []
    let totalLegacy = 0, totalFound = 0
    for (const g of golden) {
      const c = g.case
      const keys: string[] = c.keys || [...FILTER_KEYS]
      const groups = keys.length === FILTER_KEYS.length ? '' : joinList(keys.map(k => FILTER_KEYS.indexOf(k as any)))
      const lang = !c.columns || c.columns.length === 2 ? 2 : c.columns[0]
      const m = buildMatch(c.input, { exactWord: c.exactWord || 0, matchPhrase: c.matchPhrase || 0, wordDistance: c.wordDistance ?? 10 })
      expect(m.ok, JSON.stringify(c)).toBe(true)
      if (!m.ok) continue
      const rows = runQuery(db, 'fts.candidates', { q: m.match, lang, groups, limit: 2 ** 31 - 1 })
      const mine = new Set(rows.map(r => `${r.file}:${r.page_idx}-${r.entry_idx}:${r.d % 2 ? 'sinh' : 'pali'}`))
      // legacy filter LIKE 'an-1%' also matched an-10/an-11 (A5) - compare only rows inside the selected groups
      const legacyRows = (g.all as string[]).filter(r => groups === '' || keys.includes(FILTER_KEYS[fileGroup(r.split(':')[0])!]))
      const found = legacyRows.filter(r => mine.has(r)).length
      totalLegacy += legacyRows.length; totalFound += found
      report.push(`${JSON.stringify(c)}: legacy ${legacyRows.length}, new ${mine.size}, found ${found}`)
    }
    fs.writeFileSync(path.join(tmp, 'fts-recall.txt'), report.join('\n'))
    console.log(report.join('\n'))
    expect(totalFound / totalLegacy).toBeGreaterThan(0.95)
    db.close()
  })
})
