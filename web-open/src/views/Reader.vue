<!-- the reading view: the open texts one at a time, as tabs or side by side as columns (settings.tabView, tipitaka.app's tab
     views) and the audio bar: web/src/views/Reader.vue without the dictionary pane and the mūla / aṭṭhakathā scroll sync -->
<template>
  <div>
    <TabsBar v-if="!showColumns && tabs.activeInd >= 0" class="sticky z-20 transition-transform" :style="{ top: `${APP_BAR}px` }"
      :class="{ '-translate-y-[89px]': ui.headerHidden }" />
    <!-- columns: as many of the open texts as fit (at least two), each scrolling itself -->
    <div v-if="showColumns" ref="columnsEl" class="flex" :style="{ height: columnsHeight }" data-testid="columns">
      <div v-for="tab in shownTabs" :key="tab.uid" class="flex min-w-0 flex-1 flex-col border-r border-line last:border-r-0" data-testid="column"
        @mousedown="activate(tab)" @touchstart.passive="activate(tab)">
        <div :class="['flex shrink-0 items-center border-b border-line py-0.5 pl-3 pr-1 text-[15px]', tab === tabs.activeTab ? 'bg-primary-soft text-primary' : 'text-muted']">
          <span class="pali min-w-0 flex-1 truncate">{{ tab.node ? tree.nameOf(tab.node, 'pali') : tab.key }}</span>
          <TabsBar v-if="tab === shownTabs[shownTabs.length - 1]" list-only @mousedown.stop @touchstart.stop />
          <button class="icon-btn" :title="t('Close')" data-testid="column-close" @click.stop="tabs.closeTab(tabs.tabList.indexOf(tab))"><IconClose /></button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain" :data-pane="tab.uid">
          <Text :tab="tab" contained />
        </div>
      </div>
    </div>
    <template v-else>
      <Text v-for="(tab, i) in tabs.tabList" v-show="i === tabs.activeInd" :key="tab.uid" :tab="tab" />
    </template>
    <button class="fixed z-20 rounded-full bg-surface2 p-2 shadow-lg" :style="{ right: `${contentRight + 16}px`, bottom: `${audio.controlsVisible ? 80 : 16}px` }"
      :title="t('Back')" data-testid="scroll-top" @click="scrollTop"><IconTop /></button>
    <AudioControl />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useHead } from '@unhead/vue'
import { useElementSize, useEventListener } from '@vueuse/core'
import IconTop from '~icons/mdi/chevron-triple-up'
import IconClose from '~icons/mdi/close'
import Text from '@o/components/Text.vue'
import TabsBar from '@o/components/TabsBar.vue'
import AudioControl from '@o/components/AudioControl.vue'
import { useTabs, type Tab } from '@/stores/tabs'
import { useTree } from '@/stores/tree'
import { useAudio } from '@/stores/audio'
import { useUi } from '@/stores/ui'
import { useHistory } from '@/stores/history'
import { useLayout, APP_BAR } from '@/composables/layout'
import { viewport } from '@/composables/breakpoints'
import { t } from '@o/i18n'

const tabs = useTabs(), tree = useTree(), audio = useAudio(), ui = useUi(), history = useHistory()
const { contentRight, headerHeight, columnsView: showColumns } = useLayout()

// ---- columns view (web/src/views/Reader.vue) ----
// the text the server rendered (server/ssr_open.go) stays until this text is shown (web/src/views/Reader.vue)
watch(() => tabs.activeTab?.isLoaded || !!tabs.activeTab?.errorMessage, done => { if (done) document.getElementById('ssr')?.remove() }, { immediate: true })
const MIN_COLUMN = 300 // px; more tabs than fit: the shown ones are a window that follows the active tab
const AUDIO_BAR = 64
const columnsEl = ref<HTMLElement>()
const { width: columnsWidth } = useElementSize(columnsEl)
const maxColumns = computed(() => Math.max(2, Math.floor((columnsWidth.value || viewport.width.value) / MIN_COLUMN)))
const firstShown = ref(0)
const shownTabs = computed(() => {
  const list = tabs.tabList, n = Math.min(maxColumns.value, list.length), active = tabs.activeInd
  let start = Math.min(firstShown.value, list.length - n)
  if (active >= 0 && active < start) start = active
  if (active >= start + n) start = active - n + 1
  return list.slice(Math.max(0, start), Math.max(0, start) + n)
})
watch(shownTabs, s => { const i = tabs.tabList.indexOf(s[0]); if (i >= 0) firstShown.value = i })
const columnsHeight = computed(() => `${viewport.height.value - headerHeight.value - (audio.controlsVisible ? AUDIO_BAR : 0)}px`)
function activate(tab: Tab) { const i = tabs.tabList.indexOf(tab); if (i !== tabs.activeInd) tabs.setActive(i) }
const paneOf = (tab?: Tab) => (showColumns.value && tab ? document.querySelector<HTMLElement>(`[data-pane="${tab.uid}"]`) : null)

// the reading history (the bookmarks page)
watch(() => [tabs.activeTab?.key, !!tabs.activeTab?.node] as const, ([key, found]) => {
  if (key && found) history.visit(key, 'pali')
}, { immediate: true })

const scrollTop = () => (paneOf(tabs.activeTab) ?? window).scrollTo({ top: 0, behavior: 'smooth' })

// each tab keeps its own scroll position (web/src/views/Reader.vue)
useEventListener(window, 'scroll', () => { if (tabs.activeTab && !showColumns.value) tabs.update(tabs.activeTab, { scrollY: window.scrollY }) }, { passive: true })
watch(() => tabs.activeTab, async tab => {
  if (showColumns.value) return
  await nextTick()
  if (tab && tab === tabs.activeTab) window.scrollTo(0, tab.scrollY)
}, { immediate: true })

// title "<sutta> < <collection root>" in the script of the page
const rootItem = computed(() => {
  const key = tabs.activeTab?.key
  const root = key?.split('-')[0]
  return root && root !== key ? tree.items.get(root) || tree.nodes.get(root) : undefined
})
watch(() => tabs.activeKey, k => { if (k && !rootItem.value) tree.getPath(k) }, { immediate: true })
const title = computed(() => {
  const tab = tabs.activeTab
  if (!tab?.node) return ''
  let name = tree.nameOf(tab.node, 'pali')
  if (rootItem.value) name += ' < ' + tree.nameOf(rootItem.value, 'pali')
  return name
})
useHead({ title, meta: [{ property: 'og:title', content: title }] })
</script>
