<!-- one row of the sutta tree (tipitaka.app TreeNode): chevron button, the title as a real link (middle click / open in a new
     browser tab / keyboard), a recitation button at the end, children with a guide line down from the chevron -->
<template>
  <li>
    <div class="group flex items-start rounded-md" :class="isCurrent ? 'bg-primary-soft text-primary' : 'hover:bg-surface2'"
      :style="{ paddingLeft: `${depth * INDENT}px` }" data-testid="tree-node" :data-key="item.key"
      @keydown.right="item.child_count && !isOpen && toggle()" @keydown.left="item.child_count && isOpen && toggle()">
      <!-- the chevron box has the title's padding and line height, so it sits on the first line of a wrapped title -->
      <!-- a wide click target (the whole height of the first line, 36 px wide) without making the rows taller -->
      <button v-if="item.child_count" class="flex w-9 shrink-0 justify-center self-stretch leading-snug" data-testid="tree-toggle-branch"
        :aria-label="isOpen ? 'වසන්න' : 'විවෘත කරන්න'" :aria-expanded="isOpen" @click.stop="toggle">
        <span class="my-0.5 flex h-[calc(1.375em+0.25rem)] w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-line hover:text-primary">
          <IconChevron class="text-[1.35em] transition-transform duration-150" :class="{ 'rotate-90': isOpen }" />
        </span>
      </button>
      <span v-else class="w-9 shrink-0" />
      <a :href="href" class="min-w-0 flex-1 py-1 pr-1 leading-snug" :aria-current="isCurrent ? 'page' : undefined" data-testid="tree-label" @click="onClick">
        {{ tree.nameOf(item) }}
      </a>
      <!-- recitation (on row hover, always on touch screens), not on the top level -->
      <button v-if="hasAudio && depth > 0" class="tree-audio icon-btn shrink-0 p-1 text-info hover:text-primary" title="සජ්ඣායනය අසන්න"
        data-testid="tree-audio" @click.stop="emit('open', item.key, true)"><IconPlayCircle /></button>
    </div>
    <ul v-if="isOpen && kids" class="relative">
      <span class="pointer-events-none absolute bottom-1 top-0 w-px bg-line" :style="{ left: `${depth * INDENT + 17.5}px` }" />
      <TreeNode v-for="c in kids" :key="c.key" :item="c" :depth="depth + 1" :active-key="activeKey" @open="(k, a) => emit('open', k, a)" />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import IconChevron from '~icons/mdi/chevron-right'
import IconPlayCircle from '~icons/mdi/play-circle-outline'
import { useTree, type TreeItem } from '@/stores/tree'
import { useAudio } from '@/stores/audio'

const INDENT = 16 // px per level
const props = defineProps<{ item: TreeItem; depth: number; activeKey: string }>()
const emit = defineEmits<{ open: [key: string, playAudio: boolean] }>()
const tree = useTree(), audio = useAudio(), router = useRouter()
const isOpen = computed(() => tree.openBranches.includes(props.item.key))
const isCurrent = computed(() => props.item.key === props.activeKey)
const kids = computed(() => tree.children.get(props.item.id))
const hasAudio = computed(() => audio.isAvailable(props.item.file))
const href = computed(() => router.resolve('/' + props.item.key).href)
watch(isOpen, o => { if (o && props.item.child_count) tree.loadChildren(props.item.id) }, { immediate: true })

function toggle() { tree.toggleBranch(props.item.key) }
/** opens the sutta in a new tab (a modified / middle click is left to the browser: a new browser tab); a closed branch also opens */
function onClick(e: MouseEvent) {
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return
  e.preventDefault()
  if (props.item.child_count && !isOpen.value) toggle()
  emit('open', props.item.key, false)
}
</script>
