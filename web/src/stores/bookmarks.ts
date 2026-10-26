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
import { countFeature } from '@/composables/stats'

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
/** a star on a whole sutta: on its heading, or without a position (title search, history) */
const isSutta = (b: Bookmark) => !b.eInd || b.type === 'heading'
/** one star per sutta (before 2026-10 a sutta could be starred twice: on its heading and from a list): the first kept,
 * a heading (with its text) before one without a position */
function dedupeSuttas(all: Record<string, Bookmark>): Record<string, Bookmark> {
  const seen = new Set<string>(), out: Record<string, Bookmark> = {}
  const entries = Object.entries(all).filter(([, b]) => b && typeof b.key === 'string')
  const order = (b: Bookmark) => (isSutta(b) ? (b.eInd ? 0 : 1) : 0)
  for (const [k, b] of [...entries].sort((x, y) => order(x[1]) - order(y[1]))) {
    if (isSutta(b)) { if (seen.has(b.key)) continue; seen.add(b.key) }
    out[k] = b
  }
  const kept: Record<string, Bookmark> = {} // in the stored order
  for (const [k, b] of entries) if (k in out) kept[k] = b
  return kept
}

export const useBookmarks = defineStore('bookmarks', () => {
  const bookmarks = ref<Record<string, Bookmark>>(dedupeSuttas(loadJson<Record<string, Bookmark>>(BOOKMARKS_KEY) || {}))
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

  /** the stars of a whole sutta: on its heading in the text (either column), or from a list (title search, history: no
   * position) - one star, wherever it was set */
  const suttaStars = (key: string) => Object.keys(bookmarks.value).filter(k => isSutta(bookmarks.value[k]) && bookmarks.value[k].key === key)
  function storageKeyFor(b: Bookmark): string | undefined {
    const exact = bookmarkKey(b.key, b.eInd || [0, 0], b.language)
    if (b.eInd && bookmarks.value[exact]) return exact
    if (!b.eInd && bookmarks.value[`${b.key}::${b.language}`]) return `${b.key}::${b.language}`
    if (isSutta(b)) { const k = suttaStars(b.key)[0]; if (k) return k }
    return b.file ? byPos.value.get(posKey(b.file, b.eInd, b.language)) : undefined
  }
  const isStarred = (b: Bookmark) => !!storageKeyFor(b)

  function toggle(b: Bookmark) {
    const existing = storageKeyFor(b)
    const next = { ...bookmarks.value }
    if (existing) for (const k of isSutta(b) ? [existing, ...suttaStars(b.key)] : [existing]) delete next[k]
    else { next[b.eInd ? bookmarkKey(b.key, b.eInd, b.language) : `${b.key}::${b.language}`] = b; countFeature('star') }
    bookmarks.value = next
    saveJson(BOOKMARKS_KEY, next)
  }

  return { bookmarks, count, isStarred, toggle, resolveLegacy }
})
