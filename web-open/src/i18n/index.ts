/**
 * UI translations, tipitaka.app's (cst/web/src/i18n): strings are written in English in the code (t('Settings')),
 * <lang>.json maps the English text to the translation. Those files are tipitaka.app's, unchanged, so they can be copied
 * again when it adds strings; the strings only this site has are in open.<lang>.json (translated by AI, Claude 2026-11:
 * to be checked by a reader of each language). A string in neither falls back to English (i18n.test.ts lists them).
 */
import { ref } from 'vue'

/** name: in the language itself, english: for those who do not read it */
export const UI_LANGS: { code: string; name: string; english: string }[] = [
  { code: 'en', name: 'English', english: 'English' }, { code: 'si', name: 'සිංහල', english: 'Sinhala' }, { code: 'my', name: 'မြန်မာ', english: 'Myanmar' },
  { code: 'th', name: 'ไทย', english: 'Thai' }, { code: 'kh', name: 'ខ្មែរ', english: 'Khmer' }, { code: 'hi', name: 'हिन्दी', english: 'Hindi' },
  { code: 'ch', name: '中文', english: 'Chinese' },
]

const loaders = import.meta.glob<{ default: Record<string, string> }>('./*.json')
const load = async (file: string) => (loaders[file] ? (await loaders[file]()).default : {})
const current = ref<Record<string, string>>({})
export const uiLang = ref('en')

export async function setUiLang(code: string) {
  uiLang.value = code
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-ui-lang', code)
  if (code === 'en') { current.value = {}; return }
  const [app, own] = await Promise.all([load(`./${code}.json`), load(`./open.${code}.json`)])
  if (uiLang.value === code) current.value = { ...app, ...own }
}

/** translate; {0} {1} are replaced by the arguments */
export function t(en: string, ...args: (string | number)[]): string {
  let s = current.value[en] || en
  args.forEach((a, i) => { s = s.replace(`{${i}}`, String(a)) })
  return s
}
