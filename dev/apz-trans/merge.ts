/**
 * Writes a run's results (out/<set>/opus.jsonl) into public/static/text-apz, after automatic checks.
 *
 *   npx tsx dev/apz-trans/merge.ts --set <set> [--runner opus] [--write]
 *
 * Without --write it only reports. Checks per entry:
 *   hard (the entry is not merged): no result, empty while the Pāḷi has words, a copy of the Pāḷi, a different leading
 *     paragraph number, digits of the Pāḷi missing
 *   soft (merged, listed for the user's spot checks): length against BJT outside 0.5–2.5, Latin letters, -පෙ- dropped
 * Translate mode: a book without a text-apz file gets one (all pages, '' where nothing merged); every new entry is
 * flagged `ai`. QA mode: "ok" changes nothing; "fixed" replaces the text and keeps the entry's ai flag; "retranslated"
 * replaces it and flags it ai (a wholly new translation). Writes out/<set>/merge-report.md and flags.tsv.
 */
import fs from 'node:fs'
import path from 'node:path'
import { OUT, readJsonl, textFile, type Packet, type Result } from './lib'
import { APZ_DIR, type ApzFile } from '../../build/apz'

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined }
const SET = arg('--set'), RUNNER = arg('--runner') ?? 'opus', WRITE = process.argv.includes('--write')
if (!SET) throw new Error('--set <set>')
const dir = path.join(OUT, SET)
const packets: Packet[] = JSON.parse(fs.readFileSync(path.join(dir, 'packets.json'), 'utf-8'))
const results = new Map(readJsonl<Result>(path.join(dir, `${RUNNER}.jsonl`)).map(r => [r.packet, r]))

// (as dev/apz-import/import.ts: a copy of the Pāḷi has most of its words and none of the letters BJT Pāḷi never uses)
const SINHALA_ONLY = /[ේෝැෑශෂඇඈඒඕ]/
const words = (s: string) => s.replace(/\{[^}]*\}|\*\*|__|-පෙ-/g, '').split(/[^඀-෿‍]+/).filter(w => w.length > 1)
function copied(si: string, pali: string) {
  const w = words(si)
  if (w.length < 5) return false
  const p = new Set(words(pali)), r = w.filter(x => p.has(x)).length / w.length
  return r >= 0.9 || (r >= 0.5 && !SINHALA_ONLY.test(si))
}
const leadNum = (s: string) => s.match(/^\s*\(?([\d.\s-]+?)[.)]\s/)?.[1].replace(/\s+/g, '')
// (digits stuck to a word are footnote marks the BJT digitization left without braces: ඛයිතං53, දෙසී3ති)
const digits = (s: string) => (s.replace(/\{[^}]*\}/g, '').replace(/(?<=[඀-෿])\d+/g, '').match(/\d+/g) ?? []).sort().join(' ')

type Flag = [key: string, level: 'hard' | 'soft', kind: string, note: string]
const flags: Flag[] = []
const apz = new Map<string, ApzFile>()
const getApz = (file: string): ApzFile => {
  if (!apz.has(file)) {
    const f = path.join(APZ_DIR, file + '.json')
    apz.set(file, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf-8'))
      : { filename: file, pages: textFile(file).pages.map((p: any) => ({ pageNum: p.pageNum, entries: p.pali.entries.map(() => '') })) })
  }
  return apz.get(file)!
}
const count = { merged: 0, unchanged: 0, missing: 0, hard: 0 }
const verdicts: Record<string, number> = {}

