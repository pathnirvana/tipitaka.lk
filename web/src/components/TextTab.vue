<!-- the text of one tab: pages of pali/sinhala entry pairs (v2 TextTab.vue) -->
<template>
  <div ref="root" class="text-tab relative mx-auto my-2 max-w-[1400px]" :style="{ fontSize: settings.fontPx }" data-testid="text-tab"
    @click="onClick" @mouseover="onOver" @mouseout="onOut" @touchstart.passive="onTouchStart" @touchend="onTouchEnd">
    <div v-if="tab.errorMessage" class="banner m-3 border-error" role="alert">
      <div class="font-bold">සූත්‍රය ලබාගැනීමේදී වරදක් සිදුවිය</div>{{ tab.errorMessage }}
    </div>
    <Skeleton v-else-if="!tab.isLoaded" />
    <template v-else>
      <div class="flex justify-end px-2">
        <button v-if="tab.entryStart > 0 || tab.pageStart > 0" class="btn rounded-full" title="කලින් පිටුව" data-testid="load-prev" @click="tabs.loadPrevPage(tab)">
          <IconUp />
        </button>
      </div>
      <section v-for="page in pages" :key="page.pageIdx" class="page" :data-page-idx="page.pageIdx">
        <template v-if="!tab.showScanPage">
          <div v-if="settings.showPageNumbers && !isAtta" :class="['pair text-center', gridCols]">
            <div v-if="cols.pali"><button class="btn border-0 text-info" data-testid="page-number" @click.stop="tabs.update(tab, { showScanPage: true })">{{ page.pageNum }}</button></div>
            <div v-if="cols.sinh"><button class="btn border-0 text-info" @click.stop="tabs.update(tab, { showScanPage: true })">{{ page.pageNum + 1 }}</button></div>
          </div>
          <div v-for="row in visibleRows(page)" :key="row.entry_idx" :class="['pair', gridCols]" :data-eind="`${row.page_idx}-${row.entry_idx}`">
            <EntryCell v-if="cols.pali" :row="row" lang="pali" :file="file" :terms="termsFor(row)" :hide-footnotes="settings.footnoteMethod === 'hidden'" :index-words="indexWords(row)" :gloss-words="glossWordsOf(row)" />
            <EntryCell v-if="cols.sinh" :row="row" lang="sinh" :file="file" :terms="termsFor(row)" :hide-footnotes="settings.footnoteMethod === 'hidden'" :index-words="indexWords(row)" />
          </div>
          <div v-if="settings.footnoteMethod === 'end-page'" :class="['pair', gridCols]">
            <div v-for="l in shownLangs" :key="l" class="px-2 py-2" :data-lang="l">
              <template v-if="page.footnotes[l].length">
                <hr class="border-line">
                <div class="flex flex-wrap text-left text-[0.9em]" data-testid="footnote-list">
                  <div v-for="(note, i) in page.footnotes[l]" :key="i" class="flex-auto px-4 py-0.5"><FootnoteContent :text="note" :lang="l" /></div>
                </div>
              </template>
            </div>
          </div>
        </template>
        <div v-else :class="['pair', gridCols]">
          <div v-for="l in shownLangs" :key="l" class="text-center">
            <img class="scan-img inline-block" :src="scanSrc(page.pageNum, l)" :alt="`page ${page.pageNum}`" data-testid="scan-img" loading="lazy">
          </div>
        </div>
      </section>
      <div v-if="tab.node && tab.pageEnd < tab.node.page_count" ref="sentinel" class="card m-2 cursor-pointer text-center" data-testid="next-section" @click="tabs.loadNextPage(tab, 1)">
        ඊළඟ කොටස පෙන්වන්න.
      </div>
    </template>

    <Floating :open="!!fn.open" :anchor="fn.anchor" :close-only="settings.footnoteMethod !== 'hover'" @close="closeFootnote" @leave="settings.footnoteMethod === 'hover' && closeFootnote()">
      <div class="text-sm" data-testid="footnote-popover" @click="onPopoverClick">
        <FootnoteContent v-if="fn.text" :text="fn.text" :lang="fn.lang" />
        <span v-else class="text-muted">අධෝලිපිය හමු නොවීය.</span>
      </div>
    </Floating>
    <Floating :open="!!abbr.anchor" :anchor="abbr.anchor" close-only @close="abbr.anchor = null">
      <span class="text-sm" data-testid="abbr-desc">{{ abbr.text }}</span>
    </Floating>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import IconUp from '~icons/mdi/chevron-up'
