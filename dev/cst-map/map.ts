/**
 * Maps the entries of tipitaka.lk's texts to the paragraphs of tipitaka.app's CST text (../cst/db/text.db), by words:
 * the mūla (BJT edition) to CST's mūla, the aṭṭhakathā (VRI's text, phase 3 sync) to CST's aṭṭhakathā. The map links
 * tipitaka.lk to the app's data: mūla <-> aṭṭhakathā paragraph links, places and people (settings, mentions).
 *
 *   npx tsx dev/cst-map/map.ts [--file dn-1]
 *
 * Each file is cut into chunks of about CHUNK words (at entry boundaries, headings left out: they are lk's own); a chunk
 * is located in CST by word trigrams and aligned word by word (Myers). An entry maps to the CST paragraphs that hold at
 * least MIN_SHARE of its matched words. Output dev/cst-map/<file>.json (format lk-cst/2):
 *   { upstream, entries: { "<page>:<entry>": [ph, conf, "book#idx book#idx", runs] } }
 * ph: sha1-12 of the entry's Pāḷi text (the record is stale when the text changes), conf: share of the entry's words
 * matched. report.md lists the coverage per file and the entries not mapped.
 * Format lk-cst/2 adds the word runs (tipitaka.app's glosses are word spans): "lkW book#idx cstW len;..." - the entry's
 * words lkW.. (shared/tokenize word numbers, as the web renders them) are the paragraph's words cstW.. (words of
 * tokenize(vriToLk(text)) in dev/cst/align.ts), len words in a row.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { loadCst, tokenize, myers, type GTok, type VPara } from '../cst/align'
import { tokenize as tokenizeV1 } from '../../shared/tokenize'

const TEXT_DIR = 'public/static/text'
const OUT_DIR = 'dev/cst-map'
const ONLY = (() => { const i = process.argv.indexOf('--file'); return i > 0 ? process.argv[i + 1] : '' })()
const CHUNK = 300 // words per located chunk
const MIN_SHARE = 0.2 // of an entry's matched words for a paragraph to be listed
const textHash = (s: string) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12)

type Cst = ReturnType<typeof loadCst>
interface Entry { page: number; idx: number; type: string; text: string; words: string[]; v1: number[] } // v1: shared/tokenize word number of each word

/**
 * the CST position of a chunk: the offset most word trigrams agree on. Passages repeat (the sīla sections of the
 * Dīgha, peyyāla), so among the offsets nearly as good as the best the one closest to `expected` (where the previous
 * chunk ended) wins
 */
function locate(cst: Cst, words: string[], expected: number): { best: number; votes: number } {
  const votes = new Map<number, number>()
  for (let j = 0; j + 2 < words.length; j++) {
    for (const p of cst.tri.get(words[j] + ' ' + words[j + 1] + ' ' + words[j + 2]) ?? []) votes.set(p - j, (votes.get(p - j) ?? 0) + 1)
  }
  // offsets a few words apart are the same place (insertions / omissions inside the chunk)
  const near = new Map<number, number>()
  for (const [o, v] of votes) { const k = Math.round(o / 20); near.set(k, (near.get(k) ?? 0) + v) }
  let max = 0
  for (const v of near.values()) max = Math.max(max, v)
  let best = -1, n = 0, dist = Infinity
  for (const [o, v] of votes) {
    const v20 = near.get(Math.round(o / 20)) ?? 0
    if (v20 < 0.6 * max) continue
    const d = expected >= 0 ? Math.abs(o - expected) : 0
    if (d < dist || (d === dist && v > n)) { best = o; n = v20; dist = d }
  }
  return { best, votes: n }
}

/** the shared/tokenize (v1) word number of each align.ts word (by offset; -1: none) */
function v1Numbers(text: string, toks: { s: number }[]): number[] {
  const v1 = tokenizeV1(text)
  let k = 0
  return toks.map(t => {
    while (k < v1.length && v1[k].e <= t.s) k++
    return k < v1.length && v1[k].s <= t.s ? k : -1
  })
}

