/**
 * names.json + Search Console exports (fetch-gsc.mjs) -> shared/popular-suttas.json, the common names of popular suttas
 * that title search also looks up (shared/sutta-names.ts).
 *
 * A sutta's weight is the Search Console impressions of the queries naming it (after dropping words like pdf, lyrics,
 * සිංහල): it orders the suttas a query matches. Every key must be a node of the tree.
 *
 * usage: npx tsx dev/popular-suttas/build.ts <gsc export.json…>
 *        npx tsx dev/popular-suttas/build.ts --unmatched <gsc export.json…>   sutta queries no name matches, most searched first
 */
import fs from 'node:fs'
import { romanFold, sinhFold, buildNameIndex, type PopularSutta } from '../../shared/sutta-names'

const HERE = new URL('.', import.meta.url).pathname
const OUT = new URL('../../shared/popular-suttas.json', import.meta.url).pathname
const tree = JSON.parse(fs.readFileSync(new URL('../../public/static/data/tree.json', import.meta.url), 'utf8')) as Record<string, unknown>
const names = JSON.parse(fs.readFileSync(HERE + 'names.json', 'utf8')) as Record<string, { si: string[]; ro: string[]; review?: string }>

const args = process.argv.slice(2), unmatched = args.includes('--unmatched')
const exports = args.filter(a => !a.startsWith('--'))
if (!exports.length) { console.error('usage: build.ts [--unmatched] <gsc export.json…>'); process.exit(1) }

const entries: PopularSutta[] = Object.entries(names).filter(([k]) => !k.startsWith('_')).map(([key, n]) => {
  if (!tree[key]) throw new Error(`${key} is not in the tree`)
  return { key, si: n.si, ro: n.ro, weight: 0 }
})

// a query without the words that do not name a sutta
const NOISE = new Set(('pdf sinhala sinhalen lyrics download free meaning book potha pota in english text pali deshana deshanawa full with the of and mp3 ' +
  'audio video youtube online tipitaka pitaka lk translation explained sermon sutta sutra suthra suthraya sutraya suttaya sutham suttam piritha pirith paritta ' +
  'සිංහල සිංහලෙන් පොත පාලි දේශනාව දේශනා අර්ථය තේරුම ගාථාව ගාථා සහිත සූත්‍රය සූත්රය සුත්රය සූත්ර සුත්තං පිරිත පිරිත් පරිත්තං').split(' '))
const SUTTA = /sut+|sutra|suthr|සූත්|සුත්|සූත|සුත|pirit|පිරිත|parit|පරිත්/i
const core = (q: string) => q.replace(/[‌‍]/g, '').toLowerCase().split(/\s+/).filter(w => !NOISE.has(w)).join(' ')

const index = buildNameIndex(entries)
const folded = index.folded
const left = new Map<string, number>()
for (const file of exports) {
  for (const r of JSON.parse(fs.readFileSync(file, 'utf8')) as { keys: [string, string]; impressions: number }[]) {
    const q = core(r.keys[0])
    if (!SUTTA.test(r.keys[0]) || q.length < 3) continue
    // the query names the sutta when it equals one of its names (loosely), so "maha mangala" is not also counted for "mangala"
    const rq = /[a-z]/.test(q) ? romanFold(q) : '', sq = rq ? '' : sinhFold(q)
    const hits = entries.filter((_, i) => (rq && folded[i].ro.includes(rq)) || (sq && folded[i].si.includes(sq)))
    for (const e of hits) e.weight += r.impressions
    if (!hits.length) left.set(q, (left.get(q) || 0) + r.impressions)
  }
}

if (unmatched) {
  for (const [q, n] of [...left].sort((a, b) => b[1] - a[1]).slice(0, 300)) console.log(n, q)
} else {
  entries.sort((a, b) => b.weight - a.weight)
  fs.writeFileSync(OUT, '[\n' + entries.map(e => JSON.stringify(e)).join(',\n') + '\n]\n')
  console.log(`${entries.length} suttas -> ${OUT}`)
  for (const e of entries.filter(e => !e.weight)) console.log('no searches:', e.key, e.si[0])
}
