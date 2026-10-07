<!-- full text search (v2 FTS.vue) -->
<template>
  <div class="p-3">
    <div v-if="inputError" class="banner mb-2 border-error" data-testid="search-error">{{ inputError }}</div>
    <div class="flex flex-wrap items-start gap-3">
      <template v-if="!advanced">
        <fieldset class="option-group">
          <label class="block"><input v-model.number="exactWord" type="radio" :value="1" data-testid="exact-1"> එම වචනයම සොයන්න</label>
          <label class="block"><input v-model.number="exactWord" type="radio" :value="0" data-testid="exact-0"> මේ අකුරු වලින් ඇරඹෙන ඕනෑම වචනයක්</label>
        </fieldset>
        <fieldset v-if="multiWord" class="text-sm">
          <label class="block"><input v-model.number="matchPhrase" type="radio" :value="1" data-testid="phrase-1"> සම්පුර්ණ වාක්‍යක් ලෙස</label>
          <label class="block"><input v-model.number="matchPhrase" type="radio" :value="0" data-testid="phrase-0"> වෙන්වූ වචන සමූහයක් ලෙස</label>
        </fieldset>
        <label v-if="multiWord && !matchPhrase">වචන අතර උපරිම දුර
          <input v-model.number="wordDistance" type="number" min="0" max="100" class="input w-20" data-testid="word-distance">
        </label>
      </template>
      <span class="flex-1" />
      <FilterDialog type="fts" />
    </div>
    <div v-if="message" class="banner my-2 border-info" data-testid="search-message">{{ message }} <ShareButton :link="link" /></div>
    <div v-if="errorMessage" class="banner my-2 border-error" data-testid="fts-error">
      <div class="font-bold">අන්තර්ගතය සෙවීමේදී වරදක් සිදුවිය.</div>{{ errorMessage }}
    </div>
    <div class="flex flex-col" data-testid="fts-results">
      <div v-for="g in groups" :key="g.key" class="border border-dotted border-line p-2" data-testid="fts-group">
        <div v-for="(item, i) in (g.open ? g.items : g.items.slice(0, 1))" :key="i" class="my-1" data-testid="fts-item" :data-key="item.key" :data-lang="item.language">
          <TipitakaLink v-if="item.key && paths.get(item.key)" :path="paths.get(item.key)!" :params="{ ...item, hWords: terms, text: null }" />
          <div class="text-[1.1em]" :style="{ fontSize: settings.fontPx }" v-html="safe(item.hText)" />
        </div>
        <button v-if="g.items.length > 1" :class="['btn border-0', g.open ? 'text-success' : 'text-info']" data-testid="fts-group-toggle" @click="g.open = !g.open">
          {{ g.open ? `මෙම ${countText(g)} වසන්න.` : `මෙම සූත්‍රයේම තවත් ${countText(g)}ක ඇත. බලන්න.` }}
        </button>
      </div>
    </div>
    <Skeleton v-if="running" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import { useDebounceFn } from '@vueuse/core'
import DOMPurify from 'dompurify'
import FilterDialog from '@/components/FilterDialog.vue'
import TipitakaLink from '@/components/TipitakaLink.vue'
import ShareButton from '@/components/ShareButton.vue'
import Skeleton from '@/components/Skeleton.vue'
import { useSearch } from '@/stores/search'
import { useTree, type TreeItem } from '@/stores/tree'
import { useSettings } from '@/stores/settings'
import { buildMatch, cleanFtsInput, ftsInputError, isAdvancedQuery, type FtsTerm } from '@shared/fts-query'
import { parseFtsOptions, ftsLink } from '@shared/routes'
import { beautifyFTSText } from '@shared/beautify'
import { FILTER_KEYS } from '@shared/constants'
import { runFts, CANDIDATE_LIMIT, type FtsGroup } from '@/data/fts'
import { QueryError } from '@/data/source'

const search = useSearch(), tree = useTree(), settings = useSettings(), route = useRoute(), router = useRouter()
search.searchType = 'fts'
if (route.params.words) search.searchInput = String(route.params.words)
const opts = parseFtsOptions(route.params.options ? String(route.params.options) : null)
const exactWord = ref(opts.exactWord), matchPhrase = ref(opts.matchPhrase), wordDistance = ref(opts.wordDistance)

