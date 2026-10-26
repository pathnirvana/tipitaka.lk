/** the suttas read, most recent first (tipitaka.app library history): a sutta is recorded when its tab becomes active */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { HISTORY_KEY } from '@shared/constants'
import { loadJson, saveJson } from '@/composables/storage'

export interface HistoryItem { key: string; language?: 'pali' | 'sinh'; at: number }
export const MAX_HISTORY = 40

export const useHistory = defineStore('history', () => {
  const stored = loadJson<HistoryItem[]>(HISTORY_KEY)
  const items = ref<HistoryItem[]>(Array.isArray(stored) ? stored.filter(h => h && typeof h.key === 'string') : [])
  watch(items, v => saveJson(HISTORY_KEY, v), { deep: true })
  function visit(key: string, language: HistoryItem['language']) {
    items.value = [{ key, language, at: Date.now() }, ...items.value.filter(h => h.key !== key)].slice(0, MAX_HISTORY)
  }
  function clear() { items.value = [] }
  return { items, visit, clear }
})
