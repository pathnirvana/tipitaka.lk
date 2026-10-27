/**
 * replaces web/src/stores/settings.ts (vite.config.ts OVERRIDES): the same store for the web/src components, with
 * pitaka.lk's defaults (one sutta at a time, no footnotes, word alignments or aṭṭhakathā underlines, the five
 * dictionaries) and the reading mode. Saved under pitaka.lk-settings-1 (overrides/storage.ts).
 */
import { defineStore } from 'pinia'
import { reactive, watch, computed, toRefs } from 'vue'
import { SETTINGS_KEY } from '@shared/constants'
import { loadJson, saveJson } from '@/composables/storage'
import type { LetterOptions } from '@shared/beautify'
import { applyTheme, isTheme, onSystemDark, type Theme } from '@/composables/themes'

/** sinh: the translation (the pāḷi where an entry has none), pali, interleaved: each pāḷi paragraph then its translation,
 * side: pāḷi and translation side by side (wide screens only, else interleaved) */
export type ReadingMode = 'sinh' | 'pali' | 'interleaved' | 'side'
export const READING_MODES: ReadingMode[] = ['sinh', 'pali', 'interleaved', 'side']
/** the narrowest text for side by side (px) */
export const SIDE_BY_SIDE_FROM = 720

export type FootnoteMethod = 'hidden' | 'click' | 'hover' | 'end-page'
export type TabView = 'single' | 'tabs' | 'columns'
export interface Settings {
  theme: Theme
  readingMode: ReadingMode
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
  audioFollow: boolean
  dictSheetHeight: number
  dicts: string[]
  tabView: TabView
  glossUnderline: boolean
  syncColumns: boolean
  panelPinned: boolean
}
const STORED: (keyof Settings)[] = ['theme', 'readingMode', 'treeLanguage', 'bandiLetters', 'specialLetters', 'fontSize',
  'syncTree', 'autoHideSearchBar', 'audioFollow', 'dictSheetHeight', 'dicts', 'panelPinned']

/** server/engine PitakaDicts */
export const PITAKA_DICTS = ['dpd', 'si-buddhadatta', 'si-sumangala', 'en-ncped', 'en-dppn']
export const BASE_FONT_PX = 18
export const FONT_SIZE_RANGE = [-7, 8] as const

export function defaultSettings(): Settings {
  return {
    theme: 'light', readingMode: 'sinh', defaultColumns: 2, treeLanguage: 'sinh', footnoteMethod: 'hidden',
    bandiLetters: true, specialLetters: false, showPageNumbers: false, fontSize: 0, syncTree: true, autoHideSearchBar: true,
    alignmentView: false, audioFollow: true, dictSheetHeight: 40, dicts: [...PITAKA_DICTS],
    tabView: 'single', glossUnderline: false, syncColumns: false, panelPinned: false,
  }
}

export const useSettings = defineStore('settings', () => {
  const state = reactive<Settings>(defaultSettings())
  const stored = loadJson<Partial<Settings>>(SETTINGS_KEY)
  if (stored) for (const k of STORED) if (k in stored && stored[k] !== undefined) (state as Record<string, unknown>)[k] = stored[k]
  if (!isTheme(state.theme)) state.theme = 'light'
  if (!READING_MODES.includes(state.readingMode)) state.readingMode = 'sinh'
  state.dicts = state.dicts.filter(d => PITAKA_DICTS.includes(d))
  if (!state.dicts.length) state.dicts = [...PITAKA_DICTS]

  watch(() => STORED.map(k => state[k]), () => {
    const obj: Partial<Settings> = {}
    for (const k of STORED) (obj as Record<string, unknown>)[k] = state[k]
    saveJson(SETTINGS_KEY, obj)
  })
  watch(() => state.theme, applyTheme, { immediate: true })
  onSystemDark(() => applyTheme(state.theme))

  const letterOptions = computed<LetterOptions>(() => ({ bandiLetters: state.bandiLetters, specialLetters: state.specialLetters }))
  const fontPx = computed(() => `${BASE_FONT_PX + state.fontSize}px`)
  return { ...toRefs(state), letterOptions, fontPx }
})
