<!-- the text of the open sutta in the reading mode (composables/readingMode.ts): web/src/components/TextTab.vue without
     footnotes, scanned pages, word alignments, aṭṭhakathā underlines and columns. An entry without a translation shows
     its pāḷi in the Sinhala mode; a part of the tipitaka without one shows the pāḷi with a note. -->
<template>
  <div ref="root" class="text-tab relative mx-auto my-2 max-w-[1100px]" :class="{ 'max-w-[1400px]': mode === 'side' }" :style="{ fontSize: settings.fontPx }"
    :data-mode="mode" data-testid="text-tab" @click="onClick">
    <div v-if="tab.errorMessage" class="banner m-3 border-error" role="alert">
      <div class="font-bold">සූත්‍රය ලබාගැනීමේදී වරදක් සිදුවිය</div>{{ tab.errorMessage }}
    </div>
    <Skeleton v-else-if="!tab.isLoaded" />
    <template v-else>
      <div v-if="untranslated(tab)" class="banner m-2 border-info text-[0.85em]" data-testid="translation-coming">
        මෙම කොටසේ සරල සිංහල පරිවර්තනය ඉදිරියේදී එක් කෙරේ. දැනට පාළි පාඨය පමණක් ඇත.
      </div>
      <div class="flex justify-end px-2">
        <button v-if="tab.entryStart > 0 || tab.pageStart > 0" class="btn rounded-full" title="කලින් පිටුව" data-testid="load-prev" @click="tabs.loadPrevPage(tab)">
          <IconUp />
        </button>
      </div>
      <section v-for="page in pages" :key="page.pageIdx" class="page" :data-page-idx="page.pageIdx">
        <div v-for="row in visibleRows(page)" :key="row.entry_idx" :class="mode === 'side' ? 'pair pair-2' : ''" :data-eind="`${row.page_idx}-${row.entry_idx}`">
          <template v-if="mode === 'side'">
            <Entry :row="row" lang="pali" :file="file" :terms="termsFor(row)" :index-words="indexWords(row)" />
            <Entry v-if="row.s_text" :row="row" lang="sinh" :file="file" :terms="termsFor(row)" />
            <div v-else />
          </template>
          <!-- interleaved: an entry the same in both (a number, a name) once -->
          <template v-else-if="mode === 'interleaved'">
            <Entry :row="row" lang="pali" :file="file" :terms="termsFor(row)" :index-words="indexWords(row)" :class="{ 'entry-pali-under': translated(row) }" />
            <Entry v-if="translated(row)" :row="row" lang="sinh" :file="file" :terms="termsFor(row)" class="entry-sinh-under" />
          </template>
          <Entry v-else-if="mode === 'sinh' && row.s_text" :row="row" lang="sinh" :file="file" :terms="termsFor(row)" />
          <Entry v-else :row="row" lang="pali" :file="file" :terms="termsFor(row)" :index-words="indexWords(row)" :class="{ untranslated: mode === 'sinh' }" />
        </div>
      </section>
      <div v-if="tab.node && tab.pageEnd < tab.node.page_count" ref="sentinel" class="card m-2 cursor-pointer text-center" data-testid="next-section" @click="tabs.loadNextPage(tab, 1)">
        ඊළඟ කොටස පෙන්වන්න.
      </div>
      <div v-else class="m-2 flex justify-between" data-testid="sutta-end">
        <button class="btn" data-testid="end-prev-sutta" @click="tabs.navigate(-1)"><IconPrev class="mr-1" />කලින් සූත්‍රය</button>
        <button class="btn" data-testid="end-next-sutta" @click="next">ඊළඟ සූත්‍රය<IconNext class="ml-1" /></button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import IconUp from '~icons/mdi/chevron-up'
import IconPrev from '~icons/mdi/skip-previous'
import IconNext from '~icons/mdi/skip-next'
import Entry from './Entry.vue'
import Skeleton from '@/components/Skeleton.vue'
import { useTabs, type Tab } from '@/stores/tabs'
import { useText, type PageData } from '@/stores/text'
import { useSettings } from '@/stores/settings'
import { useInlineDict } from '@/stores/inlineDict'
import { useAudio } from '@/stores/audio'
import { textHash } from '@shared/sha1'
import type { EntryRow } from '@/data/types'
import { useReadingMode } from '@p/composables/readingMode'

const props = defineProps<{ tab: Tab }>()
const tabs = useTabs(), text = useText(), settings = useSettings(), inlineDict = useInlineDict(), audio = useAudio()
const { modeOf, untranslated } = useReadingMode()
const root = ref<HTMLElement>()

