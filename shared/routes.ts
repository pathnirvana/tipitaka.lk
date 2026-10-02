/** URL helpers. The URL formats are part of the public contract (shared links) - do not change them. */
import type { Language } from './constants'

export type EInd = [number, number] // [pageIdx, entryIdx] - 0-based indexes into pages[] and pali.entries[]

export const SITE = 'https://tipitaka.lk'

export function parseEIndStr(str?: string | null): EInd | null {
  if (!str) return null
  const parts = str.split('-')
  if (parts.length !== 2) return null
  return [parseInt(parts[0]) || 0, parseInt(parts[1]) || 0]
}
export const eIndStr = (e: EInd) => `${e[0]}-${e[1]}`
export const eIndEquals = (a?: EInd | null, b?: EInd | null) => !!a && !!b && a[0] === b[0] && a[1] === b[1]
export const eIndLessEqual = (a: EInd, b: EInd) => a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])

export const isLanguage = (s: unknown): s is Language => s === 'pali' || s === 'sinh'

/** link copied from the entry menu (v2 TextEntry.vue linkToEntry) */
export function entryLink(key: string, eInd: EInd, language: Language, isHeading: boolean) {
  return isHeading ? `${SITE}/${key}/${language}` : `${SITE}/${key}/${eIndStr(eInd)}/${language}`
}
export const fullLink = (link: string) => (link.startsWith('http') ? link : SITE + link)

export interface FtsUrlOptions { exactWord: number; matchPhrase: number; wordDistance: number }
export const defaultFtsOptions = (): FtsUrlOptions => ({ exactWord: 0, matchPhrase: 0, wordDistance: 10 })
export function parseFtsOptions(str?: string | null): FtsUrlOptions {
  const o = defaultFtsOptions()
  if (!str) return o
  const [a, b, c] = str.split('-').map(x => parseInt(x))
  return { exactWord: isNaN(a) ? o.exactWord : a, matchPhrase: isNaN(b) ? o.matchPhrase : b, wordDistance: isNaN(c) ? o.wordDistance : c }
}
export const ftsLink = (input: string, o: FtsUrlOptions) =>
  `/fts/${input.replace(/\s/g, '%20')}/${[o.exactWord, o.matchPhrase, o.wordDistance].join('-')}`

/** key used for bookmarks (v2 entryToKeyStr) and audio (entryToAudioKey) */
export const bookmarkKey = (key: string, eInd: EInd, language: Language) => `${key}:${eInd.join('-')}:${language}`
