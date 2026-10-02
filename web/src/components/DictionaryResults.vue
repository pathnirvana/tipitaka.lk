<!-- v2 DictionaryResults.vue. Meanings are HTML from the dictionaries - sanitised with DOMPurify -->
<template>
  <div v-if="results" data-testid="dict-results">
    <div v-if="results.breakups.length" class="my-2 flex flex-wrap">
      <div v-for="(b, i) in results.breakups" :key="i" class="px-4" data-testid="dict-breakup">
        <span>{{ b.word }}</span><span class="chip mx-1">{{ b.type }}</span><span>{{ b.breakup }}</span>
      </div>
    </div>
    <table v-if="results.matches.length" class="w-full">
      <tbody>
        <tr v-for="(m, i) in results.matches" :key="i" class="border-b border-line">
          <td class="px-3 py-2" :style="{ fontSize: settings.fontPx }" data-testid="dict-match">
            <span class="text-info">{{ m.word }}</span>
            <span class="chip mx-3 text-[10px]">{{ m.dict }}</span>
            <span class="meaning" v-html="sanitize(m.meaning)" />
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="results.prefixWords.length" class="card my-2">
      <div class="mb-2 text-sm text-muted">ශබ්දකෝෂ වල අඩංගු මෙම අකුරු වලින් ඇරඹෙන වෙනත් වචන</div>
      <button v-for="(p, i) in results.prefixWords" :key="i" class="chip m-1 text-sm hover:bg-surface2" data-testid="dict-prefix" @click="$router.push(`/dict/${p.word}`)">{{ p.word }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import DOMPurify from 'dompurify'
import type { DictResults } from '@/data/dictionary'
import { useSettings } from '@/stores/settings'

defineProps<{ results: DictResults | null }>()
const settings = useSettings()
const sanitize = (html: string) => DOMPurify.sanitize(html, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'span', 'sup', 'sub', 'u', 'small', 'ul', 'ol', 'li', 'div', 'font'], ALLOWED_ATTR: ['class'] })
</script>
