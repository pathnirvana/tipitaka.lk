/** search box state + persisted search settings (v2 store/search.js, key tipitaka.lk-search-settings-1) */
import { defineStore } from 'pinia'
import { reactive, ref, watch } from 'vue'
import { FILTER_KEYS, SEARCH_SETTINGS_KEY, dictionaryInfo } from '@shared/constants'
import { loadJson, saveJson } from '@/composables/storage'

export type SearchType = 'title' | 'fts' | 'dict'
export interface Filter { keys: string[]; columns: number[] }
interface Stored { filter: { title: Filter; fts: Filter }; selectedDictionaries: string[]; searchType: SearchType }

export const useSearch = defineStore('search', () => {
  const stored = loadJson<Partial<Stored>>(SEARCH_SETTINGS_KEY) || {}
  const searchType = ref<SearchType>(stored.searchType || 'title')
  const searchInput = ref('')
  const filter = reactive<{ title: Filter; fts: Filter }>({
    title: { keys: [...FILTER_KEYS], columns: [0, 1], ...(stored.filter?.title || {}) },
    fts: { keys: [...FILTER_KEYS], columns: [0, 1], ...(stored.filter?.fts || {}) },
  })
  const selectedDictionaries = ref<string[]>((stored.selectedDictionaries || Object.keys(dictionaryInfo)).filter(d => dictionaryInfo[d]))
  const filterTreeOpenKeys = ref<string[]>(['sp'])
  const maxResults = 100

  watch([searchType, filter, selectedDictionaries], () => {
    saveJson(SEARCH_SETTINGS_KEY, { filter, selectedDictionaries: selectedDictionaries.value, searchType: searchType.value })
  }, { deep: true })

  const shortDicts = () => selectedDictionaries.value.map(d => dictionaryInfo[d][1])

  return { searchType, searchInput, filter, selectedDictionaries, filterTreeOpenKeys, maxResults, shortDicts }
})
