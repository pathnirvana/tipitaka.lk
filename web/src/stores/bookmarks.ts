/**
 * Starred suttas / paragraphs, stored like v2 (key "<key>:<p>-<e>:<lang>" -> {key, language, eInd, type, text, hText}).
 * Entries are matched on (file, eInd, language) because some entry keys changed (A14); `file` is an extra field.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { BOOKMARKS_KEY } from '@shared/constants'
import { bookmarkKey, type EInd } from '@shared/routes'
import { loadJson, saveJson } from '@/composables/storage'
import { useTree } from './tree'

export interface Bookmark {
  key: string
  language: 'pali' | 'sinh'
  eInd: EInd | null
  type: string | null
  text: string | null
  hText: string | null
  file?: string
}
const posKey = (file: string, eInd: EInd | null, lang: string) => `${file}:${eInd ? eInd.join('-') : ''}:${lang}`

export const useBookmarks = defineStore('bookmarks', () => {
  const bookmarks = ref<Record<string, Bookmark>>(loadJson<Record<string, Bookmark>>(BOOKMARKS_KEY) || {})
  const resolvedFiles = ref<Record<string, string>>({}) // node key -> file for legacy bookmarks without `file`
  const byPos = computed(() => {
    const m = new Map<string, string>()
    for (const [k, b] of Object.entries(bookmarks.value)) {
      const file = b.file || resolvedFiles.value[b.key]
      if (file) m.set(posKey(file, b.eInd, b.language), k)
    }
    return m
  })
  const count = computed(() => Object.keys(bookmarks.value).length)

  async function resolveLegacy() {
    const keys = Object.values(bookmarks.value).filter(b => !b.file).map(b => b.key)
    if (!keys.length) return
    const paths = await useTree().getPaths(keys)
    const res: Record<string, string> = {}
    for (const [k, p] of paths) res[k] = p[p.length - 1].file
    resolvedFiles.value = { ...resolvedFiles.value, ...res }
  }

  function storageKeyFor(b: Bookmark): string | undefined {
    const exact = bookmarkKey(b.key, b.eInd || [0, 0], b.language)
    if (b.eInd && bookmarks.value[exact]) return exact
    if (!b.eInd && bookmarks.value[`${b.key}::${b.language}`]) return `${b.key}::${b.language}`
    return b.file ? byPos.value.get(posKey(b.file, b.eInd, b.language)) : undefined
  }
  const isStarred = (b: Bookmark) => !!storageKeyFor(b)

  function toggle(b: Bookmark) {
    const existing = storageKeyFor(b)
    const next = { ...bookmarks.value }
    if (existing) delete next[existing]
    else next[b.eInd ? bookmarkKey(b.key, b.eInd, b.language) : `${b.key}::${b.language}`] = b
    bookmarks.value = next
    saveJson(BOOKMARKS_KEY, next)
  }

  return { bookmarks, count, isStarred, toggle, resolveLegacy }
})
