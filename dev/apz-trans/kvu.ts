/**
 * The rewrite of the Kathāvatthu (ap-kvu*): flow.ts's method (Opus rewrite with prompt-v2.md, a terms list the run builds,
 * one review call per group) with what this book needs:
 *
 *  - Labels. Every turn of the debate starts with an editorial label (ස. පු, ප. පටිඤ්ඤා, අනු. ඨ …). The model does not
 *    write it: it is given the role and returns the words of the turn; the label is written out here from one table
 *    (සකවාදී ප්‍රශ්නය: …), and the paragraph number is put before it.
 *  - Plain replies (ආමන්තා. / න හෙවං වත්තබ්බෙ -පෙ-) whose BJT adds nothing take a fixed text and are not sent; they are
 *    shown to the model in their place so that it can follow the debate.
 *  - A packet is a whole kathā; a long kathā is cut at its numbered paragraphs, and the later parts are given its start
 *    (# KATHĀ: title, BJT's introduction, the opening question and reply).
 *  - A turn that repeats an earlier one (same role, same Pāḷi, same BJT brackets) takes that text. A review correction
 *    of the earlier turn is carried to its repeats.
 *  - Text comes from public/static/text (db/text.db gives only the commentary glosses).
 *
 *   npx tsx dev/apz-trans/kvu.ts [--run flow-ap-kvu] [--only ap-kvu:0-9,ap-kvu-3:6-12] [--seed terms.json] [--pin kvu-pins.json] [--max-usd N]
 *
 * State (resumable) in out/<run>/: rewrite.jsonl, review.jsonl, terms.json, log.txt, text-<file>.json
 * ({key: {si, body, src, from?}}); --page writes side.md (Pāḷi, BJT and the new text side by side) and stops.
 */
import fs from 'node:fs'
import path from 'node:path'
import { DIR, OUT, REWRITE, claude, entries, openDb, packet, readJsonl, appendJsonl, textFile, type Entry } from './lib'

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined }
const FILES = ['ap-kvu', 'ap-kvu-1-2', 'ap-kvu-2', 'ap-kvu-3', 'ap-kvu-5', 'ap-kvu-8', 'ap-kvu-11', 'ap-kvu-15', 'ap-kvu-19']
const OPUS = 'claude-opus-5-5', MAX_SENT = 7000, MIN_BREAK = 3500, MAX_GROUP = 18000, MAX_USD = Number(arg('--max-usd') ?? Infinity)
const dir = path.join(OUT, arg('--run') ?? 'flow-ap-kvu')
fs.mkdirSync(dir, { recursive: true })
const log = (s: string) => { console.log(s); fs.appendFileSync(path.join(dir, 'log.txt'), s + '\n') }
const only = new Map((arg('--only') ?? '').split(',').filter(Boolean).map(x => { const [f, r] = x.split(':'); const [a, b] = r.split('-').map(Number); return [f, [a, b ?? a]] as [string, number[]] }))

