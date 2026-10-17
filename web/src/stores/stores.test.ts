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
import { parseLabels, parseWordTimes, wordAt, assignLabels, matchEntries, assignTimings, isTimingDoc, type TimingDoc } from './audio'

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
    const bad = await tabs.openTab({ key: 'dn-1', eInd: [9999, 0], reuse: true }) // already open -> same tab, new position
    expect(bad.pageStart).toBe(0) // out of range eInd falls back to the node position
    expect(tabs.tabList.length).toBe(2)
    await tabs.openTab({ key: 'dn-1-1', reuse: true })
    expect(tabs.activeInd).toBe(0)
    await tabs.openTab({ key: 'dn-1-1' }) // without reuse an open sutta gets another tab (v2)
    expect([tabs.tabList.length, tabs.activeInd, tabs.findTab('dn-1-1')]).toEqual([3, 2, 2]) // findTab: most recently used
    tabs.closeTab(2); tabs.closeTab(1); tabs.closeTab(0)
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

describe('audio timing files (v2)', () => {
  it('matches paragraphs by text hash in order', () => {
    expect(matchEntries(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([[0, 0, 'eq'], [1, 1, 'eq'], [2, 2, 'eq']])
    // b split into b1 b2 in the text: the old b plays for neither, the rest keep their audio
    expect(matchEntries(['a', 'b1', 'b2', 'c'], ['a', 'b', 'c'])).toEqual([[0, 0, 'eq'], [1, 1, 'sub'], [3, 2, 'eq']])
    // a paragraph removed from the text / added to the text
    expect(matchEntries(['a', 'c'], ['a', 'b', 'c'])).toEqual([[0, 0, 'eq'], [1, 2, 'eq']])
    expect(matchEntries(['a', 'x', 'b'], ['a', 'b'])).toEqual([[0, 0, 'eq'], [2, 1, 'eq']])
    // repeated paragraphs pair up in order; an edited one still plays
    expect(matchEntries(['r', 'r', 'z', 'r'], ['r', 'r', 'y', 'r'])).toEqual([[0, 0, 'eq'], [1, 1, 'eq'], [2, 2, 'sub'], [3, 3, 'eq']])
  })
  it('assigns spans and word timings across a text file\'s recordings', () => {
    const doc = (entries: TimingDoc['entries']): TimingDoc => ({ v: 2, tok: 'v1', audio: 'x.m4a', dur: 60, entries })
    const rows = ['a', 'b', 'c', 'd'].map((ph, i) => ({ audio_idx: i, page_idx: 0, entry_idx: i, audio_ph: ph }))
    const es = assignTimings(rows, [
      { src: '1.m4a', doc: doc([{ ph: 'a', s: 1000, e: 2000, t: '0:0-40,2:50-90' }, { ph: 'B', s: 2500, e: 3000, t: '0:0-10' }]) },
      { src: '2.m4a', doc: doc([{ ph: 'c', s: 0, e: 0 }, { ph: 'd', s: 300, e: 900 }]) },
    ])
    expect(es[0].label).toEqual({ start: 10, end: 20, num: 1, src: '1.m4a' })
    expect(es[0].words).toEqual({ ph: 'a', w: [0, 2], s: [10, 10.5] })
    expect([es[1].label?.start, es[1].words]).toEqual([25, undefined]) // text changed: plays without word timings
    expect(es[2].label).toBeUndefined() // empty placeholder span
    expect(es[3].label).toEqual({ start: 3, end: 9, num: 4, src: '2.m4a' })
    expect([isTimingDoc(doc([])), isTimingDoc({ v: 1, entries: {} }), isTimingDoc(null)]).toEqual([true, false, false])
  })
})

describe('audio word timings', () => {
  const labels = parseLabels('10.0\t20.0\t1\n30.5\t40\t2\n', 'x.m4a')
  const times = parseWordTimes({ v: 1, tok: 'v1', entries: { 1: { ph: 'abc', t: '0:0-40,2:50-90,3:120-200' }, 2: { ph: 'd', t: '1:10-20' }, 9: { ph: 'e', t: '0:0-1' } } }, labels)
  it('parses centiseconds from the label start into media seconds', () => {
    expect(times.get(1)).toEqual({ ph: 'abc', w: [0, 2, 3], s: [10, 10.5, 11.2] })
    expect(times.get(2)!.s).toEqual([30.6])
    expect(times.has(9)).toBe(false) // no such label
    expect(parseWordTimes({ v: 2, entries: {} }, labels).size).toBe(0)
    expect(parseWordTimes(null, labels).size).toBe(0)
  })
  it('finds the word being chanted', () => {
    const t = times.get(1)!
    expect([9.9, 10, 10.4, 10.5, 11.19, 11.2, 19].map(x => wordAt(t, x))).toEqual([-1, 0, 0, 2, 2, 3, 3])
  })
  it('attaches timings to entries through their label', () => {
    const es = assignLabels([{ audio_idx: 0, page_idx: 0, entry_idx: 3 }, { audio_idx: 1, page_idx: 0, entry_idx: 4 }, { audio_idx: 5, page_idx: 1, entry_idx: 0 }], [labels], times)
    expect(es.map(e => e.words?.ph)).toEqual(['abc', 'd', undefined])
  })
})
