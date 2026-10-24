/** dictionary pane of the reader: opened by clicking a pali word (lookup of the form), the word can be edited (search) */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { cleanInlineWord } from '@/data/dictionary'

export const useInlineDict = defineStore('inlineDict', () => {
  const show = ref(false)
  const tab = ref<'dict'>('dict') // tabs of the pane (setting, atta later)
  const word = ref('') // Sinhala
  const mode = ref<'lookup' | 'dict'>('lookup') // a clicked word of the text, or typed
  let wordEl: HTMLElement | null = null

  function markWord(el: HTMLElement | null) {
    wordEl?.classList.remove('selected-word')
    wordEl = el
    el?.classList.add('selected-word')
  }
  function open(el: HTMLElement) {
    show.value = true
    markWord(el)
    word.value = cleanInlineWord(el.innerText)
    mode.value = 'lookup'
  }
  /** an edited word: a dictionary search */
  function search(w: string) { word.value = w; mode.value = 'dict' }
  function close() { show.value = false; markWord(null) }
  return { show, tab, word, mode, open, search, close }
})
