<!-- the reading mode: Sinhala / Pāḷi / interleaved / side by side (side by side only on wide screens) -->
<template>
  <div class="inline-flex overflow-hidden rounded-full border border-line" role="group" aria-label="කියවන ආකාරය" data-testid="reading-mode">
    <button v-for="m in READING_MODES" :key="m" :class="['whitespace-nowrap px-2.5 py-1 text-[15px]', picked === m ? 'bg-primary text-white' : 'hover:bg-surface2',
                                                         { 'opacity-50': m === 'side' && !sideFits }]"
      :title="MODE_HELP[m] + (m === 'side' && !sideFits ? ' - මෙම තිරයේ පාළිය සමඟ පෙන්වේ' : '')" :aria-pressed="picked === m"
      :data-testid="`mode-${m}`" @click="pick(m)">
      {{ MODE_LABELS[m] }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { READING_MODES } from '@p/overrides/settings'
import { useReadingMode, MODE_LABELS, MODE_HELP } from '@p/composables/readingMode'

const { picked, pick, sideFits } = useReadingMode()
</script>
