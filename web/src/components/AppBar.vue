<!-- top bar: tree toggle | search type + search box | reading controls (wide screens) | side panel button -->
<template>
  <header :class="['fixed inset-x-0 top-0 z-40 border-b border-line bg-surface transition-transform', { '-translate-y-full': hidden }]" data-testid="app-bar">
    <div class="flex h-12 items-center px-1 sm:px-2">
      <button class="icon-btn shrink-0 text-xl" :class="{ 'text-primary': ui.showTree }" title="සූත්‍ර නාමාවලිය" data-testid="tree-toggle" @click="ui.showTree = !ui.showTree"><IconMenu /></button>

      <div class="mx-1 flex min-w-0 flex-1 justify-center sm:mx-3">
        <div class="flex h-9 w-full max-w-[560px] items-stretch rounded border border-line bg-surface focus-within:border-primary">
          <div class="relative shrink-0">
            <button ref="typeBtn" class="flex h-full items-center rounded-l border-r border-line px-2 text-primary hover:bg-surface2" :title="typeInfo[search.searchType].menu" data-testid="search-type" @click="typeOpen = !typeOpen">
              <component :is="typeInfo[search.searchType].icon" class="text-lg" />
              <span v-if="mdAndUp" class="ml-1.5 whitespace-nowrap text-fg">{{ typeInfo[search.searchType].label }}</span>
              <IconDown class="ml-0.5 text-muted" />
            </button>
            <Floating :open="typeOpen" :anchor="typeBtn ?? null" @close="typeOpen = false">
              <div class="min-w-[240px] py-1" @click="typeOpen = false">
                <button v-for="(info, t) in typeInfo" :key="t" class="menu-item" :data-testid="`search-type-${t}`" @click="setType(t)">
                  <component :is="info.icon" class="mr-3 text-primary" />{{ info.menu }}<IconCheck v-if="search.searchType === t" class="ml-auto text-success" />
                </button>
              </div>
            </Floating>
          </div>
          <input v-model="input" class="min-w-0 flex-1 bg-transparent px-2 text-fg outline-none" placeholder="සෙවුම් පද මෙතැන යොදන්න" aria-label="search" data-testid="search-input"
            @focus="routeToSearchPage($router, search.searchInput, search.searchType)">
          <button v-if="input" class="px-2 text-muted hover:text-fg" title="clear" @click="input = ''"><IconClose /></button>
        </div>
      </div>

      <div class="flex shrink-0 items-center">
        <template v-if="isTextTab && mdAndUp">
          <button class="icon-btn" title="කලින් සූත්‍රය" data-testid="prev-sutta" @click="tabs.navigate(-1)"><IconPrev /></button>
          <ColumnSelector v-model="tabColumns" class="mx-1" />
          <button v-if="!tabs.isAtta(tabs.activeTab)" :class="['icon-btn', { 'bg-primary text-white hover:bg-primary': scan }]" :title="scan ? 'නව පිටපතට' : 'පැරණි පිටපතට (scan)'" :aria-pressed="scan" data-testid="scan-toggle" @click="scan = !scan"><IconScanner /></button>
          <button class="icon-btn" title="ඊළඟ සූත්‍රය" data-testid="next-sutta" @click="tabs.navigate(1)"><IconNext /></button>
        </template>
        <button v-else-if="!isTextTab && tabs.tabList.length" class="icon-btn text-success" title="කියවමින් සිටි සූත්‍රයට" data-testid="exit-to-reader" @click="$router.push('/' + tabs.activeKey)"><IconBook /></button>
        <button class="icon-btn ml-1 text-xl" :class="{ 'text-primary': ui.showPanel }" title="සැකසුම් සහ සබැඳි" data-testid="panel-toggle" @click="ui.showPanel = !ui.showPanel"><IconMore /></button>
      </div>
    </div>
    <TabsBar v-if="isTextTab" />
  </header>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconMenu from '~icons/mdi/menu'
import IconTitle from '~icons/mdi/format-title'
import IconTextSearch from '~icons/mdi/text-search'
import IconDict from '~icons/mdi/book-open-page-variant'
import IconCheck from '~icons/mdi/check'
import IconDown from '~icons/mdi/menu-down'
import IconClose from '~icons/mdi/close'
import IconPrev from '~icons/mdi/skip-previous'
import IconNext from '~icons/mdi/skip-next'
import IconScanner from '~icons/mdi/scanner'
import IconBook from '~icons/mdi/book-open-variant'
import IconMore from '~icons/mdi/dots-vertical'
import Floating from './Floating.vue'
import ColumnSelector from './ColumnSelector.vue'
import TabsBar from './TabsBar.vue'
import { useUi } from '@/stores/ui'
import { useTabs } from '@/stores/tabs'
import { useSearch, type SearchType } from '@/stores/search'
import { useSettings } from '@/stores/settings'
import { mdAndUp, smAndUp, viewport } from '@/composables/breakpoints'
import { routeToSearchPage } from '@/composables/searchRouting'
import { useTabColumns } from '@/composables/columns'

const ui = useUi(), tabs = useTabs(), search = useSearch(), settings = useSettings()
const route = useRoute(), router = useRouter()
const typeBtn = ref<HTMLElement>()
const typeOpen = ref(false)

const typeInfo = {
  title: { label: 'සූත්‍ර නාම', menu: 'සූත්‍ර නාම සෙවීම', icon: IconTitle },
  fts: { label: 'සූත්‍ර අන්තර්ගතය', menu: 'සූත්‍ර අන්තර්ගතය සෙවීම', icon: IconTextSearch },
  dict: { label: 'පාලි ශබ්දකෝෂ', menu: 'පාලි ශබ්දකෝෂ සෙවීම', icon: IconDict },
} as const
function setType(t: SearchType) {
  search.searchType = t
  routeToSearchPage(router, search.searchInput, t)
}
const input = computed({
  get: () => search.searchInput,
  set: v => { search.searchInput = v ? v.trim() : ''; routeToSearchPage(router, search.searchInput, search.searchType) },
})
const isTextTab = computed(() => route.name === 'Home' && tabs.activeInd >= 0)
const tabColumns = useTabColumns()
const scan = computed({ get: () => !!tabs.activeTab?.showScanPage, set: v => { if (tabs.activeTab) tabs.update(tabs.activeTab, { showScanPage: v }) } })

// hide on scroll down for small screens (v2 appBarHide)
const autoHide = computed(() => (viewport.height.value < 700 || !smAndUp.value) && settings.autoHideSearchBar)
const hidden = ref(false)
let lastY = 0
function onScroll() {
  const y = window.scrollY
  hidden.value = autoHide.value && y > lastY && y > 120
  lastY = y
}
watch(autoHide, a => { if (!a) hidden.value = false })
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>
