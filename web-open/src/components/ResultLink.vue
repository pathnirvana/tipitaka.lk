<!-- a search result's text: its title and the books it is in, in the script of the page (web/src/components/TipitakaLink.vue) -->
<template>
  <a v-if="path.length" :href="href" class="pali block cursor-pointer py-1.5 hover:text-info" :style="{ fontSize: '1rem', overflowWrap: 'anywhere' }" data-testid="result-link" @click="open">
    <span class="mr-2 font-medium text-primary">{{ name(path[path.length - 1]).replace(/[()[\]]/g, '') }}</span>
    <span v-if="alias" class="mr-2 text-[0.95em] text-muted" data-testid="title-alias">({{ alias }})</span>
    <span v-for="(item, i) in path.slice(0, -1)" :key="item.key" class="text-[0.8125em] text-muted">
      <IconChevron v-if="i > 0" class="inline" />{{ name(item) }}
    </span>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import IconChevron from '~icons/mdi/chevron-right'
import { useTree, type TreeItem } from '@/stores/tree'
import { useTabs } from '@/stores/tabs'
import type { FtsHighlight } from '@shared/fts-query'
import type { EInd } from '@shared/routes'

const props = defineProps<{ path: TreeItem[]; target: { key: string; eInd?: EInd | null; hWords?: FtsHighlight | null }; alias?: string }>()
const tree = useTree(), router = useRouter()
const name = (item: TreeItem) => tree.nameOf(item, 'pali')
const href = computed(() => router.resolve(`/${props.target.key}${props.target.eInd ? `/${props.target.eInd.join('-')}` : ''}`).href)
/** opens the text in the reader (a modified / middle click is left to the browser: a new browser tab) */
function open(e: MouseEvent) {
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return
  e.preventDefault()
  useTabs().openTab({ key: props.target.key, eInd: props.target.eInd, language: 'pali', hWords: props.target.hWords })
}
</script>
