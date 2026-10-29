/**
 * Builds the packets of a bulk stage (out/<set>/packets.json) for run.ts, like pilot.ts does for the pilot.
 *
 *   npx tsx dev/apz-trans/set.ts qa [--set qa] [--sample 0.02]
 *     the targeted QA of the existing sin_apz: the AI fill-ins, the gaps (dev/apz-import/gaps.tsv: empty, copied-pali,
 *     partly-pali), the length outliers against BJT, and a random sample of the human entries. Neighbouring picks become
 *     one window (with the entries between them); the windows of a file share packets.
 *   npx tsx dev/apz-trans/set.ts book <file prefix> [--set <name>] [--terms ok|proposed]
 *     every entry of the text files <prefix>, <prefix>-* (e.g. vp-prj), translated in order; a file's packets form one chain.
 *
 * Packets are about MAX_PALI Pāḷi chars, ending at a heading where one is near. The glossary terms (status ok, or also
 * proposed with --terms proposed) that occur in a packet go in with it.
 */
import fs from 'node:fs'
import path from 'node:path'
import { OUT, entries, openDb, packet, readJsonl, termsFor, type Entry, type Packet, type Result } from './lib'

type P = Packet & { group: string; after?: string }
const MAX_PALI = 4000, MIN_BREAK = 2000
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined }
const stage = process.argv[2]
const statuses = arg('--terms') === 'proposed' ? ['ok', 'proposed'] : ['ok']
const db = openDb()
const files = (db.prepare(`SELECT name FROM file WHERE name NOT LIKE 'atta%' AND name NOT LIKE 'anya%' ORDER BY name`).pluck().all() as string[])
const allOf = (file: string) => entries(db, file, '0:0', '99999:9999')

/** consecutive entries cut into packets: at MAX_PALI, or at a heading once a packet has MIN_BREAK */
function cut(es: Entry[]): Entry[][] {
  const out: Entry[][] = []
  let cur: Entry[] = [], size = 0
  for (const e of es) {
    const heading = e.type === 'heading' || e.type === 'centered'
    if (cur.length && (size + e.pali.length > MAX_PALI || (heading && size >= MIN_BREAK))) { out.push(cur); cur = []; size = 0 }
    cur.push(e); size += e.pali.length
  }
  if (cur.length) out.push(cur)
  return out
}

/** a seeded random number generator, so the sample is the same on every run */
function rng(seed: number) { return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 }

