/**
 * Experiments for extending the rewrite method (prompt-v2.md) to the Abhidhamma: which model and effort writes the
 * Sinhala, judged blind by Fable against the Pāḷi and BJT.
 *
 *   npx tsx dev/apz-trans/exp.ts build <name> <file page:entry> [<file page:entry> …]
 *     out/exp-<name>/packets.json: one packet of about 4,000 Pāḷi chars from each start entry.
 *   npx tsx dev/apz-trans/exp.ts rewrite <name> --tag opus-medium --model claude-opus-5-5 --effort medium
 *     every packet rewritten by that model: out/exp-<name>/<tag>.jsonl (with the usage of each call).
 *   npx tsx dev/apz-trans/exp.ts judge <name> --tags opus-medium,sonnet-low,…
 *     Fable lists the errors of each candidate, blind (letters shuffled per packet): judge.jsonl, then the summary.
 *   npx tsx dev/apz-trans/exp.ts summary <name>
 *
 * The second experiment, on consecutive packets of one file (a chain, as in a real run):
 *   npx tsx dev/apz-trans/exp.ts buildchain <name> <file> <page:entry> <packets>
 *   npx tsx dev/apz-trans/exp.ts chain <name> --tag x --model … --effort … [--ledger]
 *     the packets in order, each with the last two entries before it (PREV); with --ledger also the terms list the
 *     run builds for itself: every call returns the terms it worded, later packets get those that occur in their Pāḷi.
 *   npx tsx dev/apz-trans/exp.ts review <name> --tag x [--model claude-opus-5-5] [--ledger]
 *     one call over the whole chain (review-prompt.md): <tag>+rev.jsonl has the corrected text, review-<tag>.json the changes.
 */
import fs from 'node:fs'
import path from 'node:path'
import { OUT, REWRITE, SCHEMA, claude, entries, openDb, packet, render, readJsonl, appendJsonl, type Entry, type Packet, type Result } from './lib'

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined }
const [cmd, name] = process.argv.slice(2)
if (!cmd || !name) throw new Error('usage: exp.ts build|rewrite|judge|summary <name> …')
const dir = path.join(OUT, `exp-${name}`)
fs.mkdirSync(dir, { recursive: true })
const MAX_PALI = 4000
const FABLE = 'claude-fable-5-2'
const RULES = REWRITE.replace(/## Task[\s\S]*$/, '')
const TERMS_RULE = `## Terms list
# TERMS, when present, lists Pāḷi terms with the Sinhala wording already used for them earlier in this book. Use that
wording wherever the term has the same meaning here; where the context gives it another meaning, word it as the context
requires.
`
const TERMS_TASK = `
Also return "terms": the technical terms, names and fixed phrases of this packet that will come again in the book and are
not in # TERMS, each as {"pali", "si"}: "pali" is the term as a Pāḷi stem without its case ending (e.g. වෙදනාක්ඛන්ධ), "si"
the Sinhala wording you used for it, without a case ending. Only terms you worded in this packet, at most 15; [] if none.`
const TERMS_SCHEMA = { type: 'array', items: { type: 'object', required: ['pali', 'si'], properties: { pali: { type: 'string' }, si: { type: 'string' } } } }
/** the rows of the terms list whose Pāḷi stem occurs in these entries (the longest stems first, at most 80) */
const termsFor = (ledger: Map<string, string>, es: Entry[]) => {
  const text = es.map(e => e.pali).join(' ')
  return [...ledger].filter(([p]) => p.length >= 4 && text.includes(p)).sort((a, b) => b[0].length - a[0].length).slice(0, 80).map(([p, si]) => `${p} → ${si}`)
}

const JUDGE_TASK = `## Task: check candidate rewrites
Each entry under # ENTRIES has several candidate rewrites (A, B, …) of its BJT, made under the rules above by different
writers. You do not know which writer made which. For every entry and every candidate, list its errors against the PALI,
the BJT and the rules:
- meaning: says something different from BJT (or from the Pāḷi where BJT is wrong or silent); a term rendered wrongly.
- omission: a clause, list item, number or explanation of BJT/Pāḷi is missing.
- addition: content that is in neither BJT nor the Pāḷi (other than a short bracket explanation of an unknown word).
- unknown-word: a word the ordinary reader would not know (an old or learned word, an unexplained Sanskrit form), or a
  word that means something else today.
- sentence: a sentence that is unclear, garbled, ungrammatical or ambiguous.
- not-modernised: old verb endings, old spellings or archaic number words kept from BJT.
- form: paragraph number, bold, -පෙ-, quotes or entry boundaries handled against the rules.
Give each error a severity: "major" (the reader is misled or loses content) or "minor". List only real errors: do not
penalise a valid difference of wording, and judge every candidate by the same standard. An entry with no errors gets an
empty list. "best" names the candidate letters you would publish for that entry, best first ("tie" if all are equal).
Return {"items": [{"i", "cands": [{"c", "errors": [{"kind", "severity", "note"}]}], "best"}]}: one item per entry. Notes are
short, in English, and quote the words concerned.`
const JUDGE_SCHEMA = { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object', required: ['i', 'cands', 'best'], properties: {
  i: { type: 'integer' }, best: { type: 'string' },
  cands: { type: 'array', items: { type: 'object', required: ['c', 'errors'], properties: { c: { type: 'string' },
    errors: { type: 'array', items: { type: 'object', required: ['kind', 'severity', 'note'], properties: { kind: { type: 'string' }, severity: { type: 'string' }, note: { type: 'string' } } } } } } } } } } } }

