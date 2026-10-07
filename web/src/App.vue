<template>
  <AppBar />
  <SidePanel />
  <!-- slides in/out like the side panel (v-show keeps the loaded tree) -->
  <Transition enter-from-class="-translate-x-full" leave-to-class="-translate-x-full">
    <aside v-show="ui.showTree" class="fixed bottom-0 left-0 z-30 border-r border-line bg-surface shadow-xl transition-transform duration-200" :style="{ top: headerHeight, width: `${Math.min(350, viewport.width.value)}px` }" data-testid="drawer">
      <TreeDrawer />
    </aside>
  </Transition>
  <Transition enter-from-class="opacity-0" leave-to-class="opacity-0">
    <div v-if="ui.showTree && narrow" class="fixed inset-0 z-20 bg-black/30 transition-opacity duration-200" @click="ui.showTree = false" />
  </Transition>
  <main class="transition-[padding] duration-200" :style="{ paddingTop: headerHeight, paddingLeft: ui.showTree && !narrow ? '350px' : '0' }">
    <RouterView />
  </main>
  <div v-if="ui.snackbar.show" class="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full bg-info px-5 py-2 text-center text-white shadow-lg" role="status" data-testid="snackbar">
    {{ ui.snackbar.message }}
  </div>
  <Dialog :open="ui.nativeBusy">
    <div class="flex items-center space-x-4">
      <div class="h-10 w-10 shrink-0 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <div class="text-sm">මෙම මෘදුකාංගයේ දත්ත පිටපත් වෙමින් පවතී. මොහොතක් රැඳී සිටින්න. මෙය පළමු ස්ථාපනයේ දී පමණක් සිදුවේ.</div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import AppBar from './components/AppBar.vue'
import TreeDrawer from './components/TreeDrawer.vue'
import SidePanel from './components/SidePanel.vue'
import Dialog from './components/Dialog.vue'
import { useUi } from './stores/ui'
import { useTabs } from './stores/tabs'
import { useAudio } from './stores/audio'
import { useAbbreviations } from './stores/abbreviations'
import { useSettings } from './stores/settings'
import { useRouteSync } from './composables/routeSync'
import { viewport } from './composables/breakpoints'
import { onNativeBusy, getData, isNativeApp } from './data/source'

const ui = useUi(), tabs = useTabs(), route = useRoute(), router = useRouter()
useSettings()
useHead({ titleTemplate: t => (t ? `${t} | බුද්ධ ජයන්ති ත්‍රිපිටකය` : 'බුද්ධ ජයන්ති ත්‍රිපිටකය'), title: 'Home' })
onNativeBusy(b => { ui.nativeBusy = b })
useRouteSync(router)

const narrow = computed(() => viewport.width.value < 1000)
const headerHeight = computed(() => (route.name === 'Home' && tabs.activeInd >= 0 ? '89px' : '49px'))

onMounted(() => {
  useAbbreviations().init()
  useAudio().init()
  if (isNativeApp()) getData() // starts copying the dbs on the first run
  if (route.name !== 'Home') document.getElementById('ssr')?.remove()
})
</script>