const packets: P[] = []
let setName = arg('--set')
if (stage === 'qa') {
  setName ??= 'qa'
  const sample = Number(arg('--sample') ?? 0.02), rand = rng(20261028)
  const gaps = new Set(fs.readFileSync('dev/apz-import/gaps.tsv', 'utf-8').split('\n').slice(1).filter(Boolean).map(l => l.split('\t'))
    .filter(g => ['empty', 'copied-pali', 'partly-pali'].includes(g[3])).map(g => `${g[0]} ${g[1]}:${g[2]}`))
  const why: Record<string, number> = {}
  for (const file of files) {
    const es = allOf(file)
    if (!es.some(e => e.apz !== undefined)) continue
    const pick = es.map(e => {
      const words = e.pali.replace(/^[\d.\s]+/, '').trim().length
      if (!words) return '' // (number lines, empty Pāḷi: nothing to translate)
      if (e.ai) return 'ai'
      if (gaps.has(e.key)) return 'gap'
      if (e.bjt.length >= 200 && e.apz) { const r = e.apz.length / e.bjt.length; if (r < 0.4 || r > 2.5) return 'length' }
      return e.pali.length >= 40 && rand() < sample ? 'sample' : ''
    })
    pick.forEach(w => { if (w) why[w] = (why[w] ?? 0) + 1 })
    // windows: picks at most 2 entries apart, with the entries between them; the windows of a file then share packets up
    // to MAX_PALI (a call has a fixed cost - the prompt and the model's thinking - so one or two entries per call cost too much)
    const windows: Entry[][] = []
    let i = 0
    while (i < es.length) {
      if (!pick[i]) { i++; continue }
      let j = i
      for (let k = i + 1; k < es.length && k <= j + 3; k++) if (pick[k]) j = k
      windows.push(...cut(es.slice(i, j + 1)))
      i = j + 1
    }
    let cur: Entry[] = [], size = 0
    const flush = () => {
      if (!cur.length) return
      packets.push({ ...packet(db, `${file}-${cur[0].page}.${cur[0].entry}`, 'qa', cur, { terms: termsFor(cur, statuses) }), group: 'qa' })
      cur = []; size = 0
    }
    for (const w of windows) {
      const n = w.reduce((s, e) => s + e.pali.length, 0)
      if (cur.length && size + n > MAX_PALI) flush()
      cur.push(...w); size += n
    }
    flush()
  }
  console.log('picked:', why)
} else if (stage === 'book') {
  const prefix = process.argv[3]
  if (!prefix) throw new Error('book <file prefix>')
  setName ??= prefix
  for (const file of files.filter(f => f === prefix || f.startsWith(prefix + '-'))) {
    let prevId: string | undefined
    cut(allOf(file)).forEach((chunk, n) => {
      const id = `${file}-${n + 1}`
      packets.push({ ...packet(db, id, 'translate', chunk, { terms: termsFor(chunk, statuses) }), group: prefix, ...(prevId ? { after: prevId } : {}) })
      prevId = id
    })
  }
} else if (stage === 'redo') {
  // the entries of a finished set where BJT explains a short Pāḷi at length and the result cut that back
  // (prompt.md's "follow BJT" rule came after the set ran); each file's picks share packets, in the set's mode
  const from = process.argv[3]
  if (!from) throw new Error('redo <set>')
  setName ??= `${from}-redo`
  const src: P[] = JSON.parse(fs.readFileSync(path.join(OUT, from, 'packets.json'), 'utf-8'))
  const res = new Map(readJsonl<Result>(path.join(OUT, from, 'opus.jsonl')).map(r => [r.packet, r]))
  const byFile = new Map<string, { e: Entry; mode: Packet['mode']; prev?: { key: string; si: string } }[]>()
  for (const p of src) p.entries.forEach((e, i) => {
    const it = res.get(p.id)?.items.find(x => x.i === i + 1)
    if (!it || it.verdict === 'ok' || /^\s*\d+\s*-\s*\d+/.test(e.bjt)) return // (a BJT paragraph over several entries)
    if (e.bjt.length < 150 || e.bjt.length < 1.4 * e.pali.length || it.si.length >= 0.8 * e.bjt.length) return
    const before = p.entries[i - 1] && res.get(p.id)!.items.find(x => x.i === i)
    const list = byFile.get(e.file) ?? byFile.set(e.file, []).get(e.file)!
    list.push({ e, mode: p.mode, ...(before ? { prev: { key: p.entries[i - 1].key, si: before.si } } : {}) })
  })
  for (const [file, xs] of byFile) {
    let cur: typeof xs = [], size = 0
    const flush = () => {
      if (!cur.length) return
      const es = cur.map(x => x.e)
      packets.push({ ...packet(db, `${file}-${es[0].page}.${es[0].entry}`, cur[0].mode, es, { terms: termsFor(es, statuses), prev: cur.flatMap(x => x.prev ? [x.prev] : []) }), group: from })
      cur = []; size = 0
    }
    for (const x of xs) {
      if (cur.length && size + x.e.pali.length > MAX_PALI) flush()
      cur.push(x); size += x.e.pali.length
    }
    flush()
  }
} else throw new Error('usage: set.ts qa | book <prefix> | redo <set>')

const dir = path.join(OUT, setName!)
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'packets.json'), JSON.stringify(packets))
const n = packets.reduce((s, p) => s + p.entries.length, 0), chars = packets.reduce((s, p) => s + p.entries.reduce((t, e) => t + e.pali.length, 0), 0)
console.log(`${dir}: ${packets.length} packets, ${n} entries, ${chars} Pāḷi chars; ${packets.filter(p => p.terms?.length).length} with glossary terms`)
