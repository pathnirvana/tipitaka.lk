/**
 * the dictionary pane of the reader: opened by clicking a pali word (lookup of the form, the word can be edited: search)
 * or from a paragraph's menu; its other tabs show the aṭṭhakathā / mūla (the explanation of an underlined word, else the
 * passages linked to the paragraph) and the setting (place, people)
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { cleanInlineWord } from '@/data/dictionary'
import type { Gloss } from '@/data/names'

export type PaneTab = 'dict' | 'atta' | 'setting'
/** the paragraph of the pane: its file, position and node (sutta) */
export interface ParaCtx { file: string; page: number; entry: number; key: string }

export const useInlineDict = defineStore('inlineDict', () => {
  const show = ref(false)
  const tab = ref<PaneTab>('dict')
  const word = ref('') // Sinhala
  const mode = ref<'lookup' | 'dict'>('lookup') // a clicked word of the text, or typed
  const ctx = ref<ParaCtx | null>(null)
  const glosses = ref<Gloss[]>([]) // of the clicked word (underlined: explained in the aṭṭhakathā)
  let wordEl: HTMLElement | null = null

  function markWord(el: HTMLElement | null) {
    wordEl?.classList.remove('selected-word')
    wordEl = el
    el?.classList.add('selected-word')
  }
  /** a clicked word: the dictionary (the tab stays when the pane is open on another one: reading the commentary word by word) */
  function open(el: HTMLElement, para?: ParaCtx, gl: Gloss[] = []) {
    if (!show.value) tab.value = 'dict'
    show.value = true
    markWord(el)
    word.value = cleanInlineWord(el.innerText)
    mode.value = 'lookup'
    if (para) ctx.value = para
    glosses.value = gl
  }
  /** a paragraph's commentary or setting (the paragraph menu) */
  function openTab(t: PaneTab, para: ParaCtx) {
    ctx.value = para
    glosses.value = []
    tab.value = t
    show.value = true
    markWord(null)
  }
  /** another text became the active one (a tab opened or switched to): the pane's paragraph follows it, so the Setting
   * tab shows its place; an explanation being read in the Atta tab stays */
  function follow(para: ParaCtx) {
    if (!ctx.value || (ctx.value.file === para.file && ctx.value.page === para.page && ctx.value.entry === para.entry)) return
    ctx.value = para
    if (tab.value !== 'atta') glosses.value = []
  }
  /** an edited word: a dictionary search */
  function search(w: string) { word.value = w; mode.value = 'dict' }
  function close() { show.value = false; markWord(null) }
  return { show, tab, word, mode, ctx, glosses, open, openTab, follow, search, close }
})
