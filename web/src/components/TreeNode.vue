<template>
  <li>
    <div class="group relative flex cursor-pointer items-center whitespace-nowrap rounded-r-full py-0.5 pr-2 hover:bg-surface2"
      :class="{ 'bg-surface2 text-primary': item.key === activeKey }" :style="{ paddingLeft: `${depth * INDENT}px` }"
      :id="item.key === activeKey ? 'activelabel' : undefined" data-testid="tree-node" :data-key="item.key">
      <!-- recitation: its own button in the indent left of the chevron (shown on hover, always on touch screens), not on the top level -->
      <button v-if="hasAudio && depth > 0" class="tree-audio icon-btn absolute p-0.5 text-[1.05em] text-info hover:text-error" :style="{ left: `${depth * INDENT - 21}px` }"
        title="සජ්ඣායනය අසන්න" data-testid="tree-audio" @click.stop="emit('open', item.key, true)"><IconPlayCircle /></button>
      <button class="icon-btn shrink-0 p-0.5 text-[1.2em] text-muted" :aria-expanded="isOpen" :aria-label="item.key" @click.stop="toggle">
        <template v-if="item.child_count">
          <IconChevronDown v-if="isOpen" /><IconChevronRight v-else />
        </template>
        <span v-else class="block h-[1em] w-[1em]" />
      </button>
      <span class="pl-0.5" data-testid="tree-label" @click.stop="emit('open', item.key, false)">{{ tree.nameOf(item) }}</span>
    </div>
    <ul v-if="isOpen && kids">
      <TreeNode v-for="c in kids" :key="c.key" :item="c" :depth="depth + 1" :active-key="activeKey" @open="(k, a) => emit('open', k, a)" />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import IconChevronRight from '~icons/mdi/chevron-right'
import IconChevronDown from '~icons/mdi/chevron-down'
import IconPlayCircle from '~icons/mdi/play-circle'
import { useTree, type TreeItem } from '@/stores/tree'
import { useAudio } from '@/stores/audio'

const INDENT = 22 // px per level, room for the recitation button of the level below
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
