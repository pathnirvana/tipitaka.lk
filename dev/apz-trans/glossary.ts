/**
 * The term glossary (dev/apz-trans/glossary.tsv): one Sinhala rendering per frequent Pāḷi term, so the books translated
 * one packet at a time use the same words. Terms are DPD headwords (db/dict.db), counted over the books still to be
 * translated; Opus proposes each rendering from DPD's meaning and example entries with their BJT (and APZ) Sinhala.
 *
 *   npx tsx dev/apz-trans/glossary.ts mine [--top 500]   out/glossary/candidates.json
 *   npx tsx dev/apz-trans/glossary.ts propose            out/glossary/proposed.jsonl (resumable)
 *   npx tsx dev/apz-trans/glossary.ts tsv                glossary.tsv + out/glossary/review-page.html (the user's review page)
 *   npx tsx dev/apz-trans/glossary.ts apply <dir> [--upto <pali>]  the page's reviews (ArtifactData list of `terms`, out_dir) → glossary.tsv
 *
 * glossary.tsv (pali, roman, si, note, freq, status) is the reviewed copy: `tsv` keeps the si/note/status of rows already
 * there and only adds new ones, so the user's corrections stay. Packets use the rows with status ok.
 */
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { convert } from '@pnfo/pali-converter'
import { tokenize } from '../../shared/tokenize'
import { DIR, OUT, STYLE, TSV, claude, openDb, readJsonl, appendJsonl, lemmaOf, readGlossary } from './lib'

const G = path.join(OUT, 'glossary')
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined }
/** the books still to be translated (Paṭṭhāna deferred) */
export const TARGET = (f: string) => /^(vp-|ap-(?!pat)|kn-(cp|mn|nc|ps|nett|petk)\b)/.test(f)
const POS = new Set(['masc', 'fem', 'nt', 'adj', 'pp', 'ptp', 'prp'])

export interface Term { pali: string; roman: string; pos: string; meanings: string[]; freq: number; forms: string[]; examples: { key: string; pali: string; bjt: string; apz?: string }[] }

function mine() {
  const top = Number(arg('--top') ?? 500)
  const db = openDb(), dict = new Database('db/dict.db', { readonly: true })
  const lemmas = lemmaOf(dict)
  const terms = new Map<string, { pos: string; meanings: Set<string>; freq: number; forms: Map<string, number>; entries: Set<number> }>()
  const rows = db.prepare(`SELECT e.id, f.name, e.p_text FROM entry e JOIN file f ON f.id = e.file_id WHERE f.name NOT LIKE 'atta%' AND f.name NOT LIKE 'anya%'`).all() as { id: number; name: string; p_text: string }[]
  for (const r of rows) {
    if (!TARGET(r.name)) continue
    for (const { t } of tokenize(r.p_text)) {
      // (a form that can also be a verb, particle or pronoun - atthi, na, ayaṃ - says nothing about the terms)
      const all = lemmas(t)
      if (!all.length || all.some(l => !POS.has(l.pos))) continue
      const ls = all.filter(l => [...l.base].length > 2)
      const bases = [...new Set(ls.map(l => l.base))]
      for (const b of bases) {
        let x = terms.get(b)
        if (!x) terms.set(b, x = { pos: ls.find(l => l.base === b)!.pos, meanings: new Set(), freq: 0, forms: new Map(), entries: new Set() })
        x.freq += 1 / bases.length
        x.forms.set(t, (x.forms.get(t) ?? 0) + 1)
        if (x.entries.size < 400) x.entries.add(r.id)
        for (const l of ls) if (l.base === b && l.meaning) x.meanings.add(l.meaning)
      }
    }
  }
  // homonyms split a form's count between "Xa" and "Xā" (dhamma / dhammā, vedanā / vedana): one term, the more frequent
  for (const [b, x] of [...terms]) {
    const other = b.endsWith('ā') ? b.slice(0, -1) + 'a' : b.endsWith('a') ? b.slice(0, -1) + 'ā' : ''
    const y = terms.get(other)
    if (!y || !terms.has(b) || y.freq < x.freq) continue
    y.freq += x.freq
    for (const [f, n] of x.forms) y.forms.set(f, (y.forms.get(f) ?? 0) + n)
    for (const id of x.entries) if (y.entries.size < 400) y.entries.add(id)
    terms.delete(b)
  }
  // examples: the shortest target entries with the term (their BJT Sinhala is short enough to find the word in), plus one
  // sutta entry with APZ when there is one
  const eq = db.prepare(`SELECT e.id, f.name, e.page_idx, e.entry_idx, e.p_text, e.s_text FROM entry e JOIN file f ON f.id = e.file_id WHERE e.id = ?`)
  const chosen = [...terms].sort((a, b) => b[1].freq - a[1].freq).slice(0, top)
  const out: Term[] = chosen.map(([b, x]) => {
    const es = [...x.entries].map(id => eq.get(id) as Record<string, any>).filter(e => e.s_text && e.p_text.length > 30)
      .sort((a, b) => a.p_text.length - b.p_text.length).slice(0, 3)
    return {
      pali: convert(b, 'sinh', 'latn'), roman: b, pos: x.pos, meanings: [...x.meanings].slice(0, 4), freq: Math.round(x.freq),
      forms: [...x.forms].sort((a, b) => b[1] - a[1]).slice(0, 12).map(f => f[0]),
      examples: es.map(e => ({ key: `${e.name} ${e.page_idx}:${e.entry_idx}`, pali: clip(e.p_text), bjt: clip(e.s_text) })),
    }
  })
  addApzExamples(db, out)
  fs.mkdirSync(G, { recursive: true })
  fs.writeFileSync(path.join(G, 'candidates.json'), JSON.stringify(out, null, 1))
  console.log(`${terms.size} terms; wrote the top ${out.length} (freq ${out[0].freq} … ${out[out.length - 1].freq})`)
}
const clip = (s: string) => (s ?? '').replace(/\{[^}]*\}/g, '').slice(0, 400)

