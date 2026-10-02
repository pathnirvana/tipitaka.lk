/**
 * Full text search over the contentless FTS4 index (v2 FTS.vue getSearchResults/buildResults).
 * Ranking: hits from matchinfo('x') / log2(text length); snippets and highlights are built client side.
 */
import { getData } from './source'
import type { FtsCandidate, FtsText } from './types'
import { buildSnippet } from '@shared/highlight'
import { beautifyFTSText, type LetterOptions } from '@shared/beautify'
import { joinList, TYPES } from '@shared/constants'
import type { FtsTerm } from '@shared/fts-query'
import type { EInd } from '@shared/routes'

export const CANDIDATE_LIMIT = 2000
export const MAX_RESULTS = 100

export interface FtsItem { key: string; eInd: EInd; language: 'pali' | 'sinh'; hText: string; numMatches: number; textLength: number; type: string; file: string }
export interface FtsGroup { key: string; items: FtsItem[]; numMatches: number }
export interface FtsResults { groups: FtsGroup[]; total: number; shown: number }

/** sum of "hits in this row" over the phrases of matchinfo 'x' (3 little endian uint32 per phrase and column) */
export function matchHits(miHex: string): number {
  let sum = 0
  for (let i = 0; i + 8 <= miHex.length; i += 24) {
    const b = miHex.slice(i, i + 8)
    sum += parseInt(b.slice(6, 8) + b.slice(4, 6) + b.slice(2, 4) + b.slice(0, 2), 16)
  }
  return sum
}
export const rankOf = (numMatches: number, len: number) => numMatches / Math.log2(Math.max(len, 2))

export async function runFts(match: string, terms: FtsTerm[], lang: 0 | 1 | 2, groups: number[] | null, letters: LetterOptions): Promise<FtsResults> {
  const g = groups ? joinList(groups) : ''
  const [cands, count] = await Promise.all([
    getData().query<FtsCandidate>('fts.candidates', { q: match, lang, groups: g, limit: CANDIDATE_LIMIT }),
    getData().query<{ n: number }>('fts.count', { q: match, lang, groups: g }),
  ])
  const ranked = cands.map(c => ({ c, hits: matchHits(c.mi) })).sort((a, b) => rankOf(b.hits, b.c.len) - rankOf(a.hits, a.c.len)).slice(0, MAX_RESULTS)
  const ids = [...new Set(ranked.map(r => Math.floor(r.c.d / 2)))]
  const texts = new Map((ids.length ? await getData().query<FtsText>('fts.texts', { ids: joinList(ids) }) : []).map(t => [t.id, t]))
  const byKey = new Map<string, FtsGroup>()
  for (const { c, hits } of ranked) {
    const t = texts.get(Math.floor(c.d / 2))
    if (!t) continue
    const language = c.d % 2 ? 'sinh' : 'pali'
    const snip = buildSnippet(language === 'pali' ? t.p_text : t.s_text, terms)
    const item: FtsItem = { key: t.node_key, eInd: [t.page_idx, t.entry_idx], language, hText: beautifyFTSText(snip.html, language, letters),
      numMatches: hits, textLength: c.len, type: TYPES[t.p_type], file: t.file }
    const grp = byKey.get(item.key) || { key: item.key, items: [], numMatches: 0 }
    grp.items.push(item)
    grp.numMatches += hits
    byKey.set(item.key, grp)
  }
  const out = [...byKey.values()]
  for (const grp of out) grp.items.sort((a, b) => rankOf(b.numMatches, b.textLength) - rankOf(a.numMatches, a.textLength))
  out.sort((a, b) => b.numMatches - a.numMatches)
  return { groups: out, total: count[0]?.n || 0, shown: ranked.length }
}
