<!-- pali dictionary search (v2 Dictionary.vue) -->
<template>
  <div class="p-3">
    <div v-if="inputError" class="banner mb-2 border-error" data-testid="search-error">{{ inputError }}</div>
    <div v-else-if="message" class="banner mb-2 border-info" data-testid="search-message">{{ message }} <ShareButton :link="link" /></div>
    <div v-if="errorMessage" class="banner mb-2 border-error" data-testid="dict-error">{{ errorMessage }}</div>
    <DictionaryFilter />
    <Skeleton v-if="running" />
    <DictionaryResults :results="results" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import { useDebounceFn } from '@vueuse/core'
import DictionaryFilter from '@/components/DictionaryFilter.vue'
import DictionaryResults from '@/components/DictionaryResults.vue'
import ShareButton from '@/components/ShareButton.vue'
import Skeleton from '@/components/Skeleton.vue'
import { useSearch } from '@/stores/search'
import { wordInputError } from '@shared/dict-words'
import { pageDictQuery, type DictResults } from '@/data/dictionary'

const search = useSearch(), route = useRoute(), router = useRouter()
search.searchType = 'dict'
if (route.params.word) search.searchInput = String(route.params.word)
const input = computed(() => search.searchInput)
const results = shallowRef<DictResults | null>(null)
const running = ref(false)
const errorMessage = ref('')
const resultsInput = ref<string | null>(null)
const inputError = computed(() => wordInputError(input.value))
const link = computed(() => '/dict/' + input.value)
const message = computed(() => {
  if (!input.value || !results.value) return ''
  const r = results.value
  const matched = !r.matches.length ? `“${input.value}” යන සෙවුම සඳහා ගැළපෙන වචන ශබ්දකෝෂ වල අඩංගු නොවේ. ` : `“${input.value}” යන සෙවුම සඳහා ගැළපෙන වචන ${r.matches.length} ක් හමුවිය. `
  return matched + (r.prefixWords.length ? `මෙම අකුරු වලින් ඇරඹෙන වෙනත් වචන ${r.prefixWords.length} ක් ශබ්දකෝෂ වල හමුවිය.` : '')
})
useHead({ title: computed(() => (input.value ? `“${input.value}” යන සෙවුමට ශබ්දකෝෂ වලින් ලැබුණු ප්‍රතිඵල` : 'පාළි ශබ්දකෝෂ සෙවීම')) })

let seq = 0
async function getResults() {
  if (inputError.value) return
  const my = ++seq
  resultsInput.value = input.value
  running.value = true
  errorMessage.value = ''
  try {
    const r = await pageDictQuery(input.value, search.shortDicts())
    if (my === seq) results.value = r
  } catch (e) {
    if (my === seq) errorMessage.value = (e as Error).message // v2 swallowed these errors (A9)
  } finally { if (my === seq) running.value = false }
}
const debounced = useDebounceFn(getResults, 400)
function updatePage() {
  if (route.name === 'dict' && route.path !== link.value) router.push(link.value)
  debounced()
}
watch(input, v => { if (v !== resultsInput.value) updatePage() })
watch(() => search.selectedDictionaries, () => debounced(), { deep: true })
// back/forward between words
watch(() => route.params.word, w => { if (route.name === 'dict' && w && w !== resultsInput.value) search.searchInput = String(w) })
onMounted(() => { if (input.value !== resultsInput.value) updatePage() })
</script>
