/**
 * One-off import of the simplified Sinhala translation (sin_apz) into public/static/text-apz/ (see build/apz.ts and
 * dev-docs/pitaka-flavor.md). After it, git is the edit overlay: corrections are commits to those files.
 *
 *   npx tsx dev/apz-import/import.ts [--write]
 *
 * Source: misc-projects/ai-trans/bjt/output-apz/<file>-combined.json ({"<chunk>": [text…]}), made by align-apz.js from
 * the old APZ XML: exactly one string per BJT Pāḷi entry of the file, in order. It is checked against the copy
 * sync-json-to-sqlite.js wrote to tipitaka-new's text.db (table sin_apz, page = pageNum + pageOffset, seq = entry index
 * + sequenceStart).
 * Clean-up:
 *  - AI markers ("(AI)", "[AI]", "{AI}", "- AI", "(AI Translation)"…) and the aligner's "(S16)" / "(S39 Full)" peyyāla
 *    references are removed; the entry is flagged in the page's `ai` list
 *  - entries that are a copy of the Pāḷi instead of a translation become '' (the reader shows the Pāḷi only)
 *  - editor notes ("potential errors from here", "to here"), romanised glosses and footnote markers are removed
 * Output: the text-apz files (--write), dev/apz-import/gaps.tsv (entries for the QA pass) and report.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { loadCorpus, type JEntry, type JFile } from '../../build/corpus'
import type { ApzFile } from '../../build/apz'

const SRC_DIR = process.env.APZ_SRC || '../misc-projects/ai-trans/bjt/output-apz'
const SRC_DB = process.env.APZ_DB || '../tipitaka-new/server-data/text.db'
const TEXT_DIR = 'public/static/text'
const OUT_DIR = 'public/static/text-apz'
const REPORT_DIR = 'dev/apz-import'
const WRITE = process.argv.includes('--write')

// a copy of the Pāḷi: at least COPY_MIN of the words found in its Pāḷi entry and no letter the BJT Pāḷi never uses
// (Sinhala long e/o, æ, ś, ṣ; not the ZWJ conjuncts, APZ's copies of the Pāḷi have them), or at least COPY_ALWAYS.
// Below that, entries with Sinhala letters are kept even when most words are Pāḷi (uddāna name lists
// "සමණී ය, සමණගුත්තා ය…": 0.83-0.88); they are reported from PARTLY_MIN for review
const SINHALA_ONLY = /[ේෝැෑශෂඇඈඒඕ]/
const COPY_MIN = 0.5
const COPY_ALWAYS = 0.9
const PARTLY_MIN = 0.5
const MIN_WORDS = 5 // shorter entries (names, "[සාවත්ථි]", "නමො තස්ස…") are the same in both
const PROSE = new Set(['paragraph', 'gatha', 'unindented'])

const AI_MARK = /\s*-?\s*(?:[([{]\s*AI(?: (?:Translation|Indication|Generated))?\s*[)\]}]|\bAI\b)\.?/g
const SEGMENT_REF = /\s*\(S\d+(?: Full)?\)\s*/g // "nogena... (S16) ... yana" - the aligner's reference to an earlier sutta

type Gap = [file: string, page: number, entry: number, kind: string, note: string]

const words = (s: string) => s.replace(/\{[^}]*\}|\*\*|__|-පෙ-/g, '').split(/[^඀-෿‍]+/).filter(w => w.length > 1)
const snippet = (s: string) => s.replace(/\s+/g, ' ').slice(0, 80)

/** the combined file as one list of strings, chunks in numeric order */
function readCombined(file: string): string[] {
  const c = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, (string | { translation?: string; text?: string })[]>
  return Object.keys(c).sort((a, b) => parseInt(a) - parseInt(b))
    .flatMap(k => c[k].map(i => typeof i === 'string' ? i : i.translation || i.text || ''))
}

/** the db copy of a file in the same order, null where the db has no row */
function readDb(db: Database.Database, f: JFile): (string | null)[] {
  const q = db.prepare('SELECT text FROM sin_apz WHERE book_id = ? AND page = ? AND seq = ?').pluck()
  return f.pages.flatMap(p => p.pali.entries.map((_, ei) =>
    (q.get(f.bookId, p.pageNum + (f.pageOffset || 0), ei + (p.pali.sequenceStart || 0)) as string | undefined) ?? null))
}