/** one short sutta entry per term whose APZ shows how the human translation rendered it */
function addApzExamples(db: Database.Database, terms: Term[]) {
  const want = new Map<string, Term>()
  for (const t of terms) for (const f of t.forms.slice(0, 4)) if (!want.has(f)) want.set(f, t)
  const rows = db.prepare(`SELECT e.id, f.name, e.page_idx, e.entry_idx, e.p_text FROM entry e JOIN file f ON f.id = e.file_id
    WHERE f.name GLOB '[dmsa]n-*' OR f.name GLOB 'kn-*' ORDER BY length(e.p_text)`).all() as Record<string, any>[]
  const got = new Set<Term>()
  for (const r of rows) {
    if (r.p_text.length < 40 || got.size === terms.length) continue
    for (const { t } of tokenize(r.p_text)) {
      const term = want.get(t)
      if (!term || got.has(term)) continue
      const apz = apzText(r.name, r.page_idx, r.entry_idx)
      if (!apz) continue
      term.examples.push({ key: `${r.name} ${r.page_idx}:${r.entry_idx}`, pali: clip(r.p_text), bjt: '', apz: clip(apz) })
      got.add(term)
    }
  }
}
const apzFiles = new Map<string, any>()
function apzText(file: string, p: number, e: number): string | undefined {
  if (!apzFiles.has(file)) { const f = `public/static/text-apz/${file}.json`; apzFiles.set(file, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf-8')) : null) }
  return apzFiles.get(file)?.pages[p]?.entries[e] || undefined
}

const TASK = `## Task: a term glossary
You get Pāḷi terms (DPD headwords) that occur often in the books still to be translated (Vinaya, Abhidhamma, and the
Khuddaka books Cariyāpiṭaka, Niddesa, Paṭisambhidāmagga, Netti, Peṭakopadesa), with DPD's English meaning and example
entries: the Pāḷi, its BJT Sinhala and, where there is one, the existing human Sinhala (APZ) of a sutta entry.
For each term give the Sinhala rendering to use in the new translation, following the style rules above, for the reader
described there:
- "si": the rendering as it should appear in a sentence, in its base form. Where the reader would not know the
  established word, give a plain word with the term in brackets, e.g. "ගොරෝසු (ඔළාරික)". Where the Sanskrit-Sinhala form is
  not common Sinhala, use the Pāḷi word in Sinhala script. Proper names and words every reader knows (භික්ෂුව, ධර්මය)
  are given as they are.
- "note": short, in English: when the rendering depends on context (give the alternatives and when to use each), or why
  you chose it over BJT's word. Empty when nothing needs saying.
Return {"items": [{"i", "si", "note"}]}: one item per term, same i numbers.`

async function propose() {
  const terms: Term[] = JSON.parse(fs.readFileSync(path.join(G, 'candidates.json'), 'utf-8'))
  const file = path.join(G, 'proposed.jsonl')
  const done = new Set(readJsonl<{ roman: string }>(file).map(x => x.roman))
  const todo = terms.filter(t => !done.has(t.roman))
  const BATCH = 30, JOBS = 4
  const batches: Term[][] = []
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH))
  console.log(`${todo.length} terms to propose in ${batches.length} batches`)
  const schema = { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object',
    properties: { i: { type: 'integer' }, si: { type: 'string' }, note: { type: 'string' } }, required: ['i', 'si', 'note'] } } } }
  let next = 0, cost = 0
  await Promise.all(Array.from({ length: JOBS }, async () => {
    while (next < batches.length) {
      const b = batches[next++]
      const user = b.map((t, i) => [`## i=${i + 1} ${t.pali} (${t.roman}, ${t.pos}, ${t.freq}×) forms: ${t.forms.join(' ')}`,
        `DPD: ${t.meanings.join(' | ')}`,
        ...t.examples.map(e => `[${e.key}] PALI: ${e.pali}\n${e.apz ? `APZ: ${e.apz}` : `BJT: ${e.bjt}`}`)].join('\n')).join('\n\n')
      try {
        const r = await claude('claude-opus-5-5', STYLE + '\n\n' + TASK, user, schema)
        cost += r.usage.costUsd
        for (const x of r.out.items as unknown as { i: number; si: string; note: string }[]) {
          const t = b[x.i - 1]
          if (t) appendJsonl(file, { roman: t.roman, si: x.si, note: x.note })
        }
        console.log(`batch done (${b[0].roman} …), $${cost.toFixed(2)} so far`)
      } catch (e) { console.error(`batch failed: ${(e as Error).message.slice(0, 300)}`) }
    }
  }))
}

