<!-- full text search of the pāḷi, the words typed in any script (web/src/views/FtsSearch.vue; data/query.ts) -->
<template>
  <div class="mx-auto max-w-[900px] p-3" lang="en">
    <div class="mb-2 flex flex-wrap items-center text-[15px]" data-testid="fts-options">
      <template v-if="!advanced">
      <label class="mr-4 inline-flex items-center" :title="t('Match only the word as typed, not the words that begin with it')">
        <input v-model="exact" type="checkbox" class="mr-1.5 h-4 w-4 accent-[var(--c-primary)]" data-testid="exact-word">{{ t('Exact word') }}
      </label>
      <template v-if="multiWord">
        <label class="mr-4 inline-flex items-center"><input v-model="phrase" type="checkbox" class="mr-1.5 h-4 w-4 accent-[var(--c-primary)]" data-testid="exact-phrase">{{ t('Exact phrase') }}</label>
        <label v-if="!phrase" class="inline-flex items-center">{{ t('Near each other') }}: {{ t('within') }}
          <input v-model.number="distance" type="number" min="0" max="100" class="input mx-1.5 w-16" data-testid="word-distance">{{ t('words') }}
        </label>
      </template>
      </template>
      <span class="flex-1" />
      <FilterDialog type="fts" />
    </div>
    <div v-if="!input" class="banner border-info" data-testid="search-message">
      {{ t('Find a word or a phrase in all the texts. A word also finds its other endings.') }} {{ t('Type in any script.') }}
      {{ t('Without diacritics a word matches with or without them: dhamma also finds dhammā.') }}
    </div>
    <div v-else-if="inputError" class="banner border-error" data-testid="search-error">{{ inputError }}</div>
    <div v-else-if="errorMessage" class="banner border-error" data-testid="fts-error">{{ errorMessage }}</div>
    <div v-else-if="total >= 0" class="banner border-info" data-testid="search-message">
      <template v-if="total">{{ t('{0} matches in {1} texts', total > shown ? `${shown} / ${total}` : total, groups.length) }}</template>
      <template v-else>{{ t('No results') }}<template v-if="missing.length">: {{ missing.join(' ') }}</template></template>
      <div v-if="searchedText" class="pali mt-1 text-sm text-muted" data-testid="searched-words">{{ searchedText }}</div>
    </div>
    <div class="mt-2 flex flex-col" data-testid="fts-results">
      <div v-for="g in groups" :key="g.key" class="border-b border-line py-2" data-testid="fts-group">
        <div v-for="(item, i) in (g.open ? g.items : g.items.slice(0, 1))" :key="i" class="my-1" data-testid="fts-item" :data-key="item.key">
          <ResultLink v-if="item.key && paths.get(item.key)" :path="paths.get(item.key)!" :target="{ key: item.key, eInd: item.eInd, hWords: highlight }" />
          <div class="entry-text fts-snippet" :style="{ fontSize: settings.fontPx }" v-html="safe(item.hText)" />
        </div>
        <button v-if="g.items.length > 1" :class="['btn border-0', g.open ? 'text-success' : 'text-info']" data-testid="fts-group-toggle" @click="g.open = !g.open">
          {{ g.open ? t('Collapse') : t('Show {0} more', g.items.length - 1) }}
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
import FilterDialog from '@o/components/FilterDialog.vue'
import ResultLink from '@o/components/ResultLink.vue'
import Skeleton from '@/components/Skeleton.vue'
import { useSearch } from '@/stores/search'
import { useTree, type TreeItem } from '@/stores/tree'
import { useSettings } from '@/stores/settings'
import { buildMatch, buildMatchSlots, cleanFtsInput, isAdvancedQuery, type FtsBuild, type FtsHighlight } from '@shared/fts-query'
import { parseFtsOptions } from '@shared/routes'
import { beautifyText } from '@shared/beautify'
import { runFts, type FtsGroup } from '@/data/fts'
import { QueryError } from '@/data/source'
import { advancedToSinhala, expandQuery } from '@o/data/query'
import { useSearchFilter } from '@o/composables/searchFilter'
import { t } from '@o/i18n'

