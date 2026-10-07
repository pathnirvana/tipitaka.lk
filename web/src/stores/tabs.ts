/**
 * Open text tabs (v2 store/tabs.js). Navigation (router) is handled by composables/routeSync.ts,
 * not inside the store actions.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { EInd } from '@shared/routes'
import type { FtsTerm } from '@shared/fts-query'
import type { NodeRow } from '@/data/types'
import { useTree } from './tree'
import { useText } from './text'
import { useSettings } from './settings'
import { smAndUp } from '@/composables/breakpoints'
import { isAttaFile, isPaliOnlyFile } from '@shared/constants'

export type Columns = 0 | 1 | 2 // 0 pali, 1 sinh, 2 both
export interface OpenParams {
  key: string
  eInd?: EInd | null
  language?: 'pali' | 'sinh'
  hWords?: FtsTerm[] | null
  playAudio?: boolean
}
export interface Tab {
  uid: number
  key: string
  node: NodeRow | null
  eInd: EInd // position the tab was opened at (highlight target)
  entryStart: number
  pageStart: number
  pageEnd: number // exclusive
  columns: Columns
  lastUsed: number
  language?: 'pali' | 'sinh'
  showScanPage: boolean
  hWords: FtsTerm[] | null
  errorMessage: string
  isLoaded: boolean
}

let uid = 1
export const MAX_TABS = 12

export const useTabs = defineStore('tabs', () => {
  const tree = useTree(), text = useText(), settings = useSettings()
  const tabList = ref<Tab[]>([])
  const activeInd = ref(-1)
  const activeTab = computed<Tab | undefined>(() => tabList.value[activeInd.value])
  const activeKey = computed(() => activeTab.value?.key || '')

  /** v2 getTabColumns */
  function tabColumns(tab?: Tab): Columns {
    const cols = tab ? tab.columns : settings.defaultColumns
    if (cols !== 2 || smAndUp.value) return cols // small screens show one column (v2)
    if (settings.defaultColumns !== 2) return settings.defaultColumns
    return settings.treeLanguage === 'pali' ? 0 : 1
  }
  const isAtta = (tab?: Tab) => !!tab?.node && isAttaFile(tab.node.file)
  const paliOnly = (tab?: Tab) => !!tab?.node && isPaliOnlyFile(tab.node.file)

  function newTab(p: OpenParams, columns: Columns): Tab {
    return { uid: uid++, key: p.key, node: null, eInd: p.eInd || [0, 0], entryStart: 0, pageStart: 0, pageEnd: 0, columns, lastUsed: Date.now(),
      language: p.language, showScanPage: false, hWords: p.hWords || null, errorMessage: '', isLoaded: false }
  }

  async function load(tab: Tab, explicitEInd: EInd | null | undefined) {
    try {
      const node = await tree.getNode(tab.key)
      if (!node || !node.file) { tab.errorMessage = `සූත්‍රය "${tab.key}" සොයාගත නොහැක.`; return }
      tab.node = node
      let eInd: EInd = explicitEInd || [node.page_idx, node.entry_idx]
      if (eInd[0] >= node.page_count || eInd[0] < 0) eInd = [node.page_idx, node.entry_idx]
      tab.eInd = eInd
      tab.entryStart = eInd[1]
      tab.pageStart = eInd[0]
      tab.pageEnd = Math.min(eInd[0] + 2, node.page_count)
      await text.loadRange(node.file, tab.pageStart, tab.pageEnd - 1)
      tab.isLoaded = true
    } catch (e) {
      tab.errorMessage = `Failed to load ${tab.key}: ${(e as Error).message}`
    }
  }

  /**
   * opens a sutta. An already open sutta is re-used (moved to the requested position if one is given) instead of
   * opening a duplicate tab, and the least recently used tabs are closed beyond MAX_TABS.
   */
  async function openTab(p: OpenParams): Promise<Tab> {
    const columns: Columns = !p.language ? settings.defaultColumns : (Number(p.language === 'sinh') as Columns)
    const existing = findTab(p.key)
    if (existing >= 0) {
      setActive(existing)
      const tab = tabList.value[existing]
      if (p.eInd || p.hWords) return replaceActive({ ...p, language: p.language || tab.language })
      if (p.language) tab.columns = columns
      return tab
    }
    tabList.value.push(newTab(p, columns))
    activeInd.value = tabList.value.length - 1
    const tab = tabList.value[activeInd.value]
    trimTabs()
    await load(tab, p.eInd)
    return tab
  }

  /** closes the least recently used tabs beyond MAX_TABS (never the active one) */
  function trimTabs() {
    while (tabList.value.length > MAX_TABS) {
      const active = tabList.value[activeInd.value]
      const oldest = tabList.value.filter(t => t !== active).sort((a, b) => a.lastUsed - b.lastUsed)[0]
      closeTab(tabList.value.indexOf(oldest))
    }
  }

  /** replace the active tab (keeps the columns / scan setting) */
  async function replaceActive(p: OpenParams): Promise<Tab> {
    const old = activeTab.value
    if (!old) return openTab(p)
    const tab = newTab(p, p.language ? (Number(p.language === 'sinh') as Columns) : old.columns)
    tab.showScanPage = old.showScanPage
    tabList.value.splice(activeInd.value, 1, tab)
    const t = tabList.value[activeInd.value]
    await load(t, p.eInd)
    return t
  }

  function closeTab(i: number) {
    if (i < 0 || i >= tabList.value.length) return
    tabList.value.splice(i, 1)
    if (i < activeInd.value || (i === activeInd.value && activeInd.value >= tabList.value.length)) activeInd.value--
    if (!tabList.value.length) activeInd.value = -1
    else if (activeInd.value < 0) activeInd.value = 0
  }
  function closeOthers(i: number) {
    const keep = tabList.value[i]
    if (!keep) return
    tabList.value = [keep]
    activeInd.value = 0
  }
  function closeAll() { tabList.value = []; activeInd.value = -1 }
  function setActive(i: number) {
    if (i >= 0 && i < tabList.value.length) { activeInd.value = i; tabList.value[i].lastUsed = Date.now() }
  }
  function findTab(key: string) { return tabList.value.findIndex(t => t.key === key) }

  async function loadNextPage(tab: Tab, by = 1) {
    if (!tab.node) return
    const newEnd = Math.min(tab.pageEnd + by, tab.node.page_count)
    if (newEnd <= tab.pageEnd) return
    await text.loadRange(tab.node.file, tab.pageEnd, newEnd - 1)
    tab.pageEnd = newEnd
  }
  async function loadPrevPage(tab: Tab) {
    if (!tab.node) return
    if (tab.entryStart > 0) { tab.entryStart = 0; return }
    if (tab.pageStart === 0) return
    await text.loadRange(tab.node.file, tab.pageStart - 1, tab.pageStart - 1)
    tab.pageStart--
  }

  /** prev / next sutta. v2 kept the old eInd here (A36) - the new sutta now opens at its own start */
  async function navigate(dir: 1 | -1) {
    const tab = activeTab.value
    if (!tab?.node) return
    const n = await tree.neighbor(tab.node.id, dir)
    if (!n) return
    await replaceActive({ key: n.key, language: tab.language })
  }

  /** updates fields of a tab (components never mutate the tab objects directly) */
  function update(tab: Tab, patch: Partial<Pick<Tab, 'columns' | 'showScanPage'>>) { Object.assign(tab, patch) }

  return { update, closeOthers, closeAll, tabList, activeInd, activeTab, activeKey, tabColumns, isAtta, paliOnly, openTab, replaceActive, closeTab, setActive, findTab, loadNextPage, loadPrevPage, navigate }
})
