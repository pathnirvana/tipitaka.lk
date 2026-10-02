/** Writes db/text.db from the corpus + tree. Schema documented in dev-docs/data-pipeline.md. */
import fs from 'node:fs'
import Database from 'better-sqlite3'
import type { Corpus } from './corpus'
import type { TreeTuple } from './tree'
import { normalizeForSearch } from '../shared/normalize'
import { FILTER_KEYS, typeToInt, isPaliOnlyFile } from '../shared/constants'

export const SCHEMA_VERSION = '1'

export const SCHEMA = `
CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE file (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, book_id INTEGER NOT NULL,
  page_offset INTEGER NOT NULL, collection TEXT, pali_only INTEGER NOT NULL, grp INTEGER, page_count INTEGER NOT NULL);
CREATE TABLE page (file_id INTEGER NOT NULL, page_idx INTEGER NOT NULL, page_num INTEGER NOT NULL,
  PRIMARY KEY (file_id, page_idx)) WITHOUT ROWID;
CREATE TABLE node (id INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE, parent_id INTEGER, level INTEGER NOT NULL,
  pali TEXT NOT NULL, sinh TEXT NOT NULL, file_id INTEGER, page_idx INTEGER NOT NULL, entry_idx INTEGER NOT NULL,
  grp INTEGER, child_count INTEGER NOT NULL, mirror_key TEXT);
CREATE INDEX node_parent ON node(parent_id, id);
CREATE TABLE entry (id INTEGER PRIMARY KEY, file_id INTEGER NOT NULL, page_idx INTEGER NOT NULL, entry_idx INTEGER NOT NULL,
  node_id INTEGER, p_type INTEGER NOT NULL, p_level INTEGER, p_text TEXT NOT NULL,
  s_type INTEGER, s_level INTEGER, s_text TEXT, no_audio INTEGER, key_offset REAL, audio_idx INTEGER,
  UNIQUE (file_id, page_idx, entry_idx));
CREATE TABLE footnote (file_id INTEGER NOT NULL, page_idx INTEGER NOT NULL, lang INTEGER NOT NULL, idx INTEGER NOT NULL,
  text TEXT NOT NULL, PRIMARY KEY (file_id, page_idx, lang, idx)) WITHOUT ROWID;
CREATE VIRTUAL TABLE fts USING fts4(content="", text, tokenize=simple);
`

export function fileGroup(name: string): number | null {
  const m = FILTER_KEYS.map((k, i) => (name === k || name.startsWith(k + '-') ? i : -1)).filter(i => i >= 0)
  if (m.length > 1) throw new Error(`file ${name} matches several filter keys`)
  return m.length ? m[0] : null
}

export interface WriteDbInput {
  corpus: Corpus
  tree: Map<string, TreeTuple>
  order: string[]
  entryNodes: Map<string, number[][]>
  meta: Record<string, string>
}

export function writeDb(outFile: string, { corpus, tree, order, entryNodes, meta }: WriteDbInput) {
  for (const f of [outFile, outFile + '-journal', outFile + '-wal']) fs.rmSync(f, { force: true })
  const db = new Database(outFile)
  db.pragma('journal_mode = OFF')
  db.pragma('synchronous = OFF')
  db.exec(SCHEMA)
  const fileId = new Map(corpus.names.map((n, i) => [n, i + 1]))
  const dfsId = new Map(order.map((k, i) => [k, i + 1]))

  const insFile = db.prepare('INSERT INTO file VALUES (?,?,?,?,?,?,?,?)')
  const insPage = db.prepare('INSERT INTO page VALUES (?,?,?)')
  const insNode = db.prepare('INSERT INTO node VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
  const insEntry = db.prepare('INSERT INTO entry VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  const insFn = db.prepare('INSERT INTO footnote VALUES (?,?,?,?,?)')
  const insFts = db.prepare('INSERT INTO fts(docid, text) VALUES (?,?)')
  const insMeta = db.prepare('INSERT INTO meta VALUES (?,?)')

  db.transaction(() => {
    corpus.files.forEach((f, i) => {
      const id = i + 1, paliOnly = isPaliOnlyFile(f.filename)
      insFile.run(id, f.filename, f.bookId, f.pageOffset, f.collection ?? null, paliOnly ? 1 : 0, fileGroup(f.filename), f.pages.length)
      f.pages.forEach((p, pi) => insPage.run(id, pi, p.pageNum))
    })
    // nodes in DFS order
    const childCount = new Map<string, number>()
    for (const [, v] of tree) childCount.set(v[4], (childCount.get(v[4]) || 0) + 1)
    order.forEach((key, i) => {
      const [pali, sinh, level, [pi, ei], parent, file] = tree.get(key)!
      let grp: number | null = null
      for (let k: string | undefined = key; k && k !== 'root'; k = tree.get(k)?.[4]) {
        const g = (FILTER_KEYS as readonly string[]).indexOf(k)
        if (g >= 0) { grp = g; break }
      }
      const mirror = key.startsWith('atta-') ? key.slice(5) : 'atta-' + key
      insNode.run(i + 1, key, parent === 'root' ? null : dfsId.get(parent), level, pali, sinh, fileId.get(file) ?? null,
        pi, ei, grp, childCount.get(key) || 0, tree.has(mirror) ? mirror : null)
    })
    // entries, footnotes, fts
    let entryId = 0
    corpus.files.forEach((f, i) => {
      const fid = i + 1, paliOnly = isPaliOnlyFile(f.filename), nodes = entryNodes.get(f.filename)!
      let audioIdx = 0
      f.pages.forEach((p, pi) => {
        p.pali.entries.forEach((pe, ei) => {
          entryId++
          const se = paliOnly ? undefined : p.sinh.entries[ei]
          const dfs = nodes[pi][ei]
          insEntry.run(entryId, fid, pi, ei, dfs >= 0 ? dfs + 1 : null, typeToInt(pe.type), pe.level ?? null, pe.text,
            se ? typeToInt(se.type) : null, se ? se.level ?? null : null, se ? se.text : null,
            pe.noAudio ? 1 : null, pe.keyOffset ?? null, pe.noAudio ? null : audioIdx++)
          const pn = normalizeForSearch(pe.text)
          if (pn) insFts.run(BigInt(entryId * 2), pn)
          if (se) { const sn = normalizeForSearch(se.text); if (sn) insFts.run(BigInt(entryId * 2 + 1), sn) }
        })
        p.pali.footnotes.forEach((fn, k) => insFn.run(fid, pi, 0, k, fn.text))
        p.sinh.footnotes.forEach((fn, k) => insFn.run(fid, pi, 1, k, fn.text))
      })
    })
    meta.entry_count = String(entryId)
    for (const [k, v] of Object.entries(meta)) insMeta.run(k, v)
  })()
  db.exec("INSERT INTO fts(fts) VALUES('optimize')")
  db.exec('ANALYZE')
  db.pragma('journal_mode = DELETE')
  db.exec('VACUUM')
  db.close()
}
