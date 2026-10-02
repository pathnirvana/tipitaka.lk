/** Reads the ground-truth text JSON files (read-only, never written). */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export interface JEntry { type: string; text: string; level?: number; noAudio?: boolean; keyOffset?: number }
export interface JSide { entries: JEntry[]; footnotes: JEntry[]; sequenceStart?: number }
export interface JPage { pageNum: number; pali: JSide; sinh: JSide }
export interface JFile { filename: string; pages: JPage[]; bookId: number; pageOffset: number; collection?: string }

export interface Corpus { files: JFile[]; names: string[]; contentHash: string }

/** files sorted by name (same order as the v2 build-tree.js) */
export function loadCorpus(textDir: string): Corpus {
  const names = fs.readdirSync(textDir).filter(n => n.endsWith('.json')).map(n => n.slice(0, -5)).sort()
  const hash = crypto.createHash('sha256')
  const files = names.map(name => {
    const buf = fs.readFileSync(path.join(textDir, name + '.json'))
    hash.update(name).update(buf)
    return JSON.parse(buf.toString('utf-8')) as JFile
  })
  return { files, names, contentHash: hash.digest('hex') }
}
