<!-- web/src/components/AppBar.vue with open.tipitaka.lk's search box; the script and the settings are in the side panel -->
<template>
  <header :class="['fixed inset-x-0 top-0 z-40 border-b border-line bg-surface transition-transform', { '-translate-y-full': ui.headerHidden }]" data-testid="app-bar">
    <div class="flex h-12 items-center px-1 sm:px-2">
      <button class="icon-btn shrink-0 text-xl" :class="{ 'text-primary': ui.showTree }" :title="t('Contents')" data-testid="tree-toggle" @click="ui.showTree = !ui.showTree"><IconMenu /></button>
      <RouterLink v-if="lgAndUp" to="/" class="mx-2 shrink-0 truncate font-bold text-primary" data-testid="site-name">{{ SITE_NAME }}</RouterLink>
      <div class="flex min-w-0 flex-1 justify-center sm:mx-3"><SearchBox /></div>
      <div class="flex shrink-0 items-center">
        <template v-if="isTextTab && mdAndUp">
          <button class="icon-btn" :title="t('Previous')" data-testid="prev-sutta" @click="tabs.navigate(-1)"><IconPrev /></button>
          <button class="icon-btn" :title="t('Next')" data-testid="next-sutta" @click="tabs.navigate(1)"><IconNext /></button>
        </template>
        <button v-else-if="!isTextTab && tabs.tabList.length" class="icon-btn text-success" :title="t('Back to the text')" data-testid="exit-to-reader" @click="$router.push('/' + tabs.activeKey)"><IconBook /></button>
        <!-- the script of the page names the button of the panel where it is chosen -->
        <button class="flex h-9 items-center rounded hover:bg-surface2" :class="[smAndUp ? 'ml-1 border border-line px-2' : 'px-1', { 'border-primary text-primary': ui.showPanel || panelColumn }]"
          :title="t('Settings')" :aria-label="t('Settings')" data-testid="panel-toggle" @click="togglePanel">
          <span v-if="smAndUp" class="script-sample max-w-[6rem] truncate" :data-script="script">{{ info.native }}</span><IconMore :class="['text-xl', { 'ml-1': smAndUp }]" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import IconMenu from '~icons/mdi/menu'
import IconPrev from '~icons/mdi/skip-previous'
import IconNext from '~icons/mdi/skip-next'
import IconBook from '~icons/mdi/book-open-variant'
import IconMore from '~icons/mdi/dots-vertical'
import { useUi } from '@/stores/ui'
import { useTabs } from '@/stores/tabs'
import { useSettings } from '@/stores/settings'
import { useLayout } from '@/composables/layout'
import SearchBox from './SearchBox.vue'
import { mdAndUp, smAndUp, viewport } from '@/composables/breakpoints'
import { SCRIPTS } from '@shared/scripts'
import { SITE_NAME } from '@o/site'
import { script } from '@o/script'
import { t } from '@o/i18n'

const ui = useUi(), tabs = useTabs(), settings = useSettings()
const route = useRoute()
const { panelColumn, togglePanel } = useLayout()
const info = SCRIPTS.find(x => x.code === script)!
const lgAndUp = computed(() => viewport.width.value >= 1100)
const isTextTab = computed(() => route.name === 'Home' && tabs.activeInd >= 0)

// hide on scroll down for small screens (web/src AppBar), not while the tree or the side panel is open below it
const autoHide = computed(() => (viewport.height.value < 700 || !smAndUp.value) && settings.autoHideSearchBar)
let lastY = 0
function onScroll() {
  const y = window.scrollY
  ui.headerHidden = autoHide.value && !ui.showTree && !ui.showPanel && y > lastY && y > 120
  lastY = y
}
watch([autoHide, () => ui.showTree || ui.showPanel], ([a, open]) => { if (!a || open) ui.headerHidden = false })
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>
