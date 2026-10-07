<!-- sutta tree (v2 TipitakaTree.vue) - children are loaded on demand -->
<template>
  <nav class="relative h-full overflow-auto pb-16" :style="{ fontSize: settings.fontPx }" data-testid="tree" ref="scroller">
    <div class="absolute right-2 top-2 z-10 flex flex-col items-end space-y-2">
      <button class="icon-btn bg-error text-white shadow" title="close" @click="ui.showTree = false"><IconClose /></button>
      <button class="icon-btn bg-success text-white shadow" title="sync" data-testid="tree-sync" @click="sync"><IconSync /></button>
      <button class="icon-btn bg-success text-white shadow" title="collapse" @click="tree.openBranches = []"><IconCollapse /></button>
    </div>
    <ul v-if="roots" class="py-1">
      <TreeNode v-for="r in roots" :key="r.key" :item="r" :depth="0" :active-key="tabs.activeKey" @open="open" />
    </ul>
    <Skeleton v-else />
  </nav>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import IconClose from '~icons/mdi/close'
import IconSync from '~icons/mdi/sync'
import IconCollapse from '~icons/mdi/arrow-collapse-vertical'
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
  const tab = await tabs.openTab({ key })
  if (playAudio && tab.node) audio.startEntry(tab.node.file, tab.eInd)
  if (window.innerWidth < 1000) ui.showTree = false
}
async function sync() {
  if (!tabs.activeKey) return
  await tree.openTo(tabs.activeKey)
  await nextTick()
  const el = document.getElementById('activelabel') // may not exist when hidden (v2 threw here, A15)
  if (el && scroller.value) scroller.value.scrollTop = el.offsetTop - 100
}
watch(() => tabs.activeKey, k => { if (k && settings.syncTree) sync() })
defineExpose({ sync })
</script>
