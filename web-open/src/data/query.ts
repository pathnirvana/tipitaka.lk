/**
 * Search words typed in any script -> the words of the index. The full text index (text.db fts) holds the text as
 * tipitaka.lk stores it, in Sinhala script, so a query is converted to it:
 *  - a word in another script, or in Roman with diacritics (nibbāna), is that word
 *  - a Roman word without diacritics (nibbana) may stand for several: a → a ā, n → n ṇ ṅ ñ, t → t ṭ ... The spellings
 *    that occur in the texts are found through the index vocabulary (fts.vocab), as tipitaka.lk does for Singlish.
 */
import { convertMixed } from '@pnfo/pali-converter'
import { getData } from '@/data/source'
import { joinList } from '@shared/constants'
import { cleanFtsInput, ftsTerm, type FtsTerm } from '@shared/fts-query'
import { fold } from '@shared/normalize'

/** Roman letters only: read without regard to diacritics */
export const isFolded = (word: string) => /^[a-z]+$/i.test(word)

/** a word in any script in Sinhala script; Pāḷi has only the short e and o (Roman ē ō, and the long signs of the scripts) */
export function toSinhala(word: string): string {
  return convertMixed(word.replace(/ē/g, 'e').replace(/ō/g, 'o').replace(/Ē/g, 'E').replace(/Ō/g, 'O'), 'sinh').trim()
}
/** as a term of the index. A word typed up to a consonant (nibb) ends in a hal sign in Sinhala script, which the longer
 *  words do not have at that place (නිබ්බ් / නිබ්බාන): a prefix is searched without it */
function sinhTerm(word: string, prefix: boolean): FtsTerm | null {
  const s = toSinhala(word)
  return ftsTerm(prefix ? s.replace(/්$/, '') : s, prefix)
}

const VARIANTS: Record<string, string[]> = { a: ['a', 'ā'], i: ['i', 'ī'], u: ['u', 'ū'], n: ['n', 'ṇ', 'ṅ', 'ñ'], t: ['t', 'ṭ'],
  d: ['d', 'ḍ'], l: ['l', 'ḷ'], m: ['m', 'ṃ'] }
const PRUNE_AT = 16

async function vocab(words: string[], prefix: boolean): Promise<Map<string, number>> {
  const uniq = [...new Set(words)].filter(Boolean)
  if (!uniq.length) return new Map()
  const rows = await getData().query<{ word: string; docs: number }>('fts.vocab', { words: joinList(uniq), prefix: prefix ? 1 : 0 })
  return new Map(rows.filter(r => r.docs > 0).map(r => [r.word, r.docs]))
}

/**
 * the spellings of a Roman word without diacritics that occur in the texts, the most frequent first. The spellings are
 * built letter by letter; when there are many, the ones no word of the texts starts with are dropped.
 */
export async function expandFolded(word: string, prefix: boolean, max: number): Promise<FtsTerm[]> {
  const letters = [...word.toLowerCase()]
  let cands = ['']
  for (let i = 0; i < letters.length; i++) {
    const vs = VARIANTS[letters[i]] ?? [letters[i]]
    cands = cands.flatMap(c => vs.map(v => c + v))
    // not before an h: t + h is one letter (ථ), which the word so far (ත) is not the start of
    if (cands.length > PRUNE_AT && i < letters.length - 1 && letters[i + 1] !== 'h') {
      const terms = cands.map(c => sinhTerm(c, true)?.text ?? '')
      const found = await vocab(terms, true)
      cands = cands.filter((_, k) => found.has(terms[k]))
      if (!cands.length) return []
    }
  }
  const terms = cands.map(c => sinhTerm(c, prefix)).filter((t): t is FtsTerm => !!t)
  const found = await vocab(terms.map(t => t.text), prefix)
  const kept: FtsTerm[] = []
  for (const t of [...new Map(terms.map(t => [t.text, t])).values()].filter(t => found.has(t.text)).sort((a, b) => found.get(b.text)! - found.get(a.text)!)) {
    if (kept.length >= max) break
    if (t.prefix && kept.some(k => t.text.startsWith(k.text))) continue // covered by a kept prefix
    kept.push(t)
  }
  return kept
}

export interface Expansion {
  /** the alternatives of each word of the query */
  slots: FtsTerm[][]
  /** words without any word in the texts */
  missing: string[]
  /** some word was read without regard to diacritics */
  folded: boolean
}
export async function expandQuery(input: string, prefix: boolean): Promise<Expansion> {
  const words = cleanFtsInput(input).split(' ').filter(Boolean)
  const perWord = words.length === 1 ? 8 : 4 // alternatives per word (the phrases / near groups multiply)
  const out: Expansion = { slots: [], missing: [], folded: false }
  for (const w of words) {
    if (!isFolded(w)) {
      const t = sinhTerm(w, prefix)
      if (t) out.slots.push([t])
      continue
    }
    out.folded = true
    const alts = await expandFolded(w, prefix, perWord)
    if (alts.length) out.slots.push(alts)
    else out.missing.push(w)
  }
  return out
}

/** a query with operators (AND OR * ^): its words in Sinhala script as typed, the operators kept */
export function advancedToSinhala(input: string): string {
  return input.split(/(\s+|[*^()])/).map(p => (!p || /^(\s+|[*^()]|AND|OR|NOT)$/.test(p) ? p : toSinhala(p))).join('')
}

// ---- titles ----
/** a title in Roman, lower case (ro) and without diacritics (fo) */
export const romanTitle = (roman: string) => { const ro = roman.toLowerCase().replace(/[‌‍]/g, ''); return { ro, fo: fold(ro) } }
/** the query of a title search: in Roman, compared without diacritics when it has none */
export function titleQuery(input: string): { q: string; folded: boolean } {
  const q = convertMixed(input.trim(), 'latn').toLowerCase().replace(/ē/g, 'e').replace(/ō/g, 'o')
  return { q, folded: fold(q) === q }
}
