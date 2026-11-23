<!-- the starred texts and paragraphs, and the texts read (web/src/views/Bookmarks.vue in the script and language of the page) -->
<template>
  <div class="mx-auto max-w-[900px] p-3">
    <div class="mb-2 flex items-center border-b border-line px-2 pb-1">
      <IconStar class="mr-2 text-star" /><h2 class="flex-1 text-lg">{{ t('Bookmarks') }}</h2>
    </div>
    <div v-if="!store.count" class="banner mb-2 border-info" data-testid="bookmarks-message">{{ t('No bookmarks yet. Add one with the button next to a paragraph: Add a bookmark.') }}</div>
    <div class="divide-y divide-line">
      <div v-for="(b, k) in store.bookmarks" :key="k" class="flex items-start px-2 py-1" data-testid="bookmark-item">
        <div class="min-w-0 flex-1">
          <ResultLink v-if="paths.get(b.key)" :path="paths.get(b.key)!" :target="{ key: b.key, eInd: b.type === 'heading' ? null : b.eInd }" />
          <div v-if="b.type !== 'heading' && b.text" :class="['entry-text', b.type]" :style="{ fontSize: settings.fontPx }"><RichText :text="b.text" lang="pali" hide-footnotes /></div>
        </div>
        <button class="icon-btn ml-1 mt-1 shrink-0 text-star" :title="t('Remove the bookmark')" data-testid="bookmark-remove" @click="store.toggle(b)"><IconStar /></button>
      </div>
    </div>

    <!-- the texts read, most recent first -->
    <div class="mb-1 mt-8 flex items-center border-b border-line px-2 pb-1">
      <IconHistory class="mr-2 text-info" /><h2 class="flex-1 text-lg">{{ t('History') }}</h2>
      <button v-if="history.items.length" class="text-sm text-muted underline hover:text-primary" data-testid="history-clear" @click="history.clear()">{{ t('Clear') }}</button>
    </div>
    <div class="divide-y divide-line" data-testid="history">
      <div v-for="h in history.items" :key="h.key" class="flex items-center px-2" data-testid="history-item">
        <ResultLink v-if="paths.get(h.key)" class="min-w-0 flex-1" :path="paths.get(h.key)!" :target="{ key: h.key }" />
        <span class="ml-2 shrink-0 whitespace-nowrap text-sm text-muted">{{ ago(h.at) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { shallowRef, watchEffect } from 'vue'
import { useHead } from '@unhead/vue'
import IconHistory from '~icons/mdi/history'
import IconStar from '~icons/mdi/star'
import ResultLink from '@o/components/ResultLink.vue'
import RichText from '@/components/RichText'
import { useBookmarks } from '@/stores/bookmarks'
import { useTree, type TreeItem } from '@/stores/tree'
import { useSettings } from '@/stores/settings'
import { useHistory } from '@/stores/history'
import { t, uiLang } from '@o/i18n'

useHead({ title: () => t('Bookmarks') })
const store = useBookmarks(), tree = useTree(), settings = useSettings(), history = useHistory()
const paths = shallowRef(new Map<string, TreeItem[]>())
watchEffect(async () => { paths.value = await tree.getPaths([...Object.values(store.bookmarks).map(b => b.key), ...history.items.map(h => h.key)]) })

/** when a text was read, in the language of the interface (its codes are tipitaka.app's: kh, ch) */
const LOCALE: Record<string, string> = { kh: 'km', ch: 'zh' }
function ago(at: number): string {
  const m = Math.floor((Date.now() - at) / 60000)
  const [n, unit] = m < 60 ? [m, 'minute'] as const : m < 60 * 24 ? [Math.floor(m / 60), 'hour'] as const : [Math.floor(m / (60 * 24)), 'day'] as const
  try { return new Intl.RelativeTimeFormat(LOCALE[uiLang.value] ?? uiLang.value, { numeric: 'auto' }).format(-n, unit) } catch { return new Date(at).toLocaleDateString() }
}
</script>
