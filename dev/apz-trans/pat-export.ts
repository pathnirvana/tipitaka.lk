/**
 * Paṭṭhāna: packets written out as files, for a model that is run by hand (Gemini in Antigravity), with the same inputs
 * a flow.ts rewrite call gets.   npx tsx dev/apz-trans/pat-export.ts <terms.json> <out dir> <file from to> …
 */
import fs from 'node:fs'
import path from 'node:path'
import { entries, openDb, packet, render } from './lib'
const [termsFile, out, ...specs] = process.argv.slice(2)
const ledger: [string, string][] = JSON.parse(fs.readFileSync(termsFile, 'utf-8'))
const witness: Record<string, string[]> = JSON.parse(fs.readFileSync('dev/apz-trans/pat-witness.json', 'utf-8'))
const db = openDb()
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'rules.md'), fs.readFileSync('dev/apz-trans/pat-rules.md', 'utf-8').replace(/## Task[\s\S]*$/, '') + `## Task
Translate every entry under # ENTRIES following the rules above. Write {"items": [{"i", "si"}]}: one item per entry, the
same i numbers, in order. "si" is the modern Sinhala text of that entry only.
`)
for (let k = 0; k + 2 < specs.length + 0; k += 3) {
  const [file, from, to] = specs.slice(k, k + 3)
  const es = entries(db, file, from, to)
  const text = es.map(e => e.pali).join(' ')
  const terms = ledger.filter(([p]) => p.length >= 4 && text.includes(p)).sort((a, b) => b[0].length - a[0].length).slice(0, 80).map(([p, si]) => `${p} → ${si}`)
  const shown = new Set<string>()
  const body = render({ ...packet(db, `${file} ${from}`, 'rewrite', es), prev: [], terms }, e => (witness[e.key] ?? []).filter(w => !shown.has(w) && shown.add(w)).map(w => `SANNAYA: ${w}`).join('\n'))
  fs.writeFileSync(path.join(out, `packet-${k / 3 + 1}.md`), body)
  console.log(`packet-${k / 3 + 1}.md: ${file} ${from}-${to}, ${es.length} entries, ${body.length} chars`)
}
