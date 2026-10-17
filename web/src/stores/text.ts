/** page cache: only the pages being read are fetched (v2 fetched the whole 1-4 MB file) */
import { defineStore } from 'pinia'
import { markRaw, ref } from 'vue'
import { getData } from '@/data/source'
import type { AlignRow, EntryRow, FootnoteRow } from '@/data/types'
import { EntryAlign } from '@shared/align'

export interface PageData {
  pageIdx: number
  pageNum: number
  rows: EntryRow[]
  footnotes: { pali: string[]; sinh: string[] }
}

export const useText = defineStore('text', () => {
  const files = new Map<string, Map<number, PageData>>()
  const version = ref(0) // bumped when pages are added (cheap reactivity for the raw cache)
  // pali-sinhala word alignments, fetched only while the alignment view is on: file -> 'page-entry' -> alignment
  const aligns = new Map<string, Map<string, EntryAlign>>()
  const alignPages = new Map<string, Set<number>>() // pages whose alignments were fetched (most entries have none)
  const alignVersion = ref(0)

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

  function getAlign(file: string, pageIdx: number, entryIdx: number): EntryAlign | undefined {
    return aligns.get(file)?.get(`${pageIdx}-${entryIdx}`)
  }

  /** loads the alignments of pages [from, to] of a file (inclusive) */
  async function loadAlign(file: string, from: number, to: number) {
    const done = alignPages.get(file) || new Set<number>()
    alignPages.set(file, done)
    while (from <= to && done.has(from)) from++
    while (to >= from && done.has(to)) to--
    if (from > to) return
    const rows = await getData().query<AlignRow>('text.align', { file, from, to })
    const cache = aligns.get(file) || new Map<string, EntryAlign>()
    aligns.set(file, cache)
    for (const r of rows) cache.set(`${r.page_idx}-${r.entry_idx}`, new EntryAlign(r.links, r.pu, r.sa))
    for (let p = from; p <= to; p++) done.add(p)
    alignVersion.value++
  }

  return { getPage, loadRange, version, getAlign, loadAlign, alignVersion }
})
