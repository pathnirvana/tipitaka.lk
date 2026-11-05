/**
 * Rewrite mode, per book: the newest text of every entry, the chapter review, and the side-by-side page.
 *
 *   npx tsx dev/apz-trans/book.ts assemble <book> <set> [<set> …]
 *     out/book-<book>/text.json: entry key -> {si, src}, from the sets in order (a later set wins; a set's fixed.jsonl,
 *     hand or review corrections, wins over its opus.jsonl). Entries corrected by the chapter review keep their reviewed text.
 *   npx tsx dev/apz-trans/book.ts review <book> --from 30:0 --to 47:9999 [--effort medium]
 *     every chapter (heading to heading) overlapping the range, one call each (review-prompt.md after prompt-v2.md's
 *     rules): the corrected entries go into text.json, the changes into review.jsonl.
 *   npx tsx dev/apz-trans/book.ts dump <book> --from 48:0 --to 124:9999
 *     the chapters in range as review files (out/book-<book>/rev/*.txt) for a review in the Claude session.
 *   npx tsx dev/apz-trans/book.ts apply <book> <corrections.json> [--by claude]
 *     that review's corrections [{key, si, errors}] into text.json (checked: -පෙ-, bold, paragraph number) and review.jsonl.
 *   npx tsx dev/apz-trans/book.ts write <book>
 *     the book into public/static/text-apz/<book>.json, every entry flagged ai (a new translation).
 *   npx tsx dev/apz-trans/book.ts page <book> --from 30:0 --to 47:9999
 *     out/book-<book>/page-<from>.html: BJT Sinhala | newest text, words that differ highlighted, review changes listed.
 */
import fs from 'node:fs'
import path from 'node:path'
import { DIR, OUT, REWRITE, claude, entries, openDb, packet, readJsonl, appendJsonl, render, textFile as bjtFile, type Entry, type Packet, type Result } from './lib'
import { APZ_DIR } from '../../build/apz'

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined }
const [cmd, book] = process.argv.slice(2)
if (!cmd || !book) throw new Error('usage: book.ts assemble|review|page <book> …')
const dir = path.join(OUT, `book-${book}`)
fs.mkdirSync(dir, { recursive: true })
const textFile = path.join(dir, 'text.json')
type Text = Record<string, { si: string; src: string }>
const text: Text = fs.existsSync(textFile) ? JSON.parse(fs.readFileSync(textFile, 'utf-8')) : {}
const save = () => fs.writeFileSync(textFile, JSON.stringify(text, null, 1))
const MAX_CHAPTER = 25000 // Pāḷi chars per review call; a longer chapter is reviewed in parts
const pos = (k: string) => k.split(' ')[1].split(':').map(Number).reduce((a, b) => a * 10000 + b)
const db = openDb()

