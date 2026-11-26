/**
 * The rewrite of a book with no one checking it (the method found with exp.ts, for the Abhidhamma): BJT Sinhala rewritten
 * by Opus (prompt-v2.md) packet by packet, checked, then every group of packets reviewed in one call before the run moves
 * on, with a terms list the run builds for itself.
 *
 *   npx tsx dev/apz-trans/flow.ts <file prefix> [--pages 0-29] [--files N] [--seed <terms.json>] [--max-usd N]
 *       [--book <note.md>]  rules for this book, added to the rewrite and the review prompt
 *       [--pin <terms.json>] rows of the terms list that no rewrite or review may change
 *       [--units]            a packet ends only before a numbered paragraph or a heading (a pair of questions stays whole)
 *       [--rules <rules.md>] the rules in place of prompt-v2.md (a book translated from the Pāḷi: pat-rules.md)
 *       [--witness <w.json>] {entry key: [text]} shown with the entry as SANNAYA lines (pat-sannaya.py)
 *       [--mech pat]         entries that code words exactly (pat-mech.ts: the Paṭṭhāna's counting lists) are not sent
 *       [--tag <t>]          a trial: state in out/flow-<prefix>-<t>, text in out/book-<file>-<t>
 *
 * For every file <prefix>, <prefix>-* in order (--pages: only those pages of the first file):
 *  1. packets of about 4,000 Pāḷi chars (as set.ts). An entry whose Pāḷi and BJT repeat an earlier entry takes that
 *     entry's text (with its own paragraph number) and is not sent again.
 *  2. each packet is rewritten with the two entries before it (PREV) and the rows of the terms list whose Pāḷi stem
 *     occurs in it (TERMS); the call returns the new terms it worded. A packet that fails the checks (an entry missing or
 *     empty, a paragraph number or number changed) is run once more.
 *  3. after about 18,000 Pāḷi chars the group is reviewed in one call (review-prompt.md, with PALI, BJT and TERMS): its
 *     corrections are applied when they keep -පෙ-, bold and the paragraph number, and the terms it settles replace the
 *     list's rows, so a poor first wording does not spread.
 *  4. when every file is done (not with --pages), 2% of the entries (--audit-rate), in runs of 4, are audited by Fable,
 *     which is not told how the text was made: the log gives the error rate, and an entry with a major error takes the
 *     auditor's correction (audit.jsonl).
 * State, all resumable: out/flow-<prefix>/rewrite.jsonl, review.jsonl, terms.json, log.txt; the text goes to
 * out/book-<file>/text.json (book.ts page shows it, book.ts write puts it into text-apz).
 */
import fs from 'node:fs'
import path from 'node:path'
import { mech as patMech } from './pat-mech'
import { DIR, OUT, REWRITE, SCHEMA, agy, claude, entries, openDb, packet, render, readJsonl, appendJsonl, type Entry, type Packet } from './lib'

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined }
const prefix = process.argv[2]
if (!prefix) throw new Error('usage: flow.ts <file prefix> [--pages 0-29] [--seed terms.json] [--max-usd N]')
const OPUS = 'claude-opus-5-5', MAX_PALI = 4000, MIN_BREAK = 2000, MAX_GROUP = 18000, MAX_USD = Number(arg('--max-usd') ?? Infinity)
const TAG = arg('--tag') ? '-' + arg('--tag') : ''
const dir = path.join(OUT, `flow-${prefix}${TAG}`)
fs.mkdirSync(dir, { recursive: true })
const log = (s: string) => { console.log(s); fs.appendFileSync(path.join(dir, 'log.txt'), s + '\n') }

