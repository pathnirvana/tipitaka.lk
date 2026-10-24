<!-- pali dictionary search (v2 Dictionary.vue): the engine's dict operation (DPD, the English and Sinhala dictionaries) -->
<template>
  <div class="mx-auto max-w-[900px] p-3">
    <div v-if="inputError" class="banner mb-2 border-error" data-testid="search-error">{{ inputError }}</div>
    <div v-else-if="message" class="banner mb-2 border-info" data-testid="search-message">{{ message }} <ShareButton :link="link" /></div>
    <div class="my-2 flex items-center">
      <span class="flex-1 text-sm text-muted">සිංහල, රෝමානු (dhamma) හෝ සිංග්ලිෂ් අකුරු වලින් සොයන්න. * සහ ? යොදා රටා සෙවිය හැක.</span>
      <DictFilter />
    </div>
    <DictView v-if="query" :word="query" mode="dict" @result="onResult" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import { useDebounceFn } from '@vueuse/core'
import DictFilter from '@/components/DictFilter.vue'
import DictView from '@/components/DictView.vue'
import ShareButton from '@/components/ShareButton.vue'
import { useSearch } from '@/stores/search'
import { wordInputError } from '@shared/dict-words'
import type { DictResult } from '@/data/dictionary'

const search = useSearch(), route = useRoute(), router = useRouter()
search.searchType = 'dict'
if (route.params.word) search.searchInput = String(route.params.word)
const input = computed(() => search.searchInput)
const query = ref('') // the input that is searched (debounced)
const result = ref<DictResult | null>(null)
const inputError = computed(() => wordInputError(input.value))
const link = computed(() => '/dict/' + input.value)
const message = computed(() => {
  const r = result.value
  if (!query.value || !r) return ''
  const n = r.entries.length + r.dpd.length
  return n ? `“${query.value}” යන සෙවුම සඳහා ශබ්දකෝෂ වලින් අර්ථ ${n} ක් හමුවිය.` : `“${query.value}” යන සෙවුම සඳහා ගැළපෙන වචන ශබ්දකෝෂ වල අඩංගු නොවේ.`
})
useHead({ title: computed(() => (input.value ? `“${input.value}” යන සෙවුමට ශබ්දකෝෂ වලින් ලැබුණු ප්‍රතිඵල` : 'පාළි ශබ්දකෝෂ සෙවීම')) })
const onResult = (r: DictResult | null) => { result.value = r }

const run = useDebounceFn(() => { if (!inputError.value) query.value = input.value }, 400)
function updatePage() {
  if (route.name === 'dict' && route.path !== link.value) router.push(link.value)
  run()
}
watch(input, v => { if (v !== query.value) updatePage() })
// back/forward between words
watch(() => route.params.word, w => { if (route.name === 'dict' && w && w !== query.value) search.searchInput = String(w) })
onMounted(() => { if (input.value && input.value !== query.value) updatePage() })
</script>
