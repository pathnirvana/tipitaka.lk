<template>
  <div class="p-3">
    <div class="mb-2 flex items-center border-b border-line px-2 pb-1">
      <IconStar class="mr-2 text-star" /><h2 class="flex-1 text-lg">තරු යෙදූ සූත්‍ර</h2>
    </div>
    <div class="banner mb-2 border-info" data-testid="bookmarks-message">{{ message }}</div>
    <div class="divide-y divide-line">
      <div v-for="(b, k) in store.bookmarks" :key="k" class="px-2 py-1" data-testid="bookmark-item">
        <TipitakaLink v-if="paths.get(b.key)" :path="paths.get(b.key)!" :params="b" />
        <div v-if="b.type !== 'heading'" :style="{ fontSize: settings.fontPx }">
          <div v-if="b.text" :class="['entry-text', b.type]"><RichText :text="b.text" :lang="b.language" :hide-footnotes="true" /></div>
          <div v-else-if="b.hText" class="text-[1.1em]" v-html="safe(b.hText)" />
        </div>
      </div>
    </div>

    <!-- the suttas read, most recent first (tipitaka.app) -->
    <div class="mb-1 mt-8 flex items-center border-b border-line px-2 pb-1">
      <IconHistory class="mr-2 text-info" /><h2 class="flex-1 text-lg">කියවූ සූත්‍ර</h2>
      <button v-if="history.items.length" class="text-sm text-muted underline hover:text-primary" data-testid="history-clear" @click="history.clear()">මකන්න</button>
    </div>
    <p v-if="!history.items.length" class="px-2 py-2 text-muted" data-testid="history-empty">ඔබ කියවන සූත්‍ර මෙහි පෙන්වේ.</p>
    <div class="divide-y divide-line" data-testid="history">
      <div v-for="h in history.items" :key="h.key" class="flex items-center px-2" data-testid="history-item">
        <TipitakaLink v-if="paths.get(h.key)" class="min-w-0 flex-1" :path="paths.get(h.key)!" :params="{ key: h.key, language: h.language }" />
        <span class="ml-2 shrink-0 whitespace-nowrap text-sm text-muted">{{ ago(h.at) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watchEffect } from 'vue'
import { useHead } from '@unhead/vue'
import DOMPurify from 'dompurify'
import TipitakaLink from '@/components/TipitakaLink.vue'
import RichText from '@/components/RichText'
import { useBookmarks } from '@/stores/bookmarks'
import { useTree, type TreeItem } from '@/stores/tree'
import { useSettings } from '@/stores/settings'
import { useHistory } from '@/stores/history'
import IconHistory from '~icons/mdi/history'
import IconStar from '~icons/mdi/star'

useHead({ title: 'තරු යෙදූ සහ කියවූ සූත්‍ර - Bookmarks' })
const store = useBookmarks(), tree = useTree(), settings = useSettings(), history = useHistory()
const paths = shallowRef(new Map<string, TreeItem[]>())
watchEffect(async () => { paths.value = await tree.getPaths([...Object.values(store.bookmarks).map(b => b.key), ...history.items.map(h => h.key)]) })
store.resolveLegacy()
const message = computed(() => (!store.count ? 'ඔබ කිසිම සූත්‍රයකට හෝ පරිච්ඡේදයකට තරු යොදා නැත. සටහන් තැබීමට තරු ලකුණ මත ඔබන්න.'
  : `ඔබ විසින් තරු යෙදු සූත්‍ර ${store.count} ක ලැයිස්තුවක් පහත දැක්වේ.`))
/** when a sutta was read: minutes, hours or days ago */
function ago(at: number) {
  const m = Math.floor((Date.now() - at) / 60000)
  if (m < 1) return 'දැන්'
  if (m < 60) return `මිනිත්තු ${m} කට පෙර`
  if (m < 60 * 24) return `පැය ${Math.floor(m / 60)} කට පෙර`
  const d = Math.floor(m / (60 * 24))
  return d === 1 ? 'ඊයේ' : `දින ${d} කට පෙර`
}
const safe = (html: string) => DOMPurify.sanitize(html, { ALLOWED_TAGS: ['sr', 'b'], ALLOWED_ATTR: [] })
</script>
