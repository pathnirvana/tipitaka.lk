/**
 * Reads the Pāḷi↔Sinhala alignment store (dev/alignments/<file>.json, format bjt-align/1) for the align table.
 * A record is used only while it is fresh: the sha1 hashes it stores must match the current entry texts
 * (stale records are the realignment queue, listed in the build report), and every word number must exist.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { tokenize } from '../shared/tokenize'
import { parseLinks, parseNums } from '../shared/align'

export const ALIGN_DIR = 'dev/alignments'
export interface AlignRec { ph: string; sh: string; L: string; pu: string; sa: string; src: string; at?: string }
export interface AlignRow { links: string; pu: string; sa: string; src: number }
export interface AlignStats { fresh: number; stale: number; invalid: number; staleKeys: string[] }

const textHash = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12)
/** src in the db: 1 model, 2 Opus (reference model), 3 checked by a reviewer, 4 by rule (headings, numbers) */
export function srcCode(src: string): number {
  return src === 'rule' ? 4 : src.startsWith('reviewer') ? 3 : src.startsWith('opus') ? 2 : 1
}

export class Alignments {
  readonly files = new Map<string, Record<string, AlignRec>>()
  readonly stats = new Map<string, AlignStats>()
  readonly hash: string // content hash of the store (part of api_hash)
  constructor(readonly dir = ALIGN_DIR) {
    const h = crypto.createHash('sha1')
    const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => n.endsWith('.json')).sort() : []
    for (const n of names) {
      const buf = fs.readFileSync(path.join(dir, n))
      h.update(n).update(buf)
      const j = JSON.parse(buf.toString('utf-8'))
      if (j.format !== 'bjt-align/1' || j.tokenizer !== 'v1') throw new Error(`${dir}/${n}: unknown format ${j.format}/${j.tokenizer}`)
      this.files.set(j.file, j.paras)
    }
    this.hash = h.digest('hex').slice(0, 16)
  }

  /** the row for one entry, or null (no record, stale or invalid - counted in stats) */
  row(file: string, pageIdx: number, entryIdx: number, pText: string, sText: string): AlignRow | null {
    const rec = this.files.get(file)?.[`${pageIdx}:${entryIdx}`]
    if (!rec) return null
    const st = this.stats.get(file) || { fresh: 0, stale: 0, invalid: 0, staleKeys: [] }
    this.stats.set(file, st)
    if (rec.ph !== textHash(pText) || rec.sh !== textHash(sText)) { st.stale++; st.staleKeys.push(`${pageIdx}:${entryIdx}`); return null }
    const np = tokenize(pText).length, ns = tokenize(sText).length
    const groups = parseLinks(rec.L), pu = parseNums(rec.pu), sa = parseNums(rec.sa)
    const ok = groups && pu && sa && groups.every(g => g.p.every(i => i < np) && g.s.every(i => i < ns))
      && pu.every(i => i < np) && sa.every(i => i < ns)
    if (!ok) { st.invalid++; return null }
    st.fresh++
    return { links: rec.L, pu: rec.pu, sa: rec.sa, src: srcCode(rec.src) }
  }

  /** build report lines: counts per file and the stale entries (to realign) */
  report(): string[] {
    const out = [`## Alignments (${this.dir})`, '']
    let f = 0, s = 0, inv = 0
    for (const [file, st] of [...this.stats].sort()) {
      f += st.fresh; s += st.stale; inv += st.invalid
      out.push(`- ${file}: ${st.fresh} fresh` + (st.stale ? `, ${st.stale} stale (${st.staleKeys.slice(0, 20).join(' ')}${st.staleKeys.length > 20 ? ' …' : ''})` : '') + (st.invalid ? `, ${st.invalid} invalid` : ''))
    }
    for (const file of this.files.keys()) if (!this.stats.has(file)) out.push(`- ${file}: no matching entries`)
    out.splice(2, 0, `${f} entries aligned, ${s} stale, ${inv} invalid.`, '')
    return out
  }
}
