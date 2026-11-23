<!-- the text of one tab: web/src/components/TextTab.vue with the pāḷi alone - no Sinhala column, scanned pages, word
     alignments, aṭṭhakathā underlines, dictionary or columns view. The footnotes (variant readings) are kept. -->
<template>
  <div ref="root" class="text-tab relative mx-auto my-2 max-w-[760px]" :style="{ fontSize: settings.fontPx }" data-testid="text-tab"
    @click="onClick" @mouseover="onOver" @mouseout="onOut">
    <div v-if="tab.errorMessage" class="banner m-3 border-error" role="alert">
      {{ t('Could not load the text. Please try again.') }}
    </div>
    <Skeleton v-else-if="!tab.isLoaded" />
    <template v-else>
      <div class="flex justify-end px-2">
        <button v-if="tab.entryStart > 0 || tab.pageStart > 0" class="btn rounded-full" :title="t('Show previous text')" data-testid="load-prev" @click="tabs.loadPrevPage(tab)">
          <IconUp />
        </button>
      </div>
      <section v-for="page in pages" :key="page.pageIdx" class="page" :data-page-idx="page.pageIdx">
        <!-- the page of the printed book (BJT) -->
        <div v-if="settings.showPageNumbers" class="page-num" data-testid="page-number">{{ page.pageNum }}</div>
        <div v-for="row in visibleRows(page)" :key="row.entry_idx" :data-eind="`${row.page_idx}-${row.entry_idx}`">
          <Entry :row="row" :file="file" :terms="termsFor(row)" :hide-footnotes="settings.footnoteMethod === 'hidden'" :index-words="indexWords(row)" />
        </div>
        <div v-if="settings.footnoteMethod === 'end-page' && page.footnotes.pali.length" class="px-2 py-2">
          <hr class="border-line">
          <div class="flex flex-wrap text-left text-[0.9em]" data-testid="footnote-list">
            <div v-for="(note, i) in page.footnotes.pali" :key="i" class="flex-auto px-4 py-0.5"><Footnote :text="note" /></div>
          </div>
        </div>
      </section>
      <div v-if="tab.node && tab.pageEnd < tab.node.page_count" ref="sentinel" class="card m-2 cursor-pointer text-center" data-testid="next-section" @click="tabs.loadNextPage(tab, 1)">
        {{ t('Show more') }}
      </div>
      <div v-else class="m-2 flex justify-between" data-testid="sutta-end">
        <button class="btn" data-testid="end-prev-sutta" @click="tabs.navigate(-1)"><IconPrev class="mr-1" />{{ t('Previous') }}</button>
        <button class="btn" data-testid="end-next-sutta" @click="next">{{ t('Next') }}<IconNext class="ml-1" /></button>
      </div>
    </template>

    <Floating :open="!!fn.open" :anchor="fn.anchor" :close-only="settings.footnoteMethod !== 'hover'" @close="closeFootnote" @leave="settings.footnoteMethod === 'hover' && closeFootnote()">
      <div class="text-sm" data-testid="footnote-popover">
        <Footnote v-if="fn.text" :text="fn.text" />
        <span v-else class="text-muted">{{ t('Not found') }}</span>
      </div>
    </Floating>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import IconUp from '~icons/mdi/chevron-up'
import IconPrev from '~icons/mdi/skip-previous'
import IconNext from '~icons/mdi/skip-next'
import Entry from './Entry.vue'
import Footnote from './Footnote'
import Floating from '@/components/Floating.vue'
import Skeleton from '@/components/Skeleton.vue'
import { useTabs, type Tab } from '@/stores/tabs'
import { useText, type PageData } from '@/stores/text'
import { useSettings } from '@/stores/settings'
import { useAudio } from '@/stores/audio'
import { textHash } from '@shared/sha1'
import { parseFootnote } from '@shared/footnote'
import type { EntryRow } from '@/data/types'
import { t } from '@o/i18n'

// contained: a column of the columns view (it scrolls itself, not the window)
const props = defineProps<{ tab: Tab; contained?: boolean }>()
const tabs = useTabs(), text = useText(), settings = useSettings(), audio = useAudio()
const root = ref<HTMLElement>()

const file = computed(() => props.tab.node?.file || '')
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
const termsFor = (row: EntryRow) => (props.tab.hWords && props.tab.eInd[0] === row.page_idx && props.tab.eInd[1] === row.entry_idx ? props.tab.hWords : null)

