/**
 * Dictionaries (the Go engine's dicts / dict / lookup operations, tipitaka.app server/engine/dict.go). The dictionary
 * db is in Roman script: Sinhala words are converted before a lookup and the Pali of the results converted back.
 */
import { convert } from '@pnfo/pali-converter'
import { getData } from './source'
import { isSinglishQuery, singlishMatches } from '@shared/singlish'

export interface Dict { code: string; lang: string; name: string; short: string; desc?: string; origin?: string; entries: number; optIn?: boolean; abbrevs?: Record<string, string> }
export interface DictEntry { dict: string; word: string; hom?: number; meaning: string; dist: number }
export interface DpdRoot { root: string; meaning: string; group: number; sign: string; sanskritRoot?: string; sanskritMeaning?: string }
export interface DpdHead {
  id: number; lemma: string; pos: string; grammar: string; meaning: string; meaningLit?: string; meaning2?: string; construction?: string
  rootKey?: string; rootBase?: string; derivedFrom?: string; sanskrit?: string; plusCase?: string; compoundType?: string
  compoundConstruction?: string; notes?: string; stem?: string; pattern?: string; example?: string; source?: string; sutta?: string
  ebtCount: number; root?: DpdRoot
}
export interface Breakup { word: string; type: string; origin: string; parts: [string, number][] }
export interface DictResult {
  word: string; entries: DictEntry[]; dpd: DpdHead[]; breakups: Breakup[]
  grammar?: [string, string, string][]; deconstructor?: string[]; spelling?: string; see?: string; abbrev?: string
}

/** Sinhala (or mixed) Pali -> lower case Roman, as stored in the dictionary db */
export const toRoman = (s: string) => convert(s.replace(/[‍‌]/g, ''), 'latn', 'sinh').toLowerCase()
/** Roman Pali -> Sinhala script (lk's spelling: no joiners) */
export const toSinh = (s: string) => convert(s, 'sinh', 'latn').replace(/‍/g, '')

/** a clicked word of the text: punctuation and quotes removed */
export const cleanInlineWord = (text: string) => text.replace(/[\.,:;\?!\(\)“”‘’'"\-–]/g, '').trim()

const params = (w: string, dicts: string[], limit: number) => ({ w, limit, ...(dicts.length ? { dicts: dicts.join(',') } : {}) })

export const listDicts = () => getData().op<Dict[]>('dicts')

/** a word as it occurs in the text: DPD analysis of the form + dictionary entries (of its headwords) */
export function lookupWord(sinhWord: string, dicts: string[], limit = 20): Promise<DictResult> {
  return getData().op<DictResult>('lookup', params(toRoman(cleanInlineWord(sinhWord)), dicts, limit))
}

/**
 * a typed word: Sinhala, Roman (diacritics optional) or singlish. Latin input is first looked up as Roman Pali,
 * then as the most likely Sinhala spellings of the singlish (the first that finds something)
 */
export async function searchWord(input: string, dicts: string[], limit = 100): Promise<DictResult> {
  const q = input.trim()
  const run = (w: string) => getData().op<DictResult>('dict', params(w, dicts, limit))
  if (!isSinglishQuery(q)) return run(toRoman(q))
  const first = await run(q.toLowerCase())
  if (hasResults(first)) return first
  for (const s of (await singlishMatches(q, 5)).slice(0, 5)) {
    const r = await run(toRoman(s))
    if (hasResults(r)) return r
  }
  return first
}

export const hasResults = (r: DictResult) => !!(r.entries.length || r.dpd.length || r.breakups.length || r.grammar?.length)

/** the Sinhala name of a dictionary language */
export const langName = (code: string) => ({ en: 'English', si: 'සිංහල' } as Record<string, string>)[code] ?? code
