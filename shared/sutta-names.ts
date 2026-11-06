/**
 * Common names of popular suttas (shared/popular-suttas.json, made by dev/popular-suttas/build.ts).
 * Many suttas are known by a name that is not their BJT title (සිඟාලෝවාද is සිගාලසුත්තං, කාලාම has only a number),
 * so title search also looks the query up in these names, and lists the popular suttas first.
 *
 * Names are compared loosely: spaces, zwj, vowel length, aspiration, ණ/න, ළ/ල and a trailing "sutta" are ignored.
 */
import { fold } from './normalize'

export interface PopularSutta { key: string; si: string[]; ro: string[]; weight: number }

const SINH_FOLD: [RegExp, string][] = [
  [/[‌‍\s]/g, ''], [/ෝ/g, 'ො'], [/ේ/g, 'ෙ'], [/ී/g, 'ි'], [/ූ/g, 'ු'], [/ණ/g, 'න'], [/ළ/g, 'ල'],
  [/ඛ/g, 'ක'], [/ඝ/g, 'ග'], [/ඡ/g, 'ච'], [/ඣ/g, 'ජ'], [/ඨ/g, 'ට'], [/ඪ/g, 'ඩ'], [/ථ/g, 'ත'], [/ධ/g, 'ද'], [/ඵ/g, 'ප'], [/භ/g, 'බ'],
  [/ඟ/g, 'ග'], [/ඞ්/g, 'ං'], [/ෂ/g, 'ස'], [/ශ/g, 'ස'],
]
// a trailing සූත්‍රය / සුත්තං / පිරිත / පරිත්තං… (after folding)
const SINH_SUFFIX = /(සුත්රය|සුත්රං|සුත්ර|සුත්තං|සුත්ත|පිරිත්|පිරිත|පරිත්තං|පරිත්ත|ජාතකය|ජාතකං)$/
const ROMAN_SUFFIX = /(sutam|sutan|suta|sutraya|sutra|sutaya|pirita|pirit|paritam|parita|jatakam|jatakaya|jataka)$/

export function sinhFold(s: string): string {
  let out = s
  for (const [re, to] of SINH_FOLD) out = out.replace(re, to)
  return out.replace(SINH_SUFFIX, '')
}

/** roman Pali/Singlish: no diacritics, aspirates, doubled letters, w/v and nasal spellings */
export function romanFold(s: string): string {
  return fold(s).replace(/[^a-z]/g, '')
    .replace(/w/g, 'v').replace(/ee/g, 'i').replace(/oo/g, 'u')
    .replace(/([bcdgjkpt])h/g, '$1').replace(/[nm](?=[^aeiouy])/g, 'n')
    .replace(/(.)\1+/g, '$1')
    .replace(ROMAN_SUFFIX, '')
}

const isRoman = (s: string) => /[a-z]/i.test(s)
const sinhLetters = (s: string) => (s.match(/[ක-ෆඅ-ඎ]/g) || []).length

/**
 * the query matches a name when it is part of the name (a query shorter than 4 only its start), or starts with the
 * name (සිඟාලෝවාදදේශනාව). Not a name anywhere in the query: සතිපට්ඨාන is not පට්ඨාන.
 */
function matches(q: string, name: string): boolean {
  if (!q || !name) return false
  return name.startsWith(q) || (q.length >= 4 && name.includes(q)) || (name.length >= 4 && q.startsWith(name))
}

export interface NameIndex { entries: PopularSutta[]; folded: { si: string[]; ro: string[] }[]; weight: Map<string, number> }

export function buildNameIndex(entries: PopularSutta[]): NameIndex {
  return {
    entries,
    folded: entries.map(e => ({ si: e.si.map(sinhFold), ro: e.ro.map(romanFold) })),
    weight: new Map(entries.map(e => [e.key, e.weight])),
  }
}

/**
 * the popular suttas whose common names match the query, most searched first.
 * candidates: Sinhala spellings of a Singlish query (singlishMatches), compared with the Sinhala names.
 */
export function matchNames(index: NameIndex, query: string, candidates: string[] = []): { key: string; name: string }[] {
  const out: { key: string; name: string; weight: number }[] = []
  const roman = isRoman(query) ? romanFold(query) : ''
  const sinh = (isRoman(query) ? candidates : [query]).map(sinhFold).filter(q => sinhLetters(q) >= 2)
  if (roman.length < 3 && !sinh.length) return []
  index.entries.forEach((e, i) => {
    const f = index.folded[i]
    let name = roman.length >= 3 ? e.ro[f.ro.findIndex(n => matches(roman, n))] : undefined
    if (!name) for (const q of sinh) { const j = f.si.findIndex(n => matches(q, n)); if (j >= 0) { name = e.si[j]; break } }
    if (name) out.push({ key: e.key, name: e.si[0] ?? name, weight: e.weight })
  })
  return out.sort((a, b) => b.weight - a.weight).map(({ key, name }) => ({ key, name }))
}
