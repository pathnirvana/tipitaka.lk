<!-- replaces web/src/components/InlineDict.vue (vite.config.ts OVERRIDES): the same pane without the aṭṭhakathā tab
     (pitaka.lk has no aṭṭhakathā). Tabs: the dictionary, the setting of the clicked word's paragraph. -->
<template>
  <aside v-if="dict.show" :class="dictSide ? 'fixed bottom-0 right-0 z-30 flex flex-col border-l border-line bg-surface'
    : 'fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-2xl border-t border-line bg-surface shadow-2xl'"
    :style="dictSide ? { top: `${APP_BAR}px`, right: `${panelRight}px`, width: `${DICT_WIDTH}px` } : { height: `${height}vh` }" data-testid="inline-dict">
    <div v-if="!dictSide" class="flex h-5 shrink-0 cursor-row-resize items-center justify-center" role="separator" aria-orientation="horizontal"
      aria-label="උස වෙනස් කිරීමට අදින්න" data-testid="sheet-handle" @mousedown="startDrag" @touchstart="startDrag">
      <div class="h-1.5 w-12 rounded-full bg-line" />
    </div>
    <div class="flex shrink-0 items-center border-b border-line px-2 py-1">
      <button v-for="t in tabsShown" :key="t.id" :class="['rounded-lg px-3 py-1 text-[15px]', dict.tab === t.id ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface2']"
        :data-testid="`dict-tab-${t.id}`" @click="dict.tab = t.id">{{ t.label }}</button>
      <span class="flex-1" />
      <button class="icon-btn" title="close" data-testid="inline-dict-close" @click="dict.close()"><IconClose /></button>
    </div>
    <div v-if="dict.tab !== 'dict' && dict.ctx" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
      <SettingView :node-key="dict.ctx.key" :file="dict.ctx.file" :page="dict.ctx.page" :entry="dict.ctx.entry" />
    </div>
    <template v-if="dict.tab === 'dict'">
      <div class="flex shrink-0 items-center px-2 py-1.5">
        <input v-model="word" class="input min-w-0 flex-1" aria-label="word" data-testid="inline-dict-input">
        <button class="icon-btn ml-1" title="backspace" data-testid="inline-backspace" @click="backspace"><IconBackspace /></button>
        <button class="btn ml-1 shrink-0" title="අන්තර්ගතයේ සොයන්න" data-testid="inline-fts" @click="$router.push('/fts/' + input)">
          <IconMagnify class="text-primary" /><span v-if="dictSide || smAndUp" class="ml-1">අන්තර්ගතයේ</span>
        </button>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
        <DictView :word="dict.word" :mode="dict.mode" compact />
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import IconBackspace from '~icons/mdi/backspace-outline'
import IconMagnify from '~icons/mdi/magnify'
import IconClose from '~icons/mdi/close'
import DictView from '@/components/DictView.vue'
import SettingView from '@/components/SettingView.vue'
import { useInlineDict } from '@/stores/inlineDict'
import { useSettings } from '@/stores/settings'
import { smAndUp, viewport } from '@/composables/breakpoints'
import { useLayout, DICT_WIDTH, APP_BAR } from '@/composables/layout'

// the paragraph's tabs once a paragraph is known (a clicked word, the paragraph menu)
const tabsShown = computed(() => [
  { id: 'dict' as const, label: 'ශබ්දකෝෂය' },
  ...(dict.ctx ? [{ id: 'setting' as const, label: 'ස්ථානය' }] : []),
])
const dict = useInlineDict(), settings = useSettings()
const { dictSide, panelRight } = useLayout()
// the input follows the clicked word; an edited word is searched (debounced)
const input = ref(dict.word)
watch(() => dict.word, w => { input.value = w })
const debounced = useDebounceFn((w: string) => dict.search(w), 400)
const word = computed({ get: () => input.value, set: v => { input.value = v; debounced(v) } })
// strip one consonant + vowel signs at a time
function backspace() { word.value = input.value.replace(/[අ-ෆ][්-ෟංඃ‍]*$/, '') }

// sheet height in % of the screen: the saved value, or the live value while dragging
const dragging = ref<number | null>(null)
const height = computed(() => dragging.value ?? settings.dictSheetHeight)
const MIN = 20, MAX = 90, CLOSE_BELOW = 12
// mouse and touch events: pointer events need Chrome 55 (Android 7 ships WebView 53)
const clientY = (e: MouseEvent | TouchEvent) => ('touches' in e ? (e.touches[0] || e.changedTouches[0]).clientY : e.clientY)
function startDrag(e: MouseEvent | TouchEvent) {
  const touch = e.type === 'touchstart'
  const startY = clientY(e), startH = height.value
  const move = (ev: MouseEvent | TouchEvent) => {
    if (ev.cancelable) ev.preventDefault() // no page scroll while dragging
    dragging.value = Math.min(MAX, Math.max(5, startH + ((startY - clientY(ev)) / viewport.height.value) * 100))
  }
  const up = () => {
    window.removeEventListener(touch ? 'touchmove' : 'mousemove', move)
    window.removeEventListener(touch ? 'touchend' : 'mouseup', up)
    if (touch) window.removeEventListener('touchcancel', up)
    const h = dragging.value
    dragging.value = null
    if (h === null) return
    if (h < CLOSE_BELOW) dict.close() // dragged down: close, keep the saved height
    else settings.dictSheetHeight = Math.round(Math.max(MIN, h))
  }
  window.addEventListener(touch ? 'touchmove' : 'mousemove', move, { passive: false })
  window.addEventListener(touch ? 'touchend' : 'mouseup', up)
  if (touch) window.addEventListener('touchcancel', up)
  if (!touch) e.preventDefault() // no text selection while dragging
}
</script>
