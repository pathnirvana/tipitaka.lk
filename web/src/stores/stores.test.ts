// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { setData, Data } from '@/data/source'
import { LocalSource } from '@/test-utils'
import { useSettings } from './settings'
import { useTabs } from './tabs'
import { useTree } from './tree'
import { useBookmarks } from './bookmarks'
import { useSearch } from './search'
import { SETTINGS_KEY, BOOKMARKS_KEY, SEARCH_SETTINGS_KEY } from '@shared/constants'

let src: LocalSource
beforeEach(() => {
  localStorage.clear()
  src = new LocalSource()
  setData(new Data(src))
  setActivePinia(createPinia())
})

describe('settings', () => {
  it('loads v2 settings and saves changes with the same key', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ darkMode: true, defaultColumns: 0, fontSize: 2, unknownOld: 1 }))
    setActivePinia(createPinia())
    const s = useSettings()
    expect(s.darkMode).toBe(true)
    expect(s.defaultColumns).toBe(0)
    expect(s.fontPx).toBe('18px')
    s.bandiLetters = false
    await nextTick()
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toMatchObject({ darkMode: true, bandiLetters: false, defaultColumns: 0 })
  })
})

describe('search settings', () => {
  it('reads v2 search settings', () => {
    localStorage.setItem(SEARCH_SETTINGS_KEY, JSON.stringify({ filter: { fts: { keys: ['dn-1'], columns: [1] } }, selectedDictionaries: ['Pali Text Society', 'Gone'], searchType: 'dict' }))
    setActivePinia(createPinia())
    const s = useSearch()
    expect(s.filter.fts).toEqual({ keys: ['dn-1'], columns: [1] })
    expect(s.filter.title.columns).toEqual([0, 1])
    expect(s.selectedDictionaries).toEqual(['Pali Text Society'])
    expect(s.shortDicts()).toEqual(['PTS'])
    expect(s.searchType).toBe('dict')
  })
})

describe('tabs', () => {
  it('opens a tab with v2 pagination and columns', async () => {
    const tabs = useTabs()
    const t = await tabs.openTab({ key: 'dn-1-1', language: 'sinh' })
    expect(t.isLoaded).toBe(true)
    expect([t.pageStart, t.pageEnd, t.entryStart, t.columns]).toEqual([0, 2, 4, 1])
    await tabs.loadPrevPage(t)
    expect(t.entryStart).toBe(0)
    await tabs.loadNextPage(t, 1)
    expect(t.pageEnd).toBe(3)
    const t2 = await tabs.openTab({ key: 'dn-1', eInd: [5, 2] })
    expect([t2.pageStart, t2.entryStart, t2.columns]).toEqual([5, 2, 2])
    const bad = await tabs.openTab({ key: 'dn-1', eInd: [9999, 0] }) // already open -> same tab, new position
    expect(bad.pageStart).toBe(0) // out of range eInd falls back to the node position
    expect(tabs.tabList.length).toBe(2)
    await tabs.openTab({ key: 'dn-1-1' })
    expect(tabs.activeInd).toBe(0)
    tabs.closeTab(1); tabs.closeTab(0)
    expect(tabs.activeInd).toBe(-1)
  })
  it('closes the least recently used tabs beyond the limit', async () => {
    const tabs = useTabs()
    const keys = (await useTree().loadChildren(0)).map(r => r.key) // 7 roots
    const more = ['dn-1-1', 'dn-1', 'an-1', 'an-10', 'kn-dhp', 'kn-dhp-1', 'ap-pat']
    for (const k of [...keys, ...more]) await tabs.openTab({ key: k })
    expect(tabs.tabList.length).toBe(12)
    expect(tabs.activeKey).toBe('ap-pat')
    expect(tabs.findTab('vp')).toBe(-1) // the oldest were closed
  })
  it('unknown keys give an error message', async () => {
    const t = await useTabs().openTab({ key: 'nope' })
    expect(t.errorMessage).toContain('nope')
  })
  it('navigates to the next sutta at its own start (A36)', async () => {
    const tabs = useTabs()
    await tabs.openTab({ key: 'kn-dhp-1', eInd: [5, 2] })
    await tabs.navigate(1)
    const next = tabs.activeTab!
    expect(next.key).not.toBe('kn-dhp-1')
    expect(next.eInd).toEqual([next.node!.page_idx, next.node!.entry_idx])
  })
  it('column rules on small screens (v2 getTabColumns)', () => {
    const tabs = useTabs(), s = useSettings()
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true })
    window.dispatchEvent(new Event('resize'))
    s.defaultColumns = 2
    s.treeLanguage = 'sinh'
    expect(tabs.tabColumns({ columns: 2 } as never)).toBe(1)
  })
})

describe('tree', () => {
  it('loads children lazily, paths and names', async () => {
    const tree = useTree()
    const roots = await tree.loadChildren(0)
    expect(roots.map(r => r.key)).toEqual(['vp', 'sp', 'ap', 'atta-vp', 'atta-sp', 'atta-ap', 'anya'])
    const path = await tree.getPath('dn-1-1')
    expect(path.map(p => p.key)).toEqual(['sp', 'dn', 'dn-1', 'dn-1-1'])
    await tree.openTo('dn-1-1')
    expect(tree.openBranches).toEqual(['sp', 'dn', 'dn-1'])
    expect(tree.nameOf({ pali: 'x', sinh: '' }, 'sinh')).toBe('x')
  })
})

describe('bookmarks', () => {
  it('keeps the v2 format, matches legacy entries by file + position', async () => {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify({ 'old-key:0-6:pali': { key: 'dn-1-1', language: 'pali', eInd: [0, 6], type: 'paragraph', text: 'x', hText: null } }))
    setActivePinia(createPinia())
    const b = useBookmarks()
    await b.resolveLegacy()
    const entry = { key: 'dn-1', language: 'pali' as const, eInd: [0, 6] as [number, number], type: 'paragraph', text: 'x', hText: null, file: 'dn-1' }
    expect(b.isStarred(entry)).toBe(true) // different node key, same position
    b.toggle(entry)
    expect(b.count).toBe(0)
    b.toggle(entry)
    expect(Object.keys(JSON.parse(localStorage.getItem(BOOKMARKS_KEY)!))).toEqual(['dn-1:0-6:pali'])
  })
})