// ---- labels
const SPEAKER: Record<string, string> = { ස: 'S', සක: 'S', සකවාදී: 'S', ප: 'P', පරවාදී: 'P', පරවාදි: 'P', අනු: 'A', අනුලොම: 'A', අනුලෝම: 'A', පටි: 'R', පටිලොම: 'R', පටිලෝම: 'R' }
const ACT: Record<string, string> = {
  පු: 'q', පුච්ඡා: 'q', අනු: 'aq', අනුයොගො: 'aq', අනුයෝග: 'aq', පටිඤ්ඤා: 'yes', පටි: 'no', පටික්ඛෙපො: 'no', පටික්ඛේප: 'no', පටික්ඛෙප: 'no', අවජානනා: 'no',
  වි: 'ans', ඨ: 'tha', ඨපනා: 'tha', පා: 'pa', පාපනා: 'pa', ආ: 'aro', ආරොපනා: 'aro', ආරෝපනා: 'aro', නි: 'ni', නිග්ගහො: 'ni', නිග්ගහ: 'ni',
  නිග: 'nig', නිගමනං: 'nig', නිගමන: 'nig', පටිකම්මං: 'pk', පටිකම්ම: 'pk', උ: 'uda', උදා: 'uda', උදාහරණං: 'uda',
}
const SPEAKER_SI: Record<string, string> = { S: 'සකවාදී', P: 'පරවාදී', A: 'අනුලෝම', R: 'පටිලෝම' }
const ACT_SI: Record<string, string> = {
  q: 'ප්‍රශ්නය', aq: 'විමසුම', yes: 'පිළිගැනීම', no: 'ප්‍රතික්ෂේපය', ans: 'පිළිතුර', tha: 'පිහිටුවීම', pa: 'පැමිණවීම', aro: 'නැංවීම',
  ni: 'නිග්‍රහය', nig: 'නිගමනය', pk: 'ප්‍රතික්‍රියාව', uda: 'උපනය',
}
const noFn = (s: string) => s.replace(/\{[^}]*\}/g, '')
/** "[**N.** ][label: ]body" -> number, role ("S q"), body */
function split(text: string) {
  let t = noFn(text).trim(), num = ''
  const n = t.match(/^\*\*([\d\s.-]+?)\.?\*\*\.?\s*/)
  if (n) { num = n[1].replace(/\s+/g, ''); t = t.slice(n[0].length) }
  let role = ''
  const l = t.match(/^([^:]{1,30}):\s+/)
  if (l) {
    const lab = l[1].trim()
    const m = lab.match(/^(ස|සක|ප|අනු|පටි)\.\s*(.+)$/) ?? lab.match(/^(සකවාදී|පරවාදී|පරවාදි|අනුලොම|අනුලෝම|පටිලොම|පටිලෝම)\s*(.+)$/)
    if (m && ACT[m[2]]) role = `${SPEAKER[m[1]]} ${ACT[m[2]]}`
    else if (ACT[lab] === 'nig') role = ` nig`
    if (role) t = t.slice(l[0].length)
  }
  return { num, role, body: t.trim() }
}
const labelOf = (role: string) => { if (!role) return ''; const [s, a] = role.split(' '); return `${s ? SPEAKER_SI[s] + ' ' : ''}${ACT_SI[a]}` }

