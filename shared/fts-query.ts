/**
 * Builds the FTS4 MATCH expression from the search box input (port of src/views/FTS.vue ftsMatchClause).
 * Only syntax supported by SQLite builds WITHOUT SQLITE_ENABLE_FTS3_PARENTHESIS is emitted (Android's
 * framework SQLite): terms, prefix `w*`, `^w`, "phrase", NEAR/n, OR and implicit AND.
 */
import { normalizeForSearch } from './normalize'

export interface FtsOptions { exactWord: number; matchPhrase: number; wordDistance: number }
export interface FtsTerm { text: string; prefix: boolean }
export type FtsBuild = { ok: true; match: string; terms: FtsTerm[] } | { ok: false; error: string }

export const FTS_MESSAGES = {
  empty: 'සෙවීම සඳහා වචන ඇතුල් කරන්න.',
  short: 'අවම වශයෙන් අකුරු 2 ක් ඇතුල් කරන්න.',
  latin: 'අන්තර්ගතය සෙවීමේදී සිංහල අකුරු පමණක් භාවිතා කරන්න.',
  chars: 'සෙවුම් පදය සඳහා ඉංග්‍රීසි සහ සිංහල අකුරු පමණක් යොදන්න.',
  unsupported: 'NOT සහ වරහන් () භාවිතා කළ නොහැක. OR හෝ හිස්තැන් (AND) පමණක් යොදන්න.',
  invalid: 'සෙවුම් පදය වැරදියි. කරුණාකර නැවත උත්සාහ කරන්න.',
}

/** cleanup applied to the raw search box text (same as v2) */
export const cleanFtsInput = (input: string) => input.trim().replace(/[‍\.,]/g, '').replace(/\s+/g, ' ')

/** v2 searchBarRules - returns '' when valid */
export function ftsInputError(v: string): string {
  if (!v) return FTS_MESSAGES.empty
  if (v.length < 2) return FTS_MESSAGES.short
  if (/[a-z]/i.test(v) && !/AND|OR|NOT/.test(v)) return FTS_MESSAGES.latin
  if (/[^a-z඀-෿‍\*\^\(\) ]/i.test(v)) return FTS_MESSAGES.chars
  return ''
}

export const isAdvancedQuery = (v: string) => /AND|OR|NOT|[\*\^\(\)]/.test(v)

// a prefix term must have at least 2 letters, otherwise it would match a huge part of the index
const prefixOk = (w: string) => [...w].length >= 2

function termFrom(word: string, prefix: boolean, caret = false): { expr: string; term: FtsTerm } | null {
  const norm = normalizeForSearch(word)
  if (!norm || norm.includes(' ')) return null
  const p = prefix && prefixOk(norm)
  return { expr: (caret ? '^' : '') + norm + (p ? '*' : ''), term: { text: norm, prefix: p } }
}

export function buildMatch(rawInput: string, opts: FtsOptions): FtsBuild {
  const input = cleanFtsInput(rawInput)
  const err = ftsInputError(input)
  if (err) return { ok: false, error: err }
  const terms: FtsTerm[] = []

  if (isAdvancedQuery(input)) {
    if (/NOT|[\(\)]/.test(input)) return { ok: false, error: FTS_MESSAGES.unsupported }
    const parts: string[] = []
    let lastWasOp = true
    for (const tok of input.split(' ')) {
      if (tok === 'AND') continue // implicit AND
      if (tok === 'OR') {
        if (lastWasOp) return { ok: false, error: FTS_MESSAGES.invalid }
        parts.push('OR'); lastWasOp = true; continue
      }
      const m = /^(\^?)([^\*\^]+)(\*?)$/.exec(tok)
      if (!m) return { ok: false, error: FTS_MESSAGES.invalid }
      const t = termFrom(m[2], !!m[3], !!m[1])
      if (!t) return { ok: false, error: FTS_MESSAGES.invalid }
      parts.push(t.expr); terms.push(t.term); lastWasOp = false
    }
    if (lastWasOp || !terms.length) return { ok: false, error: FTS_MESSAGES.invalid }
    return { ok: true, match: parts.join(' '), terms }
  }

  const words = input.split(' ').map(w => termFrom(w, !opts.exactWord)).filter((t): t is NonNullable<typeof t> => !!t)
  if (!words.length) return { ok: false, error: FTS_MESSAGES.invalid }
  words.forEach(w => terms.push(w.term))
  let match = words[0].expr
  if (words.length > 1) {
    const d = Math.max(0, Math.min(100, Math.floor(opts.wordDistance) || 0))
    match = opts.matchPhrase ? `"${words.map(w => w.expr).join(' ')}"` : words.map(w => w.expr).join(` NEAR/${d} `)
  }
  return { ok: true, match, terms }
}

/** does a normalised word match one of the query terms */
export const termMatches = (word: string, terms: FtsTerm[]) =>
  terms.some(t => (t.prefix ? word.startsWith(t.text) : word === t.text))
