/** Candidate dictionary words for an input (port of dictWordList in src/store/search.js). */
import { isSinglishQuery, singlishMatches } from './singlish'

export async function dictWordList(input: string): Promise<string[]> {
  const query = input.toLowerCase().replace(/[‍\.,:\?\(\)“”‘’]/g, '') // remove common chars
  let words: string[] = isSinglishQuery(query) ? await singlishMatches(query) : []
  if (!words.length) words = [query]
  const stripEnd = words.map(w => w.replace(/[්-ෟංඃ]+$/g, ''))
  const addVowel = !isSinglishQuery(query) ? ['ා', 'ි', 'ී', 'ු', 'ූ', 'ෙ', 'ො'].map(v => stripEnd[0] + v) : []
  return [...words, ...stripEnd, ...addVowel].filter((w, i, ar) => ar.indexOf(w) === i)
}

/** v2 skips the prefix part of the dictionary query when there are too many candidate words */
export const MAX_PREFIX_WORDS = 100

export const DICT_INPUT_MESSAGES = {
  empty: 'සෙවීමට පාලි වචනය ඇතුල් කරන්න.',
  short: 'අවම වශයෙන් අකුරු 2 ක් ඇතුල් කරන්න.',
  space: 'හිස් තැන් රහිතව එක් පදයක් පමණක් යොදන්න.',
  singlishLong: 'සිංග්ලිෂ් වලින් සෙවීමේ දී උපරිමය අකුරු 10 කට සීමා කර ඇත.',
  long: 'උපරිම දිග අකුරු 25',
  chars: 'සෙවුම් පදය සඳහා ඉංග්‍රීසි සහ සිංහල අකුරු පමණක් යොදන්න.',
}
/** v2 Dictionary.vue / TSearch.vue searchBarRules (title search uses a different first message) */
export function wordInputError(v: string, emptyMessage = DICT_INPUT_MESSAGES.empty): string {
  if (!v) return emptyMessage
  if (v.length < 2) return DICT_INPUT_MESSAGES.short
  if (/\s/.test(v)) return DICT_INPUT_MESSAGES.space
  if (isSinglishQuery(v) && v.length > 10) return DICT_INPUT_MESSAGES.singlishLong
  if (v.length > 25) return DICT_INPUT_MESSAGES.long
  if (/[^A-Za-z඀-෿‍]/.test(v)) return DICT_INPUT_MESSAGES.chars
  return ''
}
