<!-- one DPD headword (Digital Pāḷi Dictionary by Bodhirasa Bhikkhu, CC BY-NC-SA 4.0; tipitaka.app DpdHeadword.vue) -->
<template>
  <article class="border-b border-line py-2 last:border-0" data-testid="dpd-head">
    <button class="flex w-full items-baseline text-left" :aria-expanded="open" @click="open = !open">
      <span class="mr-2 font-bold">{{ ps(lemma) }}</span>
      <sup v-if="sense" class="mr-2 text-[0.625rem] text-muted">{{ sense }}</sup>
      <span class="chip mr-2" :title="posSi(h.pos)">{{ shortSi(h.pos) }}</span>
      <span class="min-w-0 flex-1"><b>{{ h.meaning || h.meaning2 }}</b><span v-if="h.meaningLit" class="text-muted"> · lit. {{ h.meaningLit }}</span></span>
    </button>
    <table v-if="open" class="mt-1.5 text-[0.9em]">
      <tr v-for="row in rows" :key="row[0]">
        <th class="whitespace-nowrap pr-3 text-left align-top font-normal text-muted">{{ row[0] }}</th><td>{{ row[1] }}</td>
      </tr>
      <tr v-if="h.example">
        <th class="pr-3 text-left align-top font-normal text-muted">උදාහරණ</th>
        <td><i v-html="cleanMeaning(convHtml(h.example, ps))" /> <span class="text-muted">{{ h.source }} {{ h.sutta }}</span></td>
      </tr>
    </table>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DpdHead } from '@/data/dictionary'
import { cleanMeaning, convHtml, usePaliSinh } from '@/composables/dict'
import { grammarSi, plusCaseSi, posSi, shortSi } from '@/composables/grammar'

const props = defineProps<{ h: DpdHead; expanded?: boolean }>()
const open = ref(!!props.expanded)
const ps = usePaliSinh()
// "dhamma 1.01" -> lemma dhamma, sense 1.01
const lemma = computed(() => props.h.lemma.replace(/\s+[\d.]+$/, ''))
const sense = computed(() => /\s([\d.]+)$/.exec(props.h.lemma)?.[1] ?? '')
const rows = computed(() => {
  const h = props.h
  const r: [string, string][] = []
  if (h.grammar) r.push(['ව්‍යාකරණ', grammarSi(h.grammar, ps)])
  if (h.plusCase) r.push(['+', plusCaseSi(h.plusCase)])
  if (h.root) r.push(['ධාතුව', `${ps(h.root.root)} ${h.root.group}${h.root.sign ? ' ' + h.root.sign : ''} (${h.root.meaning})`])
  if (h.rootBase) r.push(['මූල පදය', ps(h.rootBase)])
  if (h.construction) r.push(['සැකැස්ම', ps(h.construction.replace(/\n/g, '; '))])
  if (h.compoundType) r.push(['සමාසය', `${ps(h.compoundType)}${h.compoundConstruction ? ' · ' + ps(h.compoundConstruction) : ''}`])
  if (h.derivedFrom) r.push(['නිෂ්පන්නය', ps(h.derivedFrom)])
  if (h.meaning2 && h.meaning2 !== h.meaning) r.push(['බුද්ධදත්ත', h.meaning2])
  if (h.sanskrit) r.push(['සංස්කෘත', h.sanskrit])
  if (h.notes) r.push(['සටහන්', h.notes.replace(/<[^>]+>/g, '')])
  return r
})
</script>
