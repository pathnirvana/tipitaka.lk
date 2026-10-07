/** sutta name search over the title index (v2 TSearch.vue getSearchResults) */
import { isSinglishQuery, singlishMatches } from '@shared/singlish'
import { normalizeTitle } from '@shared/normalize'
import { FILTER_KEYS } from '@shared/constants'
import type { EInd } from '@shared/routes'
import type { TitleRow } from './types'

export interface TitleResult { key: string; language: 'pali' | 'sinh'; eInd: EInd; type: null }

export async function titleSearch(index: readonly TitleRow[], input: string, filter: { keys: string[]; columns: number[] }, maxResults = 100): Promise<TitleResult[]> {
  const query = normalizeTitle(input)
  let words: string[] = isSinglishQuery(query) ? await singlishMatches(query) : []
  if (!words.length) words = [query]
  const re = new RegExp(words.map(normalizeTitle).join('|'), 'i')
  // filter by the top level group of each node (v2 prefix match also matched an-10 for an-1 - A5)
  const groups = new Set(filter.keys.map(k => (FILTER_KEYS as readonly string[]).indexOf(k)))
  const out: TitleResult[] = []
  for (let i = 0; i < index.length && out.length < maxResults; i++) {
    const n = index[i]
    if (!groups.has(n.grp)) continue
    // names are compared without zwj on both sides (v2 removed it from the query only - A32)
    const matchPali = filter.columns.includes(0) && re.test(normalizeTitle(n.pali))
    if (matchPali || (filter.columns.includes(1) && re.test(normalizeTitle(n.sinh)))) {
      out.push({ key: n.key, language: matchPali ? 'pali' : 'sinh', eInd: [n.page_idx, n.entry_idx], type: null })
    }
  }
  return out
}
