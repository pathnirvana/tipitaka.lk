<!-- sutta name search (v2 TSearch.vue) -->
<template>
  <div class="p-3">
    <div v-if="inputError" class="banner mb-2 border-error" data-testid="search-error">{{ inputError }}</div>
    <div v-else-if="message" class="banner mb-2 border-info" data-testid="search-message">{{ message }} <ShareButton :link="link" /></div>
    <FilterDialog type="title" />
    <Skeleton v-if="loading" />
    <div v-else class="mt-2 divide-y divide-line" data-testid="title-results">
      <div v-for="r in results" :key="r.key" class="px-2" data-testid="title-result">
        <TipitakaLink v-if="paths.get(r.key)" :path="paths.get(r.key)!" :params="r" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import { useDebounceFn } from '@vueuse/core'
import { isSinglishQuery, getPossibleMatches } from '@pnfo/singlish-search'
import FilterDialog from '@/components/FilterDialog.vue'
import TipitakaLink from '@/components/TipitakaLink.vue'
import ShareButton from '@/components/ShareButton.vue'
import Skeleton from '@/components/Skeleton.vue'
import { useSearch } from '@/stores/search'
import { useTree, type TreeItem } from '@/stores/tree'
import { wordInputError } from '@shared/dict-words'
import { normalizeTitle } from '@shared/normalize'
import { FILTER_KEYS } from '@shared/constants'
import type { EInd } from '@shared/routes'

const search = useSearch(), tree = useTree(), route = useRoute(), router = useRouter()
interface Result { key: string; language: 'pali' | 'sinh'; eInd: EInd; type: null }
const results = shallowRef<Result[]>([])
const paths = shallowRef(new Map<string, TreeItem[]>())
const loading = ref(false)
const resultsInput = ref<string | null>(null)

search.searchType = 'title'
if (route.params.term) search.searchInput = String(route.params.term)

const input = computed(() => search.searchInput)
const inputError = computed(() => {
  const e = wordInputError(input.value, 'සෙවීමට සූත්‍ර නාමයෙහි කොටසක් ඇතුල් කරන්න.')
  return e === 'හිස් තැන් රහිතව එක් පදයක් පමණක් යොදන්න.' ? 'හිස්තැන් රහිතව එක් පදයක් පමණක් යොදන්න.' : e
})
const link = computed(() => '/title/' + input.value)
const message = computed(() => {
  if (!input.value || resultsInput.value === null) return ''
  const n = results.value.length
  if (!n) return `“${input.value}” යන සෙවුම සඳහා ගැළපෙන වචන කිසිවක් හමුවුයේ නැත. වෙනත් සෙවුමක් උත්සාහ කර බලන්න.`
  if (n < search.maxResults) return `“${input.value}” යන සෙවුම සඳහා ගැළපෙන වචන ${n} ක් හමුවිය.`
  return `ඔබගේ “${input.value}” යන සෙවුම සඳහා ගැළපෙන වචන ${search.maxResults} කට වඩා හමුවිය. එයින් මුල් වචන ${search.maxResults} පහත දැක්වේ.`
})
useHead({ title: computed(() => (input.value ? `“${input.value}” යන සූත්‍ර නාම සෙවීම සඳහා ලැබුණු ප්‍රතිඵල` : 'සූත්‍ර නම් සෙවීම')) })

async function getResults() {
  if (inputError.value) return
  const query = normalizeTitle(input.value)
  loading.value = true
  try {
    const index = await tree.loadTitleIndex()
    let words: string[] = isSinglishQuery(query) ? getPossibleMatches(query) : []
    if (!words.length) words = [query]
    const re = new RegExp(words.map(normalizeTitle).join('|'), 'i')
    const groups = new Set(search.filter.title.keys.map(k => (FILTER_KEYS as readonly string[]).indexOf(k)))
    const cols = search.filter.title.columns
    const out: Result[] = []
    for (let i = 0; i < index.length && out.length < search.maxResults; i++) {
      const n = index[i]
      if (!groups.has(n.grp)) continue // v2 prefix match also matched an-10 for an-1 (A5)
      const matchPali = cols.includes(0) && re.test(normalizeTitle(n.pali))
      if (matchPali || (cols.includes(1) && re.test(normalizeTitle(n.sinh)))) out.push({ key: n.key, language: matchPali ? 'pali' : 'sinh', eInd: [n.page_idx, n.entry_idx], type: null })
    }
    paths.value = await tree.getPaths(out.map(r => r.key))
    results.value = out
    resultsInput.value = input.value
  } finally { loading.value = false }
}
const debounced = useDebounceFn(getResults, 200)
function updatePage() {
  if (route.path !== link.value && route.name === 'title') router.replace(link.value)
  debounced()
}
watch(input, v => { if (v !== resultsInput.value) updatePage() })
watch(() => search.filter.title, () => debounced(), { deep: true })
onMounted(() => { if (input.value !== resultsInput.value) updatePage() })
</script>
