import { describe, expect, it } from 'vitest'
import { glossWords, increasingChain, mapY, spanWords, type Anchors } from './glosses'
import type { Gloss } from '@/data/names'

const anchors = (list: [number, number[]][]): Anchors => {
  const byId = new Map<number, number>()
  for (const [y, ids] of list) for (const g of ids) if (!byId.has(g)) byId.set(g, y)
  return { ys: list.map(x => x[0]), ids: list.map(x => x[1]), byId, height: 10000 }
}
const gloss = (g: number, side: 't' | 'c', p: number, e: number, w: number, ep: number, ee: number, ew: number, conf = 1) =>
  ({ g, side, p, e, w, ep, ee, ew, conf } as Gloss)

describe('underlined words', () => {
  it('cuts a span over several entries at the entry ends', () => {
    expect(spanWords(1, 2, 1, 2, 5, 1, 4, 3)).toEqual([5, Infinity])
    expect(spanWords(1, 3, 1, 2, 5, 1, 4, 3)).toEqual([0, Infinity])
    expect(spanWords(1, 4, 1, 2, 5, 1, 4, 3)).toEqual([0, 3])
    expect(spanWords(2, 0, 1, 2, 5, 1, 4, 3)).toBeNull()
  })
  it('gives each word its gloss ids and the class of its side', () => {
    const m = glossWords([gloss(7, 't', 0, 1, 2, 0, 1, 3), gloss(8, 't', 0, 1, 3, 0, 1, 3, 0.5), gloss(9, 'c', 0, 1, 9, 0, 2, 0)], 0, 1, 10)
    expect(m.get(2)).toEqual({ g: '7', cls: 'gl gl-atta' })
    expect(m.get(3)).toEqual({ g: '7 8', cls: 'gl gl-atta' }) // a confident gloss keeps the word an anchor
    expect(m.get(9)?.cls).toBe('gl gl-lemma')
    expect(m.get(10)?.g).toBe('9') // to the end of the entry
    expect(m.has(4)).toBe(false)
  })
})

describe('column sync', () => {
  it('interpolates between the anchors both columns have', () => {
    const src = anchors([[0, [1]], [100, [2]], [200, [3]]])
    const dst = anchors([[50, [1]], [450, [2]], [500, [3]]])
    expect(mapY(src, dst, 50)).toBe(250)
    expect(mapY(src, dst, 150)).toBe(475)
  })
  it('ignores anchors out of order (a word explained again elsewhere)', () => {
    const src = anchors([[0, [1]], [100, [2]], [200, [3]], [300, [4]]])
    const dst = anchors([[0, [1]], [9000, [2]], [200, [3]], [300, [4]]])
    expect(mapY(src, dst, 150)).toBe(150)
    expect(increasingChain([[0, 0], [1, 9], [2, 2], [3, 3]])).toEqual([[0, 0], [2, 2], [3, 3]])
  })
  it('has no position without common anchors', () => {
    expect(mapY(anchors([[0, [1]]]), anchors([[0, [2]]]), 10)).toBeNull()
  })
})
