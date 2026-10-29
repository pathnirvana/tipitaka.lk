/**
 * The pilot report: usage per 1k Pāḷi chars per runner, the judge's win rates and error kinds, how much the Opus review
 * changed Gemini's drafts, the QA verdicts on AI vs human APZ, and the entries for the user's blind review.
 *
 *   npx tsx dev/apz-trans/report.ts [--set pilot]
 *
 * Writes out/<set>/report.md, review.json (the page's data: A/B shuffled, no runner names) and review-key.json (which
 * letter is which runner, kept out of the page).
 */
import fs from 'node:fs'
import path from 'node:path'
import { DIR, OUT, readJsonl, opusIsA, type Packet, type Result } from './lib'

type P = Packet & { group: string }
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined }
const SET = arg('--set') ?? 'pilot'
const dir = path.join(OUT, SET)
const packets: P[] = JSON.parse(fs.readFileSync(path.join(dir, 'packets.json'), 'utf-8'))
const load = (r: string) => new Map(readJsonl<Result>(path.join(dir, `${r}.jsonl`)).map(x => [x.packet, x]))
const R = { opus: load('opus'), gemini: load('gemini'), review: load('review'), judge: load('judge') }
const pct = (a: number, b: number) => b ? `${Math.round(100 * a / b)}%` : '-'
const paliOf = (p: P) => p.entries.reduce((s, e) => s + e.pali.length, 0)

/** word-level similarity (LCS / longer length) */
function similarity(a: string, b: string) {
  const x = a.split(/\s+/), y = b.split(/\s+/)
  const dp = new Array(y.length + 1).fill(0)
  for (let i = 1; i <= x.length; i++) { let prev = 0; for (let j = 1; j <= y.length; j++) { const t = dp[j]; dp[j] = x[i - 1] === y[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]); prev = t } }
  return dp[y.length] / Math.max(x.length, y.length, 1)
}

const md: string[] = ['# apz-trans pilot report', '']
md.push('## Usage per 1k Pāḷi chars', '', '| runner | group | packets | Pāḷi chars | in tok/1k | out tok/1k | $/1k (list) | s/1k |', '|---|---|---|---|---|---|---|---|')
for (const [name, m] of [['opus', R.opus], ['gemini', R.gemini], ['review', R.review], ['judge', R.judge]] as const) {
  for (const g of ['vinaya', 'abhidhamma', 'qa', 'all']) {
    const ps = packets.filter(p => (g === 'all' || p.group === g) && m.has(p.id))
    if (!ps.length) continue
    const k = ps.reduce((s, p) => s + paliOf(p), 0) / 1000
    const u = ps.map(p => m.get(p.id)!.usage)
    const sum = (f: (x: Result['usage']) => number) => u.reduce((s, x) => s + f(x), 0) / k
    md.push(`| ${name} | ${g} | ${ps.length} | ${Math.round(k * 1000)} | ${Math.round(sum(x => x.input + x.cacheRead + x.cacheWrite))} | ${Math.round(sum(x => x.output))} | ${sum(x => x.costUsd).toFixed(3)} | ${Math.round(sum(x => x.ms) / 1000)} |`)
  }
}

md.push('', '## Judge (Fable, blind): which is better', '', '| group | entries | opus | gemini+review | tie | significant |', '|---|---|---|---|---|---|')
const kinds = { opus: new Map<string, number>(), review: new Map<string, number>() }
for (const g of ['vinaya', 'abhidhamma', 'qa', 'all']) {
  const items = packets.filter(p => g === 'all' || p.group === g).flatMap(p => R.judge.get(p.id)?.items ?? []) as unknown as Record<string, any>[]
  if (!items.length) continue
  const c = (b: string) => items.filter(x => x.better === b).length
  md.push(`| ${g} | ${items.length} | ${c('opus')} | ${c('review')} | ${c('tie')} | ${items.filter(x => x.significant).length} |`)
  if (g === 'all') for (const x of items) for (const r of ['opus', 'review'] as const) for (const e of x[`${r}_errors`] ?? []) kinds[r].set(e.kind, (kinds[r].get(e.kind) ?? 0) + 1)
}
md.push('', 'Errors the judge found:', '', '| kind | opus | gemini+review |', '|---|---|---|')
for (const k of new Set([...kinds.opus.keys(), ...kinds.review.keys()])) md.push(`| ${k} | ${kinds.opus.get(k) ?? 0} | ${kinds.review.get(k) ?? 0} |`)

