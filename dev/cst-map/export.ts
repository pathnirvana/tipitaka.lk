/**
 * Exports the parts of tipitaka.app's data (../cst/db/text.db) that tipitaka.lk uses through its entry -> CST paragraph
 * map (dev/cst-map/<file>.json), to dev/cst-data/ (committed: the lk build does not need the app's repository):
 *   links.tsv     aṭṭhakathā paragraph -> mūla paragraph it explains (paragraph numbers and commentary lemmas)
 *   entities.tsv  places, people, deities, groups, animals (DPD / DPPN names, coordinates of places)
 *   settings.tsv  the setting of a sutta / story (place, teacher, with, about) by CST paragraph range
 *   mentions.tsv  the names in each mūla / aṭṭhakathā paragraph
 *   glosses.tsv   word level: an aṭṭhakathā lemma, the mūla words it quotes and the last word of its explanation (word
 *                 numbers of tokenize(vriToLk(text)) in dev/cst/align.ts, as the runs of the map; spans inclusive)
 *
 *   npx tsx dev/cst-map/export.ts
 */
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { CST_DB, romanSpans, wordAt } from '../cst/align'

const OUT = 'dev/cst-data'
const db = new Database(CST_DB, { readonly: true })
const upstream = (db.prepare(`SELECT v FROM meta WHERE k = 'upstream'`).get() as { v: string }).v
fs.mkdirSync(OUT, { recursive: true })
const tsv = (file: string, header: string[], rows: unknown[][]) => {
  fs.writeFileSync(`${OUT}/${file}`, [header.join('\t'), ...rows.map(r => r.map(v => String(v ?? '').replace(/[\t\n]/g, ' ')).join('\t'))].join('\n') + '\n')
  console.log(`${file}: ${rows.length}`)
}
const book = new Map((db.prepare('SELECT id, name, coll FROM book').all() as { id: number; name: string; coll: string }[]).map(b => [b.id, b]))
const lkColl = (id: number) => ['mula', 'atta'].includes(book.get(id)?.coll ?? '')

// mūla <-> aṭṭhakathā (stored aṭṭhakathā -> mūla)
const links = (db.prepare(`SELECT from_book, from_idx, to_book, to_idx, source, conf FROM para_link WHERE kind = 'mula-atta'`).all() as
  { from_book: number; from_idx: number; to_book: number; to_idx: number; source: string; conf: number }[])
const rows = links.map(l => {
  const atta = book.get(l.from_book)!.coll === 'atta' ? [l.from_book, l.from_idx] : [l.to_book, l.to_idx]
  const mula = book.get(l.from_book)!.coll === 'atta' ? [l.to_book, l.to_idx] : [l.from_book, l.from_idx]
  return [book.get(atta[0])!.name, atta[1], book.get(mula[0])!.name, mula[1], l.source, Math.round(l.conf * 100) / 100]
})
tsv('links.tsv', ['atta_book', 'atta_idx', 'mula_book', 'mula_idx', 'source', 'conf'], rows)

// settings of mūla / aṭṭhakathā units
const settings = (db.prepare(`SELECT e.slug, s.role, s.ord, s.book_id, s.para_start, s.para_end, s.source, s.conf, s.listed, s.title
  FROM setting s JOIN entity e ON e.id = s.entity_id ORDER BY s.book_id, s.para_start, s.role, s.ord`).all() as Record<string, string | number>[])
  .filter(s => lkColl(s.book_id as number))
tsv('settings.tsv', ['slug', 'role', 'ord', 'book', 'para_start', 'para_end', 'source', 'conf', 'listed', 'title'],
  settings.map(s => [s.slug, s.role, s.ord, book.get(s.book_id as number)!.name, s.para_start, s.para_end, s.source, s.conf, s.listed, s.title]))

// names in the paragraphs (once per paragraph)
const mentions = db.prepare(`SELECT DISTINCT p.book_id, p.idx, e.slug, m.amb FROM mention m JOIN para p ON p.id = m.para_id JOIN entity e ON e.id = m.entity_id
  ORDER BY p.book_id, p.idx`).all() as { book_id: number; idx: number; slug: string; amb: number }[]