function clean(text: string, pali: JEntry, gap: (kind: string, note: string) => void): { text: string; ai: boolean } {
  let t = text, ai = false
  if (t.search(AI_MARK) >= 0 || t.search(SEGMENT_REF) >= 0) {
    ai = true
    t = t.replace(AI_MARK, '').replace(SEGMENT_REF, ' ').replace(/\.\.\.\s*\.\.\./g, '...')
  }
  if (/potential errors from here|^to here/.test(t)) {
    gap('editor-note', snippet(t))
    t = t.replace(/potential errors from here\s*/, '').replace(/^to here\s*/, '')
  }
  t = t.replace(/\.\.\.\s*\(pe\)\s*\.\.\./g, ' -පෙ- ')
  t = t.replace(/\s*\([A-Za-z][A-Za-z ]+\)/g, m => { gap('latin', m.trim()); return '' })
  if (/\{[^}]*\}/.test(t)) t = t.replace(/\{[^}]*\}/g, m => { gap('footnote-mark', m); return '' })
  t = t.replace(/[ \t]{2,}/g, ' ').replace(/ +\n|\n +/g, '\n').trim()
  if (/[A-Za-z]/.test(t)) gap('latin', snippet(t))

  const w = words(t)
  if (w.length >= MIN_WORDS && PROSE.has(pali.type)) {
    const p = new Set(words(pali.text))
    const r = w.filter(x => p.has(x)).length / w.length
    if (r >= COPY_ALWAYS || (r >= COPY_MIN && !SINHALA_ONLY.test(t))) { gap('copied-pali', snippet(t)); return { text: '', ai: false } }
    if (r >= PARTLY_MIN) gap('partly-pali', `${r.toFixed(2)} ${snippet(t)}`)
  }
  if (!t) gap('empty', '')
  return { text: t, ai: ai && !!t }
}

function main() {
  const corpus = loadCorpus(TEXT_DIR)
  const db = new Database(SRC_DB, { readonly: true })
  const srcFiles = fs.readdirSync(SRC_DIR).filter(n => n.endsWith('-combined.json')).sort()
  const gaps: Gap[] = []
  const report = ['# sin_apz import', '', `Source: ${SRC_DIR} (${srcFiles.length} files), checked against ${SRC_DB} (table sin_apz).`, '']
  let total = 0, dbDiff = 0, aiCount = 0
  const imported = new Set<string>()
  if (WRITE) fs.mkdirSync(OUT_DIR, { recursive: true })

  for (const n of srcFiles) {
    const name = n.slice(0, -'-combined.json'.length)
    const f = corpus.files[corpus.names.indexOf(name)]
    if (!f) throw new Error(`${name}: no BJT text file`)
    const src = readCombined(path.join(SRC_DIR, n))
    const pali = f.pages.flatMap((p, pi) => p.pali.entries.map((e, ei) => ({ e, pi, ei })))
    if (src.length !== pali.length) throw new Error(`${name}: ${src.length} translations, ${pali.length} Pāḷi entries`)
    const fromDb = readDb(db, f)
    fromDb.forEach((t, i) => { if (t !== src[i]) { dbDiff++; gaps.push([name, pali[i].pi, pali[i].ei, 'db-differs', snippet(t ?? '(no row)')]) } })

    const out: ApzFile = { filename: name, pages: f.pages.map(p => ({ pageNum: p.pageNum, entries: [] as string[] })) }
    src.forEach((text, i) => {
      const { e, pi, ei } = pali[i]
      const c = clean(text, e, (kind, note) => gaps.push([name, pi, ei, kind, note]))
      const page = out.pages[pi]
      page.entries.push(c.text)
      if (c.ai) { (page.ai ??= []).push(ei); aiCount++ }
    })
    total += src.length
    imported.add(name)
    if (WRITE) fs.writeFileSync(path.join(OUT_DIR, name + '.json'), JSON.stringify(out, null, 4) + '\n')
  }
  db.close()

  const byKind: Record<string, number> = {}
  for (const g of gaps) byKind[g[3]] = (byKind[g[3]] || 0) + 1
  const missing = corpus.names.filter(n => !n.startsWith('atta-') && !imported.has(n))
  report.push(
    `- files: ${imported.size}, entries: ${total}, differing from the db copy: ${dbDiff}`,
    `- AI fill-ins (flagged in \`ai\`): ${aiCount}`,
    ...Object.entries(byKind).map(([k, v]) => `- ${k}: ${v}`),
    '', 'Kinds in gaps.tsv: `empty` and `copied-pali` are shown as Pāḷi only (`copied-pali` was a copy of the Pāḷi, now \'\'); ' +
    '`partly-pali` (half or more of the words are Pāḷi) and `editor-note` (the APZ editor\'s "potential errors from here … to here" ' +
    'range, notes removed) are kept for review; `latin` and `footnote-mark` were removed.',
    '', `## BJT files without sin_apz (${missing.length}, aṭṭhakathā not counted)`, '', missing.join(' '), '')
  fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), report.join('\n'))
  fs.writeFileSync(path.join(REPORT_DIR, 'gaps.tsv'), ['file\tpage_idx\tentry_idx\tkind\tnote', ...gaps.map(g => g.join('\t'))].join('\n') + '\n')
  console.log(report.join('\n'))
  if (!WRITE) console.log('dry run - add --write to write the text-apz files')
}
main()
