/** Shared constants. Values copied from the v2 app (src/constants.js) — keep in sync with stored user data. */

export const APP_VERSION = 3.0 // compared with the number in /tipitaka-query/version

export const SETTINGS_KEY = 'tipitaka.lk-settings-2'
export const BOOKMARKS_KEY = 'tipitaka.lk-bookmarks-1'
export const SEARCH_SETTINGS_KEY = 'tipitaka.lk-search-settings-1'

/** top level search filter groups (order matters: index == file.grp / node.grp in text.db) */
export const FILTER_KEYS = ['vp-prj', 'vp-pct', 'vp-mv', 'vp-cv', 'vp-pv', 'dn-1', 'dn-2', 'dn-3', 'mn-1', 'mn-2', 'mn-3',
  'sn-1', 'sn-2', 'sn-3', 'sn-4', 'sn-5', 'an-1', 'an-2', 'an-3', 'an-4', 'an-5', 'an-6', 'an-7', 'an-8', 'an-9', 'an-10',
  'an-11', 'kn-khp', 'kn-dhp', 'kn-ud', 'kn-iti', 'kn-snp', 'kn-vv', 'kn-pv', 'kn-thag', 'kn-thig', 'kn-mn', 'kn-nc',
  'kn-jat', 'kn-ps', 'kn-ap', 'kn-bv', 'kn-cp', 'kn-nett', 'kn-petk', 'ap-dhs', 'ap-vbh', 'ap-kvu', 'ap-dhk', 'ap-pug',
  'ap-yam', 'ap-pat', 'atta-vp', 'atta-dn', 'atta-mn', 'atta-sn', 'atta-an', 'atta-kn', 'atta-ap', 'anya'] as const

/** tree nodes shown as expandable parents in the search filter tree */
export const FILTER_TREE_PARENTS = ['vp', 'sp', 'ap', 'atta-sp', 'dn', 'mn', 'sn', 'an', 'kn']

export const enum Lang { Pali = 0, Sinh = 1 }
export type Language = 'pali' | 'sinh'
export const langCode = (l: Language): Lang => (l === 'sinh' ? Lang.Sinh : Lang.Pali)

/** entry type <-> int mapping used in text.db */
export const TYPES = ['centered', 'heading', 'paragraph', 'gatha', 'unindented'] as const
export type EntryType = (typeof TYPES)[number]
export const typeToInt = (t: string): number => {
  const i = (TYPES as readonly string[]).indexOf(t)
  if (i < 0) throw new Error(`unknown entry type ${t}`)
  return i
}

export const isPaliOnlyFile = (filename: string) => /^ap-pat/.test(filename)
export const isAttaFile = (filename: string) => filename.startsWith('atta-')

export const DictLanguage = Object.freeze({ SI: 'si', EN: 'en' })
/** name -> [language, short code, id, info] (src/constants.js dictionaryInfo) */
export const dictionaryInfo: Record<string, [string, string, string, { d: string; o?: string; n?: number; g: boolean }]> = {
  'පොල්වත්තේ බුද්ධදත්ත': ['si', 'BUS', 'si-buddhadatta', { d: 'පොල්වත්තේ බුද්ධදත්ත හිමි, පාලි-සිංහල අකාරාදිය', g: true }],
  'මඩිතියවෙල සුමඞ්ගල': ['si', 'MS', 'si-sumangala', { d: 'මඩිතියවෙල සිරි සුමඞ්ගල හිමි, පාලි-සිංහල ශබ්දකෝෂය', g: true }],
  'Buddhadatta Concise': ['en', 'BUE', 'en-buddhadatta', { d: 'Pali Dictionary by Polwatte Buddhadatta Mahathera', o: 'Projector', n: 20970, g: true }],
  'Nyanatiloka Buddhist': ['en', 'ND', 'en-nyanatiloka', { d: 'Buddhist Dictionary by Ven Nyanatiloka', o: 'pced stardict', g: true }],
  'Pali Text Society': ['en', 'PTS', 'en-pts', { d: 'Pali Text Society Dictionary', o: 'dpr', g: true }],
  'Proper Names': ['en', 'PN', 'en-dppn', { d: 'Pali Proper Names by G P Malalasekera', o: 'dpr', g: true }],
  'VRI English': ['en', 'VRI', 'en-vri', { d: 'Dictionary distributed with VRI Chatta Sangayana Software', g: true, n: 13508 }],
  'Critical PD': ['en', 'CR', 'en-critical', { d: 'Critical Pali Dictionary - limited number of words', o: 'extracted from https://cpd.uni-koeln.de/', n: 29669, g: true }],
}

/** separator used to pass lists as a single string param to named queries (split in SQL) */
export const LIST_SEP = '\x1f'
export const joinList = (items: (string | number)[]) => items.join(LIST_SEP)
