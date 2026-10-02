/** page cache: only the pages being read are fetched (v2 fetched the whole 1-4 MB file) */
import { defineStore } from 'pinia'
import { markRaw, ref } from 'vue'
import { getData } from '@/data/source'
import type { EntryRow, FootnoteRow } from '@/data/types'

export interface PageData {
  pageIdx: number
  pageNum: number
  rows: EntryRow[]
  footnotes: { pali: string[]; sinh: string[] }
}

export const useText = defineStore('text', () => {
  const files = new Map<string, Map<number, PageData>>()
  const version = ref(0) // bumped when pages are added (cheap reactivity for the raw cache)

  function getPage(file: string, pageIdx: number): PageData | undefined {
    return files.get(file)?.get(pageIdx)
  }

  /** loads pages [from, to] of a file (inclusive) */
  async function loadRange(file: string, from: number, to: number) {
    const cache = files.get(file) || new Map<number, PageData>()
    files.set(file, cache)
    let allPresent = true
    for (let p = from; p <= to; p++) if (!cache.has(p)) allPresent = false
    if (allPresent) return
    const params = { file, from, to }
    const [entries, footnotes] = await Promise.all([
      getData().query<EntryRow>('text.entries', params),
      getData().query<FootnoteRow>('text.footnotes', params),
    ])
    for (const r of entries) {
      if (!cache.has(r.page_idx)) cache.set(r.page_idx, markRaw({ pageIdx: r.page_idx, pageNum: r.page_num, rows: [], footnotes: { pali: [], sinh: [] } }))
      const pg = cache.get(r.page_idx)!
      if (pg.rows.length === r.entry_idx) pg.rows.push(r) // guard against double insertion
    }
    for (const f of footnotes) cache.get(f.page_idx)?.footnotes[f.lang ? 'sinh' : 'pali'].push(f.text)
    version.value++
  }

  return { getPage, loadRange, version }
})
