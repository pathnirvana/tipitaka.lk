<template>
  <AppBar />
  <SidePanel />
  <!-- slides in/out like the side panel (v-show keeps the loaded tree) -->
  <Transition enter-from-class="-translate-x-full" leave-to-class="-translate-x-full">
    <aside v-show="ui.showTree" class="fixed bottom-0 left-0 z-30 border-r border-line bg-surface shadow-xl transition-transform duration-200" :style="{ top: `${APP_BAR}px`, width: `${Math.min(350, viewport.width.value)}px` }" data-testid="drawer">
      <TreeDrawer />
    </aside>
  </Transition>
  <Transition enter-from-class="opacity-0" leave-to-class="opacity-0">
    <div v-if="ui.showTree && narrow" class="fixed inset-x-0 bottom-0 z-20 bg-black/30 transition-opacity duration-200" :style="{ top: `${APP_BAR}px` }" @click="ui.showTree = false" />
  </Transition>
  <main class="transition-[padding-left,padding-right] duration-200" :style="{ paddingTop: `${APP_BAR}px`, paddingLeft: treeColumn ? `${TREE_WIDTH}px` : '0', paddingRight: `${contentRight}px`, paddingBottom: `${dictBottom}px` }">
    <RouterView />
  </main>
  <div v-if="ui.snackbar.show" class="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full bg-info px-5 py-2 text-center text-white shadow-lg" role="status" data-testid="snackbar">
    {{ ui.snackbar.message }}
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import AppBar from './components/AppBar.vue'
import TreeDrawer from './components/TreeDrawer.vue'
import SidePanel from './components/SidePanel.vue'
import { useUi } from './stores/ui'
import { useAudio } from './stores/audio'
import { useAbbreviations } from './stores/abbreviations'
import { useSettings } from './stores/settings'
import { useRouteSync } from './composables/routeSync'
import { viewport } from './composables/breakpoints'
import { useLayout, TREE_WIDTH, APP_BAR } from './composables/layout'
import { startStats } from './composables/stats'

const ui = useUi(), route = useRoute(), router = useRouter()
useSettings()
useHead({ titleTemplate: t => (t ? `${t} | බුද්ධ ජයන්ති ත්‍රිපිටකය` : 'බුද්ධ ජයන්ති ත්‍රිපිටකය'), title: 'Home' })
useRouteSync(router)
startStats(router) // anonymous counts of the website (not in the apps)

const { narrow, treeColumn, contentRight, dictBottom } = useLayout()

onMounted(() => {
  useAbbreviations().init()
  useAudio().init()
  if (route.name !== 'Home') document.getElementById('ssr')?.remove()
})
</script>
