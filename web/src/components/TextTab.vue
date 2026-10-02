<!-- the text of one tab: pages of pali/sinhala entry pairs (v2 TextTab.vue) -->
<template>
  <div class="text-tab relative mx-auto my-2 max-w-[1400px]" :style="{ fontSize: settings.fontPx }" data-testid="text-tab"
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
            <EntryCell v-if="cols.pali" :row="row" lang="pali" :file="file" :terms="termsFor(row)" :hide-footnotes="settings.footnoteMethod === 'hidden'" />
            <EntryCell v-if="cols.sinh" :row="row" lang="sinh" :file="file" :terms="termsFor(row)" :hide-footnotes="settings.footnoteMethod === 'hidden'" />
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

    <Floating :open="!!fn.open" :anchor="fn.anchor" @close="closeFootnote" @leave="settings.footnoteMethod === 'hover' && closeFootnote()">
      <div class="text-sm" data-testid="footnote-popover" @click="onPopoverClick">
        <FootnoteContent v-if="fn.text" :text="fn.text" :lang="fn.lang" />
        <span v-else class="text-muted">අධෝලිපිය හමු නොවීය.</span>
      </div>
    </Floating>
    <Floating :open="!!abbr.anchor" :anchor="abbr.anchor" @close="abbr.anchor = null">
      <span class="text-sm" data-testid="abbr-desc">{{ abbr.text }}</span>
    </Floating>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
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
import { getBJTImageSrc } from '@shared/scanned-pages'
import { bjtParams, initBjtParams } from '@/composables/bjtParams'
import { parseFootnote } from '@shared/footnote'
import type { EntryRow } from '@/data/types'

const props = defineProps<{ tab: Tab }>()
const tabs = useTabs(), text = useText(), settings = useSettings(), ui = useUi(), inlineDict = useInlineDict(), abbrs = useAbbreviations()
initBjtParams()

const file = computed(() => props.tab.node?.file || '')
const isAtta = computed(() => tabs.isAtta(props.tab))
const columns = computed(() => tabs.tabColumns(props.tab))
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

function onClick(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (t.classList.contains('fn-pointer') && settings.footnoteMethod !== 'end-page') {
    if (fn.open && fn.anchor === t) closeFootnote()
    else openFootnote(t)
    e.stopPropagation()
  } else if (t.classList.contains('w')) {
    inlineDict.open(t)
  } else if (t.classList.contains('fn-abbr')) {
    abbr.text = abbrs.describe(t.dataset.abbr || ''); abbr.anchor = t
  }
}
let hoverTimer: ReturnType<typeof setTimeout> | undefined
function onOver(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (settings.footnoteMethod === 'hover' && t.classList.contains('fn-pointer')) { clearTimeout(hoverTimer); openFootnote(t) }
}
function onOut(e: MouseEvent) {
  const t = e.target as HTMLElement
  if (settings.footnoteMethod === 'hover' && t.classList.contains('fn-pointer')) {
    hoverTimer = setTimeout(() => { if (!document.querySelector('[data-testid="footnote-popover"]:hover')) closeFootnote() }, 400)
  }
}
watch(() => settings.footnoteMethod, closeFootnote)

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
</script>
