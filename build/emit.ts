import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
import fs from 'node:fs'
import path from 'node:path'

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
export function writeFixtureDict(outFile: string, srcFile = 'db/dict.db') {
  if (!fs.existsSync(srcFile)) throw new Error(`${srcFile} not found (unzip db/dict.db.zip)`)
  fs.rmSync(outFile, { force: true })
  const prefixes = ['ධම්ම', 'බුද්ධ', 'භික්ඛ', 'නිබ්බාන', 'කම්ම', 'සීල', 'චිත්ත', 'සති', 'එවං', 'සුත', 'තථාගත', 'ආනන්ද', 'ගුණ', 'නම']
  const Database = require('better-sqlite3') as typeof import('better-sqlite3')
  const db = new Database(outFile)
  db.exec(`ATTACH DATABASE '${srcFile.replace(/'/g, "''")}' AS src;
    CREATE TABLE dictionary (word TEXT NOT NULL, dict TEXT NOT NULL, meaning TEXT NOT NULL);
    INSERT INTO dictionary SELECT word, dict, meaning FROM src.dictionary WHERE ${prefixes.map(p => `word LIKE '${p}%'`).join(' OR ')};
    CREATE INDEX worddict ON dictionary(word, dict);`)
  db.exec('DETACH DATABASE src')
  db.exec('VACUUM')
  db.close()
}
