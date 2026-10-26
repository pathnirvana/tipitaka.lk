<!-- a part of the tipitaka in the search filter: a check box (all / some / none of its parts), its parts below -->
<template>
  <li>
    <div class="flex items-center rounded-lg hover:bg-surface2">
      <button v-if="node.children" class="icon-btn shrink-0 p-1 text-muted" :aria-expanded="expanded" :title="expanded ? 'වසන්න' : 'විවෘත කරන්න'" @click="expanded = !expanded">
        <IconRight :class="['transition-transform', { 'rotate-90': expanded }]" />
      </button>
      <span v-else class="icon-btn invisible shrink-0 p-1" aria-hidden="true"><IconRight /></span>
      <label class="flex min-w-0 flex-1 cursor-pointer items-center py-1.5 pr-2">
        <input type="checkbox" class="sr-only" :checked="state === 'all'" :indeterminate="state === 'some'" :data-testid="`filter-${node.key}`" @change="$emit('toggle', node.leaves, state !== 'all')">
        <span :class="['check mr-2.5', state]" aria-hidden="true"><IconCheck v-if="state === 'all'" /><IconMinus v-else-if="state === 'some'" /></span>
        <span :class="['truncate', { 'text-muted': state === 'none' }]">{{ node.name }}</span>
      </label>
    </div>
    <ul v-if="node.children && expanded" class="ml-[15px] border-l border-line pl-2">
      <FilterNode v-for="c in node.children" :key="c.key" :node="c" :selected="selected" @toggle="(l, on) => $emit('toggle', l, on)" />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import IconRight from '~icons/mdi/chevron-right'
import IconCheck from '~icons/mdi/check-bold'
import IconMinus from '~icons/mdi/minus-thick'

export interface FNode { key: string; name: string; leaves: string[]; children?: FNode[] }
const props = defineProps<{ node: FNode; selected: Set<string> }>()
defineEmits<{ toggle: [leaves: string[], on: boolean] }>()
const expanded = ref(props.node.key === 'sp')
const state = computed(() => {
  const n = props.node.leaves.filter(l => props.selected.has(l)).length
  return n === 0 ? 'none' : n === props.node.leaves.length ? 'all' : 'some'
})
</script>

<style scoped>
/* a check box in the theme's colours (native ones ignore the dark theme on old WebViews) */
.check { display: inline-flex; width: 1.15em; height: 1.15em; flex-shrink: 0; align-items: center; justify-content: center; border-radius: 0.3em;
  border: 2px solid var(--c-muted); font-size: 0.95em; color: var(--c-surface); }
.check.all, .check.some { border-color: var(--c-primary); background: var(--c-primary); }
.check svg { width: 0.8em; height: 0.8em; }
input:focus-visible + .check { outline: 2px solid var(--c-primary); outline-offset: 2px; } /* keyboard focus only */
</style>
