/**
 * The aṭṭhakathā alignment in the reader (tipitaka.app's glosses, mapped to tipitaka.lk's words: dev-docs/data-pipeline.md):
 * the dashed underlines of the mūla words the aṭṭhakathā explains and of the aṭṭhakathā's lemmas, and the anchors that
 * keep a mūla column and its aṭṭhakathā column in step (tipitaka.app composables/glosses.ts).
 */
import type { Gloss } from '@/data/names'

/** below it a gloss is not used as a column anchor (often the commentary returning to an earlier word) */
export const LOW_CONF = 0.7

/** (page, entry) a before or at b */
const le = (p1: number, e1: number, p2: number, e2: number) => p1 < p2 || (p1 === p2 && e1 <= e2)

/** the words [from, to] (inclusive, to may be Infinity) of an entry that a span covers, or null */
export function spanWords(page: number, entry: number, p: number, e: number, w: number, ep: number, ee: number, ew: number): [number, number] | null {
  if (!le(p, e, page, entry) || !le(page, entry, ep, ee)) return null
  return [page === p && entry === e ? w : 0, page === ep && entry === ee ? ew : Infinity]
}

/** the underlined words of an entry: word index -> gloss ids and classes (gl-atta: explained in the aṭṭhakathā,
 * gl-lemma: an aṭṭhakathā lemma quoting the mūla) */
export function glossWords(glosses: Gloss[], page: number, entry: number, maxWord: number): Map<number, { g: string; cls: string }> {
  const out = new Map<number, { g: string; cls: string }>()
  for (const g of glosses) {
    const r = spanWords(page, entry, g.p, g.e, g.w, g.ep, g.ee, g.ew)
    if (!r) continue
    const cls = (g.side === 't' ? 'gl gl-atta' : 'gl gl-lemma') + (g.conf < LOW_CONF ? ' gl-lo' : '')
    for (let i = r[0]; i <= Math.min(r[1], maxWord); i++) {
      const o = out.get(i)
      out.set(i, o ? { g: `${o.g} ${g.g}`, cls: o.cls.includes('gl-lo') && !cls.includes('gl-lo') ? cls : o.cls } : { g: String(g.g), cls })
    }
  }
  return out
}

/** gloss ids of the underline at an element (data-g of the closest .gl) */
export function glossIdsAt(el: Element | null): number[] {
  const gl = el?.closest('.gl') as HTMLElement | null
  const g = gl?.getAttribute('data-g') // (not dataset: undefined on svg icons in old WebViews)
  return g ? g.split(' ').map(Number) : []
}

// ---------------- column sync ----------------

/** positions (content y of a scroll container) of the underlines of a column, by gloss id */
export interface Anchors { ys: number[]; ids: number[][]; byId: Map<number, number>; height: number }

export function collectAnchors(root: HTMLElement): Anchors {
  const top = root.getBoundingClientRect().top - root.scrollTop
  const ys: number[] = [], ids: number[][] = []
  const byId = new Map<number, number>()
  let lastY = -1
  // low confidence matches (often the commentary returning to an earlier word) are not used as anchors
  root.querySelectorAll<HTMLElement>('.gl[data-g]:not(.gl-lo)').forEach(el => {
    const y = Math.round(el.getBoundingClientRect().top - top)
    const gs = el.dataset.g!.split(' ').map(Number)
    for (const g of gs) if (!byId.has(g)) byId.set(g, y)
    if (y === lastY) ids[ids.length - 1].push(...gs)
    else { ys.push(y); ids.push(gs); lastY = y }
  })
  return { ys, ids, byId, height: root.scrollHeight }
}

/**
 * The y in the other column that corresponds to y in this one: interpolated between the nearest anchors before
 * and after y that both columns have. Only anchor pairs in the same order in both columns are used (a word the
 * commentary explains again elsewhere would pull the other column away). null when there are none (fall back to
 * paragraph links).
 */
export function mapY(src: Anchors, dst: Anchors, y: number): number | null {
  const pairAt = (k: number): [number, number] | null => {
    for (const g of src.ids[k]) { const d = dst.byId.get(g); if (d !== undefined) return [src.ys[k], d] }
    return null
  }
  // last anchor at or above y
  let lo = 0, hi = src.ys.length - 1, k = -1
  while (lo <= hi) { const m = (lo + hi) >> 1; if (src.ys[m] <= y) { k = m; lo = m + 1 } else hi = m - 1 }
  const pairs: [number, number][] = []
  // no distance limit: a verse's explanation can be a story of many screens, the mūla moves slowly through it
  for (let j = k, n = 0; j >= 0 && n < 8 && k - j < 3000; j--) { const p = pairAt(j); if (p) { pairs.unshift(p); n++ } }
  for (let j = k + 1, n = 0; j < src.ys.length && n < 8 && j - k < 3000; j++) { const p = pairAt(j); if (p) { pairs.push(p); n++ } }
  const chain = increasingChain(pairs)
  const before = [...chain].reverse().find(p => p[0] <= y) ?? null
  const after = chain.find(p => p[0] > y) ?? null
  if (before && after && after[0] > before[0]) return before[1] + ((y - before[0]) / (after[0] - before[0])) * (after[1] - before[1])
  if (before && y - before[0] < 1500) return before[1] + (y - before[0])
  if (after && after[0] - y < 1500) return after[1] - (after[0] - y)
  return null
}

/** the longest run of pairs (sorted by the first value) whose second values do not decrease */
export function increasingChain(pairs: [number, number][]): [number, number][] {
  const n = pairs.length
  const len = new Array<number>(n).fill(1), prev = new Array<number>(n).fill(-1)
  let best = -1
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++) if (pairs[j][1] <= pairs[i][1] && len[j] + 1 > len[i]) { len[i] = len[j] + 1; prev[i] = j }
    if (best < 0 || len[i] > len[best]) best = i
  }
  const out: [number, number][] = []
  for (let i = best; i >= 0; i = prev[i]) out.unshift(pairs[i])
  return out
}
