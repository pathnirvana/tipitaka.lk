/**
 * Sinhala translations of the English descriptions of the names (places, people …) that tipitaka.app gives tipitaka.lk
 * (dev/cst-data/entities.tsv: DPD meanings like "name of a town", the first sentences of DPPN entries, and the categories
 * like "villages, towns and cities"), by Gemini. The translations are lk's own, keyed by the English text, so they
 * survive re-exports from the app; only new texts are sent.
 *
 *   GEMINI_API_KEY=… npx tsx dev/names-si/translate.ts [--app] [--limit N] [--model gemini-4-argon]
 *
 * --app: also every name of tipitaka.app's db (../cst/db/text.db, the names the texts do not mention too), so that the
 * files cover the app's names as well (it can use them for its Sinhala interface).
 *
 * Writes dev/names-si/meanings.tsv and families.tsv (en, si) - reviewed by hand: a corrected row stays (rows are only
 * added). The build (build/cst.ts) shows the Sinhala and falls back to the English.
 */
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { CST_DB } from '../cst/align'

const DIR = 'dev/names-si'
const KEY = process.env.GEMINI_API_KEY
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined }
const MODEL = arg('--model') ?? 'gemini-4-argon'
const LIMIT = Number(arg('--limit') ?? Infinity)
const BATCH = 40, JOBS = 4

const STYLE = `You translate short English descriptions of proper names in the Pāḷi Tipiṭaka into Sinhala for tipitaka.lk,
a Sinhala Tipiṭaka website read by Sri Lankan Buddhists.
Rules:
- Natural modern Sinhala as in Sri Lankan Buddhist writing.
- Honorifics: the Buddha, paccekabuddhas, arahants, theras, therīs, monks and nuns get the respectful forms (බුදුරජාණන් වහන්සේ,
  පසේබුදුරජාණන් වහන්සේ, රහතන් වහන්සේ, භික්ෂූන් වහන්සේ, භික්ෂුණීන් වහන්සේ, තෙරුන් වහන්සේ; verbs: වැඩ සිටි, වැඩම කළ, දේශනා කළ සේක,
  පිරිනිවන් පෑ); kings රජතුමා; other people, deities, animals and places plain forms.
- Pāḷi names in Sinhala script in their Pāḷi form (Kakusandha → කකුසන්ධ, Sāvatthī → සාවත්ථි, Magadha → මගධ, Licchavi → ලිච්ඡවි);
  modern names in Sinhala script (Ceylon → ලංකාව, Rajgir → රාජ්ගීර්).
- Short descriptions say what the name is, without "name of": "name of a town" → "නුවරකි", "name of a daemon" → "යක්ෂයෙකි",
  "name of an arahant monk" → "රහත් භික්ෂූන් වහන්සේ නමකි", "An Arahant." → "රහතන් වහන්සේ නමකි.". Lists separated by ; stay
  lists, each item short ("chief disciple" → "අගසව්").
- Drop text references such as (Mhv.x.88), (q.v.), (see …); keep the meaning exact, add nothing, no explanations.
- Categories (kind: category) are plural labels without "names of" and without a "DPPN:" prefix: "names of monks" →
  "භික්ෂූන් වහන්සේලා", "villages, towns and cities" → "ගම්, නියම්ගම් සහ නුවරවල්", "DPPN: tank" → "වැව්".
Return a JSON array with one object {"i": number, "si": string} per input item, same numbers.`

const readTsv = (f: string) => fs.existsSync(f)
  ? new Map(fs.readFileSync(f, 'utf-8').split('\n').slice(1).filter(Boolean).map(l => l.split('\t') as [string, string]))
  : new Map<string, string>()
const writeTsv = (f: string, m: Map<string, string>) =>
  fs.writeFileSync(f, ['en\tsi', ...[...m].sort((a, b) => a[0].localeCompare(b[0])).map(([en, si]) => `${en}\t${si}`)].join('\n') + '\n')

async function gemini(items: { i: number; kind: string; en: string }[]): Promise<Map<number, string>> {
  const text = STYLE + '\n\n' + items.map(x => `${x.i}. (${x.kind}) ${x.en}`).join('\n')
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { responseMimeType: 'application/json',
        responseSchema: { type: 'ARRAY', items: { type: 'OBJECT', properties: { i: { type: 'INTEGER' }, si: { type: 'STRING' } }, required: ['i', 'si'] } } } }),
    })
    if (res.ok) {
      const d = await res.json() as { candidates?: { content: { parts: { text?: string }[] } }[] }
      const out = JSON.parse(d.candidates?.[0]?.content.parts.map(p => p.text ?? '').join('') ?? '[]') as { i: number; si: string }[]
      return new Map(out.filter(o => o.si?.trim()).map(o => [o.i, o.si.trim().replace(/[\t\n]+/g, ' ')]))
    }
    if (attempt >= 4 || ![429, 500, 503].includes(res.status)) throw new Error(`${res.status} ${await res.text()}`)
    await new Promise(r => setTimeout(r, 5000 * (attempt + 1)))
  }
}

async function main() {
  if (!KEY) throw new Error('GEMINI_API_KEY is not set')
  const rows = fs.readFileSync('dev/cst-data/entities.tsv', 'utf-8').split('\n').slice(1).filter(Boolean).map(l => l.split('\t'))
  if (process.argv.includes('--app')) {
    const db = new Database(CST_DB, { readonly: true })
    for (const e of db.prepare('SELECT slug, type, name, lemma, family, meaning FROM entity').all() as Record<string, string>[]) rows.push([e.slug, e.type, e.name, e.lemma, e.family, e.meaning])
    db.close()
  }
  const files = { meaning: path.join(DIR, 'meanings.tsv'), category: path.join(DIR, 'families.tsv') }
  const done = { meaning: readTsv(files.meaning), category: readTsv(files.category) }
  // (columns: slug type name lemma family meaning …)
  const todo: { i: number; kind: 'meaning' | 'category'; en: string }[] = []
  const seen = new Set<string>()
  for (const [kind, col] of [['category', 4], ['meaning', 5]] as const) {
    for (const r of rows) {
      const en = r[col]
      if (!en || done[kind].has(en) || seen.has(kind + en)) continue
      seen.add(kind + en)
      todo.push({ i: todo.length + 1, kind, en })
    }
  }
  const work = todo.slice(0, LIMIT)
  console.log(`${todo.length} to translate (${done.meaning.size} meanings, ${done.category.size} categories done); sending ${work.length}`)
  const batches: typeof work[] = []
  for (let i = 0; i < work.length; i += BATCH) batches.push(work.slice(i, i + BATCH))
  let next = 0, n = 0
  await Promise.all(Array.from({ length: JOBS }, async () => {
    while (next < batches.length) {
      const b = batches[next++]
      try {
        const got = await gemini(b)
        for (const x of b) { const si = got.get(x.i); if (si) { done[x.kind].set(x.en, si); n++ } }
        writeTsv(files.meaning, done.meaning); writeTsv(files.category, done.category) // (saved as it goes)
        console.log(`${n} / ${work.length}`)
      } catch (e) { console.error(`batch failed: ${(e as Error).message.slice(0, 300)}`) }
    }
  }))
  console.log(`translated ${n}; missing ${work.length - n} (run again)`)
}
main()
