/**
 * Word alignment of tipitaka.lk's texts with tipitaka.app's CST text (../cst/db/text.db): shared by
 * dev/atta-vri/reimport.ts (the atta Pāḷi sync) and dev/cst-map/map.ts (entry <-> CST paragraph mapping).
 */
import Database from 'better-sqlite3'
import { convert } from '@pnfo/pali-converter'

export const CST_DB = process.env.CST_DB || '../cst/db/text.db'

// ---------------- words ----------------
export interface Tok { w: string; s: number; e: number; star: boolean } // [s, e) in the source text; star: ** inside the word
export const isLetter = (c: string) => c >= '඀' && c <= '෿'
/** Sinhala words; joiners and bold marks (*) do not split a word (lk and VRI place bold differently) */
export function tokenize(t: string): Tok[] {
  const out: Tok[] = []
  let w = '', s = -1, e = -1, star = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (isLetter(c)) { if (s < 0) s = i; w += c; e = i + 1; continue }
    if (c === '‍' || c === '‌') continue
    if (c === '*' && s >= 0 && isLetter(t[i + 2] ?? '')) { star = true; continue } // ** inside a word
    if (w) out.push({ w, s, e, star })
    w = ''; s = -1; star = false
  }
  if (w) out.push({ w, s, e, star })
  return out
}

// ---------------- CST (VRI) ----------------
export interface VPara { book: number; bookName: string; idx: number; rend: string; text: string }
/** VRI's Roman text -> lk's Sinhala conventions (no joiners, “ ”, · in references) */
export function vriToLk(roman: string): string {
  let t = roman.replace(/\|[A-Za-z]+\d[\d.]*\|/g, '').replace(/‘‘/g, '“').replace(/’’/g, '”')
  t = convert(t, 'sinh', 'latn').replace(/[‍‌]/g, '')
  t = t.replace(/\(([^()]*)\)/g, (_, inner: string) => '(' + inner.replace(/([඀-෿])\.(?= [඀-෿\d])/g, '$1·') + ')') // (ම. නි. 2.77) -> (ම· නි· 2.77)
  return t.replace(/\s+/g, ' ').trim()
}

// ---------------- CST Roman offsets (tipitaka.app's glosses) ----------------
const ROMAN_LETTER = /[A-Za-zāīūṃṅñṭḍṇḷĀĪŪṂṄÑṬḌṆḶ]/
const sinhCache = new Map<string, string>()
const toSinhWord = (w: string): string => {
  let s = sinhCache.get(w)
  if (s === undefined) sinhCache.set(w, s = (convert(w, 'sinh', 'latn') as string).replace(/[‍‌]/g, ''))
  return s
}
/**
 * the words of a CST paragraph (Roman, as in tipitaka.app's para.text) with their Roman offsets [s, e), in the order of
 * tokenize(vriToLk(text)): out[i] is the Roman span of the i-th Sinhala word of loadCst's paragraph (null: not found)
 */
export function romanSpans(roman: string): ([number, number] | null)[] {
  const t = roman.replace(/\|[A-Za-z]+\d[\d.]*\|/g, m => ' '.repeat(m.length)) // page refs (vriToLk removes them)
  const rw: { w: string; s: number; e: number }[] = []
  let s = -1, e = -1, w = ''
  const flush = () => {
    if (s >= 0) for (const tk of tokenize(toSinhWord(w))) rw.push({ w: tk.w, s, e }) // (one Roman word is one Sinhala word)
    s = -1; w = ''
  }
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (ROMAN_LETTER.test(c)) { if (s < 0) s = i; w += c; e = i + 1; continue }
    if (c === '*' && s >= 0 && t[i + 1] === '*' && ROMAN_LETTER.test(t[i + 2] ?? '')) { i++; continue } // ** inside a word
    flush()
  }
  flush()
  const sw = tokenize(vriToLk(roman)).map(x => x.w)
  if (sw.length === rw.length && sw.every((x, i) => x === rw[i].w)) return rw.map(x => [x.s, x.e])
  const ids = new Map<string, number>()
  const id = (x: string) => { let n = ids.get(x); if (n === undefined) ids.set(x, n = ids.size); return n }
  const out: ([number, number] | null)[] = sw.map(() => null)
  const ops = myers(sw.map(id), rw.map(x => id(x.w)), 2000)
  if (ops) for (const o of ops) if (o.op === 'eq') out[o.a] = [rw[o.b].s, rw[o.b].e]
  return out
}

