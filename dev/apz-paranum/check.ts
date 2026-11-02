/**
 * Asks Claude whether the sin_apz entry translates the Pāḷi entry beside it, at the first and last entry of each run
 * in runs.json (from runs.py). Results go to check.json, keyed "<run>:first" / "<run>:last"; reruns skip what is done.
 *   npx tsx dev/apz-paranum/check.ts [--model sonnet]
 */
import fs from 'node:fs'
import { claude } from '../apz-trans/lib'

const D = 'dev/apz-paranum/'
const model = process.argv.includes('--model') ? process.argv[process.argv.indexOf('--model') + 1] : 'sonnet'
const runs: { file: string; offset: number | 'add'; entries: [number, number, number, number | null][] }[] =
  JSON.parse(fs.readFileSync(D + 'runs.json', 'utf8')).runs
const out: Record<string, { match: string; note?: string }> = fs.existsSync(D + 'check.json') ? JSON.parse(fs.readFileSync(D + 'check.json', 'utf8')) : {}

const cache = new Map<string, [any, any]>()
function texts(name: string, pi: number, i: number) {
  if (!cache.has(name)) cache.set(name, [JSON.parse(fs.readFileSync(`public/static/text-apz/${name}.json`, 'utf8')),
    JSON.parse(fs.readFileSync(`public/static/text/${name}.json`, 'utf8'))])
  const [a, b] = cache.get(name)!
  return { pali: b.pages[pi].pali.entries[i].text.replace(/\{\d+\}/g, '').slice(0, 400), sinh: a.pages[pi].entries[i].slice(0, 400) }
}

const items: { id: string; pali: string; sinh: string }[] = []
runs.forEach((r, k) => {
  const ends = r.entries.length > 1 ? [['first', r.entries[0]], ['last', r.entries.at(-1)!]] as const : [['first', r.entries[0]]] as const
  for (const [which, e] of ends) if (!out[`${k}:${which}`]) items.push({ id: `${k}:${which}`, ...texts(r.file, e[0], e[1]) })
})

const SYSTEM = `Each item has a Pāḷi paragraph or verse (BJT edition) and the Sinhala paragraph that sits beside it in a parallel reader.
Their leading paragraph numbers may differ: ignore the numbers. Texts may be cut off at 400 letters.
For each item decide whether the Sinhala translates that same Pāḷi passage ("yes"), a different passage ("no"),
or only part of it / it together with other passages ("partial"). Give a note of a few words when the answer is not "yes".`
const SCHEMA = { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object', required: ['id', 'match'],
  properties: { id: { type: 'string' }, match: { type: 'string', enum: ['yes', 'no', 'partial'] }, note: { type: 'string' } } } } } }

const batches: typeof items[] = []
for (let i = 0; i < items.length; i += 40) batches.push(items.slice(i, i + 40))
console.log(items.length, 'items in', batches.length, 'batches')
let next = 0
await Promise.all([0, 1, 2, 3].map(async () => {
  while (next < batches.length) {
    const b = batches[next++]
    const { out: res } = await claude(model, SYSTEM, JSON.stringify(b, null, 0), SCHEMA, 'low')
    for (const x of res.items as any[]) out[x.id] = x.note ? { match: x.match, note: x.note } : { match: x.match }
    fs.writeFileSync(D + 'check.json', JSON.stringify(out, null, 0))
    console.log('done', Object.keys(out).length, '/', items.length)
  }
}))
