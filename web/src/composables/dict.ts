/** dictionary meanings: the canonical markup of tipitaka.app build/dicts/markup.ts, sanitised for v-html */
import DOMPurify from 'dompurify'
import { beautifyText } from '@shared/beautify'
import { toSinh } from '@/data/dictionary'
import { useSettings } from '@/stores/settings'

const TAGS = ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'hr', 'span', 'small', 'sup', 'sub', 'ul', 'ol', 'li', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'td', 'th', 'a', 'abbr']
const ATTRS = ['class', 'data-dict', 'data-hom', 'data-a', 'data-orig']

/** links carry no href: DictView follows data-dict clicks */
export const cleanMeaning = (html: string) => DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTRS, ALLOW_DATA_ATTR: false })

/** converts the text of html (not its tags) */
export const convHtml = (html: string, conv: (s: string) => string) => html.replace(/(<[^>]*>)|([^<]+)/g, (_, tag: string, txt: string) => tag ?? conv(txt))

/** Roman Pali of the dictionary db shown in Sinhala script like the text (bandi / special letters of the settings) */
export function usePaliSinh() {
  const settings = useSettings()
  return (roman: string) => beautifyText(toSinh(roman), 'pali', settings.letterOptions)
}
