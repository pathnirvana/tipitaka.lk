<!-- dictionary results (tipitaka.app DictView.vue): the DPD analysis of a clicked word or a typed word, DPD headwords,
     the other dictionaries, breakups. Cross references (<a data-dict>) are followed in place with a back button. -->
<template>
  <div class="text-[15px]" style="overflow-wrap: anywhere" data-testid="dict-view">
    <div v-if="loading" class="space-y-2 py-2" aria-busy="true">
      <div v-for="i in 4" :key="i" class="h-4 animate-pulse rounded bg-surface2" />
    </div>
    <div v-else-if="err" class="banner border-error" data-testid="dict-error">{{ err }}</div>
    <template v-else-if="res">
      <div class="mb-2 flex items-center">
        <button v-if="back.length" class="icon-btn -ml-1 mr-1" aria-label="ආපසු" data-testid="dict-back" @click="goBack"><IconBack /></button>
        <h2 class="mr-2 text-xl font-bold text-primary" data-testid="dict-word">{{ ps(res.word) }}</h2>
        <span class="text-sm text-muted">{{ res.word }}</span>
        <span class="flex-1" />
        <RouterLink v-if="compact" :to="'/dict/' + toSinh(res.word)" class="mr-2 text-sm text-info underline" data-testid="dict-more">තව</RouterLink>
        <DictFilter v-if="compact" compact />
      </div>

      <!-- DPD analysis of the form -->
      <div v-if="res.grammar?.length || res.deconstructor?.length" class="mb-3 rounded-lg bg-surface2 px-2.5 py-2" data-testid="dict-analysis">
        <div v-for="(g, i) in uniqueGrammar" :key="i"><b class="mr-2">{{ ps(g[0]) }}</b><span class="mr-2 text-muted">{{ g[1] }}</span>{{ g[2] }}</div>
        <div v-for="(d, i) in res.deconstructor ?? []" :key="'d' + i"><IconSplit class="mr-1 inline text-muted" />{{ ps(d) }}</div>
      </div>

      <section v-if="res.dpd.length" class="mb-4" data-testid="dict-dpd-section">
        <div class="section-title">DPD <span class="font-normal">· Digital Pāḷi Dictionary</span></div>
        <DpdHeadword v-for="h in shownDpd" :key="h.id" :h="h" />
        <button v-if="res.dpd.length > shownDpd.length" class="text-sm text-info underline" @click="dpdAll = true">තවත් {{ res.dpd.length - shownDpd.length }} ක්</button>
      </section>

      <section v-if="res.entries.length" class="mb-4">
        <div class="section-title">ශබ්දකෝෂ</div>
        <div v-for="(e, i) in res.entries" :key="i" class="border-b border-line py-2 last:border-0" :data-dict-code="e.dict" data-testid="dict-match" @click="onMeaningClick">
          <div class="mb-0.5">
            <button type="button" class="chip mr-2 hover:border-primary" :title="dictName(e.dict)" data-testid="dict-chip" @click.stop="showDict($event, e.dict)">{{ dictShort(e.dict) }}</button>
            <b>{{ ps(e.word) }}</b><sup v-if="e.hom" class="text-[0.625rem] text-muted">{{ e.hom }}</sup>
          </div>
          <div class="meaning-html" v-html="cleanMeaning(e.meaning)" />
        </div>
      </section>

      <section v-if="res.breakups.length" class="mb-4" data-testid="dict-breakups">
        <div class="section-title">පද බෙදීම</div>
        <div v-for="o in breakupLines" :key="o">{{ ps(o) }}</div>
      </section>

      <Floating :open="!!tip" :anchor="tip?.el ?? null" @close="tip = null">
        <div class="max-w-[300px] text-sm" data-testid="dict-tip">
          <div v-if="tip?.title" class="font-bold">{{ tip.title }}</div>
          <div v-if="tip?.text">{{ tip.text }}</div>
          <div v-if="tip?.sub" class="mt-1 text-xs text-muted">{{ tip.sub }}</div>
        </div>
      </Floating>

      <div v-if="!hasResults(res)" class="mx-3 my-2 text-center text-sm" data-testid="inline-not-found">
        මෙම වචනය ශබ්දකෝෂ වල හමුවූයේ නැත. අකුරු කිහිපයක් අඩු කර උත්සාහ කරන්න.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IconSplit from '~icons/mdi/call-split'
import IconBack from '~icons/mdi/arrow-left'
import DpdHeadword from './DpdHeadword.vue'
import DictFilter from './DictFilter.vue'
import Floating from './Floating.vue'
import { QueryError } from '@/data/source'
import { listDicts, lookupWord, searchWord, hasResults, toSinh, langName, type Dict, type DictResult } from '@/data/dictionary'
import { cleanMeaning, usePaliSinh } from '@/composables/dict'
import { useSettings } from '@/stores/settings'

