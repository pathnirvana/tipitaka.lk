<!-- colour theme swatches (side panel: compact round swatches, settings page: with labels) -->
<template>
  <div class="flex flex-wrap items-start" role="radiogroup" aria-label="තිරයේ වර්ණ">
    <button v-for="t in THEMES" :key="t.id" role="radio" :aria-checked="s.theme === t.id" :title="t.label" :data-testid="`theme-${t.id}`"
      :class="['flex flex-col items-center', labels ? 'mb-2 mr-3 w-16' : 'mr-1.5']" @click="s.theme = t.id">
      <span :class="['block rounded-full border-2', labels ? 'h-10 w-10' : 'h-7 w-7', s.theme === t.id ? 'border-primary' : 'border-line']"
        :style="{ background: t.bg }"><IconCheck v-if="s.theme === t.id" class="m-auto h-full" :style="{ color: t.id === 'dark' ? t.fg : '#2b2522' }" /></span>
      <span v-if="labels" class="mt-1 text-center text-[13px] leading-tight">{{ t.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import IconCheck from '~icons/mdi/check'
import { THEMES } from '@/composables/themes'
import { useSettings } from '@/stores/settings'

defineProps<{ labels?: boolean }>()
const s = useSettings()
</script>
