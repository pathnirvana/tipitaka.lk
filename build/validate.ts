/**
 * Corpus validation: port of dev/error-check-text.js plus extra checks.
 * errors fail the build; warnings are reported and compared with build/validation-baseline.json.
 */
import type { JFile } from './corpus'
import { getHeadings } from './tree'
import { parseFootnote } from '../shared/footnote'

export interface Issue { file: string; code: string; where: string; msg: string }
export interface ValidationResult { errors: Issue[]; warnings: Issue[] }

const ENTRY_TYPES = new Set(['centered', 'heading', 'paragraph', 'gatha', 'unindented'])
const count = (s: string, sub: string) => s.split(sub).length - 1

export function validateCorpus(files: JFile[], names: string[]): ValidationResult {
  const errors: Issue[] = [], warnings: Issue[] = []
  files.forEach((obj, i) => {
    const file = names[i]
    const err = (code: string, where: string, msg: string) => errors.push({ file, code, where, msg })
    const warn = (code: string, where: string, msg: string) => warnings.push({ file, code, where, msg })
    if (obj.filename !== file) err('filename', '', `filename field '${obj.filename}' does not match the file name`)
    if (!obj.bookId || obj.bookId < 1 || obj.bookId > 57) err('bookId', '', `bad bookId ${obj.bookId}`)
    if (typeof obj.pageOffset !== 'number') err('pageOffset', '', `pageOffset is not a number`)
    if (!Array.isArray(obj.pages) || !obj.pages.length) { err('pages', '', 'no pages'); return }
    if (obj.collection === undefined) warn('collection', '', 'collection missing')
    const paliOnly = /^ap-pat/.test(file)
    const pageNumbers = obj.pages.map(p => parseInt(String(p.pageNum)))
    if (pageNumbers.some(n => !n)) err('pageNum', '', 'pageNum not a number')
    const inc = paliOnly ? 1 : 2
    for (let k = 0; k < pageNumbers.length - 1; k++) {
      if (pageNumbers[k + 1] - pageNumbers[k] !== inc) err('pageOrder', `p${k}`, `page numbers ${pageNumbers[k]}:${pageNumbers[k + 1]} not in order`)
    }
    obj.pages.forEach((p, pi) => {
      for (const lang of ['pali', 'sinh'] as const) {
        const side = p[lang]
        if (!side || !Array.isArray(side.entries) || !Array.isArray(side.footnotes)) { err('side', `${pi}`, `${lang} entries/footnotes missing`); continue }
        side.entries.forEach((e, ei) => {
          const where = `${pi}-${ei}:${lang}`
          if (!ENTRY_TYPES.has(e.type)) err('type', where, `unknown entry type '${e.type}'`)
          if (typeof e.text !== 'string') err('text', where, 'text is not a string')
          if (e.type !== 'heading' && 'keyOffset' in e) err('keyOffset', where, 'keyOffset on a non heading entry')
          const t = e.text || ''
          if (count(t, '**') % 2) warn('unbalancedBold', where, 'odd number of **')
          if (count(t, '__') % 2) warn('unbalancedUnderline', where, 'odd number of __')
          if (/[<>|℗]|&[a-z]+;/.test(t)) warn('specialChars', where, `html-like or special chars: ${(t.match(/<[^>]*>|&[a-z]+;|[|℗]/g) || []).join(' ')}`)
        })
        const labels = new Set(side.footnotes.map(f => parseFootnote(f.text).number))
        side.footnotes.forEach((f, fi) => { if (!parseFootnote(f.text).number) warn('footnoteFormat', `${pi}-f${fi}:${lang}`, 'footnote does not start with a label') })
        const refs = new Set<string>()
        side.entries.forEach((e, ei) => {
          for (const m of (e.text || '').matchAll(/\{([^}\n]+)\}/g)) {
            refs.add(m[1])
            if (!labels.has(m[1])) warn('footnoteRef', `${pi}-${ei}:${lang}`, `footnote {${m[1]}} not found on the page`)
          }
        })
        labels.forEach(l => { if (l && !refs.has(l)) warn('footnoteUnused', `${pi}:${lang}`, `footnote ${l} is not referenced`) })
      }
      if (!p.pali.entries.length) err('emptyPage', `${pi}`, 'pali page is empty')
      if (!paliOnly) {
        if (p.pali.entries.length !== p.sinh.entries.length) err('entryCount', `${pi}`, `pali ${p.pali.entries.length} and sinh ${p.sinh.entries.length} entry counts differ`)
        p.pali.entries.forEach((pe, ei) => {
          const se = p.sinh.entries[ei]
          if (!se) return
          if (pe.type !== se.type && !(pe.type === 'gatha' && se.type === 'paragraph')) warn('typeMismatch', `${pi}-${ei}`, `pali ${pe.type} vs sinh ${se.type}`)
          else if (pe.type === se.type && pe.type !== 'gatha' && (pe.level || 0) !== (se.level || 0)) warn('levelMismatch', `${pi}-${ei}`, `pali level ${pe.level} vs sinh ${se.level}`)
        })
      }
    })
    if (paliOnly) return
    const headings = getHeadings(obj.pages, 'pali'), sinhHeadings = getHeadings(obj.pages, 'sinh')
    if (headings.length !== sinhHeadings.length) err('headingCount', '', `pali ${headings.length} and sinh ${sinhHeadings.length} heading counts differ`)
    headings.forEach((h, ind) => {
      const s = sinhHeadings[ind]
      if (!s) return
      if (h.pi !== s.pi || h.ei !== s.ei || h.level !== s.level) err('headingAlign', `${h.pi}-${h.ei}`, 'pali and sinh headings are not aligned')
      if (!h.text.trim() || !s.text.trim()) err('emptyHeading', `${h.pi}-${h.ei}`, 'empty heading')
    })
  })
  return { errors, warnings }
}

/** baseline: counts per file+code. Only increases fail the build. */
export type Baseline = Record<string, number>
export const baselineKey = (i: Issue) => `${i.file}|${i.code}`
export function toBaseline(issues: Issue[]): Baseline {
  const b: Baseline = {}
  for (const i of issues) b[baselineKey(i)] = (b[baselineKey(i)] || 0) + 1
  return Object.fromEntries(Object.entries(b).sort(([a], [c]) => a.localeCompare(c)))
}
export function newWarnings(issues: Issue[], baseline: Baseline): string[] {
  const cur = toBaseline(issues)
  return Object.entries(cur).filter(([k, n]) => n > (baseline[k] || 0)).map(([k, n]) => `${k}: ${n} (baseline ${baseline[k] || 0})`)
}
