<template>
  <li>
    <div class="group flex cursor-pointer items-center whitespace-nowrap rounded-r-full py-0.5 pr-2 hover:bg-surface2"
      :class="{ 'bg-surface2 text-primary': item.key === activeKey }" :style="{ paddingLeft: `${depth * 16 + 10}px` }"
      :id="item.key === activeKey ? 'activelabel' : undefined" data-testid="tree-node" :data-key="item.key">
      <button class="icon-btn mr-0.5 p-1 text-[1.1em]" :aria-expanded="isOpen" :aria-label="item.key" @click.stop="toggle">
        <IconPlayCircle v-if="hasAudio && hovered" class="text-info hover:text-error" @click.stop="emit('open', item.key, true)" />
        <template v-else-if="item.child_count">
          <IconFolderOpen v-if="isOpen" /><IconFolder v-else />
        </template>
        <IconFile v-else />
      </button>
      <span class="pl-1" @mouseenter="hovered = true" @mouseleave="hovered = false" @click.stop="emit('open', item.key, false)">{{ tree.nameOf(item) }}</span>
    </div>
    <ul v-if="isOpen && kids">
      <TreeNode v-for="c in kids" :key="c.key" :item="c" :depth="depth + 1" :active-key="activeKey" @open="(k, a) => emit('open', k, a)" />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IconFolder from '~icons/mdi/folder'
import IconFolderOpen from '~icons/mdi/folder-open'
import IconFile from '~icons/mdi/file-document-outline'
import IconPlayCircle from '~icons/mdi/play-circle'
import { useTree, type TreeItem } from '@/stores/tree'
import { useAudio } from '@/stores/audio'

const props = defineProps<{ item: TreeItem; depth: number; activeKey: string }>()
const emit = defineEmits<{ open: [key: string, playAudio: boolean] }>()
const tree = useTree(), audio = useAudio()
const hovered = ref(false)
const isOpen = computed(() => tree.openBranches.includes(props.item.key))
const kids = computed(() => tree.children.get(props.item.id))
const hasAudio = computed(() => audio.isAvailable(props.item.file))
watch(isOpen, o => { if (o && props.item.child_count) tree.loadChildren(props.item.id) }, { immediate: true })
function toggle() {
  if (props.item.child_count) tree.toggleBranch(props.item.key)
  else emit('open', props.item.key, false)
}
</script>
