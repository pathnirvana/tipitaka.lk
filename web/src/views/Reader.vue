<!-- the reading view: one TextTab per open tab (v2 Home.vue). The columns view (settings.tabView, tipitaka.app) shows the
     tabs side by side, as many as fit (at least two), each scrolling itself; a mūla column and its aṭṭhakathā column
     scroll together, word by word through the underlined words both have (composables/glosses.ts). -->
<template>
  <div ref="rootEl">
    <div v-if="showColumns" class="flex" :style="{ height: columnsHeight }" data-testid="columns"
      @wheel.passive="onUserScroll" @touchstart.passive="onUserScroll" @keydown="onUserScroll" @mousedown="onUserScroll">
      <div v-for="tab in shownTabs" :key="tab.uid" :class="['flex min-w-0 flex-1 flex-col border-r border-line last:border-r-0', { 'narrow-col': colWidth < 360 }]" data-testid="column"
        @mousedown="activate(tab)" @touchstart.passive="activate(tab)">
        <div :class="['flex shrink-0 items-center border-b border-line py-0.5 pl-3 pr-1 text-[15px]', tab === tabs.activeTab ? 'bg-primary-soft text-primary' : 'text-muted']">
          <span class="min-w-0 flex-1 truncate">{{ tab.node ? tree.nameOf(tab.node) : tab.key }}</span>
          <TabsBar v-if="tab === shownTabs[shownTabs.length - 1]" list-only @mousedown.stop @touchstart.stop />
          <button class="icon-btn" title="close" data-testid="column-close" @click.stop="tabs.closeTab(tabs.tabList.indexOf(tab))"><IconClose /></button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain" :data-pane="tab.uid" @scroll.passive="onColumnScroll(tab.uid)">
          <TextTab :ref="el => setPane(tab.uid, el)" :tab="tab" contained :narrow="colWidth < PAIR_WIDTH" />
        </div>
      </div>
    </div>
    <template v-else>
      <TextTab v-for="(tab, i) in tabs.tabList" v-show="i === tabs.activeInd" :key="tab.uid" :tab="tab" />
    </template>
    <button class="fixed z-20 rounded-full bg-surface2 p-2 shadow-lg" :style="{ right: `${dictRight + 16}px`, bottom: `${dictBottom + (audio.controlsVisible ? 80 : 16)}px` }"
      title="top" data-testid="scroll-top" @click="scrollTop"><IconTop /></button>
    <AudioControl />
    <InlineDict />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from 'vue'
import { useHead } from '@unhead/vue'
import { useElementSize, useEventListener } from '@vueuse/core'
import IconTop from '~icons/mdi/chevron-triple-up'
import IconClose from '~icons/mdi/close'
import TextTab from '@/components/TextTab.vue'
import TabsBar from '@/components/TabsBar.vue'
import AudioControl from '@/components/AudioControl.vue'
import InlineDict from '@/components/InlineDict.vue'
import { useTabs, type Tab } from '@/stores/tabs'
import { useTree } from '@/stores/tree'
import { useAudio } from '@/stores/audio'
import { useSettings } from '@/stores/settings'
import { useGlosses } from '@/stores/glosses'
import { useInlineDict } from '@/stores/inlineDict'
import { useLayout } from '@/composables/layout'
import { viewport } from '@/composables/breakpoints'
import { collectAnchors, mapY, type Anchors } from '@/composables/glosses'
import { removeBandi } from '@shared/beautify'
import { isAttaFile } from '@shared/constants'

const tabs = useTabs(), tree = useTree(), audio = useAudio(), settings = useSettings(), glosses = useGlosses(), inlineDict = useInlineDict()
const { dictRight, dictBottom, headerHeight, columnsView: showColumns } = useLayout()

// the pane's paragraph (Setting tab: place, map) follows the active text: a tab opened, switched to, a column clicked
watch(() => [tabs.activeTab?.uid, tabs.activeTab?.node?.file] as const, () => {
  const t = tabs.activeTab
  if (t?.node) inlineDict.follow({ file: t.node.file, page: t.eInd[0], entry: t.eInd[1], key: t.key })
})

// ---- columns view ----
const MIN_COLUMN = 300 // px; more tabs than fit: the shown ones are a window that follows the active tab
const PAIR_WIDTH = 640 // a column narrower than this shows one language (as small screens do)
const AUDIO_BAR = 64
const rootEl = ref<HTMLElement>()
const { width: rootWidth } = useElementSize(rootEl)
const maxColumns = computed(() => Math.max(2, Math.floor((rootWidth.value || viewport.width.value) / MIN_COLUMN)))
const firstShown = ref(0)
const shownTabs = computed(() => {
  const list = tabs.tabList, n = Math.min(maxColumns.value, list.length), active = tabs.activeInd
  let start = Math.min(firstShown.value, list.length - n)
  if (active >= 0 && active < start) start = active
  if (active >= start + n) start = active - n + 1
  return list.slice(Math.max(0, start), Math.max(0, start) + n)
})
watch(shownTabs, s => { const i = tabs.tabList.indexOf(s[0]); if (i >= 0) firstShown.value = i })
const colWidth = computed(() => (rootWidth.value || viewport.width.value) / Math.max(1, shownTabs.value.length))
const columnsHeight = computed(() => `${viewport.height.value - headerHeight.value - dictBottom.value - (audio.controlsVisible ? AUDIO_BAR : 0)}px`)
function activate(tab: Tab) { const i = tabs.tabList.indexOf(tab); if (i !== tabs.activeInd) tabs.setActive(i) }

