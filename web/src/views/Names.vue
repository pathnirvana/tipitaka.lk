<!-- /names: the places, people, deities ... of the texts (tipitaka.app names, DPD / DPPN); /names/<slug>: one name - its
     meaning, place on the map, the suttas it is the setting of and the suttas that name it -->
<template>
  <div class="ui-app mx-auto max-w-[900px] px-4 pb-20 pt-6" data-testid="names-page">
    <template v-if="!slug">
      <div class="mb-4 flex items-center">
        <h1 class="flex-1 text-2xl font-semibold">ස්ථාන සහ පුද්ගලයන්</h1>
        <RouterLink to="/map" class="chip ml-3 shrink-0 text-sm hover:border-primary" data-testid="names-map-link"><IconMap class="mr-1" />සිතියම</RouterLink>
      </div>
      <p class="mb-4 text-sm text-muted">සූත්‍ර සහ අටුවා කථා දේශනා කළේ කොතැනද, කවුරුන් විසින්ද, කාටද යන්න ග්‍රන්ථවල සඳහන් පරිදි.</p>
      <input v-model="q" type="search" class="input mb-3 w-full" placeholder="නම සොයන්න (savatthi, ආනන්ද)" data-testid="names-search">
      <div class="-m-0.5 mb-3 flex flex-wrap">
        <button v-for="(label, t) in TYPE_LABEL" :key="t" :class="['chip m-0.5 text-sm', { 'border-primary bg-primary-soft text-primary': type === t && !q.trim() }]"
          :data-testid="`names-type-${t}`" @click="type = t; q = ''">{{ label }}<span class="ml-1 text-xs text-muted">{{ counts[t] ?? 0 }}</span></button>
      </div>
      <div v-if="loading" class="h-40 animate-pulse rounded bg-surface2" />
      <ul v-else class="divide-y divide-line" data-testid="names-list">
        <li v-for="e in shown" :key="e.slug">
          <RouterLink :to="'/names/' + e.slug" class="flex items-baseline py-2 hover:text-primary">
            <span class="pali shrink-0 font-medium">{{ ps(e.name.toLowerCase()) }}</span>
            <span class="ml-3 min-w-0 flex-1 truncate text-xs text-muted">{{ e.meaning }}</span>
            <span class="ml-3 whitespace-nowrap text-xs text-muted" title="දේශනා කළ ස්ථානය ආදී ලෙස සූත්‍ර / කථා · සඳහන් වන වාර">{{ e.settings ? `${e.settings} · ` : '' }}{{ e.mentions }}</span>
          </RouterLink>
        </li>
      </ul>
      <p v-if="!loading && hidden > 0" class="mt-3 text-center text-xs text-muted">තවත් {{ hidden }} ක්: නම යොදා සොයන්න</p>
    </template>
    <template v-else>
      <RouterLink to="/names" class="mb-3 inline-block text-sm text-muted hover:text-primary">← ස්ථාන සහ පුද්ගලයන්</RouterLink>
      <div v-if="!page && !loading" class="banner mt-2 border-error">මෙම නම හමු නොවිණි.</div>
      <template v-if="page">
        <h1 class="pali mb-1 text-2xl font-semibold" data-testid="name-title">{{ ps(page.name.toLowerCase()) }}</h1>
        <div class="mb-2 text-xs text-muted">{{ page.name }} · {{ TYPE_LABEL[page.type] }}<template v-if="page.family"> · {{ page.family }}</template></div>
        <p v-if="page.meaning" class="mb-3 text-sm">{{ page.meaning }}</p>
        <PlaceMap v-if="hasCoords(page)" class="mb-3 h-64" compact :places="[mapPlace(page, 'main', { label: true })]" fit-main />
        <section v-for="g in settingGroups" :key="g.role" class="mb-4" :data-testid="`name-settings-${g.role}`">
          <div class="section-title">{{ SETTING_TITLE[g.role] }} · {{ g.nodes.length }}</div>
          <ul class="flex flex-wrap">
            <li v-for="n in g.nodes" :key="n.key" class="w-full py-0.5 pr-2 text-sm sm:w-1/2"><RouterLink :to="'/' + n.key" class="pali hover:text-primary"><span v-if="n.parentPali" class="text-xs text-muted">{{ tree.nameOf(parentOf(n)) }} › </span>{{ tree.nameOf(n) }}</RouterLink></li>
          </ul>
        </section>
        <section v-if="page.mentionNodes.length" class="mb-4" data-testid="name-mentions">
          <div class="section-title">සඳහන් වන සූත්‍ර · {{ page.mentionNodes.length }}</div>
          <ul class="flex flex-wrap">
            <li v-for="n in page.mentionNodes" :key="n.key" class="w-full py-0.5 pr-2 text-sm sm:w-1/2">
              <RouterLink :to="`/${n.key}/${n.page}-${n.entry}`" class="pali hover:text-primary"><span v-if="n.parentPali" class="text-xs text-muted">{{ tree.nameOf(parentOf(n)) }} › </span>{{ tree.nameOf(n) }}</RouterLink>
              <span v-if="(n.count ?? 0) > 1" class="ml-1 text-xs text-muted">×{{ n.count }}</span>
            </li>
          </ul>
        </section>
        <p class="mt-6 text-xs text-muted">නම් සහ අර්ථ: Digital Pāḷi Dictionary, DPPN (Malalasekera); ස්ථාන: SuttaCentral, tipitaka.app.</p>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import PlaceMap from '@/components/PlaceMap.vue'