const file = computed(() => props.tab.node?.file || '')
const mode = computed(() => modeOf(props.tab))
const pages = computed<PageData[]>(() => {
  void text.version // re-evaluate when pages are loaded
  const out: PageData[] = []
  for (let p = props.tab.pageStart; p < props.tab.pageEnd; p++) {
    const pg = text.getPage(file.value, p)
    if (pg) out.push(pg)
  }
  return out
})
const visibleRows = (page: PageData) => (page.pageIdx === props.tab.pageStart ? page.rows.filter(r => r.entry_idx >= props.tab.entryStart) : page.rows)
const translated = (row: EntryRow) => !!row.s_text && row.s_text.trim() !== row.p_text.trim()
const termsFor = (row: EntryRow) => (props.tab.hWords && props.tab.eInd[0] === row.page_idx && props.tab.eInd[1] === row.entry_idx ? props.tab.hWords : null)

// infinite scroll; at the end of the sutta the next one
const sentinel = ref<HTMLElement>()
useIntersectionObserver(sentinel, ([e]) => { if (e?.isIntersecting) tabs.loadNextPage(props.tab, 1) }, { threshold: 0.5 })
async function next() {
  await tabs.navigate(1)
  window.scrollTo(0, 0)
}

/** the paragraph (file, position, node) of an element of the text */
function paraOf(el: HTMLElement) {
  const m = /^(\d+)-(\d+)$/.exec(el.closest<HTMLElement>('[data-eind]')?.dataset.eind ?? '')
  if (!m) return undefined
  const page = Number(m[1]), entry = Number(m[2])
  const row = text.getPage(file.value, page)?.rows[entry]
  return { file: file.value, page, entry, key: row?.node_key || props.tab.key }
}
// a pāḷi word: the dictionary
function onClick(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (t.classList.contains('w') && t.closest<HTMLElement>('[data-lang]')?.dataset.lang === 'pali') inlineDict.open(t, paraOf(t))
}

// ---- the word being chanted (word timings from forced alignment) ----
const chantRow = computed(() => {
  void text.version
  const e = audio.activeEntry
  if (!audio.isPlaying || audio.file !== file.value || !e?.words) return ''
  const row = text.getPage(file.value, e.page_idx)?.rows[e.entry_idx]
  return row && textHash(row.p_text) === e.words.ph ? `${e.page_idx}-${e.entry_idx}` : ''
})
const indexWords = (row: EntryRow) => chantRow.value === `${row.page_idx}-${row.entry_idx}`
let chanting: HTMLElement[] = []
watch(() => [chantRow.value, audio.playingWord] as const, ([pos, w]) => {
  chanting.forEach(c => c.classList.remove('chanting'))
  chanting = []
  const pair = pos && w >= 0 ? root.value?.querySelector<HTMLElement>(`[data-eind="${pos}"]`) : null
  if (!pair) return
  pair.querySelectorAll<HTMLElement>(`[data-lang="pali"] [data-w="${w}"]`).forEach(el => { el.classList.add('chanting'); chanting.push(el) })
}, { flush: 'post' })

// ---- audio follow: keeps the chanted word, or the paragraph without word timings, on screen (TextTab.vue) ----
const isPlayingHere = computed(() => settings.audioFollow && audio.isPlaying && audio.tabUid === props.tab.uid && tabs.activeTab === props.tab && audio.file === file.value)
let followedAt = 0
watch(() => [isPlayingHere.value, audio.activeEntry, audio.playingWord] as const, async ([on, e]) => {
  if (!on || !e) return
  const tab = props.tab
  if (e.page_idx >= tab.pageEnd) await tabs.loadNextPage(tab, e.page_idx + 1 - tab.pageEnd)
  for (let n = 0; n < 5 && (e.page_idx < tab.pageStart || (e.page_idx === tab.pageStart && e.entry_idx < tab.entryStart)); n++) await tabs.loadPrevPage(tab)
  await nextTick()
  const el = chanting[0] || root.value?.querySelector<HTMLElement>(`[data-eind="${e.page_idx}-${e.entry_idx}"]`)
  if (!el) return
  const r = el.getBoundingClientRect()
  const top = (document.querySelector('[data-testid="app-bar"]')?.getBoundingClientRect().bottom ?? 0) + 8
  const bottom = (document.querySelector('[data-testid="audio-control"]')?.getBoundingClientRect().top ?? window.innerHeight) - 8
  if ((r.top >= top && r.bottom <= bottom) || Date.now() - followedAt < 800) return
  followedAt = Date.now()
  const y = r.height > bottom - top ? r.top - top : r.top + r.height / 2 - (top + bottom) / 2
  window.scrollBy({ top: y, behavior: 'smooth' })
}, { flush: 'post' })
</script>
