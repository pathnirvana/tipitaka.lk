/**
 * replaces web/src/stores/settings.ts (vite.config.ts OVERRIDES): the same store for the web/src components, with
 * open.tipitaka.lk's defaults: the pāḷi column alone, no word alignments or aṭṭhakathā underlines. The script is not a
 * setting of this store: it is in the url (src/script.ts). Saved under open.tipitaka.lk-settings-1 (overrides/storage.ts).
 */
import { defineStore } from 'pinia'
import { reactive, watch, computed, toRefs } from 'vue'
import { SETTINGS_KEY } from '@shared/constants'
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
  uiLang: string // the language of the interface (src/i18n)
}
const STORED: (keyof Settings)[] = ['theme', 'footnoteMethod', 'bandiLetters', 'specialLetters', 'showPageNumbers', 'fontSize',
  'syncTree', 'autoHideSearchBar', 'audioFollow', 'tabView', 'panelPinned', 'uiLang']

export const BASE_FONT_PX = 18
export const FONT_SIZE_RANGE = [-7, 8] as const

export function defaultSettings(width = typeof window !== 'undefined' ? window.innerWidth : 1200): Settings {
  return {
    theme: 'light', defaultColumns: 0, treeLanguage: 'pali',
    footnoteMethod: width < 960 ? 'click' : 'hover', // v2: smAndDown ? 'click' : 'hover'
    bandiLetters: true, specialLetters: false, showPageNumbers: true, fontSize: 0, syncTree: true, autoHideSearchBar: true, alignmentView: false, audioFollow: true, dictSheetHeight: 40, dicts: [],
    tabView: 'tabs', glossUnderline: false, syncColumns: false, panelPinned: false, uiLang: 'en',
  }
}

export const useSettings = defineStore('settings', () => {
  const state = reactive<Settings>(defaultSettings())
  const stored = loadJson<Partial<Settings>>(SETTINGS_KEY)
  if (stored) for (const k of STORED) if (k in stored && stored[k] !== undefined) (state as Record<string, unknown>)[k] = stored[k]
  if (!isTheme(state.theme)) state.theme = 'light'
  if (!['single', 'tabs', 'columns'].includes(state.tabView)) state.tabView = 'tabs'

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
