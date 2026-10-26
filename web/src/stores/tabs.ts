/**
 * Open text tabs (v2 store/tabs.js). Navigation (router) is handled by composables/routeSync.ts,
 * not inside the store actions.
 */
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { EInd } from '@shared/routes'
import type { FtsHighlight } from '@shared/fts-query'
import type { NodeRow } from '@/data/types'
import { useTree } from './tree'
import { useText } from './text'
import { useSettings } from './settings'
import { smAndUp } from '@/composables/breakpoints'
import { isAttaFile, isPaliOnlyFile } from '@shared/constants'
import { countFeature } from '@/composables/stats'

export type Columns = 0 | 1 | 2 // 0 pali, 1 sinh, 2 both
export interface OpenParams {
  key: string
  eInd?: EInd | null
  language?: 'pali' | 'sinh'
  hWords?: FtsHighlight | null
  playAudio?: boolean
  reuse?: boolean // switch to an already open tab of this sutta instead of opening a new one
  /** the url names the language (/key/pali, /key/sinh: a shared link): only that column. Otherwise new tabs show the
   * default columns of the settings */
  languageColumn?: boolean
  afterActive?: boolean // a new tab goes next to the active one (opened alongside), not at the end
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
  scrollY: number // window scroll position, restored when the tab becomes active again
  hWords: FtsHighlight | null
  errorMessage: string
  isLoaded: boolean
}

let uid = 1
export const MAX_TABS = 12

export const useTabs = defineStore('tabs', () => {
  const tree = useTree(), text = useText(), settings = useSettings()
  const tabList = ref<Tab[]>([])
  const activeInd = ref(-1)
  const openCount = ref(0) // bumped on every openTab so routeSync navigates even when the active key is unchanged
  const activeTab = computed<Tab | undefined>(() => tabList.value[activeInd.value])
  const activeKey = computed(() => activeTab.value?.key || '')

  /** v2 getTabColumns; narrow: a column of the columns view too narrow for pāḷi and sinhala side by side */
  function tabColumns(tab?: Tab, narrow = false): Columns {
    const cols = tab ? tab.columns : settings.defaultColumns
    if (cols !== 2 || (smAndUp.value && !narrow)) return cols // small screens show one column (v2)
    if (settings.defaultColumns !== 2) return settings.defaultColumns
    return settings.treeLanguage === 'pali' ? 0 : 1
  }
  const isAtta = (tab?: Tab) => !!tab?.node && isAttaFile(tab.node.file)
  const paliOnly = (tab?: Tab) => !!tab?.node && isPaliOnlyFile(tab.node.file)

  /**
   * the columns of a new tab: the default columns of the settings; a url with the language shows that column; a search
   * hit in the language the default single column does not show opens both columns (the highlighted words are seen)
   */
  function columnsFor(p: OpenParams): Columns {
    const lang = (p.language === 'sinh' ? 1 : 0) as Columns
    if (p.language && p.languageColumn) return lang
    const def = settings.defaultColumns
    if (p.language && p.hWords && def !== 2 && def !== lang) return 2
    return def
  }

  function newTab(p: OpenParams, columns: Columns): Tab {
    return { uid: uid++, key: p.key, node: null, eInd: p.eInd || [0, 0], entryStart: 0, pageStart: 0, pageEnd: 0, columns, lastUsed: Date.now(),
      language: p.language, showScanPage: false, scrollY: 0, hWords: p.hWords || null, errorMessage: '', isLoaded: false }
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
   * opens a sutta in a new tab, even when it is already open (v2) - e.g. the open tab may be showing the scanned pages.
   * With p.reuse an already open sutta is re-used instead (moved to the requested position if one is given).
   * The least recently used tabs are closed beyond MAX_TABS.
   */
  async function openTab(p: OpenParams): Promise<Tab> {
    if (settings.tabView === 'single' && activeTab.value) { openCount.value++; return replaceActive(p) } // one sutta at a time
    openCount.value++
    const columns = columnsFor(p)
    const existing = p.reuse ? findTab(p.key) : -1
    if (existing >= 0) {
      setActive(existing)
      const tab = tabList.value[existing]
      if (p.eInd || p.hWords) return replaceActive({ ...p, language: p.language || tab.language })
      if (p.languageColumn) tab.columns = columns
      return tab
    }
    if (p.afterActive && activeInd.value >= 0) tabList.value.splice(++activeInd.value, 0, newTab(p, columns))
    else { tabList.value.push(newTab(p, columns)); activeInd.value = tabList.value.length - 1 }
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
    const tab = newTab(p, p.languageColumn ? columnsFor(p) : old.columns)
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
  /** the most recently used tab of a sutta (the same sutta can be open in several tabs) */
  function findTab(key: string) {
    let best = -1
    tabList.value.forEach((t, i) => { if (t.key === key && (best < 0 || t.lastUsed >= tabList.value[best].lastUsed)) best = i })
    return best
  }

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

  // one sutta at a time: the other tabs close
  watch(() => settings.tabView, v => { if (v === 'single' && tabList.value.length > 1) closeOthers(activeInd.value) })

  /** updates fields of a tab (components never mutate the tab objects directly) */
  function update(tab: Tab, patch: Partial<Pick<Tab, 'columns' | 'showScanPage' | 'scrollY'>>) {
    if (patch.showScanPage && !tab.showScanPage) countFeature('scan')
    Object.assign(tab, patch)
  }

  return { update, closeOthers, closeAll, tabList, activeInd, openCount, activeTab, activeKey, tabColumns, isAtta, paliOnly, openTab, replaceActive, closeTab, setActive, findTab, loadNextPage, loadPrevPage, navigate }
})
