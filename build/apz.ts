/**
 * The simplified Sinhala translation (sin_apz) of the pitaka.lk flavor: public/static/text-apz/<file>.json, one file per
 * BJT text file that has it (read-only here, like the BJT text). Only the text is stored: entry i of a page translates
 * Pāḷi entry i of the same page, whose type and level it takes. '' = not translated (the reader shows the Pāḷi only).
 * `ai` lists the entries that were filled in by AI rather than taken from the APZ book (dev/apz-import).
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Corpus } from './corpus'
import type { Issue } from './validate'

export const APZ_DIR = 'public/static/text-apz'

export interface ApzPage { pageNum: number; entries: string[]; ai?: number[] }
export interface ApzFile { filename: string; pages: ApzPage[] }

/** the files of an apz dir by name, empty when there is none */
export function loadApz(dir: string): Map<string, ApzFile> {
  const files = new Map<string, ApzFile>()
  if (!fs.existsSync(dir)) return files
  for (const n of fs.readdirSync(dir).filter(n => n.endsWith('.json')).sort())
    files.set(n.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dir, n), 'utf-8')) as ApzFile)
  return files
}

/** an apz file must match the Pāḷi of its text file exactly: same pages, same entry counts. A missing file is allowed */
export function validateApz(apz: Map<string, ApzFile>, corpus: Corpus): Issue[] {
  const errors: Issue[] = []
  for (const [file, a] of apz) {
    const err = (code: string, where: string, msg: string) => errors.push({ file, code, where, msg })
    const i = corpus.names.indexOf(file)
    if (i < 0) { err('apzFile', '', 'no text file of this name'); continue }
    if (a.filename !== file) err('filename', '', `filename field '${a.filename}' does not match the file name`)
    const pages = corpus.files[i].pages
    if (!Array.isArray(a.pages) || a.pages.length !== pages.length) { err('apzPages', '', `${a.pages?.length} pages, the text has ${pages.length}`); continue }
    a.pages.forEach((p, pi) => {
      const pali = pages[pi].pali.entries
      if (p.pageNum !== pages[pi].pageNum) err('apzPageNum', `${pi}`, `pageNum ${p.pageNum}, the text has ${pages[pi].pageNum}`)
      if (!Array.isArray(p.entries) || p.entries.length !== pali.length) { err('apzEntryCount', `${pi}`, `${p.entries?.length} entries, the pali has ${pali.length}`); return }
      p.entries.forEach((t, ei) => { if (typeof t !== 'string') err('apzText', `${pi}-${ei}`, 'not a string') })
      if (p.ai && !p.ai.every((ei, k) => Number.isInteger(ei) && ei >= 0 && ei < pali.length && (!k || ei > p.ai![k - 1])))
        err('apzAi', `${pi}`, 'ai must list entry indexes of the page in increasing order')
    })
  }
  return errors
}

/** entries with a translation / all entries of the files that have one, for the build report */
export function apzCoverage(apz: Map<string, ApzFile>) {
  let entries = 0, translated = 0, ai = 0
  for (const a of apz.values()) for (const p of a.pages) {
    entries += p.entries.length
    translated += p.entries.filter(t => t.trim()).length
    ai += p.ai?.length || 0
  }
  return { files: apz.size, entries, translated, ai }
}
