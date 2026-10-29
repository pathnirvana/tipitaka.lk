/**
 * Runs one runner over a set's packets (dev/apz-trans/out/<set>/packets.json) and appends its results to
 * out/<set>/<runner>.jsonl. Packets already in the file are skipped, so a run can be stopped and started again.
 *
 *   npx tsx dev/apz-trans/run.ts <runner> [--set pilot] [--only <packet id>] [--jobs 3] [--max-usd N] [--effort medium]
 *
 * --max-usd: no new packets once this run has used N dollars (list-price equivalent: plan usage for Claude).
 * --effort low|medium|high|xhigh|max: Claude's effort (default medium; the pilot ran at high).
 *
 * Runners:
 *   opus    experiment B: Opus translates (or QA-checks) from the packet directly
 *   gemini  experiment A, step 1: gemini-4-argon (REST, billed GEMINI_API_KEY)
 *   review  experiment A, step 2: Opus reviews and corrects gemini's output
 *   judge   Fable compares opus and review blind (A/B shuffled per packet)
 *
 * The packets of one range run in order: each gets the runner's own last two translations as PREV.
 */
import path from 'node:path'
import fs from 'node:fs'
import { OUT, STYLE, TASK, SCHEMA, claude, gemini, render, readJsonl, appendJsonl, opusIsA, type Item, type Packet, type Result } from './lib'

type P = Packet & { group: string; after?: string }
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined }
const runner = process.argv[2]
const SET = arg('--set') ?? 'pilot', ONLY = arg('--only'), JOBS = Number(arg('--jobs') ?? 3), MAX_USD = Number(arg('--max-usd') ?? Infinity)
const dir = path.join(OUT, SET)
const packets: P[] = JSON.parse(fs.readFileSync(path.join(dir, 'packets.json'), 'utf-8'))
const outFile = path.join(dir, `${runner}.jsonl`)
const done = new Map(readJsonl<Result>(outFile).map(r => [r.packet, r]))
const byId = (f: string) => new Map(readJsonl<Result>(path.join(dir, f)).map(r => [r.packet, r]))

if (arg('--effort')) process.env.APZ_EFFORT = arg('--effort')
const OPUS = 'claude-opus-5-5', FABLE = 'claude-fable-5-1', GEMINI = 'gemini-4-argon'

const JUDGE_TASK = `## Task: judge two translations
Each entry has two Sinhala translations, A and B, made from the same sources (for QA entries: two corrected versions of APZ).
Judge them against the PALI, BJT and ATTA and the rules above. Check accuracy against the Pāḷi, whether the meaning follows the
commentary, completeness (every clause, number, name), the register and terms, and the peyyāla rule.
For each entry return:
- "better": "A", "B" or "tie".
- "significant": true if the two differ in meaning, completeness or correctness, not only in wording.
- "a_errors" and "b_errors": the errors of each as {"kind", "note"}; kind is one of: meaning, omission, addition, number, name,
  style, peyyala, pali-left. Notes are short, in English, and quote the words concerned.
- "note": one short sentence on why.
Return {"items": [{"i", "better", "significant", "a_errors", "b_errors", "note"}]}: one item per entry, same i numbers.`
const ERRS = { type: 'array', items: { type: 'object', properties: { kind: { type: 'string' }, note: { type: 'string' } }, required: ['kind', 'note'] } }
const JUDGE_SCHEMA = { type: 'object', required: ['items'], properties: { items: { type: 'array', items: { type: 'object',
  properties: { i: { type: 'integer' }, better: { type: 'string' }, significant: { type: 'boolean' }, a_errors: ERRS, b_errors: ERRS, note: { type: 'string' } },
  required: ['i', 'better', 'significant', 'a_errors', 'b_errors', 'note'] } } } }

