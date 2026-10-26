/** user settings - persisted with the v2 key and field names so existing users keep their settings */
import { defineStore } from 'pinia'
import { reactive, watch, computed, toRefs } from 'vue'
import { SETTINGS_KEY, SEARCH_SETTINGS_KEY, dictionaryInfo } from '@shared/constants'
import { loadJson, saveJson } from '@/composables/storage'
import type { LetterOptions } from '@shared/beautify'
import { applyTheme, isTheme, onSystemDark, type Theme } from '@/composables/themes'

export type FootnoteMethod = 'hidden' | 'click' | 'hover' | 'end-page'
/** how the open suttas are shown (tipitaka.app's tab views): one at a time, tabs, or the tabs side by side as columns */
export type TabView = 'single' | 'tabs' | 'columns'
export interface Settings {
  theme: Theme
  defaultColumns: 0 | 1 | 2
  treeLanguage: 'pali' | 'sinh'
  footnoteMethod: FootnoteMethod
  bandiLetters: boolean
  specialLetters: boolean
  showPageNumbers: boolean
  fontSize: number
  syncTree: boolean
  autoHideSearchBar: boolean
  alignmentView: boolean
  audioFollow: boolean // keep the chanted paragraph / word on screen
  dictSheetHeight: number // the dictionary bottom sheet, % of the screen height
  dicts: string[] // dictionaries of the lookups: 'dpd' + dictionary codes, [] = all (tipitaka.app settings.dicts)
  tabView: TabView
  glossUnderline: boolean // underline the words the aṭṭhakathā explains (and its lemmas)
  syncColumns: boolean // columns view: a mūla and its aṭṭhakathā scroll together
  panelPinned: boolean // the side panel stays open as a column on wide screens (tipitaka.app navPinned)
}
const STORED: (keyof Settings)[] = ['theme', 'defaultColumns', 'treeLanguage', 'footnoteMethod', 'bandiLetters',
  'specialLetters', 'showPageNumbers', 'fontSize', 'syncTree', 'autoHideSearchBar', 'alignmentView', 'audioFollow', 'dictSheetHeight', 'dicts', 'tabView', 'glossUnderline', 'syncColumns', 'panelPinned']

export const BASE_FONT_PX = 18
export const FONT_SIZE_RANGE = [-7, 8] as const

export function defaultSettings(width = typeof window !== 'undefined' ? window.innerWidth : 1200): Settings {
  return {
    theme: 'light', defaultColumns: 2, treeLanguage: 'pali',
    footnoteMethod: width < 960 ? 'click' : 'hover', // v2: smAndDown ? 'click' : 'hover'
    bandiLetters: true, specialLetters: false, showPageNumbers: true, fontSize: 0, syncTree: true, autoHideSearchBar: true, alignmentView: true, audioFollow: true, dictSheetHeight: 40, dicts: [],
    tabView: 'tabs', glossUnderline: true, syncColumns: true, panelPinned: false,
  }
}

export const useSettings = defineStore('settings', () => {
  const state = reactive<Settings>(defaultSettings())
  const stored = loadJson<Partial<Settings>>(SETTINGS_KEY)
  if (stored) for (const k of STORED) if (k in stored && stored[k] !== undefined) (state as Record<string, unknown>)[k] = stored[k]
  if (!isTheme(state.theme)) state.theme = 'light'
  if (!['single', 'tabs', 'columns'].includes(state.tabView)) state.tabView = 'tabs'
  if (stored && !stored.theme && (stored as { darkMode?: boolean }).darkMode) state.theme = 'dark' // the dark mode switch before the themes
  if (!stored?.dicts) state.dicts = migrateDictionaries()

  watch(() => STORED.map(k => state[k]), () => {
    const obj: Partial<Settings> = {}
    for (const k of STORED) (obj as Record<string, unknown>)[k] = state[k]
    saveJson(SETTINGS_KEY, obj)
  })
  watch(() => state.theme, applyTheme, { immediate: true })
  onSystemDark(() => applyTheme(state.theme)) // auto follows the system when it switches

  const letterOptions = computed<LetterOptions>(() => ({ bandiLetters: state.bandiLetters, specialLetters: state.specialLetters }))
  // 18px base (tipitaka.app's reading size; v2 / lk until 2026-10 was 16px): fontSize is the reader's offset from it
  const fontPx = computed(() => `${BASE_FONT_PX + state.fontSize}px`)
  return { ...toRefs(state), letterOptions, fontPx }
})

/**
 * the dictionaries chosen before 2026-10 (search settings selectedDictionaries: names of shared/constants dictionaryInfo)
 * as dictionary codes; all of them (the default) is [] = all. The Buddhadatta English dictionary is now its revised
 * edition (en-ncped), DPD is new: on.
 */
function migrateDictionaries(): string[] {
  const old = loadJson<{ selectedDictionaries?: string[] }>(SEARCH_SETTINGS_KEY)?.selectedDictionaries
  if (!old || old.length >= Object.keys(dictionaryInfo).length) return []
  const codes = old.map(n => dictionaryInfo[n]?.[2]).filter(Boolean).map(c => (c === 'en-buddhadatta' ? 'en-ncped' : c))
  return codes.length ? ['dpd', ...codes] : []
}