/** word: a clicked word of the text (lookup) or typed input (dict: Sinhala, Roman or singlish) */
const props = defineProps<{ word: string; mode: 'lookup' | 'dict'; compact?: boolean }>()
const emit = defineEmits<{ result: [r: DictResult | null] }>()
const settings = useSettings()
const ps = usePaliSinh()
const res = ref<DictResult | null>(null)
const loading = ref(false)
const err = ref('')
const dicts = ref<Dict[]>([])
const dpdAll = ref(false)

listDicts().then(d => { dicts.value = d }).catch(() => {})
const dictShort = (code: string) => dicts.value.find(d => d.code === code)?.short ?? code
const dictName = (code: string) => { const d = dicts.value.find(x => x.code === code); return d ? `${d.name} (${langName(d.lang)})` : code }

// cross references (<a data-dict>) are followed in place; back returns to the previous word
const followed = ref<string | null>(null) // the Roman word of a followed reference
const back = ref<(string | null)[]>([])
function goBack() { followed.value = back.value.pop() ?? null }

// the dictionary of an entry (BU, PN ...) and abbreviations (<abbr data-a>): a popover
const tip = ref<{ el: HTMLElement; title: string; text: string; sub?: string } | null>(null)
function showDict(ev: MouseEvent, code: string) {
  const d = dicts.value.find(x => x.code === code)
  if (d) tip.value = { el: ev.currentTarget as HTMLElement, title: d.name, text: d.desc ?? '', sub: [langName(d.lang), d.origin].filter(Boolean).join(' · ') }
}
function onMeaningClick(ev: MouseEvent) {
  const el = ev.target as HTMLElement
  const dict = (ev.currentTarget as HTMLElement).dataset.dictCode ?? ''
  const link = el.closest<HTMLElement>('a[data-dict]')
  if (link) {
    ev.preventDefault()
    back.value.push(followed.value)
    followed.value = (link.dataset.dict ?? link.textContent ?? '').toLowerCase()
    return
  }
  const abbr = el.closest<HTMLElement>('abbr[data-a]')
  if (abbr) {
    const a = abbr.dataset.a ?? ''
    const x = dicts.value.find(d => d.code === dict)?.abbrevs?.[a]
    if (x) tip.value = { el: abbr, title: a, text: x }
    return
  }
  const ed = el.closest<HTMLElement>('.ed-add, .ed-mod, .ed-orig')
  if (ed) {
    tip.value = ed.classList.contains('ed-add') ? { el: ed, title: 'සංස්කාරක එක් කළ / නිවැරදි කළ කොටසකි', text: '' }
      : ed.classList.contains('ed-orig') ? { el: ed, title: 'මුල් සංස්කරණයේ අක්ෂර වින්‍යාසය', text: '' }
        : { el: ed, title: 'සංස්කාරක නවීකරණය කළ කොටසකි', text: ed.dataset.orig ? `මුල්: ${ed.dataset.orig}` : '' }
  }
}

// the splits of the word and of its spellings that fold the same, once each
const breakupLines = computed(() => [...new Set((res.value?.breakups ?? []).map(b => b.origin))])
const shownDpd = computed(() => (dpdAll.value || !props.compact ? res.value?.dpd ?? [] : (res.value?.dpd ?? []).slice(0, 6)))
const uniqueGrammar = computed(() => {
  const seen = new Set<string>()
  return (res.value?.grammar ?? []).filter(g => { const k = g.join('|'); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 8)
})

watch(() => props.word, () => { followed.value = null; back.value = [] })
let gen = 0
watch(() => [props.word, props.mode, followed.value, settings.dicts.join(',')] as const, async ([w, mode, f]) => {
  dpdAll.value = false
  tip.value = null
  if (!w && !f) { res.value = null; emit('result', null); return }
  const my = ++gen
  loading.value = true
  err.value = ''
  try {
    const r = f ? await searchWord(f, settings.dicts) : mode === 'lookup' ? await lookupWord(w, settings.dicts) : await searchWord(w, settings.dicts)
    if (my === gen) { res.value = r; emit('result', r) }
  } catch (e) {
    if (my === gen) err.value = e instanceof QueryError && e.code === 'not_ready' ? e.message : `ශබ්දකෝෂය සෙවීමේදී දෝෂයක්: ${(e as Error).message}`
  } finally {
    if (my === gen) loading.value = false
  }
}, { immediate: true })
</script>