type Pane = InstanceType<typeof TextTab>
const panes = new Map<number, Pane>()
function setPane(uid: number, el: Element | ComponentPublicInstance | null) {
  if (el) panes.set(uid, el as Pane)
  else panes.delete(uid)
}
const scrollerOf = (uid: number) => rootEl.value?.querySelector<HTMLElement>(`[data-pane="${uid}"]`) ?? null
const tabOf = (uid: number) => tabs.tabList.find(t => t.uid === uid)

// The column the reader scrolls (wheel, touch, keys, scrollbar) drives the others: the line at its top is mapped to the
// other columns through the underlined words both have (interpolated between them), or else through the paragraphs
// (the next gloss leading to the other text). Only a mūla and an aṭṭhakathā column follow each other.
let driver = -1
function onUserScroll(e: Event) {
  const pane = (e.target as HTMLElement).closest?.('[data-pane]') as HTMLElement | null
  if (pane) driver = Number(pane.getAttribute('data-pane'))
}
const linked = (a?: Tab, b?: Tab) => !!a?.node && !!b?.node && isAttaFile(a.node.file) !== isAttaFile(b.node.file)
const anchorCache = new Map<number, Anchors>()
function anchorsOf(uid: number, root: HTMLElement): Anchors {
  const a = anchorCache.get(uid)
  if (a && a.height === root.scrollHeight) return a
  const fresh = collectAnchors(root)
  anchorCache.set(uid, fresh)
  return fresh
}
watch(() => glosses.version, () => anchorCache.clear())
const LINE = 20 // the reading line, px below the top of a column
let frame = 0
function onColumnScroll(uid: number) {
  if (!showColumns.value || !settings.syncColumns || uid !== driver || frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    const src = scrollerOf(uid), srcTab = tabOf(uid)
    if (!src || !srcTab) return
    const a = anchorsOf(uid, src)
    for (const t of shownTabs.value) {
      if (t.uid === uid || !linked(srcTab, t)) continue
      const dst = scrollerOf(t.uid)
      if (!dst) continue
      const y = mapY(a, anchorsOf(t.uid, dst), src.scrollTop + LINE)
      if (y !== null) { dst.scrollTop = y - LINE; continue }
      // no common underlines in view: the paragraph the next gloss leads to
      const at = panes.get(uid)?.topEntry(LINE)
      const g = at && srcTab.node && t.node ? glosses.nextTo(srcTab.node.file, at[0], at[1], t.node.file) : undefined
      if (g) panes.get(t.uid)?.scrollToEntry(g.tp, g.te, LINE)
    }
  })
}

const scrollTop = () => {
  const s = showColumns.value && tabs.activeTab ? scrollerOf(tabs.activeTab.uid) : null
  if (s) s.scrollTo({ top: 0, behavior: 'smooth' })
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}

// each tab keeps its own scroll position (the window scrolls, so it is saved per tab and restored on switching)
useEventListener(window, 'scroll', () => { if (tabs.activeTab && !showColumns.value) tabs.update(tabs.activeTab, { scrollY: window.scrollY }) }, { passive: true })
watch(() => tabs.activeTab, async t => {
  if (showColumns.value) return
  await nextTick() // after the v-show switch, so the page is tall enough for the position
  if (t && t === tabs.activeTab) window.scrollTo(0, t.scrollY)
}, { immediate: true })

// title "<sutta> < <collection root>" (v2 Home.vue metaInfo)
const rootName = computed(() => {
  const tab = tabs.activeTab
  if (!tab) return ''
  let root = tab.key.split('-')[0]
  if (root === 'atta') root = 'atta-' + tab.key.split('-')[1]
  return root !== tab.key ? root : ''
})
const rootItem = computed(() => (rootName.value ? tree.items.get(rootName.value) || tree.nodes.get(rootName.value) : undefined))
watch(rootName, r => { if (r && !rootItem.value) tree.getPath(tabs.activeKey) }, { immediate: true })
const title = computed(() => {
  const tab = tabs.activeTab
  if (!tab?.node) return 'Home'
  let t = tree.nameOf(tab.node, tab.language)
  if (rootItem.value) t += ' < ' + tree.nameOf(rootItem.value, tab.language)
  return removeBandi(t)
})
useHead({ title, meta: [{ property: 'og:title', content: title }] })

// the server rendered article (#ssr) is removed once the reader has rendered the text
watch(() => tabs.activeTab?.isLoaded || !!tabs.activeTab?.errorMessage, done => { if (done) document.getElementById('ssr')?.remove() }, { immediate: true })
</script>
