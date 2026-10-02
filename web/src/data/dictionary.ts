/** dictionary lookups (v2 store/search.js runPageDictQuery / runInlineDictQuery / processDictRows) */
import { getData } from './source'
import type { DictRow } from './types'
import { dictWordList, MAX_PREFIX_WORDS } from '@shared/dict-words'
import { joinList } from '@shared/constants'

export interface DictResults {
  breakups: { word: string; type: string; breakup: string }[]
  matches: { word: string; dict: string; meaning: string }[]
  prefixWords: { word: string; count: number }[]
}

export function processDictRows(rows: DictRow[]): DictResults {
  const matches = rows.filter(r => r.dict !== 'BR' && r.meaning !== 'like').map(r => ({ word: r.word, dict: String(r.dict), meaning: r.meaning }))
  const breakups = rows.filter(r => r.dict === 'BR').map(({ word, meaning }) => {
    const [type, breakup] = meaning.split('|')
    return { word, type, breakup }
  })
  const matched = new Set(matches.map(m => m.word))
  // v2 sorted these with an invalid comparator (A10); keep the SQL order (by word)
  const prefixWords = rows.filter(r => r.meaning === 'like' && !matched.has(r.word)).map(r => ({ word: r.word, count: Number(r.dict) }))
  return { breakups, matches, prefixWords }
}

export const cleanInlineWord = (text: string) => text.replace(/[\.,:\?\(\)“”‘’]/g, '')

export async function pageDictQuery(input: string, shortDicts: string[]): Promise<DictResults> {
  const words = dictWordList(input)
  const rows = await getData().query<DictRow>('dict.page', { words: joinList(words), dicts: joinList(shortDicts), prefix: words.length > MAX_PREFIX_WORDS ? 0 : 1 })
  return processDictRows(rows)
}

export async function inlineDictQuery(word: string, shortDicts: string[]): Promise<DictResults> {
  const rows = await getData().query<DictRow>('dict.inline', { words: joinList(dictWordList(word)), dicts: joinList([...shortDicts, 'BR']) })
  return processDictRows(rows)
}
