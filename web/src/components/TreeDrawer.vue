<!-- sutta tree (v2 TipitakaTree.vue) - children are loaded on demand -->
<template>
  <nav class="flex h-full flex-col" aria-label="සූත්‍ර නාමාවලිය">
    <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-1.5" :style="{ fontSize: settings.fontPx }" data-testid="tree">
      <ul v-if="roots">
        <TreeNode v-for="r in roots" :key="r.key" :item="r" :depth="0" :active-key="tabs.activeKey" @open="open" />
      </ul>
      <Skeleton v-else />
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import TreeNode from './TreeNode.vue'
import Skeleton from './Skeleton.vue'
import { useTree } from '@/stores/tree'
import { useTabs } from '@/stores/tabs'
import { useUi } from '@/stores/ui'
import { useSettings } from '@/stores/settings'
import { useAudio } from '@/stores/audio'

const tree = useTree(), tabs = useTabs(), ui = useUi(), settings = useSettings(), audio = useAudio()
const scroller = ref<HTMLElement>()
const roots = computed(() => tree.children.get(0))
onMounted(() => tree.loadChildren(0))

async function open(key: string, playAudio: boolean) {
  const wasOpen = tabs.findTab(key) >= 0
  let tab = await tabs.openTab({ key, reuse: playAudio })
  if (playAudio && wasOpen) { // the open tab is re-used: back to the start of the sutta (where the recitation starts) in text mode
    tab = await tabs.replaceActive({ key, language: tab.language })
    tabs.update(tab, { showScanPage: false })
  }
  if (playAudio && tab.node) audio.startEntry(tab.node.file, tab.eInd, tab.uid)
  // small screens: the drawer covers the text - close it after choosing a sutta, but not a branch (to go further down)
  if (window.innerWidth < 1000 && (playAudio || !tree.items.get(key)?.child_count)) ui.showTree = false
}
/** opens the branches down to the active sutta and centers it in the tree (only the tree scrolls, not the page) */
async function sync() {
  if (!tabs.activeKey) return
  await tree.openTo(tabs.activeKey)
  await nextTick()
  const el = scroller.value?.querySelector<HTMLElement>('[aria-current="page"]') // may not exist when hidden (v2 threw here, A15)
  if (!el || !scroller.value) return
  const r = el.getBoundingClientRect(), box = scroller.value.getBoundingClientRect()
  scroller.value.scrollTop += r.top - box.top - (box.height - r.height) / 2
}
watch(() => tabs.activeKey, k => { if (k && settings.syncTree) sync() })
defineExpose({ sync })
</script>
