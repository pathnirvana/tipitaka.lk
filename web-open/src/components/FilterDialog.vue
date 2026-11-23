<!-- limit title / content search to parts of the tipitaka: web/src/components/FilterDialog.vue in the language of the
     interface, the names in the script of the page, without the choice of columns (Pāḷi only) -->
<template>
  <button :class="['btn', { 'border-primary text-primary': limited }]" data-testid="filter-button" @click="show">
    <IconFilter class="mr-1" />{{ t('Collections to search') }}<span v-if="limited" class="ml-1.5 tabular-nums" data-testid="filter-limited">{{ keys.length }} / {{ SEARCH_KEYS.length }}</span>
  </button>
  <Dialog :open="open" :title="t('Collections to search')" width="400px" @close="close">
    <div class="mb-1 text-right text-sm text-muted" data-testid="filter-count">{{ chosen.length }} / {{ SEARCH_KEYS.length }}</div>
    <ul class="-mx-1" data-testid="filter-tree">
      <FilterNode v-for="n in nodes" :key="n.key" :node="n" :selected="selected" @toggle="toggle" />
    </ul>
    <template #footer>
      <button class="btn" data-testid="filter-all" @click="chosen = allSelected ? [] : [...SEARCH_KEYS]">{{ allSelected ? t('Clear') : t('All') }}</button>
      <span class="flex-1 px-2 text-right text-xs text-error">{{ chosen.length ? '' : t('Select at least one') }}</span>
      <button class="btn-primary" :disabled="!chosen.length" data-testid="filter-done" @click="close">{{ t('Done') }}</button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import IconFilter from '~icons/mdi/filter-variant'
import Dialog from '@/components/Dialog.vue'
import FilterNode, { type FNode } from './FilterNode.vue'
import { FILTER_TREE_PARENTS } from '@shared/constants'
import { useTree, type TreeItem } from '@/stores/tree'
import { SEARCH_KEYS, useSearchFilter } from '@o/composables/searchFilter'
import { t } from '@o/i18n'

const props = defineProps<{ type: 'title' | 'fts' }>()
const tree = useTree()
const { keys, limited, set } = useSearchFilter(props.type)
const open = ref(false)
const chosen = ref<string[]>([]) // while the dialog is open (it may be empty there: a search never is)
const selected = computed(() => new Set(chosen.value))
const allSelected = computed(() => chosen.value.length === SEARCH_KEYS.length)
const nodes = ref<FNode[]>([])

async function build(item: TreeItem): Promise<FNode> {
  const n: FNode = { key: item.key, name: tree.nameOf(item, 'pali'), leaves: [] }
  if (FILTER_TREE_PARENTS.includes(item.key)) n.children = (await Promise.all((await tree.loadChildren(item.id)).map(build))).filter(c => c.leaves.length)
  n.leaves = n.children ? n.children.flatMap(c => c.leaves) : SEARCH_KEYS.includes(item.key) ? [item.key] : []
  return n
}
async function show() {
  chosen.value = [...keys.value]
  open.value = true
  if (!nodes.value.length) nodes.value = (await Promise.all((await tree.loadChildren(0)).map(build))).filter(n => n.leaves.length)
}
function toggle(leaves: string[], on: boolean) {
  const s = new Set(chosen.value)
  leaves.forEach(k => (on ? s.add(k) : s.delete(k)))
  chosen.value = SEARCH_KEYS.filter(k => s.has(k))
}
/** never search nothing: closing with no part chosen searches everything again */
function close() {
  set(chosen.value.length ? chosen.value : SEARCH_KEYS)
  open.value = false
}
</script>