import EntryCell from './EntryCell.vue'
import FootnoteContent from './FootnoteContent'
import Floating from './Floating.vue'
import Skeleton from './Skeleton.vue'
import { useTabs, type Tab } from '@/stores/tabs'
import { useText, type PageData } from '@/stores/text'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'
import { useInlineDict } from '@/stores/inlineDict'
import { useAbbreviations } from '@/stores/abbreviations'
import { useAudio } from '@/stores/audio'
import { useGlosses } from '@/stores/glosses'
import { glossIdsAt } from '@/composables/glosses'
import { textHash } from '@shared/sha1'
import { getBJTImageSrc } from '@shared/scanned-pages'
import { bjtParams, initBjtParams } from '@/composables/bjtParams'
import { parseFootnote } from '@shared/footnote'
import type { EntryRow } from '@/data/types'

// contained: a column of the columns view (it scrolls itself, not the window); narrow: too narrow for pāḷi and sinhala side by side
const props = defineProps<{ tab: Tab; contained?: boolean; narrow?: boolean }>()
const tabs = useTabs(), text = useText(), settings = useSettings(), ui = useUi(), inlineDict = useInlineDict(), abbrs = useAbbreviations(), audio = useAudio(), glosses = useGlosses()
const root = ref<HTMLElement>()
initBjtParams()

const file = computed(() => props.tab.node?.file || '')
const isAtta = computed(() => tabs.isAtta(props.tab))
const columns = computed(() => tabs.tabColumns(props.tab, props.narrow))
// pali only files always show the pali column (v2 showed an empty page for /ap-pat/sinh - A37)
const cols = computed(() => ({ pali: columns.value === 0 || columns.value === 2 || tabs.paliOnly(props.tab), sinh: (columns.value === 1 || columns.value === 2) && !tabs.paliOnly(props.tab) }))
const shownLangs = computed(() => (['pali', 'sinh'] as const).filter(l => cols.value[l]))
const gridCols = computed(() => (cols.value.pali && cols.value.sinh ? 'pair-2' : 'pair-1'))

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
const scanSrc = (pageNum: number, lang: 'pali' | 'sinh') => getBJTImageSrc(bjtParams.value, props.tab.node!.book_id, pageNum + props.tab.node!.page_offset + (lang === 'sinh' ? 1 : 0))

// infinite scroll
const sentinel = ref<HTMLElement>()
useIntersectionObserver(sentinel, ([e]) => { if (e?.isIntersecting) tabs.loadNextPage(props.tab, 1) }, { threshold: 0.5 })

// ---- footnote popover (one per tab, event delegation) ----
const fn = reactive<{ open: boolean; anchor: HTMLElement | null; text: string; lang: 'pali' | 'sinh' }>({ open: false, anchor: null, text: '', lang: 'pali' })
const abbr = reactive<{ anchor: HTMLElement | null; text: string }>({ anchor: null, text: '' })
function openFootnote(el: HTMLElement) {
  const cell = el.closest('[data-page][data-lang]') as HTMLElement | null
  if (!cell) return
  const lang = cell.dataset.lang as 'pali' | 'sinh', page = text.getPage(file.value, Number(cell.dataset.page))
  const number = el.dataset.fn
  fn.text = page?.footnotes[lang].find(f => parseFootnote(f).number === number) || ''
  fn.lang = lang
  fn.anchor = el
  fn.open = true
}
function closeFootnote() { fn.open = false; fn.anchor = null }
function onPopoverClick(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (t.classList.contains('fn-abbr')) { abbr.text = abbrs.describe(t.dataset.abbr || ''); abbr.anchor = t }
}

/** the paragraph (file, position, node) of an element of the text */
function paraOf(el: HTMLElement) {
  const m = /^(\d+)-(\d+)$/.exec(el.closest<HTMLElement>('[data-eind]')?.dataset.eind ?? '')
  if (!m) return undefined
  const page = Number(m[1]), entry = Number(m[2])
  const row = text.getPage(file.value, page)?.rows[entry]
  return { file: file.value, page, entry, key: row?.node_key || props.tab.key }
}
function onClick(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (t.classList.contains('fn-pointer') && settings.footnoteMethod !== 'end-page') {
    if (fn.open && fn.anchor === t) closeFootnote()
    else openFootnote(t)
    e.stopPropagation()
  } else if (t.classList.contains('w') && t.closest<HTMLElement>('[data-lang]')?.dataset.lang === 'pali') {
    inlineDict.open(t, paraOf(t), glosses.ofIds(file.value, glossIdsAt(t)))
    showAligned(t)
  } else if (t.getAttribute('data-w')) { // not t.dataset - undefined on svg icons in old WebViews (Chrome < 55)
    showAligned(t) // a tap on a sinhala word (touch screens have no hover)
  } else if (t.classList.contains('fn-abbr')) {
    abbr.text = abbrs.describe(t.dataset.abbr || ''); abbr.anchor = t
  }
}
let hoverTimer: ReturnType<typeof setTimeout> | undefined
function onOver(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (t.getAttribute('data-w')) showAligned(t)
  if (t.getAttribute('data-g')) hoverGloss(t)
  if (settings.footnoteMethod === 'hover' && t.classList.contains('fn-pointer')) { clearTimeout(hoverTimer); openFootnote(t) }
}
function onOut(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (t.getAttribute('data-w')) showAligned(null)
  if (t.getAttribute('data-g')) hoverGloss(null)
  if (settings.footnoteMethod === 'hover' && t.classList.contains('fn-pointer')) {
    hoverTimer = setTimeout(() => { if (!document.querySelector('[data-testid="footnote-popover"]:hover')) closeFootnote() }, 400)
  }
}
watch(() => settings.footnoteMethod, closeFootnote)