// ---- prompts: prompt-v2.md's rules, the terms list, and what differs in these books
const RULES = (arg('--rules') ? fs.readFileSync(arg('--rules')!, 'utf-8') : REWRITE).replace(/## Task[\s\S]*$/, '') + `## Terms list
# TERMS, when present, lists Pāḷi terms with the Sinhala wording already used for them earlier in this book. Use that
wording wherever the term has the same meaning here; where the context gives it another meaning, word it as the context
requires.

## Numbers that only point elsewhere
Where the Pāḷi puts cross-reference numbers after an item of a list (e.g. "කුසලා ධම්මා, 989, 1383") and BJT leaves them
out, leave them out.

` + (arg('--book') ? fs.readFileSync(arg('--book')!, 'utf-8').trim() + '\n\n' : '')
const TERMS_OUT = `"terms": the technical terms, names and fixed phrases that will come again in the book, each as {"pali", "si"}: "pali" is the
term as a Pāḷi stem without its case ending (e.g. වෙදනාක්ඛන්ධ), "si" the Sinhala wording for it without a case ending, and
without a bracket that only explains it at its first use.`
const REWRITE_TASK = `## Task
Rewrite every entry under # ENTRIES following the rules above. Return {"items": [{"i", "si"}], "terms": [{"pali", "si"}]}.
"items": one item per entry, same i numbers, in order; "si" is the modern Sinhala text of that entry only.
${TERMS_OUT} Give only terms you worded in this packet that are not in # TERMS, at most 15; [] if none.`
const REVIEW_TASK = fs.readFileSync(path.join(DIR, 'review-prompt.md'), 'utf-8')
  .replace('Return only the entries you changed: {"items": [{"i", "si", "errors"}]}.', 'Return {"items": [{"i", "si", "errors"}], "terms": [{"pali", "si"}]}. "items": only the entries you changed.') + `
${TERMS_OUT} Give only the rows of # TERMS whose wording you corrected, and terms you made the same across these entries
that are not in # TERMS; [] if none.`
const TERMS_SCHEMA = { type: 'array', items: { type: 'object', required: ['pali', 'si'], properties: { pali: { type: 'string' }, si: { type: 'string' } } } }
const REWRITE_SCHEMA: any = SCHEMA(false)
REWRITE_SCHEMA.properties.terms = TERMS_SCHEMA; REWRITE_SCHEMA.required = ['items', 'terms']
const REVIEW_SCHEMA = { type: 'object', required: ['items', 'terms'], properties: { terms: TERMS_SCHEMA, items: { type: 'array', items: { type: 'object', required: ['i', 'si', 'errors'], properties: {
  i: { type: 'integer' }, si: { type: 'string' }, errors: { type: 'array', items: { type: 'object', required: ['kind', 'note'], properties: { kind: { type: 'string' }, note: { type: 'string' } } } } } } } } }

// ---- state
type Term = { pali: string; si: string }
type Rw = { packet: string; items: { i: number; si: string }[]; terms: Term[]; usage: { costUsd: number; output: number }; tries: number }
const termsFile = path.join(dir, 'terms.json')
const ledger = new Map<string, string>(fs.existsSync(termsFile) ? JSON.parse(fs.readFileSync(termsFile, 'utf-8')) : arg('--seed') ? JSON.parse(fs.readFileSync(arg('--seed')!, 'utf-8')) : [])
const saveLedger = () => fs.writeFileSync(termsFile, JSON.stringify([...ledger], null, 1))
// (--witness: another translation or gloss of some entries, shown with the entry; a piece is shown once in a call)
const witness: Record<string, string[]> = arg('--witness') ? JSON.parse(fs.readFileSync(arg('--witness')!, 'utf-8')) : {}
const witnessLines = () => { const shown = new Set<string>(); return (e: Entry) => (witness[e.key] ?? []).filter(w => !shown.has(w) && shown.add(w)).map(w => `SANNAYA: ${w}`).join('\n') }
// (--mech pat: entries that code words exactly are not sent, and no review may change them)
// (--rewriter agy:<model id>: the rewrite goes to an Antigravity agent conversation; the review and the audit stay as they are)
const REWRITER = arg('--rewriter') ?? 'opus'
const rewriter = (system: string, user: string, schema: object) => REWRITER.startsWith('agy:') ? agy(REWRITER.slice(4), system, user, schema) : claude(OPUS, system, user, schema)
const mechOf: (pali: string) => string | undefined = arg('--mech') === 'pat' ? patMech : () => undefined
const pinned = new Map<string, string>(arg('--pin') ? JSON.parse(fs.readFileSync(arg('--pin')!, 'utf-8')) : [])
for (const [p, si] of pinned) ledger.set(p, si)
const rewrites = new Map(readJsonl<Rw>(path.join(dir, 'rewrite.jsonl')).map(r => [r.packet, r]))
const reviews = new Map(readJsonl<{ group: string }>(path.join(dir, 'review.jsonl')).map(r => [r.group, r]))
let spent = 0
const termsFor = (es: Entry[]) => {
  const text = es.map(e => e.pali).join(' ')
  return [...ledger].filter(([p]) => p.length >= 4 && text.includes(p)).sort((a, b) => b[0].length - a[0].length).slice(0, 80).map(([p, si]) => `${p} → ${si}`)
}
const addTerms = (ts: Term[] | undefined, replace: boolean) => {
  for (const t of ts ?? []) { const p = t.pali?.trim(), s = t.si?.trim(); if (p && s && !pinned.has(p) && (replace || !ledger.has(p))) ledger.set(p, s) }
  saveLedger()
}

// ---- checks (as merge.ts's hard flags and book.ts apply)
const noFn = (s: string) => s.replace(/\{[^}]*\}/g, '')
const leadNum = (s: string) => s.match(/^\s*\(?([\d.\s-–]+?)[.)]\s/)?.[1].replace(/[\s.]+/g, '').replace('–', '-')
const digits = (s: string) => (noFn(s).replace(/(?<=[඀-෿])\d+/g, '').match(/\d+/g) ?? []).sort().join(' ')
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length
function faults(e: Entry, si: string | undefined): string {
  const pali = noFn(e.pali), bjt = noFn(e.bjt)
  if (si === undefined) return 'missing'
  if (!si.trim() && pali.replace(/^[\d.\s]+/, '').trim()) return 'empty'
  if (leadNum(pali) !== undefined && leadNum(pali) !== leadNum(si)) return `paragraph number ${leadNum(pali)} vs ${leadNum(si) ?? '-'}`
  // (a number list that BJT leaves out may be left out: the digits of the Pāḷi, of BJT, or of the Pāḷi's paragraph number alone)
  const d = digits(si)
  if (d !== digits(pali) && d !== digits(bjt) && d !== digits(pali.match(/^\s*[\d.\s-–]+/)?.[0] ?? '')) return `numbers ${digits(pali)} vs ${d}`
  return ''
}