md.push('', '## How much the Opus review changed Gemini', '')
const rev = packets.filter(p => p.mode === 'translate').flatMap(p => R.review.get(p.id)?.items ?? [])
const rk = new Map<string, number>()
for (const x of rev) for (const e of x.errors ?? []) rk.set(e.kind, (rk.get(e.kind) ?? 0) + 1)
md.push(`Translate packets: ${rev.filter(x => x.verdict === 'fixed').length} of ${rev.length} Gemini entries fixed. Kinds: ${[...rk].map(([k, n]) => `${k} ${n}`).join(', ')}`)

md.push('', '## QA verdicts on APZ (Opus direct / Gemini+review)', '', '| APZ | entries | ok | fixed | retranslated |', '|---|---|---|---|---|')
for (const ai of [true, false]) {
  for (const [name, m] of [['opus', R.opus], ['review', R.review]] as const) {
    const xs = packets.filter(p => p.mode === 'qa').flatMap(p => (m.get(p.id)?.items ?? []).filter(x => !!p.entries[x.i - 1]?.ai === ai))
    const c = (v: string) => xs.filter(x => x.verdict === v).length
    md.push(`| ${ai ? 'AI fill-in' : 'human'} (${name}) | ${xs.length} | ${c('ok')} | ${c('fixed')} | ${c('retranslated')} |`)
  }
}

// the blind review: entries the judge calls significant, or where the two share less than half their words
const review: Record<string, unknown>[] = [], key: Record<string, string> = {}
for (const p of packets) {
  const o = R.opus.get(p.id), v = R.review.get(p.id), j = R.judge.get(p.id)
  if (!o || !v) continue
  const aIsOpus = opusIsA(p.id)
  p.entries.forEach((e, i) => {
    const os = o.items.find(x => x.i === i + 1)?.si ?? '', vs = v.items.find(x => x.i === i + 1)?.si ?? ''
    const ji = j?.items.find(x => x.i === i + 1) as Record<string, any> | undefined
    const sim = similarity(os, vs)
    if (!(ji?.significant || sim < 0.5) || e.pali.length < 15) return
    const [a, b] = aIsOpus ? [os, vs] : [vs, os]
    review.push({ id: e.key, group: p.group, type: e.type, pali: e.pali.replace(/\{[^}]*\}/g, ''), bjt: e.bjt.replace(/\{[^}]*\}/g, ''),
      ...(p.mode === 'qa' ? { apz: e.apz ?? '', ai: !!e.ai } : {}), glosses: (p.glosses[e.key] ?? []).slice(0, 12), a, b, sim: Math.round(sim * 100) / 100 })
    key[e.key] = aIsOpus ? 'A=opus B=gemini+review' : 'A=gemini+review B=opus'
  })
}
md.push('', `## Blind review: ${review.length} entries differ significantly`, '')
fs.writeFileSync(path.join(dir, 'review.json'), JSON.stringify(review))
fs.writeFileSync(path.join(dir, 'review-key.json'), JSON.stringify(key, null, 1))
const round = SET.match(/(\d+)$/)?.[1] // (pilot2 -> its own page, "… Round 2")
fs.writeFileSync(path.join(dir, 'review-page.html'), fs.readFileSync(path.join(DIR, 'review.html'), 'utf-8')
  .replace(/Pitaka Translation Review/g, round ? `Pitaka Translation Review Round ${round}` : '$&')
  .replace('__DATA__', () => JSON.stringify(review).replace(/</g, '\\u003c')))
fs.writeFileSync(path.join(dir, 'report.md'), md.join('\n') + '\n')
console.log(md.join('\n'))
