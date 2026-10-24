/**
 * Brings the aṭṭhakathā Pāḷi of tipitaka.lk (public/static/text/atta-*.json, from VRI's CSCD text of ~2018) up to the
 * VRI text tipitaka.app uses (tipitaka-xml at the commit of its db: ../cst/db/text.db meta 'upstream').
 *
 *   npx tsx dev/atta-vri/reimport.ts [--file atta-dn-1] [--write]
 *
 * Only words change, in place: lk's pages, entries (its splits and joins of VRI paragraphs, balanced against the Sinhala
 * translation), punctuation, bold and headings stay; the Sinhala side is not touched.
 *  1. VRI paragraphs -> Sinhala script (@pnfo/pali-converter), page markers removed
 *  2. each lk file is cut into segments at its headings; a segment is located in VRI by word trigrams (Jātaka stories
 *     are in the Sinhala order, VRI's differs) and aligned word by word (Myers diff)
 *  3. only clear corrections are applied: lk still has the words it was first committed with (else a proofreader
 *     corrected them: lk's reading stays and is reported as a possible VRI error), lk's word occurs nowhere in VRI (a
 *     typo or an outdated reading) and VRI's word is similar. Everything else is listed for review:
 *     headings (lk wrote its own), spacing only (VRI joins quoted lemmas: athakho), inserted / deleted words, edition
 *     variants, passages longer than MAX_HUNK words, differences across two entries, segments outside the file's books.
 * Output: dev/atta-vri/report.md (summary), changes.tsv (applied), errata.tsv (lk corrections kept), review.tsv (not applied)
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { convert } from '@pnfo/pali-converter'

const CST_DB = process.env.CST_DB || '../cst/db/text.db'
const TEXT_DIR = 'public/static/text'
const SYNC_DIR = 'dev/atta-vri' // keep.tsv and the report of the last sync (in git)
const OUT_DIR = process.env.ATTA_OUT || SYNC_DIR
const WRITE = process.argv.includes('--write')
const ONLY = (() => { const i = process.argv.indexOf('--file'); return i > 0 ? process.argv[i + 1] : '' })()
const MAX_HUNK = 8 // words on either side of a difference applied automatically
const CTX = 2 // words of context for the "unchanged since the first commit" check

// ---------------- words ----------------
interface Tok { w: string; s: number; e: number; star: boolean } // [s, e) in the source text; star: ** inside the word
const isLetter = (c: string) => c >= '඀' && c <= '෿'
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

// ---------------- VRI ----------------
interface VPara { book: number; bookName: string; idx: number; rend: string; text: string }
/** VRI's Roman text -> lk's Sinhala conventions (no joiners, “ ”, · in references) */
export function vriToLk(roman: string): string {
  let t = roman.replace(/\|[A-Za-z]+\d[\d.]*\|/g, '').replace(/‘‘/g, '“').replace(/’’/g, '”')
  t = convert(t, 'sinh', 'latn').replace(/[‍‌]/g, '')
  t = t.replace(/\(([^()]*)\)/g, (_, inner: string) => '(' + inner.replace(/([඀-෿])\.(?= [඀-෿\d])/g, '$1·') + ')') // (ම. නි. 2.77) -> (ම· නි· 2.77)
  return t.replace(/\s+/g, ' ').trim()
}

