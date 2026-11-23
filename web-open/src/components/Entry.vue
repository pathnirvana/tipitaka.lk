<!-- one pāḷi entry: web/src/components/EntryCell.vue without the Sinhala column, the aṭṭhakathā, the dictionary and the
     places, with open.tipitaka.lk's links and the labels in the language of the interface -->
<template>
  <div class="entry group relative px-2 py-1.5" :data-page="row.page_idx" data-lang="pali" :data-entry="row.entry_idx">
    <div :class="['entry-text', type, { 'audio-playing': audioPlaying }]" :data-level="level">
      <RichText :text="row.p_text" lang="pali" :terms="terms" :hide-footnotes="hideFootnotes" :index-words="indexWords" />
      <template v-if="isHeading && row.node_key">
        <button class="icon-btn align-middle text-[0.8em] text-info" :title="t('Get a link')" data-testid="share" @click.stop="copyLink"><IconShare /></button>
        <button class="icon-btn align-middle text-[0.8em]" :title="starLabel" :aria-pressed="starred" data-testid="bookmark" @click.stop="bookmarks.toggle(bookmark)">
          <IconStar v-if="starred" class="text-star" /><IconStarOutline v-else />
        </button>
      </template>
    </div>
    <button v-if="hasOptions" ref="dots" class="icon-btn absolute left-0.5 top-0.5 hidden bg-surface text-info shadow group-hover:inline-flex"
      :class="{ '!inline-flex': menuOpen }" :title="t('Options')" data-testid="entry-options" @click.stop="menuOpen = !menuOpen">
      <IconDots />
    </button>
    <Floating v-if="menuOpen" :open="menuOpen" :anchor="dots ?? null" close-only @close="menuOpen = false">
      <div class="min-w-[220px] py-1 text-sm" @click="menuOpen = false">
        <button class="menu-item" @click="copyLink"><IconShare class="mr-3" />{{ t('Get a link') }}</button>
        <button class="menu-item" @click="copyContent"><IconCopy class="mr-3" />{{ t('Copy the paragraph') }}</button>
        <button class="menu-item" @click="bookmarks.toggle(bookmark)">
          <IconStar v-if="starred" class="mr-3 text-star" /><IconStarOutline v-else class="mr-3" />{{ starLabel }}
        </button>
        <a v-if="cst" class="menu-item" :href="cst" target="_blank" rel="noopener" data-testid="menu-cst"><IconBook class="mr-3" />{{ t('Chaṭṭha Saṅgāyana edition') }}</a>
        <a class="menu-item" :href="sinhalaLink(row.node_key, eInd)" target="_blank" rel="noopener" data-testid="menu-sinhala"><IconLanguage class="mr-3" />{{ t('BJ Sinhala translation') }}</a>
        <button v-if="audioAvailable" class="menu-item" data-testid="menu-audio" @click="toggleAudio">
          <IconPause v-if="audioPlaying" class="mr-3 text-primary" /><IconPlay v-else class="mr-3" />
          {{ audioPlaying ? t('Stop the recitation') : t('Listen to the recitation') }}
        </button>
      </div>
    </Floating>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IconDots from '~icons/mdi/dots-horizontal'
import IconShare from '~icons/mdi/share-variant'
import IconCopy from '~icons/mdi/content-copy'
import IconPlay from '~icons/mdi/play'
import IconPause from '~icons/mdi/pause'
import IconStar from '~icons/mdi/star'
import IconStarOutline from '~icons/mdi/star-outline'
import IconBook from '~icons/mdi/book-open-variant'
import IconLanguage from '~icons/mdi/translate'
import RichText from '@/components/RichText'
import Floating from '@/components/Floating.vue'
import type { EntryRow } from '@/data/types'
import type { FtsHighlight } from '@shared/fts-query'
import { TYPES } from '@shared/constants'
import type { EInd } from '@shared/routes'
import { stripForCopy } from '@shared/markup'
import { beautifyText } from '@shared/beautify'
import { copyText } from '@/composables/clipboard'
import { useUi } from '@/stores/ui'
import { useAudio } from '@/stores/audio'
import { useTabs } from '@/stores/tabs'
import { useSettings } from '@/stores/settings'
import { useBookmarks, type Bookmark } from '@/stores/bookmarks'
import { pageLink } from '@o/site'
import { t } from '@o/i18n'
import { cstLink, sinhalaLink } from '@o/composables/editions'

const props = defineProps<{ row: EntryRow; file: string; terms: FtsHighlight | null; hideFootnotes: boolean; indexWords?: boolean }>()
const ui = useUi(), audio = useAudio(), settings = useSettings(), tabs = useTabs(), bookmarks = useBookmarks()
const dots = ref<HTMLElement>()
const menuOpen = ref(false)
// the paragraph in the Chaṭṭha Saṅgāyana edition: looked up when the menu opens (most paragraphs have one)
const cst = ref<string | null>(null)
watch(menuOpen, async open => { if (open && !cst.value) cst.value = await cstLink(props.file, props.row.page_idx, props.row.entry_idx) })

const type = computed(() => TYPES[props.row.p_type])
const level = computed(() => (props.row.p_level >= 0 ? props.row.p_level : type.value === 'centered' ? 0 : undefined))
const isHeading = computed(() => type.value === 'heading')
const eInd = computed<EInd>(() => [props.row.page_idx, props.row.entry_idx])
const hasOptions = computed(() => ['unindented', 'gatha', 'paragraph'].includes(type.value) && !!props.row.node_key)
const audioAvailable = computed(() => audio.isAvailable(props.file) && props.row.audio_idx >= 0)
const audioPlaying = computed(() => audio.playingPos === `${props.file}:${props.row.page_idx}-${props.row.entry_idx}`)
const bookmark = computed<Bookmark>(() => ({ key: props.row.node_key, language: 'pali', eInd: eInd.value, type: type.value,
  text: props.row.p_text, hText: null, file: props.file }))
const starred = computed(() => bookmarks.isStarred(bookmark.value))
const starLabel = computed(() => (starred.value ? t('Remove the bookmark') : t('Add a bookmark')))

async function copyLink() {
  if (await copyText(pageLink(props.row.node_key, isHeading.value ? null : eInd.value))) ui.notify(t('Link copied'))
}
async function copyContent() {
  if (await copyText(beautifyText(stripForCopy(props.row.p_text), 'pali', settings.letterOptions))) ui.notify(t('Paragraph copied'))
}
function toggleAudio() {
  if (audioPlaying.value) audio.togglePlay()
  else audio.startEntry(props.file, eInd.value, tabs.activeTab?.uid)
}
</script>