const input = computed(() => cleanFtsInput(search.searchInput))
const advanced = computed(() => isAdvancedQuery(input.value))
const multiWord = computed(() => input.value.split(' ').length > 1)
const built = computed(() => buildMatch(input.value, { exactWord: exactWord.value, matchPhrase: matchPhrase.value, wordDistance: wordDistance.value }))
const inputError = computed(() => ftsInputError(input.value) || (built.value.ok ? '' : built.value.error))
const link = computed(() => ftsLink(input.value, { exactWord: exactWord.value, matchPhrase: matchPhrase.value, wordDistance: wordDistance.value }))

const groups = ref<(FtsGroup & { open: boolean })[]>([])
const paths = ref(new Map<string, TreeItem[]>())
const terms = ref<FtsTerm[]>([])
const total = ref(-1)
const running = ref(false)
const errorMessage = ref('')
const resultsInput = ref<string | null>(null)

const message = computed(() => {
  if (inputError.value || total.value < 0) return ''
  const t = beautifyFTSText(input.value, 'sinh', settings.letterOptions)
  if (!total.value) return `“${t}” යන සෙවුම සඳහා ගැළපෙන පරිච්ඡේද කිසිවක් හමුවුයේ නැත. වෙනත් සෙවුමක් උත්සාහ කර බලන්න.`
  if (total.value <= search.maxResults) return `“${t}” යන සෙවුම සඳහා ගැළපෙන පරිච්ඡේද ${total.value} ක් හමුවිය.`
  const best = total.value > CANDIDATE_LIMIT ? ` (මුල් ගැළපීම් ${CANDIDATE_LIMIT} අතරින් වඩාත් ගැළපෙන ඒවා)` : ''
  return `ඔබගේ “${t}” යන සෙවුම සඳහා ගැළපෙන පරිච්ඡේද ${total.value} ක් හමුවිය. එයින් මුල් ${search.maxResults} පහත දැක්වේ${best}.`
})
useHead({ title: computed(() => (input.value ? `“${input.value}” යන අන්තර්ගත සෙවුම සඳහා ලැබුණු ප්‍රතිඵල` : 'සූත්‍ර අන්තර්ගතය සෙවීම')) })

const safe = (html: string) => DOMPurify.sanitize(html, { ALLOWED_TAGS: ['sr', 'b'], ALLOWED_ATTR: [] })
const countText = (g: FtsGroup) => (g.items.length === 2 ? 'ඡේදය' : `ඡේද ${g.items.length - 1} `)

let seq = 0
async function getResults() {
  if (inputError.value || !built.value.ok) return
  const b = built.value, my = ++seq
  errorMessage.value = ''
  resultsInput.value = input.value
  running.value = true
  try {
    const f = search.filter.fts
    const selected = f.keys.length && f.keys.length < FILTER_KEYS.length ? f.keys.map(k => (FILTER_KEYS as readonly string[]).indexOf(k)) : null
    const lang = f.columns.length < 2 ? (f.columns[0] === 1 ? 1 : 0) : 2
    const res = await runFts(b.match, b.terms, lang, selected, settings.letterOptions)
    const p = await tree.getPaths(res.groups.map(g => g.key).filter(Boolean))
    if (my !== seq) return
    terms.value = b.terms
    paths.value = p
    groups.value = res.groups.map(g => ({ ...g, open: false }))
    total.value = res.total
  } catch (e) {
    if (my !== seq) return
    groups.value = []; total.value = -1
    errorMessage.value = e instanceof QueryError && e.code === 'fts_syntax' ? 'සෙවුම් පදය වැරදියි. කරුණාකර නැවත උත්සාහ කරන්න.'
      : `${(e as Error).message}. ඔබගේ අන්තර්ජාල සම්බන්ධතාවය පරීක්‍ෂා කර බලන්න.`
  } finally { if (my === seq) running.value = false }
}
const debounced = useDebounceFn(getResults, 200)
function updatePage() {
  if (route.name === 'fts' && route.path !== link.value) router.replace(link.value)
  debounced()
}
watch(input, v => { if (v !== resultsInput.value) updatePage() })
watch([exactWord, matchPhrase, wordDistance], updatePage)
watch(() => search.filter.fts, () => debounced(), { deep: true })
onMounted(() => { if (input.value !== resultsInput.value) updatePage() })
</script>