interface GTok { w: string; para: number; s: number; e: number }
function loadVri() {
  const db = new Database(CST_DB, { readonly: true })
  const upstream = (db.prepare(`SELECT v FROM meta WHERE k = 'upstream'`).get() as { v: string }).v
  const rows = db.prepare(`SELECT p.book_id AS book, b.name AS bookName, p.idx, p.rend, p.text FROM para p JOIN book b ON b.id = p.book_id
    WHERE b.coll = 'atta' ORDER BY p.book_id, p.idx`).all() as VPara[]
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
type Op = { op: 'eq' | 'del' | 'ins'; a: number; b: number; n: number } // del: a only, ins: b only
function myers(a: number[], b: number[], maxD: number): Op[] | null {
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

// ---------------- lk files ----------------
interface Entry { page: number; idx: number; type: string; text: string; toks: Tok[] }
interface Hunk { file: string; page: number; entry: number; kind: string; lk: string; vri: string; where: string }

/** lk's text as of the last sync with VRI (the commit of dev/atta-vri/report.md), else as first committed: words lk
 * changed since are a proofreader's corrections */
const baseText = (rel: string) => {
  const sync = execSync(`git log -1 --format=%H -- ${SYNC_DIR}/report.md`).toString().trim()
  const sha = sync || execSync(`git log --format=%H --reverse -- ${rel}`).toString().trim().split('\n')[0]
  try { return execSync(`git show ${sha}:${rel}`, { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }).toString() } catch { return '' }
}

/** VRI paragraph types that are body text (titles are lk's own headings) */
const BODY = new Set(['bodytext', 'indent', 'unindented', 'gatha1', 'gatha2', 'gatha3', 'gathalast', 'hangnum'])
/** title-like VRI paragraphs stored as body text (Jātaka stories, vagga ends): short, ending in a title word */
const TITLE_END = /(වණ්ණනා|නිට්ඨිතා|නිට්ඨිතො|නිට්ඨිතං|සමත්තා|වත්ථු|වග්ගො|වග්ගො\.|කථා|ජාතකං|පෙය්යාලො|නිද්දෙසො|සුත්තං|පඨමො|දුතියො|තතියො)[\s.,:;”’)–-]*$/
const isBody = (p: VPara) => BODY.has(p.rend) && !(p.rend.startsWith('gatha') ? false : tokenize(p.text).length <= 8 && TITLE_END.test(p.text.trim()))
/** the kinds of differences applied: clear corrections and VRI's word division. VRI text lk seems to lack is listed for
 * review: checked one by one (2026-10), all were alignment artifacts at lk's headings (lk has the text in the entry
 * before the heading, VRI's sentence is from another vagga, or VRI repeats it with and without the words) */
const APPLY = new Set(['apply', 'spacing'])

/** the VRI words b (positions in vri.toks) with their punctuation: per paragraph from the first to the last word and
 * its punctuation, paragraphs joined by a space */
function vriSpan(vri: { paras: VPara[]; toks: GTok[] }, bs: number[]): string {
  const parts: string[] = []
  let i = 0
  while (i < bs.length) {
    let j = i
    while (j + 1 < bs.length && vri.toks[bs[j + 1]].para === vri.toks[bs[i]].para && bs[j + 1] === bs[j] + 1) j++
    const p = vri.paras[vri.toks[bs[i]].para].text
    let e = vri.toks[bs[j]].e
    while (e < p.length && /[^\s඀-෿]/.test(p[e])) e++
    parts.push(p.slice(vri.toks[bs[i]].s, e))
    i = j + 1
  }
  return parts.join(' ')
}

/** lk's text of a passage with VRI's word division (same letters): spaces where VRI divides, none elsewhere; lk's bold
 * marks and joiners stay. null when punctuation sits inside a word VRI joins */
export function respace(t: string, vriWords: string[]): string | null {
  const bounds = new Set<number>()
  let acc = 0
  for (const w of vriWords.slice(0, -1)) bounds.add(acc += w.length)
  let out = '', letters = 0
  for (const c of t) {
    if (isLetter(c)) {
      if (bounds.has(letters) && !/\s\**$/.test(out) && !/^\**$/.test(out)) out = out.replace(/(\**)$/, ' $1') // a division: a space (before a bold mark)
      out += c; letters++
    } else if (/\s/.test(c)) {
      if (bounds.has(letters)) out += c // a space VRI has too
    } else if (c === '*' || c === '\u200D' || c === '\u200C') out += c
    else if (bounds.has(letters)) out += c // punctuation at a division
    else return null
  }
  return out.replace(/\*\*\*\*/g, '') // two bold runs VRI joins into one word: one run
}

/** typos inside bold lemmas (the word patcher does not edit across ** marks) and a stray letter: exact replacements */
const MANUAL: [string, string, string][] = [
  ['atta-kn-jat-4', '**මහබ්බලස්සා**තිඑ', '**මහබ්බලස්සා**ති'],
  ['atta-vp-mv', '**කාළ්ඤ්ජන**න්ති', '**කාළඤ්ජන**න්ති'],
  ['atta-vp-pct', '**පාතිමොක්ඛසංවරසංවුතා**එ', '**පාතිමොක්ඛසංවරසංවුතො**'],
  ['atta-vp-prj-2', '**අට්ඨකථාස**උ', '**අට්ඨකථාසු**'],
  ['atta-an-8', 'මුඛතුණ්ඩකෙන වා ං පාදනඛසිඛාය', 'මුඛතුණ්ඩකෙන වා පාදනඛසිඛාය'],
]

const keepKey = (file: string, lk: string, vri: string) => `${file}\t${lk}\t${vri}`
/** lk's deliberate differences from VRI (dev/atta-vri/keep.tsv: file, lk words, VRI words) - never changed */
function loadKeep(): Set<string> {
  const f = path.join(SYNC_DIR, 'keep.tsv')
  if (!fs.existsSync(f)) return new Set()
  return new Set(fs.readFileSync(f, 'utf-8').split('\n').slice(1).filter(Boolean).map(l => { const [file, lk, vri] = l.split('\t'); return keepKey(file, lk ?? '', vri ?? '') }))
}

const lev = (a: string, b: string) => {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t }
  }
  return d[b.length]
}