// ---- the text store of each file (as book.ts)
const stores = new Map<string, Record<string, { si: string; src: string }>>()
const store = (file: string) => {
  if (!stores.has(file)) { const f = path.join(OUT, `book-${file}${TAG}`, 'text.json'); stores.set(file, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf-8')) : {}) }
  return stores.get(file)!
}
const saveStore = (file: string) => { fs.mkdirSync(path.join(OUT, `book-${file}${TAG}`), { recursive: true }); fs.writeFileSync(path.join(OUT, `book-${file}${TAG}`, 'text.json'), JSON.stringify(store(file), null, 1)) }

// ---- repeated entries: the same Pāḷi and BJT (but for the paragraph number) as an entry already done
const stripNum = (s: string) => noFn(s).replace(/^\s*[\d.\s-–]+[.)]?\s*/, '').trim()
const seen = new Map<string, string>() // Pāḷi + BJT -> text without its paragraph number
const dupKey = (e: Entry) => stripNum(e.pali).length >= 20 ? stripNum(e.pali) + '\u0001' + stripNum(e.bjt) : ''
const withNum = (e: Entry, body: string) => { const n = noFn(e.pali).match(/^\s*[\d.\s-–]+[.)]?\s*/)?.[0] ?? ''; return n + body }

const db = openDb()
// (in the book's order: ap-vbh, ap-vbh-2, ap-vbh-6, ap-vbh-10 …; --files N: only the first N of them)
const files = (db.prepare(`SELECT name FROM file ORDER BY name`).pluck().all() as string[]).filter(f => f === prefix || f.startsWith(prefix + '-'))
  .sort((x, y) => x.localeCompare(y, undefined, { numeric: true })).slice(0, Number(arg('--files') ?? 999))
const pages = arg('--pages')
const UNITS = process.argv.includes('--units')
let prev: { key: string; si: string }[] = []

