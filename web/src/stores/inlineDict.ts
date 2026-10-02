/** dictionary bottom sheet opened by clicking a pali word in the reader */
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { inlineDictQuery, cleanInlineWord, type DictResults } from '@/data/dictionary'
import { useSearch } from './search'

export const useInlineDict = defineStore('inlineDict', () => {
  const show = ref(false)
  const word = ref('')
  const results = shallowRef<DictResults | null>(null)
  const loading = ref(false)
  const error = ref('')
  let wordEl: HTMLElement | null = null
  let seq = 0

  function markWord(el: HTMLElement | null) {
    wordEl?.classList.remove('selected-word')
    wordEl = el
    el?.classList.add('selected-word')
  }
  async function run() {
    const my = ++seq
    loading.value = true
    error.value = ''
    try {
      const r = await inlineDictQuery(word.value, useSearch().shortDicts())
      if (my === seq) results.value = r
    } catch (e) {
      if (my === seq) error.value = (e as Error).message
    } finally {
      if (my === seq) loading.value = false
    }
  }
  function open(el: HTMLElement) {
    show.value = true
    markWord(el)
    word.value = cleanInlineWord(el.innerText)
    return run()
  }
  function close() { show.value = false; markWord(null) }
  return { show, word, results, loading, error, open, run, close }
})
