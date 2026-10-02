/**
 * Navigation tree. EXACT port of dev/build-tree.js (v2) + the DFS ordering done by src/store/tree.js.
 * Parity with public/static/data/tree.json is enforced by build/build.test.ts.
 */
import type { JFile, JPage } from './corpus'

/** [pali, sinh, level, [pageIdx, entryIdx], parent, file] - same tuple as tree.json */
export type TreeTuple = [string, string, number, [number, number], string, string]
type Placeholder = []
export type TreeMap = Map<string, TreeTuple | Placeholder>

const baseTree: [string, TreeTuple | Placeholder][] = [
  ['vp', ['විනයපිටක', 'විනය පිටකය', 7, [0, 0], 'root', 'vp-prj']],
  ['sp', ['සුත්තපිටක', 'සූත්‍ර පිටකය', 7, [0, 0], 'root', 'dn-1']],
  ['ap', ['අභිධම්මපිටක', 'අභිධර්ම පිටකය', 7, [0, 0], 'root', 'ap-dhs']],
  ['dn', ['දීඝනිකාය', 'දික් සඟිය', 6, [0, 0], 'sp', 'dn-1']],
  ['mn', ['මජ්ඣිමනිකාය', 'මැදුම් සඟිය', 6, [0, 0], 'sp', 'mn-1']],
  ['sn', ['සංයුත්තනිකායො', 'සංයුත්ත නිකාය', 6, [0, 0], 'sp', 'sn-1']],
  ['an', ['අඞ්ගුත්තරනිකායො', 'අඞ්ගුත්තර සඟිය', 6, [0, 0], 'sp', 'an-1']],
  ['kn', ['ඛුද්දකනිකායො', 'කුදුගත් සඟිය', 6, [0, 0], 'sp', 'kn-khp']],
  ...['kn-khp', 'kn-dhp', 'kn-ud', 'kn-iti', 'kn-snp', 'kn-vv', 'kn-pv', 'kn-thag', 'kn-thig', 'kn-jat', 'kn-mn', 'kn-nc',
    'kn-ps', 'kn-ap', 'kn-bv', 'kn-cp', 'kn-nett', 'kn-petk', 'ap-dhs', 'ap-vbh', 'ap-dhk', 'ap-pug', 'ap-kvu', 'ap-yam',
    'ap-pat', 'vp-prj', 'vp-pct', 'vp-mv', 'vp-cv', 'vp-pv'].map(k => [k, []] as [string, Placeholder]),
  ['atta-vp', ['විනය අට්ඨකථා', 'විනය අටුවාව', 7, [0, 0], 'root', 'atta-vp-prj']],
  ['atta-sp', ['සුත්ත අට්ඨකථා', 'සූත්‍ර අටුවාව', 7, [0, 0], 'root', 'atta-dn-1']],
  ['atta-ap', ['අභිධම්ම අට්ඨකථා', 'අභිධර්ම අටුවාව', 7, [0, 0], 'root', 'atta-ap-dhs']],
  ['atta-dn', ['දීඝනිකාය අට්ඨකථා', 'දික් සඟිය අටුවාව', 6, [0, 0], 'atta-sp', 'atta-dn-1']],
  ['atta-mn', ['මජ්ඣිමනිකාය අට්ඨකථා', 'මැදුම් සඟිය අටුවාව', 6, [0, 0], 'atta-sp', 'atta-mn-1']],
  ['atta-sn', ['සංයුත්තනිකායො අට්ඨකථා', 'සංයුත්ත නිකාය අටුවාව', 6, [0, 0], 'atta-sp', 'atta-sn-1']],
  ['atta-an', ['අඞ්ගුත්තරනිකායො අට්ඨකථා', 'අඞ්ගුත්තර නිකාය අටුවාව', 6, [0, 0], 'atta-sp', 'atta-an-1']],
  ['atta-kn', ['ඛුද්දකනිකායො අට්ඨකථා', 'කුදුගත් සඟිය අටුවාව', 6, [0, 0], 'atta-sp', 'atta-kn-khp']],
  ...['atta-kn-khp', 'atta-kn-dhp', 'atta-kn-ud', 'atta-kn-iti', 'atta-kn-snp', 'atta-kn-vv', 'atta-kn-pv', 'atta-kn-thag',
    'atta-kn-thig', 'atta-kn-jat', 'atta-kn-mn', 'atta-kn-nc', 'atta-kn-ps', 'atta-kn-ap', 'atta-kn-bv', 'atta-kn-cp',
    'atta-kn-nett', 'atta-ap-dhs', 'atta-ap-vbh', 'atta-ap-dhk', 'atta-ap-pug', 'atta-ap-kvu', 'atta-ap-yam', 'atta-ap-pat',
    'atta-vp-prj', 'atta-vp-pct', 'atta-vp-mv', 'atta-vp-cv', 'atta-vp-pv'].map(k => [k, []] as [string, Placeholder]),
  ['anya', ['අන්‍ය', 'අන්‍ය', 7, [0, 0], 'root', 'anya-vm']],
]
export const headingAtEndKeys = ['kn-vv', 'kn-pv', 'kn-thag', 'kn-thig', 'kn-jat$', 'kn-jat-(5|11|22)', 'ap-dhs', 'ap-vbh',
  'ap-yam-(6|7|8|10)', 'vp-pv(-2)?$']
export const filesFilter = /^dn-|^mn-|^sn-|^an-|^kn-|^ap-|^vp-|^atta-|^anya-/

