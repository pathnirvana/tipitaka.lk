<template>
  <div class="p-3">
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

useHead({ title: 'තරු යෙදූ සූත්‍ර - Starred' })
const store = useBookmarks(), tree = useTree(), settings = useSettings()
const paths = shallowRef(new Map<string, TreeItem[]>())
watchEffect(async () => { paths.value = await tree.getPaths(Object.values(store.bookmarks).map(b => b.key)) })
store.resolveLegacy()
const message = computed(() => (!store.count ? 'ඔබ කිසිම සූත්‍රයකට හෝ පරිච්ඡේදයකට තරු යොදා නැත. සටහන් තැබීමට තරු ලකුණ මත ඔබන්න.'
  : `ඔබ විසින් තරු යෙදු සූත්‍ර ${store.count} ක ලැයිස්තුවක් පහත දැක්වේ.`))
const safe = (html: string) => DOMPurify.sanitize(html, { ALLOWED_TAGS: ['sr', 'b'], ALLOWED_ATTR: [] })
</script>