/** the Sinhala word index of a Roman offset: the word containing it, else the next word (start) / the previous (end) */
export function wordAt(spans: ([number, number] | null)[], off: number, end: boolean): number {
  if (!end) {
    for (let i = 0; i < spans.length; i++) { const sp = spans[i]; if (sp && sp[1] > off) return i }
    return -1
  }
  for (let i = spans.length - 1; i >= 0; i--) { const sp = spans[i]; if (sp && sp[0] < off) return i }
  return -1
}

export interface GTok { w: string; para: number; s: number; e: number }
/** the paragraphs of the CST books of the collections (mula, atta ...) in Sinhala script, their words and a word trigram
 * index (positions) for locating passages */
export function loadCst(colls: string[]) {
  const db = new Database(CST_DB, { readonly: true })
  const upstream = (db.prepare(`SELECT v FROM meta WHERE k = 'upstream'`).get() as { v: string }).v
  const rows = db.prepare(`SELECT p.book_id AS book, b.name AS bookName, p.idx, p.rend, p.text FROM para p JOIN book b ON b.id = p.book_id
    WHERE b.coll IN (${colls.map(c => `'${c}'`).join(',')}) ORDER BY p.book_id, p.idx`).all() as VPara[]
  db.close()
  const paras = rows.map(r => ({ ...r, text: vriToLk(r.text) }))
  const toks: GTok[] = []
  paras.forEach((p, i) => { for (const t of tokenize(p.text)) toks.push({ w: t.w, para: i, s: t.s, e: t.e }) })
  // word trigrams -> positions (common ones dropped: they do not locate anything)
  const tri = new Map<string, number[]>()
  for (let i = 0; i + 2 < toks.length; i++) {
    const k = toks[i].w + ' ' + toks[i + 1].w + ' ' + toks[i + 2].w
    const l = tri.get(k)
    if (!l) tri.set(k, [i]); else if (l.length <= 8) l.push(i)
  }
  return { upstream, paras, toks, tri }
}

// ---------------- Myers diff of two word lists ----------------
export type Op = { op: 'eq' | 'del' | 'ins'; a: number; b: number; n: number } // del: a only, ins: b only
export function myers(a: number[], b: number[], maxD: number): Op[] | null {
  const n = a.length, m = b.length, max = n + m, off = max
  let v = new Int32Array(2 * max + 2)
  const trace: Int32Array[] = []
  let found = -1
  for (let d = 0; d <= Math.min(max, maxD); d++) {
    trace.push(v.slice())
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) { x++; y++ }
      v[off + k] = x
      if (x >= n && y >= m) { found = d; break }
    }
    if (found >= 0) break
  }
  if (found < 0) return null
  // backtrack
  const ops: Op[] = []
  let x = n, y = m
  for (let d = found; d >= 0; d--) {
    const vd = trace[d], k = x - y
    const prevK = d === 0 ? 0 : k === -d || (k !== d && vd[off + k - 1] < vd[off + k + 1]) ? k + 1 : k - 1
    const prevX = d === 0 ? 0 : vd[off + prevK], prevY = prevX - prevK
    while (x > prevX && y > prevY) { x--; y--; ops.push({ op: 'eq', a: x, b: y, n: 1 }) }
    if (d > 0) { if (x === prevX) { y--; ops.push({ op: 'ins', a: x, b: y, n: 1 }) } else { x--; ops.push({ op: 'del', a: x, b: y, n: 1 }) } }
  }
  return ops.reverse()
}

