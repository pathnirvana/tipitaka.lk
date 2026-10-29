/**
 * Builds the spot-check page of finished runs (out/spotcheck/page.html, from spotcheck.html): a seeded sample of each
 * set's results, before merge.ts --write. Run merge.ts (dry run) first: the flags come from its flags.tsv.
 *
 *   npx tsx dev/apz-trans/spotcheck.ts qa vp-prj
 *   npx tsx dev/apz-trans/spotcheck.ts qa-redo vp-prj-redo   (every entry of a redo set against its first run: out/spotcheck-redo)
 *
 * QA: retranslated, fixed, the flagged kinds (length, -පෙ- expanded, edition) and nothing marked ok. A translated book:
 * random entries, plus every length / latin flag and some -පෙ- expanded ones.
 */
import fs from 'node:fs'
import path from 'node:path'
import { DIR, OUT, readJsonl, type Packet, type Result } from './lib'

const N: Record<string, number> = { retranslated: 15, fixed: 15, sample: 20, length: 16, latin: 5, 'peyyala-expanded': 5, 'qa-edition': 8 }
const QA_KINDS = ['retranslated', 'fixed', 'length', 'peyyala-expanded', 'qa-edition'], BOOK_KINDS = ['sample', 'length', 'latin', 'peyyala-expanded']
function rng(seed: number) { return () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 }
const strip = (s: string) => s.replace(/\{[^}]*\}/g, '')

const out: any[] = []
const REDO = process.argv[2]?.endsWith('-redo')
for (const set of process.argv.slice(2)) {
  if (REDO) { out.push(...redo(set)); continue }
  const dir = path.join(OUT, set), rand = rng(20261029)
  const packets: Packet[] = JSON.parse(fs.readFileSync(path.join(dir, 'packets.json'), 'utf-8'))
  const results = new Map(readJsonl<Result>(path.join(dir, 'opus.jsonl')).map(r => [r.packet, r]))
  const flags = new Map<string, string[]>()
  for (const l of fs.readFileSync(path.join(dir, 'flags.tsv'), 'utf-8').split('\n').slice(1).filter(Boolean)) {
    const [key, , kind] = l.split('\t'); flags.set(key, [...(flags.get(key) ?? []), kind])
  }
  const qa = packets[0]?.mode === 'qa'
  const pool: Record<string, any[]> = {}
  for (const p of packets) p.entries.forEach((e, i) => {
    const it = results.get(p.id)?.items.find(x => x.i === i + 1)
    if (!it || e.pali.length < 40 || (qa && (it.verdict ?? 'fixed') === 'ok')) return
    const row = { id: e.key, set, pali: strip(e.pali), bjt: strip(e.bjt), si: it.si, ...(qa ? { old: e.apz ?? '', ai: !!e.ai, errors: it.errors ?? [], verdict: it.verdict ?? 'fixed' } : {}), why: [] as string[] }
    const kinds = [...(qa ? [it.verdict ?? 'fixed'] : ['sample']), ...(flags.get(e.key) ?? [])]
    for (const k of kinds) if ((qa ? QA_KINDS : BOOK_KINDS).includes(k)) (pool[k] ??= []).push(row)
  })
  const picked = new Map<string, any>()
  // (the flag kinds first, so a random pick that is also flagged shows the flag)
  for (const k of [...(qa ? QA_KINDS : BOOK_KINDS)].reverse()) {
    const xs = (pool[k] ?? []).filter(r => !picked.has(r.id))
    for (let n = 0; n < N[k] && xs.length; n++) { const r = xs.splice(Math.floor(rand() * xs.length), 1)[0]; picked.set(r.id, r) }
  }
  for (const r of picked.values()) {
    const fl = (flags.get(r.id) ?? []).filter(k => (qa ? QA_KINDS : BOOK_KINDS).includes(k))
    r.why = qa ? [r.verdict, ...fl] : fl.length ? fl : ['sample']
  }
  const rows = [...picked.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
  console.log(set, rows.length, Object.fromEntries(Object.entries(pool).map(([k, v]) => [k, v.length])))
  out.push(...rows)
}
/** every entry of a redo set: its first-run text against the redone one */
function redo(set: string) {
  const parent = set.replace(/-redo$/, ''), first = new Map<string, string>()
  const pp: Packet[] = JSON.parse(fs.readFileSync(path.join(OUT, parent, 'packets.json'), 'utf-8'))
  const pr = new Map(readJsonl<Result>(path.join(OUT, parent, 'opus.jsonl')).map(r => [r.packet, r]))
  for (const p of pp) p.entries.forEach((e, i) => { const it = pr.get(p.id)?.items.find(x => x.i === i + 1); if (it) first.set(e.key, it.si) })
  const packets: Packet[] = JSON.parse(fs.readFileSync(path.join(OUT, set, 'packets.json'), 'utf-8'))
  const results = new Map(readJsonl<Result>(path.join(OUT, set, 'opus.jsonl')).map(r => [r.packet, r]))
  return packets.flatMap(p => p.entries.flatMap((e, i) => {
    const it = results.get(p.id)?.items.find(x => x.i === i + 1)
    if (!it || it.verdict === 'ok') return []
    return [{ id: e.key, set: parent, pali: strip(e.pali), bjt: strip(e.bjt), si: it.si, old: first.get(e.key) ?? '', oldLabel: 'FIRST RUN',
      newLabel: 'FOLLOWING BJT', ...(e.apz ? { apz: e.apz } : {}), errors: [], why: ['BJT explains'] }]
  })).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
}

const dir = path.join(OUT, REDO ? 'spotcheck-redo' : 'spotcheck')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'page.html'), fs.readFileSync(path.join(DIR, 'spotcheck.html'), 'utf-8')
  .replace('__DATA__', () => JSON.stringify(out).replace(/</g, '\\u003c')))
console.log(`${dir}/page.html: ${out.length} entries`)
