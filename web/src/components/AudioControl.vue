<!-- recitation player (v2 AudioControl.vue) -->
<template>
  <!-- centered on the text between the tree and the dictionary column, above the dictionary sheet -->
  <div v-if="audio.controlsVisible" class="fixed z-30 w-full -translate-x-1/2 border-t border-line bg-surface shadow-2xl" data-testid="audio-control"
    :style="{ bottom: `${dictBottom}px`, left: `calc(50% + ${(contentLeft - contentRight) / 2}px)`, maxWidth: `${Math.min(800, viewport.width.value - contentLeft - contentRight)}px` }">
    <div class="h-[3px] bg-surface2"><div class="h-full bg-primary" :style="{ width: `${progress}%` }" /></div>
    <!-- paragraph number, sync | previous, play / pause (centered: equal width sides), next | settings, close -->
    <div class="flex items-center px-2 py-1">
      <div class="flex min-w-0 flex-1 basis-0 items-center space-x-1">
        <span class="truncate text-sm text-muted">{{ audio.activeEntry?.label?.num }}</span>
        <button :class="['icon-btn shrink-0', { 'bg-primary text-white hover:bg-primary': settings.audioFollow }]" title="සජ්ඣායනා වන ඡේදය පෙන්වන්න (sync)"
          :aria-pressed="settings.audioFollow" data-testid="audio-follow" @click="toggleFollow"><IconSync /></button>
      </div>
      <div class="flex items-center space-x-2 sm:space-x-4">
        <button class="icon-btn text-[1.6em]" title="previous" @click="audio.move(-1)"><IconRewind /></button>
        <button class="icon-btn bg-primary p-2 text-[1.9em] text-white shadow hover:bg-primary hover:opacity-90" :title="audio.isPlaying ? 'pause' : 'play'" data-testid="audio-toggle" @click="audio.togglePlay()">
          <IconPause v-if="audio.isPlaying" /><IconPlay v-else />
        </button>
        <button class="icon-btn text-[1.6em]" title="next" data-testid="audio-next" @click="audio.move(1)"><IconForward /></button>
      </div>
      <div class="flex flex-1 basis-0 items-center justify-end space-x-0.5">
        <div class="relative">
          <button ref="cog" class="icon-btn" title="settings" @click="showSettings = !showSettings"><IconCog /></button>
          <Floating :open="showSettings" :anchor="cog ?? null" placement="top" @close="showSettings = false">
            <label class="block text-sm">සජ්ඣායනා වේගය {{ audio.playbackRate }}x
              <input type="range" min="0.75" max="2" step="0.05" :value="audio.playbackRate" class="w-40" @input="audio.setRate(Number(($event.target as HTMLInputElement).value))">
            </label>
            <label class="mt-2 block text-sm">පරිච්ඡේද අතර නිහැඬියාව තත්පර {{ audio.silenceGap }}
              <input v-model.number="audio.silenceGap" type="range" min="0" max="1" step="0.2" class="w-40">
            </label>
          </Floating>
        </div>
        <button class="icon-btn text-error" title="close" @click="audio.close()"><IconClose /></button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import IconSync from '~icons/mdi/sync'
import IconCog from '~icons/mdi/cog'
import IconRewind from '~icons/mdi/rewind'
import IconForward from '~icons/mdi/fast-forward'
import IconPlay from '~icons/mdi/play'
import IconPause from '~icons/mdi/pause'
import IconClose from '~icons/mdi/close'
import Floating from './Floating.vue'
import { useAudio } from '@/stores/audio'
import { useTabs } from '@/stores/tabs'
import { useSettings } from '@/stores/settings'
import { useLayout } from '@/composables/layout'
import { viewport } from '@/composables/breakpoints'

const audio = useAudio(), tabs = useTabs(), settings = useSettings()
const { contentRight, dictBottom, contentLeft } = useLayout()
const cog = ref<HTMLElement>()
const showSettings = ref(false)
const progress = computed(() => (audio.duration ? (audio.currentTime / audio.duration) * 100 : 0))
/** sync on: TextTab keeps the chanted paragraph / word on screen in the playing tab, which is shown here */
async function toggleFollow() {
  settings.audioFollow = !settings.audioFollow
  const e = audio.activeEntry
  if (!settings.audioFollow || !e) return
  const i = tabs.tabList.findIndex(t => t.uid === audio.tabUid)
  if (i >= 0) { tabs.setActive(i); return }
  // the playing tab was closed or replaced: the active tab of that file is moved to the playing entry (v2 navigateToActive)
  const tab = tabs.activeTab
  if (!tab?.node || tab.node.file !== audio.file) return
  const t = await tabs.replaceActive({ key: tab.key, eInd: [e.page_idx, e.entry_idx], language: tab.language })
  audio.tabUid = t.uid
}
</script>
