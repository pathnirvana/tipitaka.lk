/** sutta name search over the title index (v2 TSearch.vue getSearchResults) */
import { isSinglishQuery, singlishMatches } from '@shared/singlish'
import { normalizeTitle } from '@shared/normalize'
import { FILTER_KEYS } from '@shared/constants'
import { buildNameIndex, matchNames, type NameIndex, type PopularSutta } from '@shared/sutta-names'
import popularSuttas from '@shared/popular-suttas.json'
import type { EInd } from '@shared/routes'
import type { TitleRow } from './types'

/** alias: the common name a sutta was found by when its title does not match (සිඟාලෝවාද for සිගාලසුත්තං) */
export interface TitleResult { key: string; language: 'pali' | 'sinh'; eInd: EInd; type: null; alias?: string }

let names: NameIndex | undefined
const byKeyCache = new WeakMap<readonly TitleRow[], Map<string, TitleRow>>()

export async function titleSearch(index: readonly TitleRow[], input: string, filter: { keys: string[]; columns: number[] }, maxResults = 100): Promise<TitleResult[]> {
  const query = normalizeTitle(input)
  const candidates: string[] = isSinglishQuery(query) ? await singlishMatches(query) : []
  const words = candidates.length ? candidates : [query]
  const re = new RegExp(words.map(normalizeTitle).join('|'), 'i')
  // filter by the top level group of each node (v2 prefix match also matched an-10 for an-1 - A5)
  const groups = new Set(filter.keys.map(k => (FILTER_KEYS as readonly string[]).indexOf(k)))
  names ??= buildNameIndex(popularSuttas as PopularSutta[])
  let byKey = byKeyCache.get(index)
  if (!byKey) byKeyCache.set(index, byKey = new Map(index.map(n => [n.key, n])))

  // names are compared without zwj on both sides (v2 removed it from the query only - A32)
  const titleMatch = (n: TitleRow): 'pali' | 'sinh' | null =>
    filter.columns.includes(0) && re.test(normalizeTitle(n.pali)) ? 'pali' : filter.columns.includes(1) && re.test(normalizeTitle(n.sinh)) ? 'sinh' : null

  // 1. suttas known by a name the query matches, most searched first (the name is shown when the title does not match)
  const out: TitleResult[] = [], seen = new Set<string>()
  for (const { key, name } of matchNames(names, input, candidates)) {
    const n = byKey.get(key)
    if (!n || !groups.has(n.grp)) continue
    const language = titleMatch(n)
    out.push({ key, language: language || 'pali', eInd: [n.page_idx, n.entry_idx], type: null, ...(language ? {} : { alias: name }) })
    seen.add(key)
  }
  // 2. title matches: the popular suttas first, then the rest in tree order
  const popular: TitleResult[] = [], rest: TitleResult[] = []
  for (let i = 0; i < index.length && rest.length < maxResults; i++) {
    const n = index[i]
    if (!groups.has(n.grp) || seen.has(n.key)) continue
    const language = titleMatch(n)
    if (language) {
      const r: TitleResult = { key: n.key, language, eInd: [n.page_idx, n.entry_idx], type: null }
      if (names.weight.has(n.key)) popular.push(r)
      else rest.push(r)
    }
  }
  popular.sort((a, b) => names!.weight.get(b.key)! - names!.weight.get(a.key)!)
  return [...out, ...popular, ...rest].slice(0, maxResults)
}