for (const [fi, file] of files.entries()) {
  if (pages && fi > 0) break
  const [p0, p1] = (pages ?? '0-99999').split('-')
  const all = entries(db, file, `${p0}:0`, `${p1}:9999`)
  // packets, then groups of packets for the review
  const chunks: Entry[][] = []
  let cur: Entry[] = [], size = 0
  for (const e of all) {
    const heading = e.type === 'heading' || e.type === 'centered'
    const over = size + e.pali.length > MAX_PALI
    // (--units: the break waits for the next numbered paragraph or heading, up to twice the size)
    const mayBreak = !UNITS || heading || leadNum(e.pali) !== undefined || size + e.pali.length > 2 * MAX_PALI
    if (cur.length && ((over && mayBreak) || (heading && size >= MIN_BREAK))) { chunks.push(cur); cur = []; size = 0 }
    cur.push(e); size += e.pali.length
  }
  if (cur.length) chunks.push(cur)
  const groups: Entry[][][] = [[]]
  for (const c of chunks) {
    const n = (g: Entry[][]) => g.flat().reduce((s, e) => s + e.pali.length, 0)
    if (groups.at(-1)!.length && n(groups.at(-1)!) + n([c]) > MAX_GROUP) groups.push([])
    groups.at(-1)!.push(c)
  }
  const text = store(file)
  // (a run that starts inside a file: the entries before it give the repeats and the context)
  if (Number(p0) > 0) {
    const before = entries(db, file, '0:0', `${Number(p0) - 1}:9999`).filter(e => text[e.key])
    for (const e of before) if (dupKey(e)) seen.set(dupKey(e), stripNum(text[e.key].si))
    prev = before.slice(-2).map(e => ({ key: e.key, si: text[e.key].si }))
  }
  log(`${file}: ${all.length} entries, ${chunks.length} packets, ${groups.length} groups`)

  for (const group of groups) {
    for (const chunk of group) {
      const id = `${file} ${chunk[0].key.split(' ')[1]}`
      // (entries that repeat an earlier one are not sent)
      for (const e of chunk) { const m = e.type === 'paragraph' ? mechOf(e.pali) : undefined; if (m !== undefined && !text[e.key]) text[e.key] = { si: m, src: 'mech' } }
      const fresh = chunk.filter(e => text[e.key]?.src !== 'mech' && !(dupKey(e) && seen.has(dupKey(e))))
      let r = rewrites.get(id)
      if (!r && fresh.length) {
        if (spent >= MAX_USD) { log(`stopped at ${id}: $${spent.toFixed(2)} used`); process.exit(0) }
        for (let tries = 1; tries <= 2; tries++) {
          const terms = termsFor(fresh)
          const c = await rewriter(RULES + REWRITE_TASK, render({ ...packet(db, id, 'rewrite', fresh), prev, ...(terms.length ? { terms } : {}) }, witnessLines()), REWRITE_SCHEMA)
          spent += c.usage.costUsd
          const bad = fresh.map((e, i) => [e.key, faults(e, c.out.items.find(x => x.i === i + 1)?.si)]).filter(x => x[1])
          r = { packet: id, items: c.out.items, terms: (c.out as any).terms ?? [], usage: c.usage, tries, ...(REWRITER === 'opus' ? {} : { by: REWRITER }) }
          log(`${id}: ${fresh.length} entries${chunk.length > fresh.length ? ` (+${chunk.length - fresh.length} repeated)` : ''}, terms ${terms.length} given ${r.terms.length} new, $${c.usage.costUsd.toFixed(3)}${bad.length ? `; failed checks: ${bad.map(b => b.join(' ')).join('; ')}` : ''}`)
          if (!bad.length) break
        }
        appendJsonl(path.join(dir, 'rewrite.jsonl'), r); rewrites.set(id, r!)
      }
      if (r) addTerms(r.terms, false)
      fresh.forEach((e, i) => { const si = r!.items.find(x => x.i === i + 1)?.si; if (si !== undefined && !text[e.key]?.src.startsWith('review')) text[e.key] = { si: noFn(si).trim(), src: 'flow' } })
      for (const e of chunk) {
        const k = dupKey(e)
        if (k && seen.has(k) && !fresh.includes(e)) { if (!text[e.key]) text[e.key] = { si: withNum(e, seen.get(k)!), src: 'flow-repeat' } }
        else if (k && text[e.key]) seen.set(k, stripNum(text[e.key].si))
      }
      prev = chunk.slice(-2).map(e => ({ key: e.key, si: text[e.key]?.si ?? '' }))
      saveStore(file)
    }
    // the review of the group, in one call
    const es = group.flat().filter(e => text[e.key]), gid = `${file} ${es[0].key.split(' ')[1]}`
    if (!reviews.has(gid)) {
      if (spent >= MAX_USD) { log(`stopped before the review of ${gid}: $${spent.toFixed(2)} used`); process.exit(0) }
      const terms = termsFor(es)
      const whole: Packet = { ...packet(db, gid, 'rewrite', es), ...(terms.length ? { terms } : {}) }
      const c = await claude(OPUS, RULES + REVIEW_TASK, render(whole, (wl => (e: Entry) => [wl(e), `NEW: ${text[e.key].si}`].filter(Boolean).join('\n'))(witnessLines())), REVIEW_SCHEMA)
      spent += c.usage.costUsd
      const done: { key: string; before: string; errors: unknown }[] = [], refused: string[] = []
      for (const it of c.out.items as any[]) {
        const e = es[it.i - 1], old = e && text[e.key].si
        if (!e || !it.si?.trim() || it.si === old) continue
        if (text[e.key].src === 'mech') { refused.push(`${e.key} (mech; proposed: ${it.si})`); continue }
        const bad = faults(e, it.si) || (count(it.si, /-පෙ-/g) !== count(old, /-පෙ-/g) ? '-පෙ- changed' : count(it.si, /\*\*/g) !== count(old, /\*\*/g) ? 'bold changed' : '')
        if (bad) { refused.push(`${e.key} (${bad})`); continue }
        done.push({ key: e.key, before: old, errors: it.errors }); text[e.key] = { si: noFn(it.si).trim(), src: 'review-flow' }
        if (dupKey(e)) seen.set(dupKey(e), stripNum(text[e.key].si))
      }
      const t: Term[] = (c.out as any).terms ?? []
      addTerms(t, true); saveStore(file)
      const rec = { group: gid, entries: es.length, items: done, refused, terms: t, usage: c.usage }
      appendJsonl(path.join(dir, 'review.jsonl'), rec); reviews.set(gid, rec)
      const kinds: Record<string, number> = {}
      for (const d of done) for (const x of (d.errors as { kind: string }[]) ?? []) kinds[x.kind] = (kinds[x.kind] ?? 0) + 1
      log(`review ${gid}: ${done.length} of ${es.length} entries changed ${JSON.stringify(kinds)}, ${t.length} terms settled${refused.length ? `, refused: ${refused.join('; ')}` : ''}, $${c.usage.costUsd.toFixed(3)}`)
      prev = es.slice(-2).map(e => ({ key: e.key, si: text[e.key].si }))
    }
  }
}
log(`done; $${spent.toFixed(2)} used in this run; ${ledger.size} terms`)

