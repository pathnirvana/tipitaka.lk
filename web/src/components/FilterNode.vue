<template>
  <li>
    <div class="flex items-center gap-1 py-0.5">
      <button v-if="node.children" class="icon-btn p-0" @click="expanded = !expanded"><IconDown v-if="expanded" /><IconRight v-else /></button>
      <span v-else class="inline-block w-5" />
      <label class="flex items-center gap-1">
        <input type="checkbox" :checked="state === 'all'" :indeterminate="state === 'some'" :data-testid="`filter-${node.key}`" @change="$emit('toggle', node.leaves, state !== 'all')">
        {{ node.name }}
      </label>
    </div>
    <ul v-if="node.children && expanded" class="pl-5">
      <FilterNode v-for="c in node.children" :key="c.key" :node="c" :selected="selected" @toggle="(l, on) => $emit('toggle', l, on)" />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import IconDown from '~icons/mdi/chevron-down'
import IconRight from '~icons/mdi/chevron-right'

export interface FNode { key: string; name: string; leaves: string[]; children?: FNode[] }
const props = defineProps<{ node: FNode; selected: Set<string> }>()
defineEmits<{ toggle: [leaves: string[], on: boolean] }>()
const expanded = ref(props.node.key === 'sp')
const state = computed(() => {
  const n = props.node.leaves.filter(l => props.selected.has(l)).length
  return n === 0 ? 'none' : n === props.node.leaves.length ? 'all' : 'some'
})
</script>
