<!-- the search box of the app bar: titles or the full text, typed in any script -->
<template>
  <div class="flex h-9 w-full max-w-[520px] items-stretch rounded border border-line bg-surface focus-within:border-primary" role="search">
    <!-- small screens: one button, the kind of search it is; a tap changes to the other kind -->
    <button v-if="!smAndUp" class="flex items-center rounded-l border-r border-line px-2 text-primary" :title="t(current.title)" :aria-label="t(current.title)"
      data-testid="search-type-toggle" :data-type="current.type" @click="setType(current.type === 'title' ? 'fts' : 'title')">
      <component :is="current.icon" class="text-lg" />
    </button>
    <template v-else>
    <button v-for="m in modes" :key="m.type" class="flex items-center border-r border-line px-2 first:rounded-l" :title="t(m.title)" :aria-pressed="search.searchType === m.type"
      :class="search.searchType === m.type ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface2'" :data-testid="`search-type-${m.type}`" @click="setType(m.type)">
      <component :is="m.icon" class="text-lg" /><span v-if="mdAndUp" class="ml-1 whitespace-nowrap text-[15px]">{{ t(m.label) }}</span>
    </button>
    </template>
    <input v-model="input" class="pali min-w-0 flex-1 bg-transparent px-2 text-fg outline-none" :placeholder="t(search.searchType === 'fts' ? 'Search all texts…' : 'Search titles…')"
      :aria-label="t('Search')" autocapitalize="off" autocomplete="off" spellcheck="false" data-testid="search-input" @focus="go(false)" @keydown.enter="go(true)">
    <button v-if="input" class="px-2 text-muted hover:text-fg" :title="t('Clear')" data-testid="search-clear" @click="input = ''"><IconClose /></button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import IconTitle from '~icons/mdi/format-title'
import IconTextSearch from '~icons/mdi/text-search'
import IconClose from '~icons/mdi/close'
import { useSearch } from '@/stores/search'
import { mdAndUp, smAndUp } from '@/composables/breakpoints'
import { t } from '@o/i18n'

type Mode = 'title' | 'fts'
const search = useSearch(), router = useRouter()
if (search.searchType === 'dict') search.searchType = 'title'
const modes = [
  { type: 'title' as Mode, label: 'Titles', title: 'Title search', icon: IconTitle },
  { type: 'fts' as Mode, label: 'Full text', title: 'Full text search', icon: IconTextSearch },
]
const current = computed(() => modes.find(m => m.type === search.searchType) ?? modes[0])
const pathOf = (type: Mode) => (type === 'fts' ? '/search' : '/titles') + (search.searchInput.trim() ? '/' + encodeURIComponent(search.searchInput.trim()) : '')
const onSearchPage = () => ['title', 'fts'].includes(String(router.currentRoute.value.name))
/** to the search page of the chosen kind: from a text when there is something to search (always on Enter and on choosing the kind) */
function go(always: boolean) {
  const type = search.searchType as Mode
  if (router.currentRoute.value.name === type) return
  if (!always && !onSearchPage() && !search.searchInput.trim()) return
  if (onSearchPage()) router.replace(pathOf(type))
  else router.push(pathOf(type))
}
function setType(type: Mode) { search.searchType = type; go(true) }
const input = computed({
  get: () => search.searchInput,
  set: v => { search.searchInput = v; go(false) },
})
</script>