const packetsFile = path.join(dir, 'packets.json')
const packets = (): Packet[] => JSON.parse(fs.readFileSync(packetsFile, 'utf-8'))
/** the candidates' order for a packet: the same on every run */
function order(id: string, tags: string[]) {
  let h = [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7)
  const t = [...tags]
  for (let i = t.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [t[i], t[j]] = [t[j], t[i]] }
  return t
}
async function pool<T>(xs: T[], n: number, f: (x: T) => Promise<void>) {
  let next = 0
  await Promise.all(Array.from({ length: n }, async () => { while (next < xs.length) await f(xs[next++]) }))
}

if (cmd === 'build') {
  const db = openDb(), out: Packet[] = []
  const a = process.argv.slice(4)
  for (let k = 0; k + 1 < a.length; k += 2) {
    const es: Entry[] = []
    let size = 0
    for (const e of entries(db, a[k], a[k + 1], '99999:9999')) { if (es.length && size + e.pali.length > MAX_PALI) break; es.push(e); size += e.pali.length }
    out.push(packet(db, `${a[k]}@${a[k + 1]}`, 'rewrite', es))
    console.log(`${a[k]} ${a[k + 1]}: ${es.length} entries, ${size} Pāḷi chars, ${es.reduce((s, e) => s + e.bjt.length, 0)} BJT chars`)
  }
  fs.writeFileSync(packetsFile, JSON.stringify(out))
} else if (cmd === 'buildchain') {
  const db = openDb(), [file, start, n] = process.argv.slice(4)
  const out: Packet[] = []
  let cur: Entry[] = [], size = 0
  for (const e of entries(db, file, start, '99999:9999')) {
    const heading = e.type === 'heading' || e.type === 'centered'
    if (cur.length && (size + e.pali.length > MAX_PALI || (heading && size >= 2000))) { out.push(packet(db, `${file}-${out.length + 1}`, 'rewrite', cur)); cur = []; size = 0 }
    if (out.length >= Number(n)) break
    cur.push(e); size += e.pali.length
  }
  fs.writeFileSync(packetsFile, JSON.stringify(out))
  console.log(`${out.length} packets, ${out.flatMap(p => p.entries).length} entries, ${out.flatMap(p => p.entries).reduce((s, e) => s + e.pali.length, 0)} Pāḷi chars`)
} else if (cmd === 'chain') {
  const tag = arg('--tag')!, model = arg('--model')!, effort = arg('--effort') ?? 'medium', useLedger = process.argv.includes('--ledger')
  const file = path.join(dir, `${tag}.jsonl`), done = new Map(readJsonl<Result & { terms?: { pali: string; si: string }[] }>(file).map(r => [r.packet, r]))
  const ledger = new Map<string, string>()
  const system = useLedger ? RULES + TERMS_RULE + REWRITE.match(/## Task[\s\S]*$/)![0].replace('{"items": [{"i", "si"}]}', '{"items": [{"i", "si"}], "terms": [{"pali", "si"}]}') + TERMS_TASK : REWRITE
  const schema: any = SCHEMA(false)
  if (useLedger) { schema.properties.terms = TERMS_SCHEMA; schema.required = ['items', 'terms'] }
  let prev: { key: string; si: string }[] = []
  for (const p of packets()) {
    let r = done.get(p.id)
    if (!r) {
      const terms = useLedger ? termsFor(ledger, p.entries) : []
      const c = await claude(model, system, render({ ...p, prev, ...(terms.length ? { terms } : {}) }), schema, effort)
      r = { packet: p.id, runner: tag, model, items: c.out.items, usage: c.usage, terms: (c.out as any).terms, given: terms.length } as any
      appendJsonl(file, { ...r, effort })
      console.log(`${tag} ${p.id}: terms given ${terms.length}, returned ${r!.terms?.length ?? 0}, out ${c.usage.output} tokens, $${c.usage.costUsd.toFixed(3)}`)
    }
    for (const t of r!.terms ?? []) if (t.pali && t.si && !ledger.has(t.pali.trim())) ledger.set(t.pali.trim(), t.si.trim())
    prev = r!.items.slice(-2).map(x => ({ key: p.entries[x.i - 1]?.key ?? '', si: x.si }))
  }
  if (useLedger) fs.writeFileSync(path.join(dir, `ledger-${tag}.json`), JSON.stringify([...ledger], null, 1))
} else if (cmd === 'review') {
  const tag = arg('--tag')!, model = arg('--model') ?? 'claude-opus-5-5', useLedger = process.argv.includes('--ledger')
  const res = new Map(readJsonl<Result>(path.join(dir, `${tag}.jsonl`)).map(r => [r.packet, r]))
  const ps = packets(), all = ps.flatMap(p => p.entries)
  const si = new Map<string, string>()
  for (const p of ps) p.entries.forEach((e, i) => si.set(e.key, res.get(p.id)!.items.find(x => x.i === i + 1)?.si ?? ''))
  const ledger = useLedger ? new Map<string, string>(JSON.parse(fs.readFileSync(path.join(dir, `ledger-${tag}.json`), 'utf-8'))) : new Map<string, string>()
  const terms = termsFor(ledger, all)
  const whole: Packet = { id: 'review', mode: 'rewrite', entries: all, glosses: Object.assign({}, ...ps.map(p => p.glosses)), atta: [], prev: [], ...(terms.length ? { terms } : {}) }
  const schema = { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object', required: ['i', 'si', 'errors'], properties: {
    i: { type: 'integer' }, si: { type: 'string' }, errors: { type: 'array', items: { type: 'object', required: ['kind', 'note'], properties: { kind: { type: 'string' }, note: { type: 'string' } } } } } } } } }
  const system = RULES + (useLedger ? TERMS_RULE : '') + fs.readFileSync(path.join('dev/apz-trans', 'review-prompt.md'), 'utf-8')
  // (--nobjt: the reviewer reads the Pāḷi and the rewrite only; --suffix names this variant's output)
  const sfx = arg('--suffix') ?? 'rev'
  let user = render(whole, e => `NEW: ${si.get(e.key)}`)
  if (process.argv.includes('--nobjt')) user = user.split('\n').filter(l => !l.startsWith('BJT: ')).join('\n')
  const c = await claude(model, process.argv.includes('--nobjt') ? system.replace('against the PALI, BJT and ATTA', 'against the PALI and ATTA') : system, user, schema, arg('--effort') ?? 'medium')
  const changed = (c.out.items as any[]).filter(it => all[it.i - 1] && it.si && it.si !== si.get(all[it.i - 1].key))
  fs.writeFileSync(path.join(dir, `review-${tag}-${sfx}.json`), JSON.stringify({ usage: c.usage, items: changed.map(it => ({ key: all[it.i - 1].key, before: si.get(all[it.i - 1].key), si: it.si, errors: it.errors })) }, null, 1))
  for (const it of changed) si.set(all[it.i - 1].key, it.si)
  fs.writeFileSync(path.join(dir, `${tag}+${sfx}.jsonl`), ps.map(p => JSON.stringify({ packet: p.id, runner: `${tag}+${sfx}`, model, items: p.entries.map((e, i) => ({ i: i + 1, si: si.get(e.key) })),
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: res.get(p.id)!.usage.costUsd + c.usage.costUsd / ps.length, ms: 0 } })).join('\n') + '\n')
  const kinds: Record<string, number> = {}
  for (const it of changed) for (const e of it.errors ?? []) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1
  console.log(`review (${sfx}) of ${tag}: ${changed.length} of ${all.length} entries changed, ${JSON.stringify(kinds)}; in ${c.usage.input + c.usage.cacheRead + c.usage.cacheWrite} out ${c.usage.output} tokens, $${c.usage.costUsd.toFixed(2)}, ${Math.round(c.usage.ms / 1000)}s`)
} else if (cmd === 'rewrite') {
  const tag = arg('--tag')!, model = arg('--model')!, effort = arg('--effort') ?? 'medium'
  const file = path.join(dir, `${tag}.jsonl`), done = new Set(readJsonl<Result>(file).map(r => r.packet))
  await pool(packets().filter(p => !done.has(p.id)), 6, async p => {
    const r = await claude(model, REWRITE, render(p), SCHEMA(false), effort)
    if (r.out.items.length !== p.entries.length) console.error(`${tag} ${p.id}: ${r.out.items.length} items for ${p.entries.length} entries`)
    appendJsonl(file, { packet: p.id, runner: tag, model, effort, items: r.out.items, usage: r.usage })
    console.log(`${tag} ${p.id}: out ${r.usage.output} tokens, $${r.usage.costUsd.toFixed(3)}, ${Math.round(r.usage.ms / 1000)}s`)
  })
} else if (cmd === 'judge') {
  const tags = arg('--tags')!.split(',')
  const res = Object.fromEntries(tags.map(t => [t, new Map(readJsonl<Result>(path.join(dir, `${t}.jsonl`)).map(r => [r.packet, r]))]))
  const file = path.join(dir, 'judge.jsonl'), done = new Set(readJsonl<any>(file).map(r => r.packet))
  await pool(packets().filter(p => !done.has(p.id)), 3, async p => {
    const ord = order(p.id, tags), L = 'ABCDEFGH'
    const user = render({ ...p, prev: [] }, (_, i) => ord.map((t, k) => `${L[k]}: ${res[t].get(p.id)?.items.find(x => x.i === i + 1)?.si ?? '(missing)'}`).join('\n'))
    const r = await claude(FABLE, RULES + JUDGE_TASK, user, JUDGE_SCHEMA, arg('--effort') ?? 'high')
    const items = (r.out.items as any[]).map(it => ({ i: it.i, best: [...String(it.best)].map(c => ord[L.indexOf(c)] ?? c).join(' > '),
      cands: Object.fromEntries((it.cands as any[]).map(c => [ord[L.indexOf(c.c)] ?? c.c, c.errors])) }))
    appendJsonl(file, { packet: p.id, order: ord, items, usage: r.usage })
    console.log(`judge ${p.id}: $${r.usage.costUsd.toFixed(3)}, ${Math.round(r.usage.ms / 1000)}s`)
  })
}
if (cmd === 'judge' || cmd === 'summary') {
  const judged = readJsonl<any>(path.join(dir, 'judge.jsonl'))
  const tags: string[] = judged[0]?.order ?? []
  const ps = new Map(packets().map(p => [p.id, p]))
  const rows = tags.map(t => {
    const rs = readJsonl<Result>(path.join(dir, `${t}.jsonl`))
    const pali = rs.reduce((s, r) => s + ps.get(r.packet)!.entries.reduce((x, e) => x + e.pali.length, 0), 0)
    const u = rs.reduce((s, r) => ({ out: s.out + r.usage.output, cost: s.cost + r.usage.costUsd, ms: s.ms + r.usage.ms }), { out: 0, cost: 0, ms: 0 })
    let major = 0, minor = 0, first = 0, n = 0
    const kinds: Record<string, number> = {}
    for (const j of judged) for (const it of j.items) {
      n++
      for (const e of it.cands[t] ?? []) { e.severity === 'major' ? major++ : minor++; kinds[e.kind] = (kinds[e.kind] ?? 0) + 1 }
      if (it.best === 'tie' || String(it.best).split(' > ')[0] === t) first++
    }
    return { tag: t, usdPer1k: +(u.cost / pali * 1000).toFixed(4), outTok: u.out, sec: Math.round(u.ms / 1000), entries: n, major, minor, bestOrTie: first, kinds }
  })
  console.table(rows.map(({ kinds, ...r }) => r))
  for (const r of rows) console.log(r.tag, JSON.stringify(r.kinds))
}