function mapFile(file: string, cst: Cst, ids: Map<string, number>, cstIds: Int32Array, paraStart: Int32Array) {
  const doc = JSON.parse(fs.readFileSync(path.join(TEXT_DIR, file + '.json'), 'utf-8')) as { pages: { pali: { entries: { type: string; text: string }[] } }[] }
  const entries: Entry[] = []
  doc.pages.forEach((pg, p) => pg.pali.entries.forEach((e, i) => {
    const toks = tokenize(e.text)
    entries.push({ page: p, idx: i, type: e.type, text: e.text, words: toks.map(t => t.w), v1: v1Numbers(e.text, toks) })
  }))
  const id = (w: string) => { let n = ids.get(w); if (n === undefined) ids.set(w, n = ids.size); return n }
  // per entry: CST paragraph -> matched words
  const hits = entries.map(() => new Map<number, number>())
  // per entry: v1 word -> CST global word (matched words)
  const pairs = entries.map(() => new Map<number, number>())
  // chunks of whole entries (an entry longer than CHUNK is its own chunk)
  const chunks: number[][] = []
  let cur: number[] = [], n = 0
  entries.forEach((en, ei) => {
    if (en.type === 'heading' || !en.words.length) return
    if (cur.length && n + en.words.length > CHUNK) { chunks.push(cur); cur = []; n = 0 }
    cur.push(ei); n += en.words.length
  })
  if (cur.length) chunks.push(cur)
  let located = 0, expected = -1
  for (const ch of chunks) {
    const words = ch.flatMap(ei => entries[ei].words), owner = ch.flatMap(ei => entries[ei].words.map(() => ei))
    const wordNo = ch.flatMap(ei => entries[ei].v1)
    const { best, votes } = locate(cst, words, expected)
    if (best < 0 || votes < Math.max(3, 0.05 * words.length)) continue
    located++
    expected = best + words.length
    const from = Math.max(0, best - 60), to = Math.min(cst.toks.length, best + Math.ceil(words.length * 1.5) + 120)
    const ops = myers(words.map(id), Array.from(cstIds.subarray(from, to)), 4000)
    if (!ops) continue
    for (const o of ops) {
      if (o.op !== 'eq') continue
      const ei = owner[o.a], m = hits[ei], para = cst.toks[o.b + from].para
      m.set(para, (m.get(para) ?? 0) + 1)
      const w = wordNo[o.a]
      if (w >= 0 && !pairs[ei].has(w)) pairs[ei].set(w, o.b + from)
    }
  }
  // entries -> paragraphs
  const out: Record<string, [string, number, string, string]> = {}
  let mapped = 0, words = 0, matchedWords = 0
  const unmapped: string[] = []
  entries.forEach((en, ei) => {
    if (en.type === 'heading' || !en.words.length) return
    words += en.words.length
    const m = hits[ei]
    const total = [...m.values()].reduce((a, b) => a + b, 0)
    matchedWords += total
    const paras = [...m].filter(([, n]) => n >= Math.max(1, MIN_SHARE * total)).map(([p]) => p).sort((a, b) => a - b)
    const conf = total / en.words.length
    if (!paras.length || conf < 0.25) { unmapped.push(`${en.page}:${en.idx}`); return }
    mapped++
    out[`${en.page}:${en.idx}`] = [textHash(en.text), Math.round(conf * 100) / 100, paras.map(p => `${cst.paras[p].bookName}#${cst.paras[p].idx}`).join(' '), runs(pairs[ei])]
  })
  /** v1 word -> CST global word pairs as runs "lkW book#idx cstW len" */
  function runs(m: Map<number, number>): string {
    const out: string[] = []
    let r: [number, number, number, number] | null = null // lkW, para, cstW, len
    for (const [w, g] of [...m].sort((a, b) => a[0] - b[0])) {
      const para = cst.toks[g].para, cw = g - paraStart[para]
      if (r && w === r[0] + r[3] && para === r[1] && cw === r[2] + r[3]) { r[3]++; continue }
      if (r) out.push(`${r[0]} ${cst.paras[r[1]].bookName}#${cst.paras[r[1]].idx} ${r[2]} ${r[3]}`)
      r = [w, para, cw, 1]
    }
    if (r) out.push(`${r[0]} ${cst.paras[r[1]].bookName}#${cst.paras[r[1]].idx} ${r[2]} ${r[3]}`)
    return out.join(';')
  }
  const body = entries.filter(e => e.type !== 'heading' && e.words.length).length
  return { out, stats: { entries: body, mapped, words, matchedWords, chunks: chunks.length, located }, unmapped }
}

function main() {
  const files = fs.readdirSync(TEXT_DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).filter(f => !f.startsWith('anya') && (!ONLY || f === ONLY)).sort()
  const byColl = { mula: files.filter(f => !f.startsWith('atta-')), atta: files.filter(f => f.startsWith('atta-')) }
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const rows: string[] = []
  const tot = { entries: 0, mapped: 0, words: 0, matched: 0 }
  for (const [coll, list] of Object.entries(byColl)) {
    if (!list.length) continue
    const t0 = Date.now()
    const cst = loadCst([coll])
    console.log(`CST ${coll}: ${cst.paras.length} paragraphs, ${cst.toks.length} words in ${((Date.now() - t0) / 1000).toFixed(1)} s`)
    const ids = new Map<string, number>()
    const cstIds = Int32Array.from(cst.toks, t => { let n = ids.get(t.w); if (n === undefined) ids.set(t.w, n = ids.size); return n })
    const paraStart = new Int32Array(cst.paras.length).fill(-1)
    cst.toks.forEach((t, i) => { if (paraStart[t.para] < 0) paraStart[t.para] = i })
    for (const f of list) {
      const { out, stats, unmapped } = mapFile(f, cst, ids, cstIds, paraStart)
      fs.writeFileSync(path.join(OUT_DIR, f + '.json'), JSON.stringify({ format: 'lk-cst/2', upstream: cst.upstream, entries: out }) + '\n')
      tot.entries += stats.entries; tot.mapped += stats.mapped; tot.words += stats.words; tot.matched += stats.matchedWords
      const pct = (100 * stats.mapped / Math.max(1, stats.entries)).toFixed(1)
      rows.push(`| ${f} | ${stats.entries} | ${pct}% | ${(100 * stats.matchedWords / Math.max(1, stats.words)).toFixed(1)}% | ${stats.located}/${stats.chunks} | ${unmapped.slice(0, 8).join(' ')}${unmapped.length > 8 ? ` … (${unmapped.length})` : ''} |`)
      console.log(`${f}: ${pct}% of ${stats.entries} entries mapped, ${(100 * stats.matchedWords / Math.max(1, stats.words)).toFixed(1)}% of words matched`)
    }
  }
  if (ONLY) return
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), [
    '# tipitaka.lk entries -> CST paragraphs', '',
    `${new Date().toISOString().slice(0, 10)}: ${tot.mapped} of ${tot.entries} entries mapped (${(100 * tot.mapped / tot.entries).toFixed(1)}%), ${(100 * tot.matched / tot.words).toFixed(1)}% of words matched.`, '',
    '| file | entries | mapped | words matched | chunks located | not mapped (page:entry) |', '|---|---|---|---|---|---|', ...rows, '',
  ].join('\n'))
  console.log(`\n${tot.mapped}/${tot.entries} entries mapped (${(100 * tot.mapped / tot.entries).toFixed(1)}%)`)
}
main()
// (types used by the shared module's API)
export type { GTok, VPara }