// ---- pali-sinhala word alignment: hovering or tapping a word highlights its linked words on both sides ----
const isAligned = (row: EntryRow) => { void text.alignVersion; return settings.alignmentView && !!text.getAlign(file.value, row.page_idx, row.entry_idx) }
watch(() => [settings.alignmentView, file.value, props.tab.pageStart, props.tab.pageEnd, props.tab.isLoaded] as const, ([on, f, from, to, loaded]) => {
  if (on && f && loaded) text.loadAlign(f, from, to - 1).catch(() => { /* an older db without alignments */ })
}, { immediate: true })
let aligned: HTMLElement[] = []
function showAligned(el: HTMLElement | null) {
  aligned.forEach(a => a.classList.remove('aligned'))
  aligned = []
  const cell = el?.closest<HTMLElement>('[data-page][data-lang]'), pair = cell?.closest<HTMLElement>('[data-eind]')
  if (!el || !cell || !pair) return
  const al = text.getAlign(file.value, Number(cell.dataset.page), Number(cell.dataset.entry))
  if (!al) return
  const linked = al.linked(cell.dataset.lang as 'pali' | 'sinh', Number(el.dataset.w))
  for (const lang of ['pali', 'sinh'] as const) {
    const want = new Set(linked[lang])
    pair.querySelectorAll<HTMLElement>(`[data-lang="${lang}"] [data-w]`).forEach(w => { if (want.has(Number(w.dataset.w))) aligned.push(w) })
  }
  aligned.forEach(a => a.classList.add('aligned'))
}
watch(() => settings.alignmentView, on => { if (!on) showAligned(null) })

// ---- the aṭṭhakathā alignment: underlined words (tipitaka.app glosses), hovering one highlights it and its counterpart
// (in the other column of the columns view) ----
watch(() => [settings.glossUnderline, file.value, props.tab.pageStart, props.tab.pageEnd, props.tab.isLoaded] as const, ([on, f, from, to, loaded]) => {
  if (on && f && loaded) glosses.load(f, from, to - 1)
}, { immediate: true })
const glossWordsOf = (row: EntryRow) => (settings.glossUnderline ? glosses.entryWords(file.value, row.page_idx, row.entry_idx, row.p_text) : undefined)
let hovered: Element[] = []
function hoverGloss(el: HTMLElement | null) {
  hovered.forEach(h => h.classList.remove('gl-hover'))
  hovered = []
  const ids = glossIdsAt(el)
  if (!ids.length) return
  hovered = Array.from(document.querySelectorAll(ids.map(g => `.gl[data-g~="${g}"]`).join(',')))
  hovered.forEach(h => h.classList.add('gl-hover'))
}

// ---- the word being chanted (word timings from forced alignment), and with the alignment view its sinhala words ----
/** 'page-entry' of the entry being chanted in this tab when it has word timings for the current text */
const chantRow = computed(() => {
  void text.version
  const e = audio.activeEntry
  if (!audio.isPlaying || audio.file !== file.value || !e?.words) return ''
  const row = text.getPage(file.value, e.page_idx)?.rows[e.entry_idx]
  return row && textHash(row.p_text) === e.words.ph ? `${e.page_idx}-${e.entry_idx}` : '' // timings of an older text are ignored
})
const indexWords = (row: EntryRow) => isAligned(row) || chantRow.value === `${row.page_idx}-${row.entry_idx}`
let chanting: HTMLElement[] = []
watch(() => [chantRow.value, audio.playingWord, settings.alignmentView] as const, ([pos, w, alignOn]) => {
  chanting.forEach(c => c.classList.remove('chanting', 'chanting-target'))
  chanting = []
  const pair = pos && w >= 0 ? root.value?.querySelector<HTMLElement>(`[data-eind="${pos}"]`) : null
  if (!pair) return
  const add = (lang: string, ws: number[], cls: string) => ws.forEach(i => pair.querySelectorAll<HTMLElement>(`[data-lang="${lang}"] [data-w="${i}"]`)
    .forEach(el => { el.classList.add(cls); chanting.push(el) }))
  add('pali', [w], 'chanting')
  const al = alignOn ? text.getAlign(file.value, ...pos.split('-').map(Number) as [number, number]) : undefined
  if (al) add('sinh', al.linked('pali', w).sinh, 'chanting-target')
}, { flush: 'post' })