// ---- the audit: a sample of the finished text (2%, in runs of 4 entries) checked by another model that is not told how it
// was made. It measures the error rate of the book; an entry with a major error takes the auditor's correction.
if (!pages) {
  const RATE = Number(arg('--audit-rate') ?? 0.02), RUN = 4
  const auditFile = path.join(dir, 'audit.jsonl')
  type Au = { batch: string; keys: string[]; items: { i: number; errors: { kind: string; severity: string; note: string }[]; si?: string }[]; applied: string[]; refused: string[]; usage: { costUsd: number } }
  const audits = new Map(readJsonl<Au>(auditFile).map(a => [a.batch, a]))
  // (the same sample on every run: a generator seeded by the prefix)
  let seed = [...prefix].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0
  const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
  const byFile = files.map(f => ({ f, es: entries(db, f, '0:0', '99999:9999').filter(e => store(f)[e.key]?.si.trim()) }))
  const total = byFile.reduce((s, x) => s + x.es.length, 0), want = Math.max(40, Math.round(total * RATE))
  const picked = new Map<string, Set<number>>(byFile.map(x => [x.f, new Set<number>()]))
  for (let n = 0, guard = 0; n < Math.min(want, total) && guard < 10000; guard++) {
    let at = Math.floor(rnd() * total), x = byFile[0]
    for (const b of byFile) { if (at < b.es.length) { x = b; break } at -= b.es.length }
    for (let i = at; i < Math.min(at + RUN, x.es.length); i++) if (!picked.get(x.f)!.has(i)) { picked.get(x.f)!.add(i); n++ }
  }
  const AUDIT_TASK = `## Task: audit
Each entry under # ENTRIES has a NEW text: a rewrite of its BJT made under the rules above. The entries are a sample of a
book: they come in short runs, and one run does not follow from the one before it. For every entry list the errors of NEW
against the PALI, the BJT and the rules:
- meaning: says something different from BJT (or from the Pāḷi where BJT is wrong or silent); a term rendered wrongly.
- omission: a clause, list item, number or explanation of BJT/Pāḷi is missing.
- addition: content that is in neither BJT nor the Pāḷi (other than a short bracket explanation of an unknown word).
- unknown-word: a word the ordinary reader would not know, or a word that means something else today.
- sentence: a sentence that is unclear, garbled, ungrammatical or ambiguous.
- not-modernised: old verb endings, old spellings or archaic number words kept from BJT.
- form: paragraph number, bold, -පෙ-, quotes or entry boundaries handled against the rules.
Give each error a severity: "major" (the reader is misled or loses content) or "minor". List only real errors: do not
penalise a valid difference of wording. An entry with no errors gets an empty list. For an entry with a major error also
give "si": the whole entry corrected, changing nothing else.
Return {"items": [{"i", "errors": [{"kind", "severity", "note"}], "si"}]}: one item per entry. Notes are short, in English,
and quote the words concerned.`
  const AUDIT_SCHEMA = { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object', required: ['i', 'errors'], properties: {
    i: { type: 'integer' }, si: { type: 'string' },
    errors: { type: 'array', items: { type: 'object', required: ['kind', 'severity', 'note'], properties: { kind: { type: 'string' }, severity: { type: 'string' }, note: { type: 'string' } } } } } } } } }
  for (const { f, es } of byFile) {
    const sample = [...picked.get(f)!].sort((a, b) => a - b).map(i => es[i]), text = store(f)
    const batches: Entry[][] = [[]]
    for (const e of sample) {
      if (batches.at(-1)!.length && batches.at(-1)!.reduce((s, x) => s + x.pali.length, 0) + e.pali.length > 6000) batches.push([])
      batches.at(-1)!.push(e)
    }
    for (const b of batches.filter(b => b.length)) {
      const id = `${f} ${b[0].key.split(' ')[1]}`
      if (audits.has(id)) continue
      if (spent >= MAX_USD) { log(`stopped before the audit of ${id}: $${spent.toFixed(2)} used`); process.exit(0) }
      const c = await claude('claude-fable-5-2', RULES + AUDIT_TASK, render(packet(db, id, 'rewrite', b), e => `NEW: ${text[e.key].si}`), AUDIT_SCHEMA, 'high')
      spent += c.usage.costUsd
      const applied: string[] = [], refused: string[] = []
      for (const it of c.out.items as any[]) {
        const e = b[it.i - 1], old = e && text[e.key].si
        if (!e || !it.si?.trim() || it.si === old || !it.errors?.some((x: any) => x.severity === 'major')) continue
        const bad = faults(e, it.si) || (count(it.si, /-පෙ-/g) !== count(old, /-පෙ-/g) ? '-පෙ- changed' : count(it.si, /\*\*/g) !== count(old, /\*\*/g) ? 'bold changed' : '')
        if (bad) { refused.push(`${e.key} (${bad})`); continue }
        text[e.key] = { si: noFn(it.si).trim(), src: 'review-audit' }; applied.push(e.key)
      }
      saveStore(f)
      const rec: Au = { batch: id, keys: b.map(e => e.key), items: c.out.items as any, applied, refused, usage: c.usage }
      appendJsonl(auditFile, rec); audits.set(id, rec)
      log(`audit ${id}: ${b.length} entries, $${c.usage.costUsd.toFixed(3)}`)
    }
  }
  let n = 0, major = 0, minor = 0, withMajor = 0, fixed = 0
  const kinds: Record<string, number> = {}
  for (const a of audits.values()) {
    n += a.keys.length; fixed += a.applied.length
    for (const it of a.items) {
      if (it.errors.some(x => x.severity === 'major')) withMajor++
      for (const x of it.errors) { x.severity === 'major' ? major++ : minor++; kinds[x.kind] = (kinds[x.kind] ?? 0) + 1 }
    }
  }
  log(`audit: ${n} of ${total} entries; ${withMajor} with a major error (${(withMajor / n * 100).toFixed(1)}%), ${major} major and ${minor} minor errors ${JSON.stringify(kinds)}; ${fixed} corrected; $${spent.toFixed(2)} used in this run`)
}
