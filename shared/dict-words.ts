/** input rules of the dictionary search */
import { isSinglishQuery } from './singlish'

export const DICT_INPUT_MESSAGES = {
  empty: 'සෙවීමට පාලි වචනය ඇතුල් කරන්න.',
  short: 'අවම වශයෙන් අකුරු 2 ක් ඇතුල් කරන්න.',
  space: 'හිස් තැන් රහිතව එක් පදයක් පමණක් යොදන්න.',
  singlishLong: 'සිංග්ලිෂ් වලින් සෙවීමේ දී උපරිමය අකුරු 30 කට සීමා කර ඇත.',
  long: 'උපරිම දිග අකුරු 35',
  chars: 'සෙවුම් පදය සඳහා ඉංග්‍රීසි සහ සිංහල අකුරු පමණක් යොදන්න (* සහ ? ද යෙදිය හැක).',
}
/**
 * v2 Dictionary.vue / TSearch.vue searchBarRules (title search uses a different first message). Since the dictionary
 * engine (2026-10): Roman Pali with diacritics and the * ? wildcards are accepted, singlish up to 30 letters
 */
export function wordInputError(v: string, emptyMessage = DICT_INPUT_MESSAGES.empty): string {
  if (!v) return emptyMessage
  if (v.length < 2) return DICT_INPUT_MESSAGES.short
  if (/\s/.test(v)) return DICT_INPUT_MESSAGES.space
  if (isSinglishQuery(v) && v.length > 30) return DICT_INPUT_MESSAGES.singlishLong
  if (v.length > 35) return DICT_INPUT_MESSAGES.long
  if (/[^A-Za-zāīūṃṁṅñṭḍṇḷĀĪŪṂṀṄÑṬḌṆḶ඀-෿‍*?]/.test(v)) return DICT_INPUT_MESSAGES.chars
  return ''
}
