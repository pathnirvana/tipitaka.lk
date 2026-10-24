/**
 * Builds the FTS4 MATCH expression from the search box input (port of src/views/FTS.vue ftsMatchClause).
 * Only syntax supported by SQLite builds WITHOUT SQLITE_ENABLE_FTS3_PARENTHESIS is emitted (Android's
 * framework SQLite): terms, prefix `w*`, `^w`, "phrase", NEAR/n, OR and implicit AND.
 */
import { normalizeForSearch } from './normalize'

export interface FtsOptions { exactWord: number; matchPhrase: number; wordDistance: number }
export interface FtsTerm { text: string; prefix: boolean }
/**
 * what is highlighted: each term on its own, the terms as a phrase (in order, next to each other) or near each other.
 * slots: the alternatives of each word of a phrase / near search (the sinhala spellings of a singlish word)
 */
export interface FtsHighlight { terms: FtsTerm[]; mode: 'terms' | 'phrase' | 'near'; distance: number; slots?: FtsTerm[][] }
export type FtsBuild = { ok: true; match: string; terms: FtsTerm[]; highlight: FtsHighlight } | { ok: false; error: string }

export const FTS_MESSAGES = {
  empty: 'සෙවීම සඳහා වචන ඇතුල් කරන්න.',
  short: 'අවම වශයෙන් අකුරු 2 ක් ඇතුල් කරන්න.',
  singlishAdvanced: 'AND, OR, * සහ ^ සමඟ සිංහල අකුරු පමණක් භාවිතා කරන්න.',
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
  if (/[^a-z඀-෿‍\*\^\(\) ]/i.test(v)) return FTS_MESSAGES.chars
  // singlish (latin letters, expanded to the sinhala words of the index) only in the simple searches
  if (isAdvancedQuery(v) && /[a-z]/i.test(v.replace(OPERATORS, ''))) return FTS_MESSAGES.singlishAdvanced
  return ''
}

const OPERATORS = /\b(AND|OR|NOT)\b/g
/** operators: the upper case words AND OR NOT (not inside a singlish word: "ORuva"), * ^ ( ) */
export const isAdvancedQuery = (v: string) => /\b(AND|OR|NOT)\b|[\*\^\(\)]/.test(v)
/** singlish words (latin letters) in a simple search */
export const hasSinglish = (v: string) => !isAdvancedQuery(v) && /[a-z]/i.test(v)

// a prefix term must have at least 2 letters, otherwise it would match a huge part of the index
const prefixOk = (w: string) => [...w].length >= 2

/** the search term of a sinhala word (normalised as in the index) */
export const ftsTerm = (word: string, prefix: boolean): FtsTerm | null => termFrom(word, prefix)?.term ?? null
const exprOf = (t: FtsTerm) => t.text + (t.prefix ? '*' : '')

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
    if (/\bNOT\b|[\(\)]/.test(input)) return { ok: false, error: FTS_MESSAGES.unsupported }
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
    return { ok: true, match: parts.join(' '), terms, highlight: { terms, mode: 'terms', distance: 0 } }
  }

  const words = input.split(' ').map(w => termFrom(w, !opts.exactWord)).filter((t): t is NonNullable<typeof t> => !!t)
  if (!words.length) return { ok: false, error: FTS_MESSAGES.invalid }
  words.forEach(w => terms.push(w.term))
  let match = words[0].expr
  const highlight: FtsHighlight = { terms, mode: 'terms', distance: 0 }
  if (words.length > 1) {
    const d = Math.max(0, Math.min(100, Math.floor(opts.wordDistance) || 0))
    match = opts.matchPhrase ? `"${words.map(w => w.expr).join(' ')}"` : words.map(w => w.expr).join(` NEAR/${d} `)
    Object.assign(highlight, opts.matchPhrase ? { mode: 'phrase' } : { mode: 'near', distance: d })
  }
  return { ok: true, match, terms, highlight }
}

/** at most this many phrases / near groups for singlish words with alternatives */
export const MAX_COMBOS = 64

/**
 * the MATCH of a simple search whose words have alternatives (slots: the sinhala spellings of singlish words that occur
 * in the index). OR only at the top level: NEAR and phrases bind tighter than OR in both the standard (Android) and the
 * enhanced query syntax, an AND of ORs would need parentheses
 */
export function buildMatchSlots(slots: FtsTerm[][], opts: FtsOptions): FtsBuild {
  if (!slots.length || slots.some(sl => !sl.length)) return { ok: false, error: FTS_MESSAGES.invalid }
  const terms = [...new Map(slots.flat().map(t => [exprOf(t), t])).values()]
  const highlight: FtsHighlight = { terms, mode: 'terms', distance: 0, slots }
  if (slots.length === 1) return { ok: true, match: slots[0].map(exprOf).join(' OR '), terms, highlight }
  const d = Math.max(0, Math.min(100, Math.floor(opts.wordDistance) || 0))
  const combos: FtsTerm[][] = []
  const walk = (i: number, acc: FtsTerm[]) => {
    if (combos.length >= MAX_COMBOS) return
    if (i === slots.length) { combos.push(acc); return }
    for (const t of slots[i]) walk(i + 1, [...acc, t])
  }
  walk(0, [])
  const match = combos.map(c => (opts.matchPhrase ? `"${c.map(exprOf).join(' ')}"` : c.map(exprOf).join(` NEAR/${d} `))).join(' OR ')
  Object.assign(highlight, opts.matchPhrase ? { mode: 'phrase' } : { mode: 'near', distance: d })
  return { ok: true, match, terms, highlight }
}

const termMatch = (word: string, t: FtsTerm) => (t.prefix ? word.startsWith(t.text) : word === t.text)
/** does a normalised word match one of the query terms */
export const termMatches = (word: string, terms: FtsTerm[]) => terms.some(t => termMatch(word, t))

/**
 * indexes of the (normalised) words to highlight: with a phrase only the words of a complete phrase, with near only
 * term words that have every other term within the distance (FTS4 NEAR/n: at most n words between, any order).
 * Falls back to every term word when nothing matches that way, so a result never shows without a highlight.
 */
export function highlightIndexes(words: string[], hl: FtsHighlight): number[] {
  const { terms } = hl
  const slots = hl.slots ?? terms.map(t => [t]) // the alternatives of each word
  const any = words.map((w, i) => (termMatches(w, terms) ? i : -1)).filter(i => i >= 0)
  if (hl.mode === 'terms' || slots.length < 2) return any
  const hits = new Set<number>()
  if (hl.mode === 'phrase') {
    for (let i = 0; i + slots.length <= words.length; i++)
      if (slots.every((sl, j) => termMatches(words[i + j], sl))) slots.forEach((_, j) => hits.add(i + j))
  } else {
    const at = slots.map(sl => words.map((w, i) => (termMatches(w, sl) ? i : -1)).filter(i => i >= 0))
    // a chain "a NEAR/n b NEAR/n c" can span (n + 1) words per step
    slots.forEach((_, j) => at[j].forEach(i => {
      if (slots.every((_, k) => k === j || at[k].some(x => x !== i && Math.abs(x - i) <= (hl.distance + 1) * Math.abs(k - j)))) hits.add(i)
    }))
  }
  return hits.size ? [...hits].sort((a, b) => a - b) : any
}