// ---- sync (audio bar toggle): keeps the chanted word, or the paragraph without word timings, on screen ----
// scrolls only when it is about to go off screen, then centers it
const isPlayingHere = computed(() => settings.audioFollow && audio.isPlaying && audio.tabUid === props.tab.uid && (props.contained || tabs.activeTab === props.tab)
  && audio.file === file.value && !props.tab.showScanPage)
let followedAt = 0 // a smooth scroll is still running for a while: the next words are not checked until it ends
watch(() => [isPlayingHere.value, audio.activeEntry, audio.playingWord] as const, async ([on, e]) => {
  if (!on || !e) return
  const tab = props.tab
  if (e.page_idx >= tab.pageEnd) await tabs.loadNextPage(tab, e.page_idx + 1 - tab.pageEnd)
  for (let n = 0; n < 5 && (e.page_idx < tab.pageStart || (e.page_idx === tab.pageStart && e.entry_idx < tab.entryStart)); n++) await tabs.loadPrevPage(tab)
  await nextTick()
  const el = chanting[0] || root.value?.querySelector<HTMLElement>(`[data-eind="${e.page_idx}-${e.entry_idx}"]`)
  if (!el) return
  const r = el.getBoundingClientRect()
  const pane = props.contained ? root.value?.closest<HTMLElement>('[data-pane]')?.getBoundingClientRect() : undefined
  const top = (pane?.top ?? document.querySelector('[data-testid="app-bar"]')?.getBoundingClientRect().bottom ?? 0) + 8
  const bottom = (pane?.bottom ?? document.querySelector('[data-testid="audio-control"]')?.getBoundingClientRect().top ?? window.innerHeight) - 8
  if ((r.top >= top && r.bottom <= bottom) || Date.now() - followedAt < 800) return
  followedAt = Date.now()
  // a paragraph taller than the screen is scrolled to its start
  const y = r.height > bottom - top ? r.top - top : r.top + r.height / 2 - (top + bottom) / 2
  const scroller = props.contained ? root.value?.closest<HTMLElement>('[data-pane]') : null
  if (scroller) scroller.scrollBy({ top: y, behavior: 'smooth' })
  else window.scrollBy({ top: y, behavior: 'smooth' })
}, { flush: 'post' })

// ---- left swipe toggles pali / sinhala when one column is shown (v2 touchSwipe) ----
let touch: { x: number; y: number } | null = null
function onTouchStart(e: TouchEvent) { touch = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
function onTouchEnd(e: TouchEvent) {
  if (!touch) return
  const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y
  touch = null
  if (dx > -100 || Math.abs(dy) > 20) return
  if (cols.value.pali === cols.value.sinh || tabs.paliOnly(props.tab)) return
  const toSinh = cols.value.pali
  tabs.update(props.tab, { columns: toSinh ? 1 : 0 })
  ui.notify(toSinh ? 'සිංහල' : 'පාළි', 1000)
}

// ---- columns view: the reading position of a column and moving a column to a passage (Reader.vue keeps a mūla and
// its aṭṭhakathā in step) ----
/** the entry at the reading line (px below the top of the column) */
function topEntry(line: number): [number, number] | null {
  const scroller = root.value?.closest<HTMLElement>('[data-pane]')
  if (!scroller || !root.value) return null
  const y = scroller.getBoundingClientRect().top + line
  const rows = root.value.querySelectorAll<HTMLElement>('[data-eind]')
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].getBoundingClientRect().bottom > y) { const [p, e] = rows[i].getAttribute('data-eind')!.split('-').map(Number); return [p, e] }
  }
  return null
}
/** scrolls the column to an entry (at the reading line), loading its pages first */
async function scrollToEntry(page: number, entry: number, line: number) {
  const tab = props.tab
  if (!tab.node) return
  for (let n = 0; n < 6 && (page < tab.pageStart || (page === tab.pageStart && entry < tab.entryStart)); n++) await tabs.loadPrevPage(tab)
  if (page >= tab.pageEnd) await tabs.loadNextPage(tab, page + 1 - tab.pageEnd)
  await nextTick()
  const el = root.value?.querySelector<HTMLElement>(`[data-eind="${page}-${entry}"]`)
  const scroller = root.value?.closest<HTMLElement>('[data-pane]')
  if (el && scroller) scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - line
}
defineExpose({ topEntry, scrollToEntry })
</script>
