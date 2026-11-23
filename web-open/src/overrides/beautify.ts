/**
 * replaces shared/beautify.ts (vite.config.ts OVERRIDES): every pāḷi text the web/src components show (the text, the
 * tree, titles, search results, copied paragraphs) goes through beautifyText, so this is where it is converted to the
 * script of the page. Sinhala script keeps tipitaka.lk's rendering (bandi letters).
 */
import { beautifyText as lkBeautify, beautifyFTSText as lkBeautifyFTS, type LetterOptions } from '../../../shared/beautify'
import { script, convertTo } from '../script'

export * from '../../../shared/beautify'

export function beautifyText(text: string, lang: 'pali' | 'sinh', opts: LetterOptions): string {
  return lang === 'pali' && script !== 'sinh' ? convertTo(text, script) : lkBeautify(text, lang, opts)
}
export function beautifyFTSText(text: string, lang: 'pali' | 'sinh', opts: LetterOptions): string {
  return lang === 'pali' && script !== 'sinh' ? convertTo(text, script) : lkBeautifyFTS(text, lang, opts)
}
