/**
 * npm run build:dict [-- <app dict.db>] - builds db/dict.db from the dictionary db of tipitaka.app (same schema, built by
 * its build/dict.ts from the sources pinned in its data/dicts.lock and data/dpd.lock; its daily upstream sync keeps
 * them current). Default source: ../cst/db/dict.db.
 *
 * tipitaka.lk keeps
 *  - the English and Sinhala dictionaries (LK_DICTS), their abbreviations and the PCED word breakups
 *  - the Digital Pāḷi Dictionary (DPD): all headwords and roots (typed searches), and the inflection / deconstruction
 *    lookup of the word forms that occur in tipitaka.lk's texts (clicked words) - most of DPD's 1.2M forms are not in
 *    the Sinhala editions
 * Words are lower case Roman (the reader converts a clicked Sinhala word with @pnfo/pali-converter, lossless for all
 * words of the texts). References to tipitaka.app's texts (<a data-ref="key#para">) are unwrapped: their paragraph
 * numbers are not tipitaka.lk's.
 */
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { convert } from '@pnfo/pali-converter'

/** tipitaka.app dictionary codes kept (in its display order) */
export const LK_DICTS = ['en-ncped', 'en-nyanatiloka', 'en-pts', 'en-dppn', 'en-vri', 'en-critical', 'si-buddhadatta', 'si-sumangala']

const DATA_REF = /<a data-ref="[^"]*">([\s\S]*?)<\/a>/g
export const unwrapRefs = (html: string) => html.replace(DATA_REF, '$1')

/** the Roman forms of the Pali words of text.db (p_text of mula and atta) */
export function textWordForms(textDb: string): Set<string> {
  const db = new Database(textDb, { readonly: true })
  const sinh = new Set<string>()
  for (const r of db.prepare('SELECT p_text FROM entry').iterate() as Iterable<{ p_text: string }>) {
    for (const w of r.p_text.replace(/‍/g, '').split(/[^඀-෿]+/)) if (w) sinh.add(w)
  }
  db.close()
  const roman = new Set<string>()
  for (const w of sinh) roman.add(convert(w, 'latn', 'sinh').toLowerCase())
  return roman
}

export function buildLkDict(appDict: string, out: string, words: Set<string>, log = (m: string) => console.log(m)) {
  if (!fs.existsSync(appDict)) throw new Error(`${appDict} not found (tipitaka.app's db/dict.db; npm run build:dict -- <path>)`)
  const tmp = out + '.tmp'
  fs.rmSync(tmp, { force: true })
  const src = new Database(appDict, { readonly: true })
  const db = new Database(tmp)
  db.pragma('journal_mode = OFF')
  db.pragma('synchronous = OFF')
  // the same schema (tables and indexes) as the source
  const schema = src.prepare(`SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type = 'index', rowid`).all() as { sql: string }[]
  for (const s of schema) db.exec(s.sql)
  src.close()
  db.exec(`ATTACH DATABASE '${appDict.replace(/'/g, "''")}' AS app`)
  const codes = LK_DICTS.map(c => `'${c}'`).join(',')
  db.transaction(() => {
    db.exec(`INSERT INTO meta SELECT * FROM app.meta;
      INSERT INTO dict SELECT * FROM app.dict WHERE code IN (${codes});
      INSERT INTO entry SELECT * FROM app.entry WHERE dict_id IN (SELECT id FROM dict);
      INSERT INTO dict_abbrev SELECT * FROM app.dict_abbrev WHERE dict_id IN (SELECT id FROM dict);
      INSERT INTO breakup SELECT * FROM app.breakup;
      INSERT INTO dpd_head SELECT * FROM app.dpd_head;
      INSERT INTO dpd_root SELECT * FROM app.dpd_root;`)
    const upd = db.prepare('UPDATE entry SET meaning = ? WHERE id = ?')
    let refs = 0
    for (const r of db.prepare(`SELECT id, meaning FROM entry WHERE meaning LIKE '%data-ref%'`).all() as { id: number; meaning: string }[]) {
      upd.run(unwrapRefs(r.meaning), r.id)
      refs++
    }
    const ins = db.prepare('INSERT INTO dpd_lookup SELECT * FROM app.dpd_lookup WHERE word = ?')
    let n = 0
    for (const w of words) n += ins.run(w).changes
    db.prepare(`INSERT OR REPLACE INTO meta VALUES ('lk_built_at', ?), ('lk_source', ?), ('lk_dpd_lookup', ?)`).run(new Date().toISOString(), 'tipitaka.app dict.db', String(n))
    const count = (t: string) => (db.prepare(`SELECT count(*) AS n FROM ${t}`).get() as { n: number }).n
    log(`dictionaries: ${count('dict')}, entries ${count('entry')} (${refs} references unwrapped), breakups ${count('breakup')}`)
    log(`dpd: headwords ${count('dpd_head')}, roots ${count('dpd_root')}, lookup ${n} of the ${words.size} word forms of the texts`)
  })()
  db.exec('DETACH DATABASE app')
  db.exec('ANALYZE')
  db.exec('VACUUM')
  db.close()
  fs.renameSync(tmp, out)
}

function main() {
  const appDict = process.argv[2] || '../cst/db/dict.db'
  const out = process.argv[3] || 'db/dict.db'
  const words = textWordForms('db/text.db')
  buildLkDict(appDict, out, words)
  console.log(`wrote ${out} (${(fs.statSync(out).size / 2 ** 20).toFixed(0)} MB)`)
}
if (import.meta.url === `file://${process.argv[1]}`) main()
