<!-- top bar (v2 App.vue v-app-bar) -->
<template>
  <header :class="['fixed inset-x-0 top-0 z-40 border-b border-line bg-surface transition-transform', { '-translate-y-full': hidden }]" data-testid="app-bar">
    <div class="flex h-12 items-center gap-1 px-1">
      <button class="icon-btn" :class="{ 'text-primary': ui.showTree }" title="tree" data-testid="tree-toggle" @click="ui.showTree = !ui.showTree"><IconMenu /></button>
      <span class="flex-1" />
      <div class="relative">
        <button ref="menuBtn" :class="mdAndUp ? 'btn mr-2' : 'icon-btn mr-1'" data-testid="search-type" @click="menuOpen = !menuOpen">
          <component :is="typeInfo[search.searchType].icon" class="text-primary" />
          <span v-if="mdAndUp" class="ml-1">{{ typeInfo[search.searchType].label }}</span>
        </button>
        <Floating :open="menuOpen" :anchor="menuBtn ?? null" @close="menuOpen = false">
          <div class="min-w-[260px] py-1 text-sm" @click="menuOpen = false">
            <button v-for="(info, t) in typeInfo" :key="t" class="menu-item" :data-testid="`search-type-${t}`" @click="setType(t)">
              <component :is="info.icon" class="mr-3" />{{ info.menu }}<IconCheck v-if="search.searchType === t" class="ml-auto text-success" />
            </button>
            <hr class="my-1 border-line">
            <button class="menu-item" data-testid="menu-settings" @click="toggleView('Settings')"><IconCog class="mr-3" />{{ isView('Settings') ? 'සැකසුමෙන් පිටවෙන්න' : 'සැකසුම් / Settings' }}</button>
            <button class="menu-item" data-testid="menu-bookmarks" @click="toggleView('Bookmarks')"><IconStar class="mr-3 text-star" />{{ isView('Bookmarks') ? 'තරු යෙදුමෙන් පිටවෙන්න' : 'තරු යෙදූ සූත්‍ර / Bookmarks' }}</button>
            <button class="menu-item" data-testid="menu-abbreviations" @click="toggleView('Abbreviations')"><IconAsterisk class="mr-3" />{{ isView('Abbreviations') ? 'කෙටි යෙදුමෙන් පිටවෙන්න' : 'කෙටි යෙදුම් / Abbreviations' }}</button>
            <button class="menu-item opacity-50" disabled><IconHelp class="mr-3" />උදව් / උපදෙස්</button>
            <a class="menu-item" href="https://pathnirvana.github.io/tipitaka.lk/" target="_blank" rel="noopener"><IconInfo class="mr-3" />අප ගැන / About</a>
            <a class="menu-item" href="https://github.com/pathnirvana/tipitaka.lk" target="_blank" rel="noopener"><IconGithub class="mr-3" />කේත කෝෂ්ඨය / GitHub</a>
          </div>
        </Floating>
      </div>
      <div class="relative min-w-0 max-w-[420px] flex-[3]">
        <input v-model="input" class="input pr-7" placeholder="සෙවුම් පද මෙතැන යොදන්න" aria-label="search" data-testid="search-input"
          @focus="routeToSearchPage($router, search.searchInput, search.searchType)">
        <button v-if="input" class="absolute right-1 top-1/2 -translate-y-1/2 text-muted" title="clear" @click="input = ''"><IconClose /></button>
      </div>
      <span class="flex-1" />
      <template v-if="isTextTab">
        <template v-if="mdAndUp">
          <button class="icon-btn" title="කලින් සූත්‍රයට" data-testid="prev-sutta" @click="tabs.navigate(-1)"><IconPrev /></button>
          <ColumnSelector v-model="tabColumns" />
          <div v-if="!tabs.isAtta(tabs.activeTab)" class="ml-1 inline-flex overflow-hidden rounded-full border border-line">
            <button :class="['px-2 py-1', !scan ? 'bg-primary text-white' : '']" title="නව පිටපත" @click="scan = false"><IconText /></button>
            <button :class="['px-2 py-1', scan ? 'bg-primary text-white' : '']" title="පැරණි පිටපත" data-testid="scan-toggle" @click="scan = true"><IconScanner /></button>
          </div>
          <button class="icon-btn" title="ඊළඟ සුත්‍රයට" data-testid="next-sutta" @click="tabs.navigate(1)"><IconNext /></button>
        </template>
        <div v-else class="relative">
          <button ref="dotsBtn" class="icon-btn" title="more" data-testid="text-menu" @click="dotsOpen = !dotsOpen"><IconDots class="text-primary" /></button>
          <Floating :open="dotsOpen" :anchor="dotsBtn ?? null" @close="dotsOpen = false">
            <div class="min-w-[220px] py-1 text-sm">
              <div class="px-4 py-2"><ColumnSelector v-model="tabColumns" /></div>
              <hr class="border-line">
              <button class="menu-item" data-testid="prev-sutta" @click="tabs.navigate(-1); dotsOpen = false"><IconPrev class="mr-3" />කලින් සූත්‍රයට</button>
              <button class="menu-item" data-testid="next-sutta" @click="tabs.navigate(1); dotsOpen = false"><IconNext class="mr-3" />ඊළඟ සුත්‍රයට</button>
              <template v-if="!tabs.isAtta(tabs.activeTab)">
                <hr class="border-line">
                <button class="menu-item" data-testid="scan-toggle" @click="scan = !scan; dotsOpen = false">
                  <IconText v-if="scan" class="mr-3" /><IconScanner v-else class="mr-3" />{{ scan ? 'නව පිටපතට' : 'පැරණි පිටපතට' }}
                </button>
              </template>
            </div>
          </Floating>
        </div>
      </template>
      <button v-else-if="tabs.tabList.length" class="icon-btn text-success" title="back to the text" data-testid="exit-to-reader" @click="$router.push('/' + tabs.activeKey)"><IconExit /></button>
    </div>
    <TabsBar v-if="isTextTab" />
  </header>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import IconMenu from '~icons/mdi/menu'
