<!-- title search: a sutta, a chapter or a book by its name, typed in any script (data/titles.ts) -->
<template>
  <div class="mx-auto max-w-[900px] p-3" lang="en">
    <div class="mb-2 flex justify-end"><FilterDialog type="title" /></div>
    <div v-if="!input" class="banner border-info" data-testid="search-message">{{ t('Find a sutta, a chapter or a book by its name.') }} {{ t('Type in any script.') }}</div>
    <div v-else-if="searched && !results.length" class="banner border-info" data-testid="search-message">{{ t('No results') }}</div>
    <Skeleton v-if="loading" />
    <div v-else class="mt-2 divide-y divide-line" data-testid="title-results">
      <div v-for="r in results" :key="r.key" class="px-2" data-testid="title-result" :data-key="r.key">
        <ResultLink v-if="paths.get(r.key)" :path="paths.get(r.key)!" :target="r" :alias="r.alias" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import { useDebounceFn } from '@vueuse/core'
import FilterDialog from '@o/components/FilterDialog.vue'
import ResultLink from '@o/components/ResultLink.vue'
import Skeleton from '@/components/Skeleton.vue'
import { useSearch } from '@/stores/search'
import { useTree, type TreeItem } from '@/stores/tree'
import { searchTitles, type TitleHit } from '@o/data/titles'
import { useSearchFilter } from '@o/composables/searchFilter'
import { t } from '@o/i18n'

const search = useSearch(), tree = useTree(), route = useRoute(), router = useRouter()
const { groups } = useSearchFilter('title')
const results = shallowRef<TitleHit[]>([])
const paths = shallowRef(new Map<string, TreeItem[]>())
const loading = ref(false), searched = ref(false)

search.searchType = 'title'
if (route.params.term) search.searchInput = String(route.params.term)
const input = computed(() => search.searchInput.trim())
useHead({ title: computed(() => (input.value ? `${input.value} - ${t('Title search')}` : t('Title search'))) })

let seq = 0
async function getResults() {
  const my = ++seq
  if (!input.value) { results.value = []; searched.value = false; return }
  loading.value = !tree.titleIndex
  try {
    const out = searchTitles(await tree.loadTitleIndex(), input.value, new Set(groups.value))
    const p = await tree.getPaths(out.map(r => r.key))
    if (my !== seq) return
    paths.value = p
    results.value = out
    searched.value = true
  } finally { if (my === seq) loading.value = false }
}
const debounced = useDebounceFn(getResults, 150)
function updatePage() {
  const link = '/titles' + (input.value ? '/' + encodeURIComponent(input.value) : '')
  if (route.name === 'title' && route.path !== router.resolve(link).path) router.replace(link)
  debounced()
}
watch(input, updatePage)
watch(groups, () => debounced())
onMounted(updatePage)
</script>
