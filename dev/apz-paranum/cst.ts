/**
 * For the sin_apz entries numbered where the BJT Pāḷi is not (runs.json "other"), looks up the CST (VRI) paragraph of
 * that number in the same book (../cst/db/text.db) and measures how much of its Pāḷi the BJT entry shares.
 * Writes cst.tsv: file, page_idx, entry_idx, apz number, word overlap (0-1), CST start, BJT start.
 *   npx tsx dev/apz-paranum/cst.ts
 */
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { convert } from '@pnfo/pali-converter'

const BOOK: Record<string, number> = { 'dn-1': 5, 'dn-2': 6, 'dn-3': 7, 'mn-1': 8, 'mn-2': 9, 'mn-3': 10,
  'sn-1': 11, 'sn-2': 12, 'sn-3': 13, 'sn-4': 14, 'sn-5': 15, 'an-1': 16, 'an-2': 17, 'an-3': 18, 'an-4': 19, 'an-5': 20,
  'an-6': 21, 'an-7': 22, 'an-8': 23, 'an-9': 24, 'an-10': 25, 'an-11': 26, 'kn-ap': 36 }
const db = new Database('../cst/db/text.db', { readonly: true })
// (CST numbers restart in some books, and a range 225-228 starts with the number)
const q = db.prepare("SELECT text FROM para WHERE book_id = ? AND (num = ? OR num LIKE ? || '-%') ORDER BY idx")
const other: any[] = JSON.parse(fs.readFileSync('dev/apz-paranum/runs.json', 'utf8')).other.filter((o: any[]) => o.length === 5)
const words = (s: string) => s.toLowerCase().replace(/<[^>]*>|\{\d+\}|\*\*/g, '').split(/[^a-zāīūṅñṭḍṇḷṃ]+/).filter(w => w.length > 2)
const cache = new Map<string, any>()
const rows: string[] = ['file\tpage_idx\tentry_idx\tnum\toverlap\tcst\tbjt']
for (const [name, pageNum, i, , na] of other) {
  const bk = BOOK[name.split('-').slice(0, 2).join('-')]
  if (!cache.has(name)) cache.set(name, JSON.parse(fs.readFileSync(`public/static/text/${name}.json`, 'utf8')))
  const pi = cache.get(name).pages.findIndex((p: any) => p.pageNum === pageNum)
  const bjt = convert(cache.get(name).pages[pi].pali.entries[i].text, 'latn', 'sinh')
  const b = new Set(words(bjt))
  let cst: string | undefined, overlap = -1
  for (const t of bk === undefined ? [] : q.pluck().all(bk, String(na[0]), String(na[0])) as string[]) {
    const c = words(t).slice(0, 40), o = c.length ? c.filter(w => b.has(w)).length / c.length : 0
    if (o > overlap) { overlap = o; cst = t }
  }
  rows.push([name, pi, i, na[0], overlap.toFixed(2), (cst ?? '-').replace(/<[^>]*>/g, '').slice(0, 70), bjt.slice(0, 70)].join('\t').replace(/\n/g, ' '))
}
fs.writeFileSync('dev/apz-paranum/cst.tsv', rows.join('\n') + '\n')
const ov = rows.slice(1).map(r => Number(r.split('\t')[4]))
console.log('entries', ov.length, '>=0.5:', ov.filter(x => x >= 0.5).length, '0-0.5:', ov.filter(x => x >= 0 && x < 0.5).length, 'no cst para:', ov.filter(x => x < 0).length)
