/**
 * npm run build:dict - rebuilds db/dict.db from dev/dicts (port of dev/dicts/populate-dict.js).
 * Needs the sinhala dictionaries submodule: git submodule update --init dev/dicts/dict-input/sinhala
 * dict.db rarely changes; the released db/dict.db (db/dict.db.zip) is normally reused.
 */
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const dir = 'dev/dicts'
const dictionaryList: [string, string][] = [ // short name -> input file
  ['BUE', 'en-buddhadatta.json'], ['ND', 'en-nyanatiloka.json'], ['PTS', 'en-pts.json'], ['PN', 'en-dppn.json'],
  ['VRI', 'en-vri.json'], ['CR', 'en-critical.json'], ['BUS', 'sinhala/buddhadatta_dict.json'], ['MS', 'sinhala/sumangala_dict.json'],
]
const removeBRTags = (m: string) => m.replace(/-<br\/>/g, '').replace(/<br\/>/g, ' ')

export function buildDictRows(): [string, string, string][] {
  let rows: [string, string, string][] = []
  for (const [short, file] of dictionaryList) {
    const p = path.join(dir, 'dict-input', file)
    if (!fs.existsSync(p)) throw new Error(`${p} missing (git submodule update --init dev/dicts/dict-input/sinhala)`)
    for (const [w, m] of JSON.parse(fs.readFileSync(p, 'utf-8')) as [string, string][]) {
      rows.push([w.replace(/\d$/, ''), short, short === 'CR' ? removeBRTags(m) : m])
    }
  }
  const breakups = JSON.parse(fs.readFileSync(path.join(dir, 'breakups.json'), 'utf-8')) as [string, string, string, [string, number][]][]
  for (const [word, type, , brs] of breakups) for (const br of brs) rows.push([word, 'BR', `${type}|${br[0]}`])
  // v2 used a boolean comparator here (A10); rows are sorted by word (byte order) and rows with an empty column dropped
  rows = rows.filter(r => r.every(Boolean)).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  return rows
}

function main() {
  const out = process.argv[2] || 'db/dict.db'
  const rows = buildDictRows()
  fs.rmSync(out, { force: true })
  const db = new Database(out)
  db.exec('CREATE TABLE dictionary (word TEXT NOT NULL, dict TEXT NOT NULL, meaning TEXT NOT NULL); CREATE INDEX worddict ON dictionary(word, dict);')
  const ins = db.prepare('INSERT INTO dictionary (word, dict, meaning) VALUES (?, ?, ?)')
  db.transaction(() => { for (const r of rows) ins.run(...r) })()
  db.exec('ANALYZE; VACUUM')
  db.close()
  console.log(`wrote ${rows.length} rows to ${out}`)
}
if (import.meta.url === `file://${process.argv[1]}`) main()