if (cmd === 'assemble') {
  for (const set of process.argv.slice(4)) {
    const sd = path.join(OUT, set), file = fs.existsSync(path.join(sd, 'fixed.jsonl')) ? 'fixed.jsonl' : 'opus.jsonl'
    const packets: Packet[] = JSON.parse(fs.readFileSync(path.join(sd, 'packets.json'), 'utf-8'))
    const res = new Map(readJsonl<Result>(path.join(sd, file)).map(r => [r.packet, r]))
    let n = 0
    for (const p of packets) p.entries.forEach((e, i) => {
      const it = res.get(p.id)?.items.find(x => x.i === i + 1)
      if (it && text[e.key]?.src !== `${set}/${file}` && !text[e.key]?.src.startsWith('review')) { text[e.key] = { si: it.si, src: `${set}/${file}` }; n++ }
    })
    console.log(`${set}/${file}: ${n} entries`)
  }
  save()
} else {
  const from = arg('--from') ?? '0:0', to = arg('--to') ?? '99999:9999'
  const all = entries(db, book, '0:0', '99999:9999')
  // chapters: from a heading to the entry before the next one
  const chapters: Entry[][] = []
  for (const e of all) { if (e.type === 'heading' || !chapters.length) chapters.push([]); chapters.at(-1)!.push(e) }
  const lo = pos(`x ${from}`), hi = pos(`x ${to}`)
  const inRange = chapters.filter(c => c.some(e => pos(e.key) >= lo && pos(e.key) <= hi))

  if (cmd === 'review') {
    if (arg('--effort')) process.env.APZ_EFFORT = arg('--effort')
    const system = REWRITE.replace(/## Task[\s\S]*$/, '') + fs.readFileSync(path.join(DIR, 'review-prompt.md'), 'utf-8')
    const schema = { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object', required: ['i', 'si', 'errors'], properties: {
      i: { type: 'integer' }, si: { type: 'string' },
      errors: { type: 'array', items: { type: 'object', required: ['kind', 'note'], properties: { kind: { type: 'string' }, note: { type: 'string' } } } } } } } } }
    let spent = 0
    for (const c of inRange) {
      const es = c.filter(e => text[e.key])
      if (es.length < c.length) console.warn(`${c[0].key}: ${c.length - es.length} entries have no rewrite yet; reviewing the rest`)
      // (parts of at most MAX_CHAPTER Pāḷi chars)
      const parts: Entry[][] = [[]]
      for (const e of es) { if (parts.at(-1)!.reduce((s, x) => s + x.pali.length, 0) + e.pali.length > MAX_CHAPTER) parts.push([]); parts.at(-1)!.push(e) }
      for (const part of parts.filter(x => x.length)) {
        const p = packet(db, `review ${part[0].key}`, 'rewrite', part)
        const r = await claude('claude-opus-5-5', system, render(p, e => `NEW: ${text[e.key].si}`), schema)
        for (const it of r.out.items) { const e = part[it.i - 1]; if (e && it.si) text[e.key] = { si: it.si, src: 'review' } }
        save()
        appendJsonl(path.join(dir, 'review.jsonl'), { chapter: part[0].key, to: part.at(-1)!.key, items: r.out.items.map(it => ({ key: part[it.i - 1]?.key, errors: it.errors })), usage: r.usage, effort: process.env.APZ_EFFORT ?? 'medium' })
        spent += r.usage.costUsd
        console.log(`${part[0].key} … ${part.at(-1)!.key}: ${part.length} entries, ${r.out.items.length} changed, $${r.usage.costUsd.toFixed(3)}`)
      }
    }
    console.log(`done; $${spent.toFixed(2)}`)
  } else if (cmd === 'dump') {
    // the review done by Claude in the session (and the review agents it briefs) instead of the script: the chapters in
    // range, grouped up to MAX_CHAPTER Pāḷi chars per file, as PALI / BJT / ATTA / NEW (out/book-<book>/rev/<first key>.txt)
    const rev = path.join(dir, 'rev'); fs.mkdirSync(rev, { recursive: true })
    const groups: Entry[][][] = [[]]
    for (const c of inRange) {
      const es = c.filter(e => pos(e.key) >= lo && pos(e.key) <= hi && text[e.key])
      if (!es.length) continue
      const size = (g: Entry[][]) => g.flat().reduce((s, x) => s + x.pali.length, 0)
      if (groups.at(-1)!.length && size(groups.at(-1)!) + size([es]) > MAX_CHAPTER) groups.push([])
      groups.at(-1)!.push(es)
    }
    for (const g of groups.filter(g => g.length)) {
      const body = g.map(es => render(packet(db, `review ${es[0].key}`, 'rewrite', es), e => `NEW: ${text[e.key].si}`).replace(/^# ENTRIES\n/m, `# CHAPTER ${es[0].key}\n`))
      const out = path.join(rev, `${g[0][0].key.replace(/[ :]/g, '_')}.txt`)
      fs.writeFileSync(out, body.join('\n'))
      console.log(`${out}: ${g.length} chapters, ${g.flat().length} entries, ${g.flat().reduce((s, x) => s + x.pali.length, 0)} Pāḷi chars`)
    }
  } else if (cmd === 'apply') {
    // corrections from the review: a JSON file [{key, si, errors: [{kind, note}]}]; checked before they go into text.json
    const file = process.argv[4], by = arg('--by') ?? 'claude'
    const items: { key: string; si: string; errors: { kind: string; note: string }[] }[] = JSON.parse(fs.readFileSync(file, 'utf-8'))
    const byKey = new Map(all.map(e => [e.key, e]))
    const count = (s: string, re: RegExp) => (s.match(re) ?? []).length
    const ok: typeof items = []
    for (const it of items) {
      const old = text[it.key]?.si, e = byKey.get(it.key)
      const bad = !old || !e ? 'no such entry' : !it.si?.trim() ? 'empty'
        : count(it.si, /-පෙ-/g) !== count(old, /-පෙ-/g) ? '-පෙ- count changed'
        : count(it.si, /\*\*/g) !== count(old, /\*\*/g) ? 'bold markers changed'
        : (it.si.match(/^\s*[\d\s.-]+/)?.[0].trim() ?? '') !== (old.match(/^\s*[\d\s.-]+/)?.[0].trim() ?? '') ? 'paragraph number changed' : ''
      if (bad) { console.warn(`${it.key}: skipped (${bad})`); continue }
      if (it.si === old) continue
      text[it.key] = { si: it.si, src: `review-${by}` }; ok.push(it)
    }
    save()
    appendJsonl(path.join(dir, 'review.jsonl'), { chapter: path.basename(file), by, items: ok.map(it => ({ key: it.key, errors: it.errors })) })
    console.log(`${ok.length} of ${items.length} corrections applied`)
  } else if (cmd === 'page') {
    const changes = new Map<string, { kind: string; note: string }[]>()
    for (const r of readJsonl<any>(path.join(dir, 'review.jsonl'))) for (const it of r.items) if (it.key) changes.set(it.key, it.errors)
    const strip = (s: string) => s.replace(/\{[^}]*\}/g, '')
    const rows = inRange.flat().filter(e => pos(e.key) >= lo && pos(e.key) <= hi && text[e.key]).map(e => ({
      id: e.key, set: book, pali: strip(e.pali), bjt: strip(e.bjt), si: text[e.key].si, old: strip(e.bjt), oldLabel: 'BJT SINHALA', newLabel: 'NEW',
      errors: changes.get(e.key) ?? [], why: changes.has(e.key) ? ['changed in review'] : [] }))
    const out = path.join(dir, `page-${from.replace(':', '.')}.html`)
    const title = arg('--title') ?? `${book} ${from.split(':')[0]}–${to.split(':')[0]}`
    const html = fs.readFileSync(path.join(DIR, 'spotcheck.html'), 'utf-8')
      .replace(/<title>.*<\/title>/, `<title>${title}</title>`).replace(/<h1>.*<\/h1>/, `<h1>${title}</h1>`)
      .replace(/<p class="lede">.*<\/p>/, `<p class="lede">${title} after both steps: the rewrite of BJT Sinhala, then the review of each whole chapter. Each card shows BJT Sinhala and the final text side by side, with the words each has that the other lacks highlighted. Cards marked “changed in review” list what the review changed and why. Mark each one, and note any error.</p>`)
      .replace(/<option value="qa">.*?<option value="bad">/, '<option value="changed">changed in review</option><option value="bad">')
      .replace("    if ((f === 'qa'", "    if (f === 'changed' && !e.why.length) continue\n    if ((f === 'qa'")
      .replace('__DATA__', () => JSON.stringify(rows).replace(/</g, '\\u003c'))
    fs.writeFileSync(out, html)
    console.log(`${out}: ${rows.length} entries, ${rows.filter(r => r.errors.length).length} changed in review`)
  } else if (cmd === 'write') {
    // the book's text into public/static/text-apz/<book>.json (a new translation: every entry flagged ai); refuses
    // when an entry of the book has no text
    const missing = all.filter(e => !text[e.key]?.si.trim() && e.pali.replace(/^[\d.\s]+/, '').trim())
    if (missing.length) throw new Error(`${missing.length} entries have no text, e.g. ${missing[0].key}`)
    const pages = bjtFile(book).pages.map((p: any) => ({ pageNum: p.pageNum, entries: p.pali.entries.map(() => ''), ai: [] as number[] }))
    for (const e of all) {
      const si = (text[e.key]?.si ?? '').replace(/\{[^}]*\}/g, '').replace(/[ \t]{2,}/g, ' ').trim()
      if (si) { pages[e.page].entries[e.entry] = si; pages[e.page].ai.push(e.entry) }
    }
    for (const p of pages) if (!p.ai.length) delete (p as any).ai
    fs.writeFileSync(path.join(APZ_DIR, book + '.json'), JSON.stringify({ filename: book, pages }, null, 4) + '\n')
    console.log(`${APZ_DIR}/${book}.json: ${all.length} entries, ${pages.reduce((s, p) => s + (p.ai?.length ?? 0), 0)} with text`)
  } else throw new Error(`unknown command ${cmd}`)
}