function tsv() {
  const terms: Term[] = JSON.parse(fs.readFileSync(path.join(G, 'candidates.json'), 'utf-8'))
  const prop = new Map(readJsonl<{ roman: string; si: string; note: string }>(path.join(G, 'proposed.jsonl')).map(x => [x.roman, x]))
  const have = readGlossary()
  for (const t of terms) {
    const p = prop.get(t.roman)
    if (!p || have.has(t.roman)) continue
    have.set(t.roman, { pali: t.pali, roman: t.roman, si: p.si, note: p.note, freq: t.freq, status: 'proposed' })
  }
  const rows = [...have.values()].sort((a, b) => b.freq - a.freq)
  fs.writeFileSync(TSV, ['pali\troman\tsi\tnote\tfreq\tstatus', ...rows.map(r => [r.pali, r.roman, r.si, r.note, r.freq, r.status].map(c => String(c).replace(/[\t\n]+/g, ' ')).join('\t'))].join('\n') + '\n')
  const byRoman = new Map(terms.map(t => [t.roman, t]))
  // (the page shows the terms still to review; approved ones are in glossary.tsv)
  fs.writeFileSync(path.join(G, 'review.json'), JSON.stringify(rows.filter(r => r.status !== 'ok').map(r => {
    const t = byRoman.get(r.roman)
    return { ...r, dpd: t?.meanings.join(' | ') ?? '', example: t?.examples.find(e => !e.apz) ?? null, apz: t?.examples.find(e => e.apz) ?? null }
  })))
  const page = fs.readFileSync(path.join(DIR, 'glossary-review.html'), 'utf-8')
  fs.writeFileSync(path.join(G, 'review-page.html'), page.replace('__DATA__', () => fs.readFileSync(path.join(G, 'review.json'), 'utf-8').replace(/</g, '\\u003c')))
  console.log(`${TSV}: ${rows.length} rows (${rows.filter(r => r.status === 'ok').length} ok)`)
}

/**
 * The user's reviews from the glossary page (its db collection `terms`, saved as JSON files by ArtifactData) into
 * glossary.tsv. --upto <pali>: the user also approved every term up to and including this one (in the page's order).
 */
function apply(dir: string) {
  const rows = readGlossary()
  let n = 0
  const upto = arg('--upto')
  if (upto) {
    const list = [...rows.values()].sort((a, b) => b.freq - a.freq), end = list.findIndex(r => r.pali === upto)
    if (end < 0) throw new Error(`--upto ${upto}: no such term`)
    for (const r of list.slice(0, end + 1)) if (r.status === 'proposed') { r.status = 'ok'; n++ }
  }
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'))
    const x = d.data ?? d, r = rows.get(x.roman)
    if (!r || !x.si) continue
    r.si = x.si; r.status = 'ok'
    if (x.status === 'changed') r.note = ''
    n++
  }
  fs.writeFileSync(TSV, ['pali\troman\tsi\tnote\tfreq\tstatus', ...[...rows.values()].sort((a, b) => b.freq - a.freq)
    .map(r => [r.pali, r.roman, r.si, r.note, r.freq, r.status].map(c => String(c).replace(/[\t\n]+/g, ' ')).join('\t'))].join('\n') + '\n')
  console.log(`${n} reviewed terms applied; ${[...rows.values()].filter(r => r.status === 'ok').length} of ${rows.size} ok`)
}

if (process.argv[1]?.endsWith('glossary.ts')) {
  const cmd = process.argv[2]
  if (cmd === 'mine') mine()
  else if (cmd === 'propose') propose()
  else if (cmd === 'tsv') tsv()
  else if (cmd === 'apply') apply(process.argv[3])
  else console.error('usage: glossary.ts mine|propose|tsv|apply <dir>')
}
