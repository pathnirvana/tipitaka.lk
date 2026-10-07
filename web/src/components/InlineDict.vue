<!-- dictionary bottom sheet in the reader (v2 Home.vue) -->
<template>
  <div v-if="dict.show" class="fixed bottom-0 left-1/2 z-30 h-[250px] w-full max-w-[800px] -translate-x-1/2 border-t border-line bg-surface shadow-2xl" data-testid="inline-dict">
    <div class="flex items-center space-x-1 px-2 py-1">
      <input v-model="word" class="input w-40" aria-label="word" data-testid="inline-dict-input">
      <button class="icon-btn" title="backspace" data-testid="inline-backspace" @click="backspace"><IconBackspace /></button>
      <button class="btn" data-testid="inline-fts" @click="$router.push('/fts/' + dict.word)">
        <span v-if="smAndUp">අන්තර්ගතයේ සොයන්න</span><IconMagnify v-else class="text-primary" />
      </button>
      <span class="flex-1" />
      <button class="icon-btn text-error" title="close" @click="dict.close()"><IconClose /></button>
    </div>
    <div class="max-h-[200px] overflow-y-auto">
      <DictionaryResults :results="dict.results" />
      <Skeleton v-if="dict.loading" :lines="3" />
      <div v-else-if="dict.error" class="banner border-error">{{ dict.error }}</div>
      <div v-else-if="!dict.results || !dict.results.matches.length" class="mx-3 text-center text-sm" data-testid="inline-not-found">
        මෙම වචනය ශබ්දකෝෂ වල හමුවූයේ නැත. අකුරු කිහිපයක් අඩු කර උත්සාහ කරන්න.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import IconBackspace from '~icons/mdi/backspace'
import IconMagnify from '~icons/mdi/magnify'
import IconClose from '~icons/mdi/close'
import DictionaryResults from './DictionaryResults.vue'
import Skeleton from './Skeleton.vue'
import { useInlineDict } from '@/stores/inlineDict'
import { smAndUp } from '@/composables/breakpoints'

const dict = useInlineDict()
const debounced = useDebounceFn(() => dict.run(), 400)
const word = computed({ get: () => dict.word, set: v => { dict.word = v; debounced() } })
// strip one consonant + vowel signs at a time
function backspace() { word.value = dict.word.replace(/[අ-ෆ][්-ෟංඃ‍]*$/, '') }
</script>
