/**
 * Builds a rewrite-mode set (out/<set>/packets.json, for run.ts) from a list of single entries, e.g. entries of text-apz
 * that were left in Pāḷi. Packets hold up to 40 entries, across files; each entry brings the text-apz entry before it as PREV.
 * BJT's "__missing trans__" placeholder is passed as no BJT, so the entry is translated from the Pāḷi.
 *
 *   npx tsx dev/apz-trans/set-list.ts <list.tsv> --set <name>
 *     list.tsv: file, page_idx, entry_idx (tab separated, a header line is skipped)
 *
 * Then: npx tsx dev/apz-trans/run.ts opus --set <name>, and set-list.ts's results are merged by hand or with merge.ts.
 */
import fs from 'node:fs'
import path from 'node:path'
import { OUT, entries, openDb, packet, type Entry, type Packet } from './lib'

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined }
const list = process.argv[2], set = arg('--set')
if (!list || !set) throw new Error('usage: set-list.ts <list.tsv> --set <name>')
const PER_PACKET = 40
const db = openDb()

const keys = fs.readFileSync(list, 'utf-8').split('\n').filter(l => /^\S+\t\d+\t\d+/.test(l)).map(l => l.split('\t'))
const byFile = new Map<string, Entry[]>()
const prevOf = new Map<string, { key: string; si: string }>()
for (const [file, p, e] of keys) {
  const [x] = entries(db, file, `${p}:${e}`, `${p}:${e}`)
  if (!x) throw new Error(`no entry ${file} ${p}:${e}`)
  if (/__missing trans/.test(x.bjt)) x.bjt = ''
  // the nearest earlier entry of the file with Sinhala text, as context
  const before = entries(db, file, `${Math.max(0, +p - 1)}:0`, `${p}:${+e - 1}`).reverse()
    .find(b => b.apz?.trim() && !keys.some(k => `${k[0]} ${k[1]}:${k[2]}` === b.key))
  if (before) prevOf.set(x.key, { key: before.key, si: before.apz! })
  byFile.set(file, [...(byFile.get(file) ?? []), x])
}
const packets: (Packet & { group: string })[] = []
// the entries are independent (each has its own context), so packets run across files: a call has a fixed cost
const all = [...byFile.values()].flat()
for (let i = 0; i < all.length; i += PER_PACKET) {
  const chunk = all.slice(i, i + PER_PACKET), first = chunk[0]
  packets.push({ ...packet(db, `${first.file}-${first.page}.${first.entry}`, 'rewrite', chunk, { prev: chunk.flatMap(x => prevOf.get(x.key) ?? []) }), group: set })
}
fs.mkdirSync(path.join(OUT, set), { recursive: true })
fs.writeFileSync(path.join(OUT, set, 'packets.json'), JSON.stringify(packets, null, 1))
console.log(`${set}: ${keys.length} entries, ${packets.length} packets`)