for (const p of packets) {
  const r = results.get(p.id)
  p.entries.forEach((e, i) => {
    const item = r?.items.find(x => x.i === i + 1)
    if (!item) { count.missing++; if (r) flags.push([e.key, 'hard', 'no-result', '']); return }
    const verdict = p.mode === 'qa' ? item.verdict ?? 'fixed' : 'new'
    verdicts[verdict] = (verdicts[verdict] ?? 0) + 1
    if (verdict === 'ok') { count.unchanged++; return }
    const si = item.si.replace(/\{[^}]*\}/g, '').replace(/[ \t]{2,}/g, ' ').trim()
    const pali = e.pali.replace(/\{[^}]*\}/g, '')
    const hard: [string, string][] = []
    if (!si && pali.replace(/^[\d.\s]+/, '').trim()) hard.push(['empty', ''])
    const bjt = e.bjt.replace(/\{[^}]*\}/g, '')
    // (BJT too keeps the Pāḷi of names and titles: a list of names is no copy)
    if (si && copied(si, pali) && !copied(bjt, pali)) hard.push(['copied-pali', si.slice(0, 80)])
    if (leadNum(pali) !== undefined && leadNum(pali) !== leadNum(si)) hard.push(['number-prefix', `${leadNum(pali)} vs ${leadNum(si) ?? '-'}`])
    // (BJT's case numbers, (4), are in its Sinhala only, and where the two sides of BJT disagree either is accepted)
    if ((digits(pali) || digits(bjt)) && digits(si) !== digits(pali) && digits(si) !== digits(bjt)) hard.push(['digits', `${digits(pali)} vs ${digits(si)}`])
    if (hard.length) { count.hard++; for (const [k, n] of hard) flags.push([e.key, 'hard', k, n]); return }
    // (a BJT paragraph numbered 4279-4280 covers several Pāḷi entries: its length says nothing about this one)
    if (e.bjt.length >= 150 && !/^\s*\d+\s*-\s*\d+/.test(bjt)) { const ratio = si.length / e.bjt.length; if (ratio < 0.5 || ratio > 2.5) flags.push([e.key, 'soft', 'length', ratio.toFixed(2)]) }
    if (/[A-Za-z]/.test(si)) flags.push([e.key, 'soft', 'latin', si.match(/[A-Za-z][A-Za-z ]*/)![0]])
    if (pali.includes('-පෙ-') && !si.includes('-පෙ-')) flags.push([e.key, 'soft', 'peyyala-expanded', ''])
    for (const er of item.errors ?? []) if (['meaning', 'omission', 'edition', 'alignment'].includes(er.kind)) flags.push([e.key, 'soft', `qa-${er.kind}`, er.note.slice(0, 160)])
    const a = getApz(e.file), pg = a.pages[e.page]
    pg.entries[e.entry] = si
    const isAi = (pg.ai ?? []).includes(e.entry)
    const ai = p.mode === 'translate' || verdict === 'retranslated' || isAi
    if (ai !== isAi) pg.ai = ai ? [...(pg.ai ?? []), e.entry].sort((x, y) => x - y) : pg.ai!.filter(x => x !== e.entry)
    if (pg.ai && !pg.ai.length) delete pg.ai
    count.merged++
  })
}

if (WRITE) for (const [file, a] of apz) fs.writeFileSync(path.join(APZ_DIR, file + '.json'), JSON.stringify(a, null, 4) + '\n')
const kinds = flags.reduce((m, f) => (m[`${f[1]} ${f[2]}`] = (m[`${f[1]} ${f[2]}`] ?? 0) + 1, m), {} as Record<string, number>)
const md = [`# merge of ${SET} (${RUNNER})${WRITE ? '' : ' - dry run, nothing written'}`, '',
  `- packets: ${packets.length}, with results: ${packets.filter(p => results.has(p.id)).length}`,
  `- entries merged: ${count.merged}, unchanged (QA ok): ${count.unchanged}, not merged (hard flags): ${count.hard}, no result yet: ${count.missing}`,
  `- verdicts: ${Object.entries(verdicts).map(([k, n]) => `${k} ${n}`).join(', ')}`,
  `- files ${WRITE ? 'written' : 'that would be written'}: ${[...apz.keys()].join(', ')}`, '', '| flag | entries |', '|---|---|',
  ...Object.entries(kinds).sort().map(([k, n]) => `| ${k} | ${n} |`), '', 'Details: flags.tsv']
fs.writeFileSync(path.join(dir, 'merge-report.md'), md.join('\n') + '\n')
fs.writeFileSync(path.join(dir, 'flags.tsv'), ['key\tlevel\tkind\tnote', ...flags.map(f => f.join('\t'))].join('\n') + '\n')
console.log(md.join('\n'))
