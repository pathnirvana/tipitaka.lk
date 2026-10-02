<!-- limit title / content search to parts of the tipitaka (v2 FilterTree.vue) -->
<template>
  <button :class="['btn', { 'border-primary text-primary': limited }]" data-testid="filter-button" @click="open = true">
    <IconFilter class="mr-1" />{{ limited ? 'සෙවුම සීමා වී ඇත' : 'සෙවුම සීමා කිරීම' }}
  </button>
  <Dialog :open="open" title="සෙවුම් සීමා කරන්න" width="360px" @close="open = false">
    <div class="mb-2 inline-flex overflow-hidden rounded border border-line">
      <button v-for="(l, i) in ['පාළි', 'සිංහල']" :key="i" :class="['px-3 py-1', filter.columns.includes(i) ? 'bg-primary text-white' : '']" :data-testid="`filter-col-${i}`" @click="toggleColumn(i)">{{ l }}</button>
    </div>
    <ul class="max-h-[55vh] overflow-auto text-sm" data-testid="filter-tree">
      <FilterNode v-for="n in nodes" :key="n.key" :node="n" :selected="selected" @toggle="toggle" />
    </ul>
    <div class="mt-3 flex">
      <button class="btn" data-testid="filter-all" @click="toggleAll">{{ allSelected ? 'සියල්ල නොතෝරන්න' : 'සියල්ල තෝරන්න' }}</button>
      <span class="flex-1" />
      <button class="btn" @click="open = false">වසන්න</button>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IconFilter from '~icons/mdi/filter-variant'
import Dialog from './Dialog.vue'
import FilterNode, { type FNode } from './FilterNode.vue'
import { FILTER_KEYS, FILTER_TREE_PARENTS } from '@shared/constants'
import { useSearch } from '@/stores/search'
import { useTree, type TreeItem } from '@/stores/tree'

const props = defineProps<{ type: 'title' | 'fts' }>()
const search = useSearch(), tree = useTree()
const open = ref(false)
const filter = computed(() => search.filter[props.type])
const selected = computed(() => new Set(filter.value.keys))
const limited = computed(() => filter.value.keys.length < FILTER_KEYS.length || filter.value.columns.length < 2)
const allSelected = computed(() => filter.value.keys.length === FILTER_KEYS.length)
const nodes = ref<FNode[]>([])

async function build(item: TreeItem): Promise<FNode> {
  const n: FNode = { key: item.key, name: tree.nameOf(item), leaves: [] }
  if (FILTER_TREE_PARENTS.includes(item.key)) n.children = await Promise.all((await tree.loadChildren(item.id)).map(build))
  n.leaves = n.children ? n.children.flatMap(c => c.leaves) : (FILTER_KEYS as readonly string[]).includes(item.key) ? [item.key] : []
  return n
}
watch(open, async o => { if (o && !nodes.value.length) nodes.value = await Promise.all((await tree.loadChildren(0)).map(build)) })

function toggle(leaves: string[], on: boolean) {
  const s = new Set(filter.value.keys)
  leaves.forEach(k => (on ? s.add(k) : s.delete(k)))
  filter.value.keys = FILTER_KEYS.filter(k => s.has(k))
}
const toggleAll = () => { filter.value.keys = allSelected.value ? [] : [...FILTER_KEYS] }
function toggleColumn(i: number) {
  const c = filter.value.columns
  if (c.includes(i)) { if (c.length > 1) filter.value.columns = c.filter(x => x !== i) } // at least one (mandatory)
  else filter.value.columns = [...c, i].sort()
}
</script>
