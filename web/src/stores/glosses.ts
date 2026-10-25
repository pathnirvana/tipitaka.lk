/**
 * The glosses (aṭṭhakathā alignment) of the loaded pages, per file and page (the engine's glosses op): the underlined
 * words of the text, the explanation of a tapped word, the targets of the columns view.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { glosses as fetchGlosses, type Gloss } from '@/data/names'
import { glossWords } from '@/composables/glosses'
import { tokenize } from '@shared/tokenize'

export const useGlosses = defineStore('glosses', () => {
  const version = ref(0) // bumped when glosses are loaded (re-renders the underlines)
  const pages = new Map<string, Map<number, Gloss[]>>() // file -> page -> glosses whose span in the file touches the page
  const byId = new Map<string, Gloss>() // 'file:id' -> the gloss as seen from the file
  const pending = new Map<string, Promise<void>>()
  const words = new Map<string, Map<number, { g: string; cls: string }>>() // 'file:page:entry' -> underlined words
  let failed = false // a db without glosses (older build, the apps): no more requests

  /** loads the glosses of pages [from, to] of a file (the pages not loaded yet) */
  async function load(file: string, from: number, to: number) {
    if (failed) return
    const have = pages.get(file) ?? new Map<number, Gloss[]>()
    pages.set(file, have)
    const missing: number[] = []
    for (let p = from; p <= to; p++) if (!have.has(p) && !pending.has(`${file}:${p}`)) missing.push(p)
    if (!missing.length) { await Promise.all([...Array(to - from + 1).keys()].map(i => pending.get(`${file}:${from + i}`))); return }
    const lo = missing[0], hi = missing[missing.length - 1]
    const job = fetchGlosses(file, lo, hi).then(list => {
      for (let p = lo; p <= hi; p++) if (!have.has(p)) have.set(p, [])
      for (const g of list) {
        for (let p = Math.max(g.p, lo); p <= Math.min(g.ep, hi); p++) have.get(p)!.push(g)
        byId.set(`${file}:${g.g}`, g)
      }
      for (const k of [...words.keys()]) if (k.startsWith(file + ':')) words.delete(k)
      version.value++
    }).catch(() => { failed = true }).finally(() => { for (let p = lo; p <= hi; p++) pending.delete(`${file}:${p}`) })
    for (let p = lo; p <= hi; p++) pending.set(`${file}:${p}`, job)
    await job
  }

  /** the underlined words of an entry (undefined: none) */
  function entryWords(file: string, page: number, entry: number, text: string) {
    void version.value
    const list = pages.get(file)?.get(page)
    if (!list?.length) return undefined
    const k = `${file}:${page}:${entry}`
    let m = words.get(k)
    if (!m) words.set(k, (m = glossWords(list, page, entry, tokenize(text).length - 1)))
    return m.size ? m : undefined
  }

  /** the glosses with these ids, as seen from the file (its side) */
  const ofIds = (file: string, ids: number[]) => ids.flatMap(id => byId.get(`${file}:${id}`) ?? [])

  /** the first gloss of the file at or after an entry that leads to the other file (columns: paragraph level sync) */
  function nextTo(file: string, page: number, entry: number, other: string): Gloss | undefined {
    const have = pages.get(file)
    if (!have) return undefined
    let best: Gloss | undefined
    for (const [p, list] of have) {
      if (p < page) continue
      for (const g of list) {
        if (g.file !== other || g.p < page || (g.p === page && g.e < entry)) continue
        if (!best || g.p < best.p || (g.p === best.p && g.e < best.e)) best = g
      }
    }
    return best
  }

  return { version, load, entryWords, ofIds, nextTo }
})