const search = useSearch(), tree = useTree(), settings = useSettings(), route = useRoute(), router = useRouter()
const filter = useSearchFilter('fts')
search.searchType = 'fts'
if (route.params.words) search.searchInput = String(route.params.words)
const o = parseFtsOptions(route.params.options ? String(route.params.options) : null)
const exact = ref(!!o.exactWord), phrase = ref(!!o.matchPhrase), distance = ref(o.wordDistance)
const opts = computed(() => ({ exactWord: exact.value ? 1 : 0, matchPhrase: phrase.value ? 1 : 0, wordDistance: distance.value }))

const input = computed(() => cleanFtsInput(search.searchInput))
const advanced = computed(() => isAdvancedQuery(input.value))
const multiWord = computed(() => input.value.split(' ').length > 1)
const inputError = computed(() => ([...input.value].length < 2 ? t('Please enter a word to search.') : ''))
const link = computed(() => '/search' + (input.value ? `/${encodeURIComponent(input.value)}/${[opts.value.exactWord, opts.value.matchPhrase, opts.value.wordDistance].join('-')}` : ''))

const groups = ref<(FtsGroup & { open: boolean })[]>([])
const paths = ref(new Map<string, TreeItem[]>())
const highlight = ref<FtsHighlight | null>(null)
const total = ref(-1), shown = ref(0)
const running = ref(false)
const errorMessage = ref('')
const missing = ref<string[]>([])
const searchedWords = ref<string[]>([]) // the spellings searched for words typed without diacritics
const searchedText = computed(() => searchedWords.value.map(w => beautifyText(w, 'pali', settings.letterOptions).toLowerCase()).join(', '))
useHead({ title: computed(() => (input.value ? `${input.value} - ${t('Full text search')}` : t('Full text search'))) })

const safe = (html: string) => DOMPurify.sanitize(html, { ALLOWED_TAGS: ['sr', 'b'], ALLOWED_ATTR: [] })

let seq = 0
async function getResults() {
  const my = ++seq
  errorMessage.value = ''
  missing.value = []; searchedWords.value = []
  if (!input.value || inputError.value) { groups.value = []; total.value = -1; return }
  running.value = true
  try {
    let b: FtsBuild
    if (advanced.value) b = buildMatch(advancedToSinhala(input.value), opts.value)
    else {
      const exp = await expandQuery(input.value, !exact.value)
      if (my !== seq) return
      if (exp.missing.length || !exp.slots.length) {
        missing.value = exp.missing
        groups.value = []; total.value = 0
        return
      }
      b = buildMatchSlots(exp.slots, opts.value)
      if (exp.folded && b.ok) searchedWords.value = b.terms.map(x => x.text + (x.prefix ? '…' : ''))
    }
    if (!b.ok) throw new QueryError(b.error, 'fts_syntax')
    const res = await runFts(b.match, b.highlight, 0, filter.groups.value, settings.letterOptions)
    const p = await tree.getPaths(res.groups.map(g => g.key).filter(Boolean))
    if (my !== seq) return
    highlight.value = b.highlight
    paths.value = p
    groups.value = res.groups.map(g => ({ ...g, open: false }))
    total.value = res.total
    shown.value = res.shown
  } catch (e) {
    if (my !== seq) return
    groups.value = []; total.value = -1
    errorMessage.value = e instanceof QueryError && e.code === 'timeout' ? t('The search is too broad. Please use longer words.') : t('Search failed.')
  } finally { if (my === seq) running.value = false }
}
const debounced = useDebounceFn(getResults, 250)
function updatePage() {
  if (route.name === 'fts' && route.path !== router.resolve(link.value).path) router.replace(link.value)
  debounced()
}
watch([input, opts], updatePage)
watch(filter.groups, () => debounced())
onMounted(updatePage)
</script>
