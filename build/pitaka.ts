/**
 * The pitaka.lk flavor's text.db (dev-docs/pitaka-flavor.md): the BJT Pāḷi with the simplified Sinhala translation
 * (text-apz, build/apz.ts) in place of the BJT Sinhala. No aṭṭhakathā (nor Visuddhimagga: anya-), footnotes or word
 * alignments. The tree comes from the BJT files themselves, so the keys and the Sinhala titles are tipitaka.lk's.
 */
import crypto from 'node:crypto'
import type { Corpus, JEntry, JFile } from './corpus'
import type { ApzFile } from './apz'
import { buildTree, type TreeBuildResult } from './tree'
import { isAttaFile } from '../shared/constants'

export const isPitakaFile = (name: string) => !isAttaFile(name) && !name.startsWith('anya')

/** the tree of the pitaka files: the base tree's nodes of the other files (atta-sp, anya…) are dropped */
export function pitakaTree(corpus: Corpus): TreeBuildResult {
  const res = buildTree(corpus.files.filter(f => isPitakaFile(f.filename)))
  for (const k of res.tree.keys()) if (!isPitakaFile(k)) res.tree.delete(k)
  res.errors = res.errors.filter(e => !/^tree placeholder /.test(e) || isPitakaFile(e.split(' ')[2]))
  return res
}

/**
 * the corpus written to the pitaka db: the pitaka files, the translation as the Sinhala side (type and level of the
 * Pāḷi entry; no entry where it is not translated, so s_text is NULL) and no footnotes
 */
export function pitakaCorpus(corpus: Corpus, apz: Map<string, ApzFile>): Corpus {
  const names: string[] = [], files: JFile[] = []
  corpus.files.forEach((f, i) => {
    const name = corpus.names[i]
    if (!isPitakaFile(name)) return
    const a = apz.get(name)
    names.push(name)
    files.push({
      ...f,
      pages: f.pages.map((p, pi) => ({
        pageNum: p.pageNum,
        pali: { ...p.pali, footnotes: [] },
        // a sparse array: writeDb reads a missing entry as no translation
        sinh: { entries: a ? p.pali.entries.map((pe, ei) => a.pages[pi].entries[ei] ? { type: pe.type, level: pe.level, text: a.pages[pi].entries[ei] } : undefined) as JEntry[] : [], footnotes: [] },
      })),
    })
  })
  const contentHash = crypto.createHash('sha256').update(corpus.contentHash).update(JSON.stringify([...apz])).digest('hex')
  return { files, names, contentHash }
}
