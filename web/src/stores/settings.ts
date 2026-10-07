/** user settings - persisted with the v2 key and field names so existing users keep their settings */
import { defineStore } from 'pinia'
import { reactive, watch, computed, toRefs } from 'vue'
import { SETTINGS_KEY } from '@shared/constants'
import { loadJson, saveJson } from '@/composables/storage'
import type { LetterOptions } from '@shared/beautify'

export type FootnoteMethod = 'hidden' | 'click' | 'hover' | 'end-page'
export interface Settings {
  darkMode: boolean
  defaultColumns: 0 | 1 | 2
  treeLanguage: 'pali' | 'sinh'
  footnoteMethod: FootnoteMethod
  bandiLetters: boolean
  specialLetters: boolean
  showPageNumbers: boolean
  fontSize: number
  syncTree: boolean
  autoHideSearchBar: boolean
  /** show pali + sinhala side by side even on small screens (only when chosen explicitly on a small screen) */
  bothColumnsOnSmallScreens: boolean
}
const STORED: (keyof Settings)[] = ['darkMode', 'defaultColumns', 'treeLanguage', 'footnoteMethod', 'bandiLetters',
  'specialLetters', 'showPageNumbers', 'fontSize', 'syncTree', 'autoHideSearchBar', 'bothColumnsOnSmallScreens']

export function defaultSettings(width = typeof window !== 'undefined' ? window.innerWidth : 1200): Settings {
  return {
    darkMode: false, defaultColumns: 2, treeLanguage: 'pali',
    footnoteMethod: width < 960 ? 'click' : 'hover', // v2: smAndDown ? 'click' : 'hover'
    bandiLetters: true, specialLetters: false, showPageNumbers: true, fontSize: 0, syncTree: true, autoHideSearchBar: true, bothColumnsOnSmallScreens: false,
  }
}

export const useSettings = defineStore('settings', () => {
  const state = reactive<Settings>(defaultSettings())
  const stored = loadJson<Partial<Settings>>(SETTINGS_KEY)
  if (stored) for (const k of STORED) if (k in stored && stored[k] !== undefined) (state as Record<string, unknown>)[k] = stored[k]

  watch(() => STORED.map(k => state[k]), () => {
    const obj: Partial<Settings> = {}
    for (const k of STORED) (obj as Record<string, unknown>)[k] = state[k]
    saveJson(SETTINGS_KEY, obj)
  })
  watch(() => state.darkMode, d => { document.documentElement.classList.toggle('dark', d) }, { immediate: true })

  const letterOptions = computed<LetterOptions>(() => ({ bandiLetters: state.bandiLetters, specialLetters: state.specialLetters }))
  const fontPx = computed(() => `${16 + state.fontSize}px`)
  return { ...toRefs(state), letterOptions, fontPx }
})
