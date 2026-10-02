/**
 * Tree of suttas, loaded lazily from text.db (no 4 MB tree.json download).
 * Names are beautified for display like the v2 getName().
 */
import { defineStore } from 'pinia'
import { ref, shallowRef, reactive } from 'vue'
import { getData } from '@/data/source'
import type { NodeRow, ChildRow, PathRow, TitleRow } from '@/data/types'
import { beautifyText } from '@shared/beautify'
import { joinList } from '@shared/constants'
import { useSettings } from './settings'

export type Lang = 'pali' | 'sinh'
export interface TreeItem { id: number; key: string; parent_id: number; level: number; pali: string; sinh: string; file: string; child_count: number }

export const useTree = defineStore('tree', () => {
  const settings = useSettings()
  const nodes = reactive(new Map<string, NodeRow>()) // full node rows by key
  const items = reactive(new Map<string, TreeItem>()) // tree items (from children/paths queries) by key
  const children = reactive(new Map<number, TreeItem[]>()) // parent id (0 = roots) -> children
  const paths = new Map<string, TreeItem[]>() // key -> root..key
  const openBranches = ref<string[]>(['sp'])
  const titleIndex = shallowRef<TitleRow[] | null>(null)

  /** display name (v2 getName): beautified; sinh falls back to pali when missing */
  function nameOf(item: { pali: string; sinh: string } | undefined, lang?: Lang): string {
    if (!item) return ''
    const l = lang || settings.treeLanguage
    const raw = l === 'sinh' ? item.sinh || item.pali : item.pali
    return beautifyText(raw, l === 'sinh' && item.sinh ? 'sinh' : 'pali', settings.letterOptions)
  }

  async function getNode(key: string): Promise<NodeRow | null> {
    if (nodes.has(key)) return nodes.get(key)!
    const rows = await getData().query<NodeRow>('tree.node', { key })
    if (!rows.length) return null
    nodes.set(key, rows[0])
    return rows[0]
  }

  async function loadChildren(parentId: number): Promise<TreeItem[]> {
    if (children.has(parentId)) return children.get(parentId)!
    const rows = await getData().query<ChildRow>('tree.children', { parent_id: parentId })
    rows.forEach(r => items.set(r.key, r))
    children.set(parentId, rows)
    return rows
  }

  function storePath(rows: PathRow[], startField: 'start' | 'start_key') {
    const byStart = new Map<string | number, PathRow[]>()
    for (const r of rows) {
      const s = r[startField] as string | number
      if (!byStart.has(s)) byStart.set(s, [])
      byStart.get(s)!.push(r)
      if (!items.has(r.key)) items.set(r.key, { ...r, parent_id: -1, child_count: -1 })
    }
    for (const list of byStart.values()) {
      const path = [...list].sort((a, b) => b.depth - a.depth).map(r => items.get(r.key)!)
      paths.set(path[path.length - 1].key, path)
    }
  }

  /** root .. key items for each key (breadcrumbs, TipitakaLink) */
  async function getPaths(keys: string[]): Promise<Map<string, TreeItem[]>> {
    const missing = [...new Set(keys)].filter(k => k && !paths.has(k))
    if (missing.length) {
      for (let i = 0; i < missing.length; i += 200) {
        storePath(await getData().query<PathRow>('tree.pathsByKeys', { keys: joinList(missing.slice(i, i + 200)) }), 'start_key')
      }
    }
    return new Map(keys.filter(k => paths.has(k)).map(k => [k, paths.get(k)!]))
  }
  async function getPath(key: string): Promise<TreeItem[]> {
    return (await getPaths([key])).get(key) || []
  }
  async function getPathById(id: number, key: string): Promise<TreeItem[]> {
    if (!paths.has(key)) storePath(await getData().query<PathRow>('tree.paths', { ids: String(id) }), 'start')
    return paths.get(key) || []
  }

  async function neighbor(id: number, dir: 1 | -1): Promise<{ key: string; file: string } | null> {
    const rows = await getData().query<{ id: number; key: string; file: string }>('tree.neighbor', { id, dir })
    return rows[0] && rows[0].file ? rows[0] : null
  }

  async function exists(key: string) { return !!(await getNode(key)) }

  async function loadTitleIndex(): Promise<TitleRow[]> {
    if (!titleIndex.value) titleIndex.value = Object.freeze(await getData().query<TitleRow>('tree.titleIndex', {})) as TitleRow[]
    return titleIndex.value
  }

  /** open the branches leading to key (v2 syncOpenBranches) */
  async function openTo(key: string) {
    const path = await getPath(key)
    const parents = path.slice(0, -1)
    await Promise.all([0, ...parents.map(p => p.id)].map(id => loadChildren(id)))
    openBranches.value = parents.map(p => p.key)
  }
  function toggleBranch(key: string) {
    const i = openBranches.value.indexOf(key)
    if (i >= 0) openBranches.value.splice(i, 1)
    else openBranches.value.push(key)
  }

  return { nodes, items, children, openBranches, titleIndex, nameOf, getNode, loadChildren, getPaths, getPath, getPathById, neighbor, exists, loadTitleIndex, openTo, toggleBranch }
})