/** baseRaw: the text lk's words are checked against (default: as of the last sync); later passes over a file use the
 * text before the pass (the passages a pass inserts change the alignment of repetitive text) */
function processFile(file: string, vri: ReturnType<typeof loadVri>, ids: Map<string, number>, vriFreq: Map<string, number>, keep: Set<string>, baseRaw?: string) {
  const rel = path.join(TEXT_DIR, file + '.json')
  const raw = fs.readFileSync(rel, 'utf-8')
  let manual = 0
  const doc = JSON.parse(raw) as { pages: { pali: { entries: { type: string; text: string }[] } }[] }
  const entries: Entry[] = []
  doc.pages.forEach(pg => pg.pali.entries.forEach(e => {
    for (const [f, from, to] of MANUAL) if (f === file && e.text.includes(from)) { e.text = e.text.replace(from, to); manual++ }
  }))
  doc.pages.forEach((pg, p) => pg.pali.entries.forEach((e, i) => entries.push({ page: p, idx: i, type: e.type, text: e.text, toks: tokenize(e.text) })))
  // the words of the file as first committed (the VRI reading of ~2018 plus lk's earliest edits)
  let base = ''
  {
    const b = JSON.parse(baseRaw ?? (baseText(rel) || raw)) as typeof doc
    base = ' ' + b.pages.flatMap(pg => pg.pali.entries.flatMap(e => tokenize(e.text).map(t => t.w))).join(' ') + ' '
  }
  const inBase = (ws: string[]) => base.includes(' ' + ws.join(' ') + ' ')
  const id = (w: string) => { let n = ids.get(w); if (n === undefined) ids.set(w, n = ids.size); return n }
  const vriIds = vri.toks.map(t => id(t.w)) // (the same ids table for every file)

  // segments: from a heading to the next
  type Ref = { e: number; t: number } // entry, token of the entry
  const segs: Ref[][] = []
  let cur: Ref[] = []
  entries.forEach((en, ei) => {
    if ((en.type === 'heading' || en.type === 'centered') && cur.length >= 30) { segs.push(cur); cur = [] }
    // lk's headings are its own titles: they mark the segments but are not aligned (a heading word aligned against the
    // same word in a VRI sentence makes the rest of that sentence look missing)
    if (en.type !== 'heading') en.toks.forEach((_, ti) => cur.push({ e: ei, t: ti })) // (centered entries are text: verses, summaries)
  })
  if (cur.length) segs.push(cur)

  const hunks: Hunk[] = []
  /** VRI text lk seems to lack at entry e: next to an lk heading it is VRI's text lk made into (or placed before) its
   * heading; mostly found in the entries around: the alignment went astray (lk's order or splits differ); else an insert */
  const insertKind = (e: number, ws: string[]) => {
    if ([e - 1, e, e + 1].some(j => entries[j]?.type === 'heading')) return 'heading'
    const near = ' ' + entries.slice(Math.max(0, e - 5), e + 6).flatMap(en => en.toks.map(t => t.w)).join(' ') + ' '
    const grams = ws.length < 4 ? [ws.join(' ')] : ws.slice(0, -3).map((_, gi) => ws.slice(gi, gi + 4).join(' '))
    return grams.filter(g => near.includes(' ' + g + ' ')).length / grams.length >= 0.5 ? 'present' : 'insert'
  }
  const edits = new Map<number, { s: number; e: number; text: string }[]>() // entry -> replacements
  // edits of the hunks to apply, collected first: a passage lk has in another place than VRI (a move) is left as it is
  const pending: { h: Hunk; edits: { e: number; ed: { s: number; e: number; text: string } }[] }[] = []
  let pend: { h: Hunk; edits: { e: number; ed: { s: number; e: number; text: string } }[] } | null = null
  const addEdit = (e: number, ed: { s: number; e: number; text: string }) => pend!.edits.push({ e, ed })
  const stats = { words: 0, matched: 0, segments: segs.length, unlocated: 0, applied: 0, errata: 0, review: 0, books: new Set<string>() }
  const word = (r: Ref) => entries[r.e].toks[r.t]
  // locate every segment: the offset most trigrams agree on
  const located = segs.map(seg => {
    const votes = new Map<number, number>()
    for (let j = 0; j + 2 < seg.length; j++) {
      const k = word(seg[j]).w + ' ' + word(seg[j + 1]).w + ' ' + word(seg[j + 2]).w
      for (const p of vri.tri.get(k) ?? []) votes.set(p - j, (votes.get(p - j) ?? 0) + 1)
    }
    let best = -1, bestN = 0
    for (const [o, n] of votes) if (n > bestN) { best = o; bestN = n }
    return { best, bestN, book: best >= 0 ? vri.paras[vri.toks[Math.max(0, best)].para].bookName : '' }
  })
  // the VRI books of the file: those most of its words are found in (a short formulaic segment, e.g. a colophon, can
  // match the same words in another book)
  const bookWords = new Map<string, number>()
  located.forEach((l, i) => { if (l.book) bookWords.set(l.book, (bookWords.get(l.book) ?? 0) + segs[i].length) })
  const fileWords = segs.reduce((n, sg) => n + sg.length, 0)
  const home = new Set([...bookWords].filter(([, n]) => n >= 0.05 * fileWords).map(([b]) => b))
  for (const [si, seg] of segs.entries()) {
    stats.words += seg.length
    const { best, bestN, book } = located[si]
    if (bestN >= 3 && !home.has(book)) { stats.unlocated++; hunks.push({ file, page: entries[seg[0].e].page, entry: entries[seg[0].e].idx, kind: 'other-book', lk: seg.slice(0, 12).map(r => word(r).w).join(' '), vri: book, where: '' }); continue }
    if (bestN < Math.max(3, 0.15 * seg.length)) { stats.unlocated++; hunks.push({ file, page: entries[seg[0].e].page, entry: entries[seg[0].e].idx, kind: 'unlocated', lk: seg.slice(0, 12).map(r => word(r).w).join(' '), vri: '', where: '' }); continue }
    const from = Math.max(0, best - 40), to = Math.min(vri.toks.length, best + Math.ceil(seg.length * 1.2) + 80)
    const ops = myers(seg.map(r => id(word(r).w)), vriIds.slice(from, to), 6000)
    if (!ops) { stats.unlocated++; continue }
    stats.books.add(vri.paras[vri.toks[best].para].bookName)
    // group into hunks between equal runs; VRI-only words before the first / after the last match are the window margin
    const firstEq = ops.findIndex(o => o.op === 'eq'), lastEq = ops.length - 1 - [...ops].reverse().findIndex(o => o.op === 'eq')
    stats.matched += ops.filter(o => o.op === 'eq').length
    const matchPara = new Map<number, number>() // lk word -> its VRI paragraph
    for (const o of ops) if (o.op === 'eq') matchPara.set(o.a, vri.toks[o.b + from].para)
    let i = 0
    while (i < ops.length) {
      if (ops[i].op === 'eq') { i++; continue }
      let j = i
      while (j < ops.length && ops[j].op !== 'eq') j++
      const hs = ops.slice(i, j)
      i = j
      const dels = hs.filter(o => o.op === 'del').map(o => o.a)
      // VRI's title paragraphs (chapter, subhead ...) are lk's own headings: only VRI's body text is brought in
      const inss = hs.filter(o => o.op === 'ins').map(o => o.b + from).filter(b => isBody(vri.paras[vri.toks[b].para]))
      if (!dels.length && (j <= firstEq || i - hs.length > lastEq)) continue // margin
      if (!dels.length && !inss.length) continue // only VRI titles
      const a1 = dels.length ? dels[0] : hs[0].a // lk position (insert before a1)
      const lkWords = dels.map(a => word(seg[a]).w), vriWords = inss.map(b => vri.toks[b].w)
      const ctxBefore = seg.slice(Math.max(0, a1 - CTX), a1).map(r => word(r).w)
      const afterAt = dels.length ? dels[dels.length - 1] + 1 : a1
      const ctxAfter = seg.slice(afterAt, afterAt + CTX).map(r => word(r).w)
      const anchor = seg[Math.min(a1, seg.length - 1)], en = entries[anchor.e]
      const vriPara = inss.length ? vri.paras[vri.toks[inss[0]].para] : vri.paras[vri.toks[Math.min(best + a1, vri.toks.length - 1)].para]
      const h: Hunk = { file, page: en.page, entry: en.idx, kind: '', lk: lkWords.join(' '), vri: vriWords.join(' '), where: `${vriPara.bookName}#${vriPara.idx}` }
      const spacing = !!lkWords.length && lkWords.join('') === vriWords.join('')
      if (en.type === 'heading' || en.type === 'centered') h.kind = 'heading'
      else if (keep.has(keepKey(file, h.lk, h.vri))) h.kind = 'keep'
      else if (new Set(dels.map(a => seg[a].e)).size > 1) h.kind = 'across-entries'
      else if (lkWords.length && !inBase([...ctxBefore, ...lkWords, ...ctxAfter])) h.kind = 'lk-edit' // (VRI text lk lacks: listed as insert)
      else if (spacing) h.kind = 'spacing' // VRI joins the words of quoted lemmas (athakho) - also inside bold
      else if (dels.some(a => word(seg[a]).star)) h.kind = 'bold-inside'
      else if (!lkWords.length) h.kind = insertKind(anchor.e, vriWords)
      else if (!vriWords.length) h.kind = 'delete'
      else if (dels.length > MAX_HUNK || inss.length > MAX_HUNK) h.kind = 'long'
      // a clear correction: lk's words occur nowhere in VRI (a typo, or an outdated reading) and VRI's are similar; when
      // lk's word is used elsewhere in VRI the difference is a variant (or VRI's own typo: දෙවානඤ්ච -> දඑවානඤ්ච)
      else if (lkWords.every(w => !vriFreq.has(w)) && lev(lkWords.join(' '), vriWords.join(' ')) <= Math.max(4, Math.ceil(vriWords.join(' ').length / 3))) h.kind = 'apply'
      else h.kind = 'variant'
      hunks.push(h)
      if (h.kind === 'lk-edit') { stats.errata++; continue }
      if (h.kind === 'keep') continue
      if (!APPLY.has(h.kind)) { stats.review++; continue }
      pend = { h, edits: [] }
      pending.push(pend)
      // the VRI words with their punctuation, paragraph by paragraph (a passage can span paragraphs or verse lines)
      const vriText = vriSpan(vri, inss)
      if (h.kind === 'spacing') {
        const t1 = word(seg[dels[0]]), t2 = word(seg[dels[dels.length - 1]])
        const re = respace(en.text.slice(t1.s, t2.e), vriWords)
        if (re === null) { h.kind = 'spacing-punctuation'; stats.review++; pending.pop(); continue }
        addEdit(anchor.e, { s: t1.s, e: t2.e, text: re })
      } else if (dels.length) {
        const t1 = word(seg[dels[0]]), t2 = word(seg[dels[dels.length - 1]])
        addEdit(anchor.e, { s: t1.s, e: t2.e, text: vriText })
      } else {
        // an insert: after the previous word (and its punctuation) when the passage continues its VRI paragraph or the
        // previous word is in the same entry, else before the next word
        const prevRef = a1 > 0 ? seg[a1 - 1] : null, nextRef = a1 < seg.length ? seg[a1] : null
        const prevPara = prevRef ? matchPara.get(a1 - 1) : undefined
        const afterPrev = prevRef && (!nextRef || prevRef.e === nextRef.e || prevPara === vri.toks[inss[0]].para || matchPara.get(a1) !== vri.toks[inss[inss.length - 1]].para)
        const target = afterPrev && prevRef ? prevRef.e : nextRef ? nextRef.e : -1
        if (target < 0 || entries[target].type === 'heading' || entries[target].type === 'centered') { h.kind = 'heading'; stats.review++; pending.pop(); continue }
        // lk has (most of) the passage in a neighbouring entry, headings included: the alignment went astray where lk's
        // order or splits differ from VRI's - measured by the share of the passage's 4-word sequences found nearby
        const near = ' ' + entries.slice(Math.max(0, target - 5), target + 6).flatMap(en => en.toks.map(t => t.w)).join(' ') + ' '
        const grams = vriWords.length < 4 ? [vriWords.join(' ')] : vriWords.slice(0, -3).map((_, gi) => vriWords.slice(gi, gi + 4).join(' '))
        if (grams.filter(g => near.includes(' ' + g + ' ')).length / grams.length >= 0.5) { h.kind = 'present'; pending.pop(); continue }
        if (afterPrev && prevRef) {
          const pe = entries[prevRef.e]
          let at = word(prevRef).e
          while (at < pe.text.length && /[^\s඀-෿]/.test(pe.text[at])) at++ // its punctuation (. ” ...)
          addEdit(prevRef.e, { s: at, e: at, text: ' ' + vriText })
        } else if (nextRef) {
          const t = word(nextRef)
          addEdit(nextRef.e, { s: t.s, e: t.s, text: vriText + ' ' })
        }
      }
    }
  }
  // moves: an insert whose letters lk has as words VRI lacks elsewhere in the file (lk's order differs from VRI's)
  const letters = (t: string) => [...t.replace(/\s/g, '')].sort().join('')
  const removed = new Set(hunks.filter(h => h.lk && !h.vri).map(h => letters(h.lk)))
  for (const pd of pending) {
    if (pd.h.kind === 'insert' && removed.has(letters(pd.h.vri))) { pd.h.kind = 'moved'; stats.review++; continue }
    for (const { e, ed } of pd.edits) { const l = edits.get(e) ?? []; l.push(ed); edits.set(e, l) }
    stats.applied++
  }
  for (const h of hunks) if (h.lk && !h.vri && removed.has(letters(h.lk)) && hunks.some(x => x.kind === 'moved' && letters(x.vri) === letters(h.lk))) h.kind = 'moved'
  // apply the edits (from the end of each entry)
  let changed = manual
  for (const [ei, list] of edits) {
    const en = entries[ei]
    let t = en.text
    for (const ed of [...list].sort((x, y) => y.s - x.s)) t = t.slice(0, ed.s) + ed.text + t.slice(ed.e)
    if (t !== en.text) { doc.pages[en.page].pali.entries[en.idx].text = t; changed++ }
  }
  if (WRITE && changed) {
    // the same formatting as the file (indent, final newline): only the changed lines differ
    const fmt = [4, 2, '\t'].find(ind => JSON.stringify(JSON.parse(raw), null, ind) === raw.replace(/\n$/, '')) ?? 4
    fs.writeFileSync(rel, JSON.stringify(doc, null, fmt) + (raw.endsWith('\n') ? '\n' : ''))
  }
  return { stats, hunks, changed }
}