// ---- the entries of a file, from the text files
type K = Entry & { level?: number; num: string; role: string; pb: string; bb: string; fixed?: string; note: boolean }
const db = openDb()
function load(file: string): K[] {
  const es = entries(db, file, '0:0', '99999:9999'), d = textFile(file)
  return es.map(e => {
    const p = d.pages[e.page].pali.entries[e.entry], s = d.pages[e.page].sinh.entries[e.entry]
    if (!p || !s) throw new Error(`${e.key}: not in the text file`)
    const k: K = { ...e, type: p.type, level: p.level, pali: p.text, bjt: s.text, num: '', role: '', pb: noFn(p.text).trim(), bb: noFn(s.text).trim(), note: false }
    if (p.type !== 'paragraph') { if (/^[\d.\s]+$/.test(k.pb)) k.fixed = k.pb; return k }
    const a = split(p.text), b = split(s.text)
    k.num = a.num || b.num; k.role = a.role || b.role; k.pb = a.body; k.bb = b.body
    if (a.role && b.role && a.role !== b.role) log(`${e.key}: label differs (Pāḷi ${a.role}, BJT ${b.role}); the Pāḷi's is used`)
    k.note = !k.pb && !k.role
    // plain replies
    const plain = !/[(\[]/.test(k.bb) && k.bb.length <= 32
    if (plain && k.pb === 'ආමන්තා.') k.fixed = 'එසේ ය.'
    else if (plain && /^න හෙවං වත්තබ්බෙ( -පෙ-|\.)$/.test(k.pb)) k.fixed = `එසේ නොකිව යුතු ${/මැ/.test(k.bb) ? 'ම ' : ''}ය${k.pb.endsWith('-පෙ-') ? ' -පෙ-' : '.'}`
    return k
  })
}
const compose = (e: K, body: string) => e.type === 'paragraph' ? `${e.num ? e.num + '. ' : ''}${e.role ? labelOf(e.role) + ': ' : ''}${body}` : body

// ---- prompts
const BOOK = `## This book: the Kathāvatthu
The book is a debate between the Sakavādī (සකවාදී, the Theravāda side) and the Paravādī (පරවාදී, who holds the view under
examination). Every paragraph is one turn of the debate. The printed label of a turn (who speaks and what kind of turn it
is) is given to you as ROLE and is put before the text by the program, with the paragraph number. So here "si" is only the
words of the turn: no label, no paragraph number.
- Word each turn as its ROLE requires. A turn that is a ප්‍රශ්නය or විමසුම is a question and must read as one; a පිළිගැනීම,
  ප්‍රතික්ෂේපය or පිළිතුර is a reply. The Pāḷi does not mark the difference; the role does.
- The questions are short and lean on what was said before: each tests the view stated at the start of the kathā (# KATHĀ
  gives that start when the packet begins later). Word the question so that the reader sees what is being asked, keeping
  BJT's reading of it and the words BJT supplies.
- The steps of the formal refutation (පිහිටුවීම, පැමිණවීම, නැංවීම, නිග්‍රහය, ප්‍රතික්‍රියාව, නිගමනය) repeat one Pāḷi frame through the
  whole book with only the proposition changed. Word a frame the same way every time, as # TERMS and the lines already done
  have it.
- Lines marked "done" already have their final text (plain replies, and turns that repeat an earlier turn). They are shown
  in their place so that you can follow the debate. Do not return them; where the same words come again, use their wording.
- A BJT bracket in a turn is from the commentary; after a reply it gives the reason for that reply. Keep it, in plain words.
- An entry with no PALI and no ROLE is a note by the BJT translators, from the commentary: who holds the view and why it is
  examined. Rewrite it as a clear note in modern Sinhala that keeps everything it says, inside the same brackets (and bold)
  BJT gives it. Names of schools stay as names.
- An entry with no PALI that has a ROLE is a turn BJT wrote out where the Pāḷi abbreviates: rewrite it as a turn.

`
const RULES = REWRITE.replace(/## Task[\s\S]*$/, '') + `## Terms list
# TERMS, when present, lists Pāḷi terms with the Sinhala wording already used for them earlier in this book. Use that
wording wherever the term has the same meaning here; where the context gives it another meaning, word it as the context
requires.

` + BOOK
const TERMS_OUT = `"terms": the technical terms, names and fixed phrases that will come again in the book, each as {"pali", "si"}: "pali" is the
term as a Pāḷi stem without its case ending (e.g. වෙදනාක්ඛන්ධ), "si" the Sinhala wording for it without a case ending, and
without a bracket that only explains it at its first use.`
const REWRITE_TASK = `## Task
Rewrite every numbered entry (i=…) under # ENTRIES following the rules above. Return {"items": [{"i", "si"}], "terms": [{"pali", "si"}]}.
"items": one item per numbered entry, same i numbers, in order; "si" is the modern Sinhala text of that entry only.
${TERMS_OUT} Give only terms you worded in this packet that are not in # TERMS, at most 15; [] if none.`
const REVIEW_TASK = fs.readFileSync(path.join(DIR, 'review-prompt.md'), 'utf-8')
  .replace('- meaning errors or omissions against the PALI, BJT and ATTA.', `- meaning errors or omissions against the PALI, BJT and ATTA;
- a turn not worded as its ROLE requires (a question that reads as a statement, or a reply that reads as a question), or a
  question whose point the reader cannot see.`)
  .replace('Return only the entries you changed: {"items": [{"i", "si", "errors"}]}.', 'Return {"items": [{"i", "si", "errors"}], "terms": [{"pali", "si"}]}. "items": only the numbered entries you changed.') + `
${TERMS_OUT} Give only the rows of # TERMS whose wording you corrected, and terms you made the same across these entries
that are not in # TERMS; [] if none.`
const TERMS_SCHEMA = { type: 'array', items: { type: 'object', required: ['pali', 'si'], properties: { pali: { type: 'string' }, si: { type: 'string' } } } }
const REWRITE_SCHEMA = { type: 'object', required: ['items', 'terms'], properties: { terms: TERMS_SCHEMA, items: { type: 'array', items: { type: 'object', required: ['i', 'si'], properties: { i: { type: 'integer' }, si: { type: 'string' } } } } } }
const REVIEW_SCHEMA = { type: 'object', required: ['items', 'terms'], properties: { terms: TERMS_SCHEMA, items: { type: 'array', items: { type: 'object', required: ['i', 'si', 'errors'], properties: {
  i: { type: 'integer' }, si: { type: 'string' }, errors: { type: 'array', items: { type: 'object', required: ['kind', 'note'], properties: { kind: { type: 'string' }, note: { type: 'string' } } } } } } } } }

// ---- state
type Term = { pali: string; si: string }
type Rw = { packet: string; items: { i: number; si: string }[]; terms: Term[]; usage: { costUsd: number; output: number }; tries: number }
type Txt = { si: string; body: string; src: string; from?: string }
const termsFile = path.join(dir, 'terms.json')
const ledger = new Map<string, string>(fs.existsSync(termsFile) ? JSON.parse(fs.readFileSync(termsFile, 'utf-8')) : arg('--seed') ? JSON.parse(fs.readFileSync(arg('--seed')!, 'utf-8')) : [])
const saveLedger = () => fs.writeFileSync(termsFile, JSON.stringify([...ledger], null, 1))
// --pin: rows that are set at the start and that no rewrite or review may change (the wording of the refutation steps)
const pinned = new Map<string, string>(arg('--pin') ? JSON.parse(fs.readFileSync(arg('--pin')!, 'utf-8')) : [])
for (const [p, si] of pinned) ledger.set(p, si)
const rewrites = new Map(readJsonl<Rw>(path.join(dir, 'rewrite.jsonl')).map(r => [r.packet, r]))
const reviews = new Map(readJsonl<{ group: string }>(path.join(dir, 'review.jsonl')).map(r => [r.group, r]))
let spent = 0
const termsFor = (es: K[]) => {
  const text = es.map(e => e.pb).join(' ')
  return [...ledger].filter(([p]) => p.length >= 4 && text.includes(p)).sort((a, b) => b[0].length - a[0].length).slice(0, 80).map(([p, si]) => `${p} → ${si}`)
}
const addTerms = (ts: Term[] | undefined, replace: boolean) => {
  for (const t of ts ?? []) { const p = t.pali?.trim(), s = t.si?.trim(); if (p && s && !pinned.has(p) && (replace || !ledger.has(p))) ledger.set(p, s) }
  saveLedger()
}
const stores = new Map<string, Record<string, Txt>>()
const storeFile = (file: string) => path.join(dir, `text-${file}.json`)
const store = (file: string) => {
  if (!stores.has(file)) stores.set(file, fs.existsSync(storeFile(file)) ? JSON.parse(fs.readFileSync(storeFile(file), 'utf-8')) : {})
  return stores.get(file)!
}
const saveStore = (file: string) => fs.writeFileSync(storeFile(file), JSON.stringify(store(file), null, 1))
const put = (e: K, body: string, src: string, from?: string) => { store(e.file)[e.key] = { si: compose(e, body), body, src, ...(from ? { from } : {}) } }

// ---- checks
const digits = (s: string) => (noFn(s).replace(/(?<=[඀-෿])\d+/g, '').match(/\d+/g) ?? []).sort().join(' ')
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length
/** the model's text of an entry, without a label or number it may have put before it, and in the note's brackets */
function tidy(e: K, si: string) {
  let t = noFn(si).trim()
  if (e.role) { const l = labelOf(e.role); t = t.replace(/^\*{0,2}\d+\.?\*{0,2}\.?\s+/, ''); if (t.startsWith(l + ':')) t = t.slice(l.length + 1).trim() }
  if (e.note && /^\*\*\[/.test(e.bb) && !/^\*\*\[/.test(t)) t = `**[${t.replace(/^\[|\]$/g, '')}]**`
  return t
}
function faults(e: K, si: string | undefined): string {
  if (si === undefined) return 'missing'
  if (!si.trim() && (e.pb || e.bb)) return 'empty'
  const d = digits(si)
  if (d !== digits(e.pb) && d !== digits(e.bb)) return `numbers ${digits(e.pb)} vs ${d}`
  if (e.role && /^(සකවාදී|පරවාදී|අනුලෝම|පටිලෝම)\s[^:]{2,20}:/.test(si)) return 'a label in the text'
  return ''
}

// ---- repeats: the same role, Pāḷi and BJT brackets as a turn already done
const brackets = (s: string) => (s.match(/\([^()]*\)/g) ?? []).join('').replace(/\s+/g, '')
const dupKey = (e: K) => e.type === 'paragraph' && e.pb.length >= 20 ? `${e.role}\u0001${e.pb}\u0001${brackets(e.bb)}` : ''
const seen = new Map<string, { key: string; body: string }>()

// ---- what the model reads
const head = (e: K) => e.role ? `ROLE: ${labelOf(e.role)}` : e.note ? '(note, no Pāḷi)' : `(${e.type})`
const doneLine = (e: K) => `## done [${e.key}] ${store(e.file)[e.key]?.si ?? ''}`
function render(o: { terms: string[]; katha: string[]; prev: string[]; es: K[]; sent: Set<K>; glosses: Record<string, string[]>; extra?: (e: K) => string }) {
  const out: string[] = []
  if (o.terms.length) out.push('# TERMS (the wording already used in this book)', ...o.terms, '')
  if (o.katha.length) out.push('# KATHĀ (the start of this kathā, already done)', ...o.katha, '')
  if (o.prev.length) out.push('# PREV (the lines just before these entries, already done)', ...o.prev, '')
  out.push('# ENTRIES')
  let i = 0
  for (const e of o.es) {
    if (!o.sent.has(e)) { out.push(doneLine(e), ''); continue }
    out.push(`## i=${++i} [${e.key}] ${head(e)}`, `PALI: ${e.pb || '(none)'}`, `BJT: ${e.bb || '(none)'}`)
    for (const g of o.glosses[e.key] ?? []) out.push(`ATTA: ${g}`)
    const x = o.extra?.(e)
    if (x) out.push(x)
    out.push('')
  }
  return out.join('\n')
}

// ---- the run
const size = (e: K) => e.fixed !== undefined ? 0 : (e.pb.length || Math.round(e.bb.length / 1.3))
for (const file of FILES) {
  if (only.size && !only.has(file)) continue
  const whole = load(file), [p0, p1] = only.get(file) ?? [0, 99999]
  const all = whole.filter(e => e.page >= p0 && e.page <= p1), text = store(file)
  // (a run that starts inside a file: the entries before it give the repeats)
  for (const e of whole) if (e.page < p0 && text[e.key] && dupKey(e) && !seen.has(dupKey(e))) seen.set(dupKey(e), { key: e.key, body: text[e.key].body })
  // kathās: each starts at the heading lines before its level-1 heading
  const starts = new Set<number>()
  all.forEach((e, n) => {
    if (e.type !== 'heading' || e.level !== 1) return
    let s = n
    while (s > 0 && all[s - 1].type !== 'paragraph' && all[s - 1].type !== 'gatha' && !/නිට්ඨිත/.test(all[s - 1].pali)) s--
    starts.add(s)
  })
  // packets: a kathā, cut before a numbered paragraph when it is long
  const chunks: { es: K[]; first: number }[] = []   // first: index in `all` of the kathā's first entry
  let cur: K[] = [], n = 0, first = 0
  all.forEach((e, idx) => {
    const newKatha = starts.has(idx)
    if (cur.length && (newKatha || (n >= MIN_BREAK && !!e.num) || n + size(e) > MAX_SENT)) { chunks.push({ es: cur, first }); cur = []; n = 0 }
    if (newKatha) first = idx
    cur.push(e); n += size(e)
  })
  if (cur.length) chunks.push({ es: cur, first })
  const groups: typeof chunks[] = [[]]
  const gsize = (g: typeof chunks) => g.reduce((s, c) => s + c.es.reduce((t, e) => t + size(e), 0), 0)
  for (const c of chunks) {
    if (groups.at(-1)!.length && gsize(groups.at(-1)!) + gsize([c]) > MAX_GROUP) groups.push([])
    groups.at(-1)!.push(c)
  }
  log(`${file}: ${all.length} entries (${all.filter(e => e.fixed !== undefined).length} fixed), ${starts.size} kathās, ${chunks.length} packets, ${groups.length} groups`)
  const kathaCtx = (c: { es: K[]; first: number }) => {
    const at = all.indexOf(c.es[0])
    if (at === c.first) return []
    const out: K[] = []
    for (let i = c.first, turns = 0; i < at && turns < 2 && out.length < 8; i++) { out.push(all[i]); if (all[i].role) turns++ }
    return out.filter(e => text[e.key]).map(e => `[${e.key}] ${text[e.key].si}`)
  }
  const prevOf = (c: { es: K[] }) => { const at = all.indexOf(c.es[0]); return all.slice(Math.max(0, at - 4), at).filter(e => text[e.key]).map(e => `[${e.key}] ${text[e.key].si}`) }

  for (const group of groups) {
    for (const c of group) {
      const id = `${file} ${c.es[0].key.split(' ')[1]}`
      for (const e of c.es) if (e.fixed !== undefined && !text[e.key]) put(e, e.fixed, 'kvu-fixed')
      // (a turn that repeats one of an earlier packet is not sent; repeats inside the packet are settled after the call)
      const fresh: K[] = [], inPacket = new Map<string, K>(), later: [K, K][] = []
      for (const e of c.es) {
        if (e.fixed !== undefined) continue
        const k = dupKey(e)
        if (k && seen.has(k)) { if (!text[e.key]) put(e, seen.get(k)!.body, 'kvu-repeat', seen.get(k)!.key); continue }
        if (k && inPacket.has(k)) { later.push([e, inPacket.get(k)!]); continue }
        if (k) inPacket.set(k, e)
        fresh.push(e)
      }
      let r = rewrites.get(id)
      if (!r && fresh.length) {
        if (spent >= MAX_USD) { log(`stopped at ${id}: $${spent.toFixed(2)} used`); process.exit(0) }
        if (process.argv.includes('--dry')) { const sent = new Set(fresh); console.log(render({ terms: termsFor(fresh), katha: kathaCtx(c), prev: prevOf(c), es: c.es.filter(e => sent.has(e) || text[e.key]), sent, glosses: packet(db, id, 'rewrite', fresh).glosses })); console.log(`\n===== ${id}: ${fresh.length} sent of ${c.es.length}, ${fresh.reduce((t, e) => t + size(e), 0)} chars\n`); continue }
        for (let tries = 1; tries <= 2; tries++) {
          const terms = termsFor(fresh), sent = new Set(fresh)
          // (repeats inside the packet are left out of what the model reads: they have no text yet)
          const shown = c.es.filter(e => sent.has(e) || text[e.key])
          const c2 = await claude(OPUS, RULES + REWRITE_TASK, render({ terms, katha: kathaCtx(c), prev: prevOf(c), es: shown, sent, glosses: packet(db, id, 'rewrite', fresh).glosses }), REWRITE_SCHEMA)
          spent += c2.usage.costUsd
          const items = c2.out.items.map(x => ({ i: x.i, si: fresh[x.i - 1] ? tidy(fresh[x.i - 1], x.si) : x.si }))
          const bad = fresh.map((e, i) => [e.key, faults(e, items.find(x => x.i === i + 1)?.si)]).filter(x => x[1])
          r = { packet: id, items, terms: (c2.out as any).terms ?? [], usage: c2.usage, tries }
          log(`${id}: ${fresh.length} sent of ${c.es.length} entries, terms ${terms.length} given ${r.terms.length} new, out ${c2.usage.output} tok, $${c2.usage.costUsd.toFixed(3)}${bad.length ? `; failed checks: ${bad.map(b => b.join(' ')).join('; ')}` : ''}`)
          if (!bad.length) break
        }
        appendJsonl(path.join(dir, 'rewrite.jsonl'), r); rewrites.set(id, r!)
      }
      if (r) addTerms(r.terms, false)
      fresh.forEach((e, i) => { const si = r!.items.find(x => x.i === i + 1)?.si; if (si !== undefined && !text[e.key]?.src.startsWith('review')) put(e, si, 'kvu') })
      for (const [e, src] of later) if (!text[e.key] && text[src.key]) put(e, text[src.key].body, 'kvu-repeat', src.key)
      for (const e of c.es) { const k = dupKey(e); if (k && text[e.key] && !seen.has(k)) seen.set(k, { key: e.key, body: text[e.key].body }) }
      saveStore(file)
    }
    // the review of the group, in one call: the turns the model wrote, with the done lines in their place
    const es = group.flatMap(c => c.es).filter(e => text[e.key]), gid = `${file} ${es[0].key.split(' ')[1]}`
    const sent = new Set(es.filter(e => text[e.key].src === 'kvu' || text[e.key].src === 'review-kvu'))
    if (!reviews.has(gid) && sent.size) {
      if (spent >= MAX_USD) { log(`stopped before the review of ${gid}: $${spent.toFixed(2)} used`); process.exit(0) }
      const list = [...sent], terms = termsFor(list)
      const c2 = await claude(OPUS, RULES + REVIEW_TASK, render({ terms, katha: kathaCtx(group[0]), prev: prevOf(group[0]), es, sent, glosses: packet(db, gid, 'rewrite', list).glosses, extra: e => `NEW: ${text[e.key].body}` }), REVIEW_SCHEMA)
      spent += c2.usage.costUsd
      const done: { key: string; before: string; errors: unknown }[] = [], refused: string[] = []
      for (const it of c2.out.items as any[]) {
        const e = list[it.i - 1], old = e && text[e.key].body
        if (!e || !it.si?.trim()) continue
        const si = tidy(e, it.si)
        if (si === old) continue
        const bad = faults(e, si) || (count(si, /-පෙ-/g) !== count(old, /-පෙ-/g) ? '-පෙ- changed' : count(si, /\*\*/g) !== count(old, /\*\*/g) ? 'bold changed' : '')
        if (bad) { refused.push(`${e.key} (${bad})`); continue }
        done.push({ key: e.key, before: old, errors: it.errors }); put(e, si, 'review-kvu')
        const k = dupKey(e)
        if (k && seen.get(k)?.key === e.key) seen.set(k, { key: e.key, body: si })
        // (its repeats take the correction)
        for (const f of FILES) { const st = stores.get(f); if (!st) continue; let ch = false
          for (const [key, v] of Object.entries(st)) if (v.from === e.key) { const o = (f === file ? whole : load(f)).find(x => x.key === key)!; st[key] = { ...v, body: si, si: compose(o, si) }; ch = true }
          if (ch) saveStore(f) }
      }
      const t: Term[] = (c2.out as any).terms ?? []
      addTerms(t, true); saveStore(file)
      const rec = { group: gid, entries: sent.size, items: done, refused, terms: t, usage: c2.usage }
      appendJsonl(path.join(dir, 'review.jsonl'), rec); reviews.set(gid, rec)
      const kinds: Record<string, number> = {}
      for (const d of done) for (const x of (d.errors as { kind: string }[]) ?? []) kinds[x.kind] = (kinds[x.kind] ?? 0) + 1
      log(`review ${gid}: ${done.length} of ${sent.size} entries changed ${JSON.stringify(kinds)}, ${t.length} terms settled${refused.length ? `, refused: ${refused.join('; ')}` : ''}, out ${c2.usage.output} tok, $${c2.usage.costUsd.toFixed(3)}`)
    }
  }
  // the side-by-side page of what is done in this file
  const md: string[] = []
  let noQ = 0
  for (const e of all) {
    const t = text[e.key]
    if (!t) continue
    if (/^. (q|aq)$/.test(e.role) && !t.body.includes('?')) { noQ++; log(`  question without "?": ${e.key} ${t.si.slice(0, 80)}`) }
    md.push(`**[${e.key}]** _${t.src}_`, '', `P: ${noFn(e.pali) || '—'}`, '', `B: ${noFn(e.bjt) || '—'}`, '', `N: ${t.si}`, '', '---', '')
  }
  fs.writeFileSync(path.join(dir, `side-${file}.md`), md.join('\n'))
  const src: Record<string, number> = {}
  for (const e of all) if (text[e.key]) src[text[e.key].src] = (src[text[e.key].src] ?? 0) + 1
  log(`${file}: ${JSON.stringify(src)}; ${noQ} questions without "?"`)
}
log(`done; $${spent.toFixed(2)} used in this run; ${ledger.size} terms`)