const lkMentions = mentions.filter(m => lkColl(m.book_id))
tsv('mentions.tsv', ['book', 'idx', 'slug', 'amb'], lkMentions.map(m => [book.get(m.book_id)!.name, m.idx, m.slug, m.amb]))

// glosses (mūla <-> aṭṭhakathā): UTF-16 offsets of the app's Roman text -> Sinhala word numbers
const paraText = new Map<string, string>() // (para has no (book_id, idx) index)
for (const p of db.prepare(`SELECT p.book_id, p.idx, p.text FROM para p JOIN book b ON b.id = p.book_id WHERE b.coll IN ('mula', 'atta')`).iterate() as
  Iterable<{ book_id: number; idx: number; text: string }>) paraText.set(`${p.book_id}#${p.idx}`, p.text)
const spanCache = new Map<string, ReturnType<typeof romanSpans>>()
const spans = (book: number, idx: number) => {
  const k = `${book}#${idx}`
  let s = spanCache.get(k)
  if (!s) spanCache.set(k, s = romanSpans(paraText.get(k) ?? ''))
  return s
}
const glossRows: unknown[][] = []
let glossDropped = 0
for (const g of db.prepare(`SELECT id, src, conf, c_book, c_idx, c_s, c_eidx, c_e, x_eidx, x_e, t_book, t_idx, t_s, t_eidx, t_e FROM gloss
  WHERE kind = 'mula-atta' ORDER BY c_book, c_idx, c_s`).iterate() as Iterable<Record<string, number | string>>) {
  const n = (k: string) => g[k] as number
  const a = wordAt(spans(n('c_book'), n('c_idx')), n('c_s'), false), ae = wordAt(spans(n('c_book'), n('c_eidx')), n('c_e'), true)
  const m = wordAt(spans(n('t_book'), n('t_idx')), n('t_s'), false), me = wordAt(spans(n('t_book'), n('t_eidx')), n('t_e'), true)
  const x = wordAt(spans(n('c_book'), n('x_eidx')), n('x_e'), true) // the last word of the explanation
  if (a < 0 || ae < 0 || m < 0 || me < 0 || x < 0) { glossDropped++; continue }
  glossRows.push([g.id, Math.round(n('conf') * 100) / 100, g.src, book.get(n('c_book'))!.name, n('c_idx'), a, n('c_eidx'), ae, n('x_eidx'), x,
    book.get(n('t_book'))!.name, n('t_idx'), m, n('t_eidx'), me])
}
// a_*: the lemma in the aṭṭhakathā book (paragraph, word .. end paragraph, word), x_*: the last word of its explanation,
// m_*: the quoted words in the mūla book
tsv('glosses.tsv', ['id', 'conf', 'src', 'a_book', 'a_idx', 'a_w', 'a_eidx', 'a_ew', 'x_idx', 'x_w', 'm_book', 'm_idx', 'm_w', 'm_eidx', 'm_ew'], glossRows)
console.log(`glosses not converted (no word at an offset): ${glossDropped}`)

// the entities used
const used = new Set([...settings.map(s => s.slug as string), ...lkMentions.map(m => m.slug)])
const entities = (db.prepare(`SELECT slug, type, name, lemma, family, meaning, lat, lon, prec, units, mentions FROM entity ORDER BY slug`).all() as Record<string, unknown>[])
  .filter(e => used.has(e.slug as string))
tsv('entities.tsv', ['slug', 'type', 'name', 'lemma', 'family', 'meaning', 'lat', 'lon', 'prec', 'units', 'mentions'],
  entities.map(e => [e.slug, e.type, e.name, e.lemma, e.family, e.meaning, e.lat, e.lon, e.prec, e.units, e.mentions]))
fs.writeFileSync(`${OUT}/README.md`, `Exported from tipitaka.app (tipitaka-xml ${upstream}) by dev/cst-map/export.ts - see that file.\n` +
  'Names and meanings: Digital Pāḷi Dictionary (CC BY-NC-SA 4.0) and DPPN (Malalasekera, revised by Ānandajoti Bhikkhu, CC BY-SA 4.0);\n' +
  'coordinates: SuttaCentral map data (CC0); settings, mentions and glosses (commentary word alignment): tipitaka.app.\n')