// infinite scroll; at the end of the sutta the next one
const sentinel = ref<HTMLElement>()
useIntersectionObserver(sentinel, ([e]) => { if (e?.isIntersecting) tabs.loadNextPage(props.tab, 1) }, { threshold: 0.5 })
const scroller = () => (props.contained ? root.value?.closest<HTMLElement>('[data-pane]') : null) ?? null
async function next() {
  await tabs.navigate(1)
  ;(scroller() ?? window).scrollTo(0, 0)
}

// ---- footnote popover (one per tab, event delegation) ----
const fn = reactive<{ open: boolean; anchor: HTMLElement | null; text: string }>({ open: false, anchor: null, text: '' })
function openFootnote(el: HTMLElement) {
  const cell = el.closest('[data-page]') as HTMLElement | null
  if (!cell) return
  const page = text.getPage(file.value, Number(cell.dataset.page))
  fn.text = page?.footnotes.pali.find(f => parseFootnote(f).number === el.dataset.fn) || ''
  fn.anchor = el
  fn.open = true
}
function closeFootnote() { fn.open = false; fn.anchor = null }
function onClick(e: MouseEvent) {
  const el = e.target as HTMLElement
  if (!el.classList.contains('fn-pointer') || settings.footnoteMethod === 'end-page') return
  if (fn.open && fn.anchor === el) closeFootnote()
  else openFootnote(el)
  e.stopPropagation()
}
let hoverTimer: ReturnType<typeof setTimeout> | undefined
function onOver(e: MouseEvent) {
  const el = e.target as HTMLElement
  if (settings.footnoteMethod === 'hover' && el.classList.contains('fn-pointer')) { clearTimeout(hoverTimer); openFootnote(el) }
}
function onOut(e: MouseEvent) {
  const el = e.target as HTMLElement
  if (settings.footnoteMethod === 'hover' && el.classList.contains('fn-pointer')) {
    hoverTimer = setTimeout(() => { if (!document.querySelector('[data-testid="footnote-popover"]:hover')) closeFootnote() }, 400)
  }
}
watch(() => settings.footnoteMethod, closeFootnote)

// ---- the word being chanted (word timings from forced alignment) ----
const chantRow = computed(() => {
  void text.version
  const e = audio.activeEntry
  if (!audio.isPlaying || audio.file !== file.value || !e?.words) return ''
  const row = text.getPage(file.value, e.page_idx)?.rows[e.entry_idx]
  return row && textHash(row.p_text) === e.words.ph ? `${e.page_idx}-${e.entry_idx}` : '' // timings of an older text are ignored
})
const indexWords = (row: EntryRow) => chantRow.value === `${row.page_idx}-${row.entry_idx}`
let chanting: HTMLElement[] = []
watch(() => [chantRow.value, audio.playingWord] as const, ([pos, w]) => {
  chanting.forEach(c => c.classList.remove('chanting'))
  chanting = []
  const para = pos && w >= 0 ? root.value?.querySelector<HTMLElement>(`[data-eind="${pos}"]`) : null
  if (!para) return
  para.querySelectorAll<HTMLElement>(`[data-w="${w}"]`).forEach(el => { el.classList.add('chanting'); chanting.push(el) })
}, { flush: 'post' })

// ---- audio follow: keeps the chanted word, or the paragraph without word timings, on screen (TextTab.vue) ----
const isPlayingHere = computed(() => settings.audioFollow && audio.isPlaying && audio.tabUid === props.tab.uid && (props.contained || tabs.activeTab === props.tab) && audio.file === file.value)
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
  const pane = scroller()?.getBoundingClientRect()
  const top = (pane?.top ?? (document.querySelector('[data-testid="tabs-bar"]') ?? document.querySelector('[data-testid="app-bar"]'))?.getBoundingClientRect().bottom ?? 0) + 8
  const bottom = (pane?.bottom ?? document.querySelector('[data-testid="audio-control"]')?.getBoundingClientRect().top ?? window.innerHeight) - 8
  if ((r.top >= top && r.bottom <= bottom) || Date.now() - followedAt < 800) return
  followedAt = Date.now()
  const y = r.height > bottom - top ? r.top - top : r.top + r.height / 2 - (top + bottom) / 2
  ;(scroller() ?? window).scrollBy({ top: y, behavior: 'smooth' })
}, { flush: 'post' })
</script>