async function runOne(p: P, prev: { key: string; si: string }[]): Promise<Result> {
  const pk = { ...p, prev }
  const sys = (task: string) => STYLE + '\n\n' + task
  const withVerdict = p.mode === 'qa'
  if (runner === 'opus' || runner === 'gemini') {
    const task = TASK[p.mode], schema = SCHEMA(withVerdict)
    const r = runner === 'opus' ? await claude(OPUS, sys(task), render(pk), schema) : await gemini(GEMINI, sys(task), render(pk), schema)
    return { packet: p.id, runner, model: runner === 'opus' ? OPUS : GEMINI, items: r.out.items, usage: r.usage }
  }
  if (runner === 'review') {
    const g = byId('gemini.jsonl').get(p.id)
    if (!g) throw new Error(`no gemini result for ${p.id}`)
    const draft = new Map(g.items.map(x => [x.i, x.si]))
    const r = await claude(OPUS, sys(TASK.review), render(pk, (_, i) => `DRAFT: ${draft.get(i + 1) ?? '(missing)'}`), SCHEMA(true))
    return { packet: p.id, runner, model: `${GEMINI}+${OPUS}`, items: r.out.items, usage: r.usage }
  }
  if (runner === 'judge') {
    const o = byId('opus.jsonl').get(p.id), v = byId('review.jsonl').get(p.id)
    if (!o || !v) throw new Error(`no opus/review result for ${p.id}`)
    const om = new Map(o.items.map(x => [x.i, x.si])), vm = new Map(v.items.map(x => [x.i, x.si]))
    const aIsOpus = opusIsA(p.id)
    const r = await claude(FABLE, sys(JUDGE_TASK), render({ ...p, prev: [] }, (_, i) => {
      const [a, b] = aIsOpus ? [om.get(i + 1), vm.get(i + 1)] : [vm.get(i + 1), om.get(i + 1)]
      return `A: ${a ?? '(missing)'}\nB: ${b ?? '(missing)'}`
    }), JUDGE_SCHEMA)
    // (stored with the names, not the letters)
    const items = (r.out.items as unknown as Record<string, any>[]).map(x => ({ ...x,
      better: x.better === 'tie' ? 'tie' : (x.better === 'A') === aIsOpus ? 'opus' : 'review',
      opus_errors: aIsOpus ? x.a_errors : x.b_errors, review_errors: aIsOpus ? x.b_errors : x.a_errors, a_errors: undefined, b_errors: undefined }))
    return { packet: p.id, runner, model: FABLE, items: items as unknown as Item[], usage: r.usage }
  }
  throw new Error(`unknown runner ${runner}`)
}

async function main() {
  const todo = packets.filter(p => !done.has(p.id) && (!ONLY || p.id === ONLY))
  // the chains of one range run in order; chains run JOBS at a time
  const heads = todo.filter(p => !p.after || !todo.some(q => q.id === p.after))
  console.log(`${runner}: ${todo.length} packets to run (${done.size} done), ${heads.length} chains, ${JOBS} at a time`)
  let next = 0, failed = 0, spent = 0
  await Promise.all(Array.from({ length: JOBS }, async () => {
    while (next < heads.length && spent < MAX_USD) {
      let p: P | undefined = heads[next++]
      while (p && spent < MAX_USD) {
        const before = p.after ? done.get(p.after) : undefined
        const prev = before && runner !== 'judge' ? before.items.slice(-2).map(x => ({ key: packets.find(q => q.id === before.packet)!.entries[x.i - 1]?.key ?? '', si: x.si })) : []
        try {
          const r = await runOne(p, prev)
          if (r.items.length !== p.entries.length) console.error(`${p.id}: ${r.items.length} items for ${p.entries.length} entries`)
          appendJsonl(outFile, { ...r, ...(runner !== 'gemini' ? { effort: process.env.APZ_EFFORT ?? 'medium' } : {}) }); done.set(p.id, r); spent += r.usage.costUsd
          console.log(`${p.id}: ${r.items.length} items, in ${r.usage.input + r.usage.cacheRead + r.usage.cacheWrite} out ${r.usage.output} tokens, $${r.usage.costUsd.toFixed(3)}, ${Math.round(r.usage.ms / 1000)}s`)
        } catch (e) { failed++; console.error(`${p.id} failed: ${(e as Error).message}`); break }
        const id: string = p.id
        p = todo.find(q => q.after === id)
      }
    }
  }))
  console.log(`done; ${failed} failed; $${spent.toFixed(2)} used${spent >= MAX_USD ? ` (stopped at --max-usd ${MAX_USD})` : ''}`)
}
main()
