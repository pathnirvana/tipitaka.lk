<!-- web/src/App.vue with open.tipitaka.lk's app bar, side panel and name -->
<template>
  <AppBar />
  <SidePanel />
  <Transition enter-from-class="-translate-x-full" leave-to-class="-translate-x-full">
    <aside v-show="ui.showTree" class="fixed bottom-0 left-0 z-30 border-r border-line bg-surface shadow-xl transition-transform duration-200" :style="{ top: `${APP_BAR}px`, width: `${Math.min(350, viewport.width.value)}px` }" data-testid="drawer">
      <TreeDrawer />
    </aside>
  </Transition>
  <Transition enter-from-class="opacity-0" leave-to-class="opacity-0">
    <div v-if="ui.showTree && narrow" class="fixed inset-x-0 bottom-0 z-20 bg-black/30 transition-opacity duration-200" :style="{ top: `${APP_BAR}px` }" @click="ui.showTree = false" />
  </Transition>
  <main class="transition-[padding-left,padding-right] duration-200" :lang="scriptInfo.lang" :style="{ paddingTop: `${APP_BAR}px`, paddingLeft: treeColumn ? `${TREE_WIDTH}px` : '0', paddingRight: `${contentRight}px`, paddingBottom: `${dictBottom}px` }">
    <RouterView />
  </main>
  <div v-if="ui.snackbar.show" class="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full bg-info px-5 py-2 text-center text-white shadow-lg" role="status" data-testid="snackbar">
    {{ ui.snackbar.message }}
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import AppBar from './components/AppBar.vue'
import SidePanel from './components/SidePanel.vue'
import TreeDrawer from '@/components/TreeDrawer.vue'
import { useUi } from '@/stores/ui'
import { useAudio } from '@/stores/audio'
import { useSettings, BASE_FONT_PX } from '@o/overrides/settings'
import { useRouteSync } from '@/composables/routeSync'
import { viewport } from '@/composables/breakpoints'
import { useLayout, TREE_WIDTH, APP_BAR } from '@/composables/layout'
import { SCRIPTS } from '@shared/scripts'
import { SITE_NAME } from './site'
import { script } from './script'
import { setUiLang, UI_LANGS } from './i18n'

const ui = useUi(), router = useRouter(), settings = useSettings()
watch(() => settings.uiLang, l => setUiLang(UI_LANGS.some(x => x.code === l) ? l : 'en'), { immediate: true })
const scriptInfo = SCRIPTS.find(s => s.code === script)!
useHead({ titleTemplate: t => (t ? `${t} | ${SITE_NAME}` : SITE_NAME), title: '' })
useRouteSync(router)
// the interface follows the text size, as tipitaka.app (cst stores/settings.ts uiFontSize): text 18 → 24px, interface 16 → 20px
watch(() => settings.fontSize, d => { document.documentElement.style.fontSize = `${Math.round(16 * (1 + (d / BASE_FONT_PX) * 0.75) * 100) / 100}px` }, { immediate: true })

const { narrow, treeColumn, contentRight, dictBottom } = useLayout()

// the text the server rendered (server/ssr_open.go): the reader takes it away when its text is shown (views/Reader.vue)
watch(() => router.currentRoute.value.name, n => { if (n && n !== 'Home') document.getElementById('ssr')?.remove() }, { immediate: true })
onMounted(() => useAudio().init())
</script>