import IconTitle from '~icons/mdi/format-title'
import IconTextSearch from '~icons/mdi/text'
import IconDict from '~icons/mdi/book-open-page-variant'
import IconCheck from '~icons/mdi/check'
import IconCog from '~icons/mdi/cog'
import IconStar from '~icons/mdi/star'
import IconAsterisk from '~icons/mdi/asterisk'
import IconHelp from '~icons/mdi/help-circle'
import IconInfo from '~icons/mdi/information'
import IconGithub from '~icons/mdi/github'
import IconClose from '~icons/mdi/close'
import IconPrev from '~icons/mdi/skip-previous'
import IconNext from '~icons/mdi/skip-next'
import IconText from '~icons/mdi/text-box'
import IconScanner from '~icons/mdi/scanner'
import IconDots from '~icons/mdi/dots-vertical'
import IconExit from '~icons/mdi/exit-to-app'
import Floating from './Floating.vue'
import ColumnSelector from './ColumnSelector.vue'
import TabsBar from './TabsBar.vue'
import { useUi } from '@/stores/ui'
import { useTabs } from '@/stores/tabs'
import { useSearch, type SearchType } from '@/stores/search'
import { useSettings } from '@/stores/settings'
import { mdAndUp, smAndUp, viewport } from '@/composables/breakpoints'
import { routeToSearchPage } from '@/composables/searchRouting'

const ui = useUi(), tabs = useTabs(), search = useSearch(), settings = useSettings()
const route = useRoute(), router = useRouter()
const menuBtn = ref<HTMLElement>(), dotsBtn = ref<HTMLElement>()
const menuOpen = ref(false), dotsOpen = ref(false)

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
const isView = (name: string) => route.name === name
function toggleView(name: string) { if (isView(name)) router.back(); else router.push({ name }) }

const isTextTab = computed(() => route.name === 'Home' && tabs.activeInd >= 0)
const tabColumns = computed({ get: () => tabs.tabColumns(tabs.activeTab), set: v => { if (tabs.activeTab) tabs.update(tabs.activeTab, { columns: v }) } })
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