function main() {
  const t0 = Date.now()
  const vri = loadVri()
  console.log(`VRI atta: ${vri.paras.length} paragraphs, ${vri.toks.length} words (tipitaka-xml ${vri.upstream.slice(0, 10)}) in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  const files = fs.readdirSync(TEXT_DIR).filter(f => f.startsWith('atta-') && f.endsWith('.json')).map(f => f.slice(0, -5))
    .filter(f => !ONLY || f === ONLY).sort()
  const ids = new Map<string, number>()
  const vriFreq = new Map<string, number>()
  for (const t of vri.toks) vriFreq.set(t.w, (vriFreq.get(t.w) ?? 0) + 1)
  const all: Hunk[] = []
  const keep = loadKeep()
  const rows: string[] = []
  const tot = { words: 0, matched: 0, applied: 0, errata: 0, review: 0, unlocated: 0, segments: 0, entries: 0 }
  for (const f of files) {
    // passes until nothing changes (writing only); lk's corrections found in the first pass are kept in the later ones
    let { stats, hunks, changed } = processFile(f, vri, ids, vriFreq, keep)
    const fileKeep = new Set([...keep, ...hunks.filter(h => h.kind === 'lk-edit').map(h => keepKey(f, h.lk, h.vri))])
    for (let pass = 2; WRITE && changed && pass <= 4; pass++) {
      const before = fs.readFileSync(path.join(TEXT_DIR, f + '.json'), 'utf-8')
      const r = processFile(f, vri, ids, vriFreq, fileKeep, before)
      if (!r.changed) break
      stats.applied += r.stats.applied; changed += r.changed
      hunks = [...hunks.filter(h => h.kind !== 'lk-edit' || true), ...r.hunks.filter(h => ['apply', 'spacing', 'insert'].includes(h.kind))]
    }
    all.push(...hunks)
    if (ONLY) for (const h of hunks) if (h.kind !== 'heading') console.log(h.kind, h.page + ':' + h.entry, '[' + h.lk.slice(0, 60) + '] -> [' + h.vri.slice(0, 80) + ']')
    for (const k of ['words', 'matched', 'applied', 'errata', 'review', 'unlocated', 'segments'] as const) tot[k] += stats[k]
    tot.entries += changed
    rows.push(`| ${f} | ${[...stats.books].join(' ')} | ${stats.words} | ${(100 * stats.matched / Math.max(1, stats.words)).toFixed(2)}% | ${stats.applied} | ${changed} | ${stats.errata} | ${stats.review} | ${stats.unlocated}/${stats.segments} |`)
    console.log(`${f}: ${(100 * stats.matched / Math.max(1, stats.words)).toFixed(2)}% same, applied ${stats.applied} (${changed} entries), lk edits ${stats.errata}, review ${stats.review}, unlocated ${stats.unlocated}/${stats.segments}`)
  }
  if (ONLY && !WRITE) return
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const tsv = (kinds: string[]) => ['file\tpage\tentry\tkind\tlk\tvri\tvri_para', ...all.filter(h => kinds.includes(h.kind))
    .map(h => [h.file, h.page, h.entry, h.kind, h.lk, h.vri, h.where].join('\t'))].join('\n') + '\n'
  fs.writeFileSync(path.join(OUT_DIR, 'changes.tsv'), tsv(['apply', 'spacing']))
  fs.writeFileSync(path.join(OUT_DIR, 'errata.tsv'), tsv(['lk-edit']))
  fs.writeFileSync(path.join(OUT_DIR, 'review.tsv'), tsv(['insert', 'variant', 'delete', 'moved', 'long', 'across-entries', 'bold-inside', 'spacing-punctuation', 'unlocated', 'other-book']))
  fs.writeFileSync(path.join(OUT_DIR, 'headings.tsv'), tsv(['heading']))
  const byKind = new Map<string, number>()
  for (const h of all) byKind.set(h.kind, (byKind.get(h.kind) ?? 0) + 1)
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), [
    `# Aṭṭhakathā Pāḷi: tipitaka.lk vs VRI (tipitaka-xml ${vri.upstream})`, '',
    `${new Date().toISOString().slice(0, 10)}${WRITE ? ', written' : ', dry run'}. Words of lk's atta Pāḷi: ${tot.words}, the same as VRI: ${(100 * tot.matched / tot.words).toFixed(2)}%.`, '',
    `- applied (clear corrections, VRI's word division, MANUAL fixes): ${tot.applied} differences in ${tot.entries} entries - changes.tsv`,
    `- kept, lk's correction (lk changed the words after its first commit; possible VRI errors): ${tot.errata} - errata.tsv`,
    `- not applied, for review (edition variants, deleted words, replaced passages > ${MAX_HUNK} words, across two entries, bold inside a word, segments not found or in another book): ${tot.review + tot.unlocated} - review.tsv (lk's own headings: headings.tsv; lk's deliberate differences: keep.tsv)`,
    `  ${[...byKind].filter(([k]) => !['apply', 'lk-edit'].includes(k)).map(([k, n]) => `${k} ${n}`).join(', ')}`, '',
    '| file | VRI book | words | same | applied | entries | lk edits | review | unlocated segments |', '|---|---|---|---|---|---|---|---|---|', ...rows, '',
  ].join('\n'))
  console.log(`\n${tot.words} words, ${(100 * tot.matched / tot.words).toFixed(2)}% same; applied ${tot.applied} in ${tot.entries} entries, lk edits ${tot.errata}, review ${tot.review}, unlocated ${tot.unlocated} - ${OUT_DIR}/report.md`)
}
main()
