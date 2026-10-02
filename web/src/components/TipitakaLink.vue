<!-- breadcrumb link to a sutta (v2 TipitakaLink.vue): [pitaka] sutta name  parents... ☆ -->
<template>
  <div v-if="items.length" class="flex flex-wrap items-center">
    <span class="cursor-pointer py-2 hover:text-info" :style="{ fontSize: settings.fontPx }" data-testid="tipitaka-link" @click="open">
      <span class="mr-2 rounded-[10px] border border-current px-1 text-[1.1em]">{{ items[0].text }}</span>
      <span class="mr-2 text-[1.2em] text-primary">{{ items[items.length - 1].text.replace(/[\(\)\[\]]/g, '') }}</span>
      <span v-for="(item, i) in items.slice(1, -1)" :key="item.key" class="text-[1.1em]">
        <IconChevron v-if="i > 0" class="inline" />{{ item.text }}
      </span>
    </span>
    <BookmarkButton :bookmark="bookmark" class="ml-1" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import IconChevron from '~icons/mdi/chevron-right'
import BookmarkButton from './BookmarkButton.vue'
import { useTree, type TreeItem } from '@/stores/tree'
import { useTabs, type OpenParams } from '@/stores/tabs'
import { useSettings } from '@/stores/settings'
import type { Bookmark } from '@/stores/bookmarks'

const props = defineProps<{ path: TreeItem[]; params: OpenParams & { type?: string | null; text?: string | null; hText?: string | null; file?: string } }>()
const emit = defineEmits<{ opened: [] }>()
const tree = useTree(), settings = useSettings()
const pitaka: Record<string, string> = { vp: 'VP', sp: 'SP', ap: 'AP' }
const items = computed(() => props.path.map(item => ({ key: item.key, text: pitaka[item.key] || tree.nameOf(item, props.params.language) })))
const bookmark = computed<Bookmark>(() => ({
  key: props.params.key, language: props.params.language || settings.treeLanguage, eInd: props.params.eInd || null,
  type: props.params.type ?? null, text: props.params.text ?? null, hText: props.params.hText ?? null,
  file: props.params.file || props.path[props.path.length - 1]?.file,
}))
function open() {
  const { key, eInd, language, hWords } = props.params
  useTabs().openTab({ key, eInd, language, hWords })
  emit('opened')
}
</script>
