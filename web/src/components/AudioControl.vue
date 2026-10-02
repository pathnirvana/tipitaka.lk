<!-- recitation player (v2 AudioControl.vue) -->
<template>
  <div v-if="audio.controlsVisible" class="fixed bottom-0 left-1/2 z-30 w-full max-w-[800px] -translate-x-1/2 border-t border-line bg-surface shadow-2xl" data-testid="audio-control">
    <div class="h-[3px] bg-surface2"><div class="h-full bg-primary" :style="{ width: `${progress}%` }" /></div>
    <div class="flex items-center gap-1 px-2 py-1">
      <div class="flex-1 truncate text-sm">{{ audio.activeEntry?.label?.num }}</div>
      <button class="icon-btn" title="go to the playing paragraph" @click="goToActive"><IconUp /></button>
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
      <button class="icon-btn" title="previous" @click="audio.move(-1)"><IconRewind /></button>
      <button class="icon-btn" title="play/pause" data-testid="audio-toggle" @click="audio.togglePlay()">
        <IconPause v-if="audio.isPlaying" class="text-primary" /><IconPlay v-else />
      </button>
      <button class="icon-btn" title="next" @click="audio.move(1)"><IconForward /></button>
      <button class="icon-btn text-error" title="close" @click="audio.close()"><IconClose /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import IconUp from '~icons/mdi/chevron-double-up'
import IconCog from '~icons/mdi/cog'
import IconRewind from '~icons/mdi/rewind'
import IconForward from '~icons/mdi/fast-forward'
import IconPlay from '~icons/mdi/play'
import IconPause from '~icons/mdi/pause'
import IconClose from '~icons/mdi/close'
import Floating from './Floating.vue'
import { useAudio } from '@/stores/audio'
import { useTabs } from '@/stores/tabs'

const audio = useAudio(), tabs = useTabs()
const cog = ref<HTMLElement>()
const showSettings = ref(false)
const progress = computed(() => (audio.duration ? (audio.currentTime / audio.duration) * 100 : 0))
async function goToActive() { // active tab replaced by the playing entry (v2 navigateToActive)
  const e = audio.activeEntry, tab = tabs.activeTab
  if (!e || !tab?.node) return
  await tabs.replaceActive({ key: tab.key, eInd: [e.page_idx, e.entry_idx], language: tab.language })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>