import IconMap from '~icons/mdi/map-outline'
import { searchNames, entityPage, mapPlace, hasCoords, parentOf, TYPE_LABEL, type Entity, type EntityPage, type EntityType } from '@/data/names'
import { usePaliSinh } from '@/composables/dict'
import { useTree } from '@/stores/tree'
import { toRoman } from '@/data/dictionary'
import { fold } from '@shared/normalize'

const route = useRoute(), ps = usePaliSinh(), tree = useTree()
const slug = computed(() => (route.params.slug as string) || '')
const q = ref(''), type = ref<EntityType>('place'), all = ref<Entity[]>([]), page = ref<EntityPage | null>(null), loading = ref(false)
const SETTING_TITLE: Record<string, string> = { place: 'මෙහිදී දේශනා කළ සූත්‍ර', teacher: 'දේශනා කළ සූත්‍ර', with: 'සහභාගී වූ සූත්‍ර', about: 'අරභයා දේශනා කළ සූත්‍ර' }
const settingGroups = computed(() => ['place', 'teacher', 'with', 'about'].map(role => ({ role, nodes: (page.value?.settingNodes ?? []).filter(n => n.role === role) })).filter(g => g.nodes.length))
// all the names once (most settings / mentions first), filtered here (tipitaka.app): a Sinhala name is matched in Roman
watch(slug, async s => {
  if (s || all.value.length) return
  loading.value = true
  try { all.value = await searchNames('', [], 10000) } catch { all.value = [] } finally { loading.value = false }
}, { immediate: true })
const counts = computed(() => all.value.reduce<Record<string, number>>((m, e) => ({ ...m, [e.type]: (m[e.type] ?? 0) + 1 }), {}))
const shown = computed(() => {
  const f = fold(/[඀-෿]/.test(q.value) ? toRoman(q.value.trim()) : q.value.trim())
  // the 300 most frequent of a type (typing finds the others)
  return all.value.filter(e => (f ? fold(e.name).includes(f) : e.type === type.value)).slice(0, f ? 500 : 300)
})
const hidden = computed(() => (q.value.trim() ? 0 : (counts.value[type.value] ?? 0) - shown.value.length))
watch(slug, async s => {
  page.value = null
  if (!s) return
  loading.value = true
  try { page.value = await entityPage(s).catch(() => null) } finally { loading.value = false }
}, { immediate: true })
useHead({ title: computed(() => (page.value ? `${ps(page.value.name.toLowerCase())} - ත්‍රිපිටකයේ ස්ථාන සහ පුද්ගලයන්` : 'ත්‍රිපිටකයේ ස්ථාන සහ පුද්ගලයන්')) })
</script>
