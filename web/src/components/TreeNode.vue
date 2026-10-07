<template>
  <li>
    <div class="group relative flex cursor-pointer items-center whitespace-nowrap rounded-r-full py-0.5 pr-2 hover:bg-surface2"
      :class="{ 'bg-surface2 text-primary': item.key === activeKey }" :style="{ paddingLeft: `${depth * 16 + 26}px` }"
      :id="item.key === activeKey ? 'activelabel' : undefined" data-testid="tree-node" :data-key="item.key">
      <!-- recitation: its own button in the indent left of the folder/file icon (shown on hover, always on touch screens) -->
      <button v-if="hasAudio" class="tree-audio icon-btn absolute p-0.5 text-[1.05em] text-info hover:text-error" :style="{ left: `${depth * 16 + 2}px` }"
        title="සජ්ඣායනය අසන්න" data-testid="tree-audio" @click.stop="emit('open', item.key, true)"><IconPlayCircle /></button>
      <button class="icon-btn mr-0.5 p-1 text-[1.1em]" :aria-expanded="isOpen" :aria-label="item.key" @click.stop="toggle">
        <template v-if="item.child_count">
          <IconFolderOpen v-if="isOpen" /><IconFolder v-else />
        </template>
        <IconFile v-else />
      </button>
      <span class="pl-1" @click.stop="emit('open', item.key, false)">{{ tree.nameOf(item) }}</span>
    </div>
    <ul v-if="isOpen && kids">
      <TreeNode v-for="c in kids" :key="c.key" :item="c" :depth="depth + 1" :active-key="activeKey" @open="(k, a) => emit('open', k, a)" />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import IconFolder from '~icons/mdi/folder'
import IconFolderOpen from '~icons/mdi/folder-open'
import IconFile from '~icons/mdi/file-document-outline'
import IconPlayCircle from '~icons/mdi/play-circle'
import { useTree, type TreeItem } from '@/stores/tree'
import { useAudio } from '@/stores/audio'

const props = defineProps<{ item: TreeItem; depth: number; activeKey: string }>()
const emit = defineEmits<{ open: [key: string, playAudio: boolean] }>()
const tree = useTree(), audio = useAudio()
const isOpen = computed(() => tree.openBranches.includes(props.item.key))
const kids = computed(() => tree.children.get(props.item.id))
const hasAudio = computed(() => audio.isAvailable(props.item.file))
watch(isOpen, o => { if (o && props.item.child_count) tree.loadChildren(props.item.id) }, { immediate: true })
function toggle() {
  if (props.item.child_count) tree.toggleBranch(props.item.key)
  else emit('open', props.item.key, false)
}
</script>
