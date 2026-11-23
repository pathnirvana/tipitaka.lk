/** title search (web/src/data/title.ts for other scripts): the titles of the mūla texts are compared in Roman, without
 * diacritics unless the query has them (tipitaka.app); the suttas known by a common name first (shared/sutta-names) */
import { convert } from '@pnfo/pali-converter'
import { FILTER_KEYS } from '@shared/constants'
import { buildNameIndex, matchNames, type NameIndex, type PopularSutta } from '@shared/sutta-names'
import popularSuttas from '@shared/popular-suttas.json'
import type { EInd } from '@shared/routes'
import type { TitleRow } from '@/data/types'
import { romanTitle, titleQuery } from './query'

export interface TitleHit { key: string; eInd: EInd; alias?: string }
interface Indexed { row: TitleRow; ro: string; fo: string }

let names: NameIndex | undefined
const cache = new WeakMap<readonly TitleRow[], Indexed[]>()
function indexed(index: readonly TitleRow[]): Indexed[] {
  let out = cache.get(index)
  if (!out) cache.set(index, out = index.filter(n => !/^(atta|anya)/.test(FILTER_KEYS[n.grp] ?? 'anya')).map(row => ({ row, ...romanTitle(convert(row.pali, 'latn', 'sinh')) })))
  return out
}

export function searchTitles(index: readonly TitleRow[], input: string, groups: Set<number>, max = 100): TitleHit[] {
  const { q, folded } = titleQuery(input)
  if (!q) return []
  const list = indexed(index)
  names ??= buildNameIndex(popularSuttas as PopularSutta[])
  const text = (n: Indexed) => (folded ? n.fo : n.ro)
  const byKey = new Map(list.map(n => [n.row.key, n]))
  const out: TitleHit[] = [], seen = new Set<string>()
  // suttas known by a name the query matches, the most searched first (the name is shown when the title does not match)
  if (folded) for (const { key, name } of matchNames(names, q)) {
    const n = byKey.get(key)
    if (!n || !groups.has(n.row.grp) || seen.has(key)) continue
    out.push({ key, eInd: [n.row.page_idx, n.row.entry_idx], ...(text(n).includes(q) || /[^\x00-\x7f]/.test(fold(name)) ? {} : { alias: name }) })
    seen.add(key)
  }
  // titles starting with the query, then containing it, in the order of the books
  const starts: TitleHit[] = [], rest: TitleHit[] = []
  for (const n of list) {
    if (starts.length + rest.length >= max * 2) break
    if (!groups.has(n.row.grp) || seen.has(n.row.key)) continue
    const at = text(n).replace(/^[\d\s.()\-–]+/, '').indexOf(q)
    if (at < 0 && !text(n).includes(q)) continue
    ;(at === 0 ? starts : rest).push({ key: n.row.key, eInd: [n.row.page_idx, n.row.entry_idx] })
  }
  return [...out, ...starts, ...rest].slice(0, max)
}
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