export const getName = (text: string) => {
  text = text.trim()
  text = text.replace(/\{.*?\}/g, '')
  text = text.replace(/[\[\]\(\)]/g, '')
  text = text.replace(/\$\$|\*\*|__/g, '')
  return text.replace(/\.$/, '').trim()
}
interface Heading { type: string; text: string; level?: number; keyOffset?: number; pi: number; ei: number }
export const getHeadings = (pages: JPage[], lang: 'pali' | 'sinh'): Heading[] =>
  pages.flatMap((p, pi) => p[lang].entries.map((e, ei) => ({ ...e, ei, pi })).filter(e => e.type === 'heading'))
const incrementEInd = ([pi, ei]: [number, number], pages: JPage[]): [number, number] =>
  ei + 1 < pages[pi].pali.entries.length ? [pi, ei + 1] : [pi + 1, 0]
const numEntryRegEx = /^[\d\. \-]+$/
const getPrevIfCenNum = ([pi, ei]: [number, number], pages: JPage[]): [number, number] => {
  if (ei > 0) {
    const prevE = pages[pi].pali.entries[ei - 1]
    if (prevE.type === 'centered' && numEntryRegEx.test(prevE.text)) return [pi, ei - 1]
  }
  return [pi, ei]
}

export interface TreeBuildResult { tree: TreeMap; errors: string[]; warnings: string[] }

export function buildTree(files: JFile[]): TreeBuildResult {
  const tree: TreeMap = new Map(baseTree.map(([k, v]) => [k, Array.isArray(v) ? [...v] as TreeTuple : v]))
  const errors: string[] = [], warnings: string[] = []
  const levelOf = (key: string): number | undefined => (tree.get(key) as TreeTuple | undefined)?.[2]

  function computeNewKey(he: Heading, parentStack: [string, string | number][]): [string, string] {
    // `undefined <= level` is false in JS, so placeholders stop the popping exactly like v2
    while ((levelOf(parentStack[parentStack.length - 1][0]) as number) <= (he.level as number)) parentStack.pop()
    const parent = parentStack[parentStack.length - 1]
    if ('keyOffset' in he) parent[1] = he.keyOffset as number
    const newKey = `${parent[0]}-${parent[1]}`
    const existing = tree.get(newKey)
    if (existing && existing.length) errors.push(`duplicate tree key ${newKey}`)
    parent[1] = parseInt(String(parent[1])) + 1 // NaN for non numeric offsets - same as v2
    return [newKey, parent[0]]
  }

  for (const obj of files) {
    const fileKey = obj.filename
    if (!filesFilter.test(fileKey)) { warnings.push(`file ${fileKey} not in tree filter`); continue }
    const paliOnly = /^ap-pat/.test(fileKey), isAtta = fileKey.startsWith('atta-')
    const pages = obj.pages
    const parentKey = fileKey.split('-').slice(0, -1).join('-')
    const keyOffset = fileKey.split('-').slice(-1)[0]
    const parentStack: [string, string | number][] = [[parentKey, keyOffset]]
    const headings = getHeadings(pages, 'pali'), sinhHeadings = getHeadings(pages, 'sinh')
    if (!paliOnly && headings.length !== sinhHeadings.length) {
      errors.push(`pali and sinh headings mismatch in ${fileKey}: ${headings.length} and ${sinhHeadings.length}`)
      continue
    }
    const errorHeadings = headings.filter(he => (he.level as number) > (headings[0].level as number) || !he.level)
    if (errorHeadings.length) warnings.push(`headings deeper than the first heading in ${fileKey}: ${errorHeadings.map(h => `${h.pi}-${h.ei}`).join(',')}`)
    let prevEInd: [number, number] = [0, 0]
    const isHeadingAtEnd = headingAtEndKeys.some(k => fileKey.search(k) !== -1) && !isAtta
    headings.forEach((he, hei) => {
      const [newKey, pKey] = computeNewKey(he, parentStack)
      const level = parseInt(String(he.level))
      const eInd: [number, number] = [he.pi, he.ei]
      tree.set(newKey, [getName(he.text), getName(!paliOnly ? sinhHeadings[hei].text : ''), level,
        isHeadingAtEnd && level === 1 ? prevEInd : getPrevIfCenNum(eInd, pages), pKey, fileKey])
      parentStack.push([newKey, 1])
      prevEInd = incrementEInd(eInd, pages)
    })
  }
  for (const [k, v] of tree) if (!v.length) errors.push(`tree placeholder ${k} was never filled`)
  return { tree, errors, warnings }
}

/** DFS order exactly as src/store/tree.js (setIndex + genTree + childrenSort + addOrder) */
export function dfsOrder(tree: Map<string, TreeTuple>): string[] {
  const children = new Map<string, string[]>([['root', []]])
  for (const [key, v] of tree) {
    children.set(key, children.get(key) || [])
    const p = children.get(v[4])
    if (!p) throw new Error(`parent ${v[4]} of ${key} not defined before it`)
    p.push(key)
  }
  const childInd = (key: string) => parseInt(key.split('-').splice(-1)[0])
  const childrenSort = (a: { key: string }, b: { key: string }) => {
    let ac, bc
    if (isNaN((ac = childInd(a.key))) || isNaN((bc = childInd(b.key)))) return 0
    return ac - bc
  }
  type T = { key: string; children?: T[] }
  const genTree = (key: string): T => {
    const t: T = { key }
    const ch = children.get(key)!
    if (ch.length) t.children = ch.map(genTree).sort(childrenSort)
    return t
  }
  const order: string[] = []
  const addOrder = (t: T) => { order.push(t.key); t.children?.forEach(addOrder) }
  children.get('root')!.map(genTree).forEach(addOrder)
  return order
}
