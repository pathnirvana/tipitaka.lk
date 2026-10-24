import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
import fs from 'node:fs'
import path from 'node:path'
import { convert } from '@pnfo/pali-converter'
import { fold } from '../shared/normalize'

// port of dev/gen-sitemap.js
const commonSearchTerms = ['කර්මය', 'මාරයා', 'ශ්‍රද්ධාව', 'පංචඋපාදානස්කන්ධය', 'සංඛාර', 'නාමරූප', 'අරූප ලෝක', 'ආනන්තරීය කර්ම',
  'සෝවාන් පුද්ගලයා', 'ත්‍රිහේතුක ප්‍රතිසන්ධිය', 'පටිච්චසමුප්පාදය']

export function writeSitemap(keys: string[], outFile: string) {
  const links = [...keys.map(k => `https://tipitaka.lk/${k}/pali`), ...keys.map(k => `https://tipitaka.lk/${k}/sinh`),
    ...commonSearchTerms.map(t => `https://tipitaka.lk/fts/${t}/0-0-10`)]
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, links.join('\n'), 'utf-8')
}

/** small dictionary db for tests (words starting with a few common prefixes) from db/dict.db */
/**
 * the dictionary db of the e2e fixture: a small part of db/dict.db (build/dict.ts) - the entries, breakups and DPD rows
 * of the fixture texts' words and of words starting with the test prefixes (typed searches)
 */
export function writeFixtureDict(outFile: string, srcFile = 'db/dict.db', textDb = path.join(path.dirname(outFile), 'text.db')) {
  if (!fs.existsSync(srcFile)) throw new Error(`${srcFile} not found (npm run build:dict)`)
  const Database = require('better-sqlite3') as typeof import('better-sqlite3')
  const prefixes = ['ධම්ම', 'බුද්ධ', 'භික්ඛ', 'නිබ්බාන', 'කම්ම', 'සීල', 'චිත්ත', 'සති', 'එවං', 'සුත', 'තථාගත', 'ආනන්ද', 'ගුණ', 'නම']
    .map(w => fold(convert(w, 'latn', 'sinh')))
  const words = new Set<string>()
  const text = new Database(textDb, { readonly: true })
  for (const r of text.prepare('SELECT p_text FROM entry').iterate() as Iterable<{ p_text: string }>) {
    for (const w of r.p_text.replace(/‍/g, '').split(/[^඀-෿]+/)) if (w) words.add(convert(w, 'latn', 'sinh').toLowerCase())
  }
  text.close()
  fs.rmSync(outFile, { force: true })
  const db = new Database(outFile)
  const src = new Database(srcFile, { readonly: true })
  for (const r of src.prepare(`SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type = 'index', rowid`).all() as { sql: string }[]) db.exec(r.sql)
  src.close()
  db.exec(`ATTACH DATABASE '${srcFile.replace(/'/g, "''")}' AS src; CREATE TEMP TABLE w (word TEXT PRIMARY KEY, fold TEXT); CREATE INDEX temp.w_fold ON w(fold)`)
  const insW = db.prepare('INSERT OR IGNORE INTO temp.w VALUES (?, ?)')
  db.transaction(() => { for (const w of words) insW.run(w, fold(w)) })()
  const keep = `(fold IN (SELECT fold FROM temp.w) OR ${prefixes.map(p => `fold GLOB '${p}*'`).join(' OR ')})`
  db.exec(`INSERT INTO meta SELECT * FROM src.meta;
    INSERT INTO dict SELECT * FROM src.dict;
    INSERT INTO dict_abbrev SELECT * FROM src.dict_abbrev;
    INSERT INTO entry SELECT * FROM src.entry WHERE ${keep};
    INSERT INTO entry SELECT * FROM src.entry WHERE id IN (SELECT alias_of FROM entry) AND id NOT IN (SELECT id FROM entry);
    INSERT INTO breakup SELECT * FROM src.breakup WHERE ${keep};
    INSERT INTO dpd_lookup SELECT * FROM src.dpd_lookup WHERE word IN (SELECT word FROM temp.w);
    INSERT INTO dpd_head SELECT * FROM src.dpd_head WHERE ${keep};
    INSERT INTO dpd_root SELECT * FROM src.dpd_root;`)
  // the headwords of the kept lookups
  const ids = new Set<number>()
  for (const r of db.prepare('SELECT headwords FROM dpd_lookup').all() as { headwords: string }[]) for (const id of JSON.parse(r.headwords || '[]') as number[]) ids.add(id)
  const insH = db.prepare('INSERT OR IGNORE INTO dpd_head SELECT * FROM src.dpd_head WHERE id = ?')
  db.transaction(() => { for (const id of ids) insH.run(id) })()
  db.exec('DETACH DATABASE src')
  db.exec('VACUUM')
  db.close()
}
