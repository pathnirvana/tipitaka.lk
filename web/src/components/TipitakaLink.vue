<!-- breadcrumb link to a sutta (v2 TipitakaLink.vue): [pitaka] sutta name  parents... ☆ -->
<template>
  <!-- the star stays at the end of the first line (on small screens a wrapping row gave it a line of its own) -->
  <div v-if="items.length" class="flex items-start">
    <span class="min-w-0 flex-1 cursor-pointer py-2 hover:text-info" :style="{ fontSize: settings.fontPx, overflowWrap: 'anywhere' }" data-testid="tipitaka-link" @click="open">
      <span class="mr-2 whitespace-nowrap rounded-full bg-surface2 px-2.5 py-0.5 align-[0.1em] text-[0.85em] text-muted" data-testid="collection-chip">{{ collection }}</span>
      <span class="mr-2 text-[1.1em] text-primary">{{ items[items.length - 1].text.replace(/[\(\)\[\]]/g, '') }}</span>
      <span v-for="(item, i) in items.slice(1, -1)" :key="item.key" class="text-[0.95em]">
        <IconChevron v-if="i > 0" class="inline" />{{ item.text }}
      </span>
    </span>
    <BookmarkButton :bookmark="bookmark" class="ml-1 mt-2 shrink-0" />
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
// the collection (root of the path): short Sinhala names, the same in both languages (v2: VP SP AP or the root's name)
const COLLECTIONS: Record<string, string> = { vp: 'විනය', sp: 'සූත්‍ර', ap: 'අභිධර්ම', 'atta-vp': 'විනය අටුවා', 'atta-sp': 'සූත්‍ර අටුවා',
  'atta-ap': 'අභිධර්ම අටුවා', anya: 'අන්‍ය' }
const items = computed(() => props.path.map(item => ({ key: item.key, text: tree.nameOf(item, props.params.language) })))
const collection = computed(() => COLLECTIONS[props.path[0]?.key] ?? items.value[0]?.text ?? '')
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
