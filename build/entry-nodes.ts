/**
 * Maps every entry to the tree node (sutta) it belongs to.
 * Semantics = v2 getKeyForEInd (src/store/tree.js): the LAST node in DFS order whose file is this file
 * and whose [pageIdx, entryIdx] <= the entry position. NULL when there is no such node (front matter).
 */
import type { JFile } from './corpus'
import type { TreeTuple } from './tree'

const posKey = (pi: number, ei: number) => pi * 100000 + ei

/** returns Map<file, number[][]> of dfs index (0-based) per [page][entry], -1 when none */
export function mapEntriesToNodes(files: JFile[], tree: Map<string, TreeTuple>, order: string[]): Map<string, number[][]> {
  const byFile = new Map<string, { pos: number; dfs: number }[]>()
  order.forEach((key, dfs) => {
    const v = tree.get(key)!
    const list = byFile.get(v[5]) || []
    list.push({ pos: posKey(v[3][0], v[3][1]), dfs })
    byFile.set(v[5], list)
  })
  const result = new Map<string, number[][]>()
  for (const f of files) {
    const nodes = (byFile.get(f.filename) || []).sort((a, b) => a.pos - b.pos)
    let ni = 0, best = -1
    result.set(f.filename, f.pages.map((p, pi) => p.pali.entries.map((_, ei) => {
      const pos = posKey(pi, ei)
      while (ni < nodes.length && nodes[ni].pos <= pos) { best = Math.max(best, nodes[ni].dfs); ni++ }
      return best
    })))
  }
  return result
}

/** v2 heading counting mapping (src/store/tabs.js addEntryFields) - only used for the build report (A14) */
export function legacyHeadingMapping(file: JFile, order: string[]): string[][] {
  let curKey = ''
  const indexOf = new Map(order.map((k, i) => [k, i]))
  return file.pages.map(p => p.pali.entries.map(e => {
    if (e.type === 'heading') curKey = curKey ? order[(indexOf.get(curKey) ?? -2) + 1] : file.filename
    return curKey
  }))
}
