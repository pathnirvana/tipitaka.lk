<!-- colour theme swatches (web/src/components/ThemePicker.vue with the names in the language of the interface) -->
<template>
  <div class="flex flex-wrap items-start" role="radiogroup" :aria-label="t('Appearance')">
    <button v-for="th in THEMES" :key="th.id" role="radio" :aria-checked="s.theme === th.id" :title="t(NAMES[th.id])" :data-testid="`theme-${th.id}`"
      class="mr-1.5 flex flex-col items-center" @click="s.theme = th.id">
      <span :class="['block h-7 w-7 rounded-full border-2', s.theme === th.id ? 'border-primary' : 'border-line']"
        :style="{ background: th.bg }"><IconCheck v-if="s.theme === th.id" class="m-auto h-full" :style="{ color: th.id === 'dark' ? th.fg : '#2b2522' }" /></span>
    </button>
  </div>
</template>

<script setup lang="ts">
import IconCheck from '~icons/mdi/check'
import { THEMES, type Theme } from '@/composables/themes'
import { useSettings } from '@/stores/settings'
import { t } from '@o/i18n'

const NAMES: Record<Theme, string> = { light: 'Light', sepia: 'Sepia', green: 'Green', dark: 'Dark', auto: 'Auto' }
const s = useSettings()
</script>
