import { defineStore } from 'pinia'
import { shallowRef, computed } from 'vue'
import { getStatic } from '@/data/source'

/** footnote abbreviations: abbr -> [description, count] (static/data/footnote-abbreviations.json) */
export const useAbbreviations = defineStore('abbreviations', () => {
  const map = shallowRef<Record<string, [string, number]>>({})
  const loaded = shallowRef(false)
  const keys = computed(() => new Set(Object.keys(map.value)))
  async function init() {
    if (loaded.value) return
    try { map.value = Object.freeze(await getStatic<Record<string, [string, number]>>('static/data/footnote-abbreviations.json')) } catch { /* ignore */ }
    loaded.value = true
  }
  const describe = (a: string) => map.value[a]?.[0] || ''
  return { map, loaded, keys, init, describe }
})
