<!-- one pali or sinhala entry (v2 TextEntry.vue) -->
<template>
  <div class="entry group relative px-2 py-1.5" :data-page="row.page_idx" :data-lang="lang" :data-entry="row.entry_idx">
    <div :class="['entry-text', type, { 'audio-playing': audioPlaying }]" :data-level="level">
      <AtuwaLink v-if="isHeading && row.node_key" :mirror-key="row.mirror_key" :language="lang" />
      <RichText :text="text" :lang="lang" :terms="terms" :wrap-words="lang === 'pali'" :hide-footnotes="hideFootnotes" />
      <template v-if="isHeading && row.node_key">
        <ShareButton :link="`/${row.node_key}/${lang}`" />
        <BookmarkButton :bookmark="bookmark" />
      </template>
    </div>
    <button v-if="hasOptions" ref="dots" class="icon-btn absolute left-0.5 top-0.5 hidden bg-surface text-info shadow group-hover:inline-flex"
      :class="{ '!inline-flex': menuOpen }" title="විකල්ප" data-testid="entry-options" @click.stop="menuOpen = !menuOpen">
      <IconDots />
    </button>
    <Floating v-if="menuOpen" :open="menuOpen" :anchor="dots ?? null" @close="menuOpen = false">
      <div class="min-w-[220px] py-1 text-sm" @click="menuOpen = false">
        <button class="menu-item" @click="copyLink"><IconShare class="mr-3" />link එකක් ලබාගන්න</button>
        <button class="menu-item" @click="copyContent"><IconCopy class="mr-3" />ඡේදය copy කරගන්න</button>
        <AtuwaLink :mirror-key="row.mirror_key" :language="lang" list-item />
        <BookmarkButton :bookmark="bookmark" list-item />
        <button v-if="audioAvailable" class="menu-item" @click="toggleAudio">
          <IconPause v-if="audioPlaying" class="mr-3 text-primary" /><IconPlay v-else class="mr-3" />
          {{ 'සජ්ඣායනය' + (audioPlaying ? ' නවත්වන්න' : ' අසන්න') }}
        </button>
      </div>
    </Floating>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import IconDots from '~icons/mdi/dots-horizontal'
import IconShare from '~icons/mdi/share-variant'
import IconCopy from '~icons/mdi/content-copy'
import IconPlay from '~icons/mdi/play'
import IconPause from '~icons/mdi/pause'
import RichText from './RichText'
import AtuwaLink from './AtuwaLink.vue'
import ShareButton from './ShareButton.vue'
import BookmarkButton from './BookmarkButton.vue'
import Floating from './Floating.vue'
import type { EntryRow } from '@/data/types'
import type { FtsTerm } from '@shared/fts-query'
import { TYPES } from '@shared/constants'
import { entryLink, type EInd } from '@shared/routes'
import { stripForCopy } from '@shared/markup'
import { beautifyText } from '@shared/beautify'
import { copyText } from '@/composables/clipboard'
import { useUi } from '@/stores/ui'
import { useAudio } from '@/stores/audio'
import { useSettings } from '@/stores/settings'
import type { Bookmark } from '@/stores/bookmarks'

const props = defineProps<{ row: EntryRow; lang: 'pali' | 'sinh'; file: string; terms: FtsTerm[] | null; hideFootnotes: boolean }>()
const ui = useUi(), audio = useAudio(), settings = useSettings()
const dots = ref<HTMLElement>()
const menuOpen = ref(false)

const isPali = computed(() => props.lang === 'pali')
const text = computed(() => (isPali.value ? props.row.p_text : props.row.s_text))
const type = computed(() => TYPES[isPali.value || props.row.s_type < 0 ? props.row.p_type : props.row.s_type])
const level = computed(() => {
  const l = isPali.value ? props.row.p_level : props.row.s_level
  return l >= 0 ? l : type.value === 'centered' ? 0 : undefined // centered without a level is level 0 (A31)
})
const isHeading = computed(() => type.value === 'heading')
const eInd = computed<EInd>(() => [props.row.page_idx, props.row.entry_idx])
const hasOptions = computed(() => ['unindented', 'gatha', 'paragraph'].includes(type.value) && !!props.row.node_key)
const audioAvailable = computed(() => audio.isAvailable(props.file) && props.row.audio_idx >= 0)
const audioPlaying = computed(() => audio.playingPos === `${props.file}:${props.row.page_idx}-${props.row.entry_idx}`)
const bookmark = computed<Bookmark>(() => ({ key: props.row.node_key, language: props.lang, eInd: eInd.value, type: type.value,
  text: text.value, hText: null, file: props.file }))

async function copyLink() {
  if (await copyText(entryLink(props.row.node_key, eInd.value, props.lang, isHeading.value))) ui.notifyType('link-copied')
}
async function copyContent() {
  if (await copyText(beautifyText(stripForCopy(text.value), props.lang, settings.letterOptions))) ui.notifyType('content-copied')
}
function toggleAudio() {
  if (audioPlaying.value) audio.togglePlay()
  else audio.startEntry(props.file, eInd.value)
}
</script>
