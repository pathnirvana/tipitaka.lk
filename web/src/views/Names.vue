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
        <div class="mb-2 text-xs text-muted">{{ page.name }} · {{ TYPE_LABEL[page.type] }}<template v-if="showFamily"> · {{ page.family }}</template></div>
        <p v-if="page.meaning" class="mb-3 text-sm">{{ page.meaning }}</p>
        <p v-if="page.homonyms?.length" class="mb-3 text-sm" data-testid="name-homonyms">
          මෙම නමින්ම තවත්:
          <template v-for="(h, i) in page.homonyms" :key="h.slug">
            <span v-if="i">, </span><RouterLink :to="'/names/' + h.slug" class="underline hover:text-primary">{{ h.meaning || h.lemma }}</RouterLink>
          </template>
        </p>
        <PlaceMap v-if="hasCoords(page)" class="mb-3 h-64" compact :places="[mapPlace(page, 'main', { label: true })]" fit-main />
        <!-- the suttas by book (tipitaka.app): a dot for mūla / aṭṭhakathā, the count, the suttas folded in; in the
             interface face, the size of the text around them -->
        <section v-for="g in settingGroups" :key="g.role" class="mb-4" :data-testid="`name-settings-${g.role}`">
          <div class="section-title">{{ SETTING_TITLE[g.role] }} · {{ g.nodes.length }}</div>
          <details v-for="b in byBook(g.nodes)" :key="b.key" class="mb-0.5" :open="g.nodes.length <= 30">
            <summary class="book-row flex cursor-pointer items-center py-1 text-sm">
              <span :class="['coll-dot mr-2.5', b.atta ? 'coll-atta' : 'coll-mula']" />
              <span class="min-w-0 flex-1 truncate"><span class="text-muted">{{ b.group }} · </span>{{ b.book }}</span>
              <span class="ml-3 text-muted">{{ b.count }}</span>
            </summary>
            <ul class="mb-2 ml-5">
              <li v-for="n in b.items" :key="n.key">
                <RouterLink :to="'/' + n.key" class="flex items-baseline py-0.5 text-sm hover:text-primary">
                  <span class="min-w-0 flex-1 truncate">{{ tree.nameOf(n) }}</span><span v-if="(n.count ?? 0) > 1" class="ml-3 text-muted">{{ n.count }}</span>
                </RouterLink>
              </li>
            </ul>
          </details>
        </section>
        <section v-if="page.mentionNodes.length" class="mb-4" data-testid="name-mentions">
          <div class="section-title">සඳහන් වන තැන් · {{ mentionTotal }}</div>
          <details v-for="b in byBook(page.mentionNodes)" :key="b.key" class="mb-0.5" :open="page.mentionNodes.length <= 30">
            <summary class="book-row flex cursor-pointer items-center py-1 text-sm">
              <span :class="['coll-dot mr-2.5', b.atta ? 'coll-atta' : 'coll-mula']" />
              <span class="min-w-0 flex-1 truncate"><span class="text-muted">{{ b.group }} · </span>{{ b.book }}</span>
              <span class="ml-3 text-muted">{{ b.count }}</span>
            </summary>
            <ul class="mb-2 ml-5">
              <li v-for="n in b.items" :key="n.key">
                <RouterLink :to="`/${n.key}/${n.page}-${n.entry}`" class="flex items-baseline py-0.5 text-sm hover:text-primary">
                  <span class="min-w-0 flex-1 truncate">{{ tree.nameOf(n) }}</span><span v-if="(n.count ?? 0) > 1" class="ml-3 text-muted">{{ n.count }}</span>
                </RouterLink>
              </li>
            </ul>
          </details>
        </section>
        <section v-if="page.comentions?.length" class="mb-4" data-testid="name-comentions">
          <div class="section-title">බොහෝ විට සමඟ සඳහන් වන නම්</div>
          <div class="-m-0.5 flex flex-wrap">
            <RouterLink v-for="r in page.comentions.slice(0, 30)" :key="r.slug" :to="'/names/' + r.slug" class="chip m-0.5 text-sm hover:border-primary" :title="r.meaning">
              <span class="pali">{{ ps(r.name.toLowerCase()) }}</span><span class="ml-1 text-xs text-muted">{{ r.count }}</span>
            </RouterLink>
          </div>
        </section>
        <section v-if="related.length" class="mb-4" data-testid="name-related">
          <div class="section-title">එම සූත්‍රවලම</div>
          <div v-for="g in related" :key="g.role" class="mb-1 flex flex-wrap items-center">
            <span class="mr-1.5 text-xs text-muted">{{ ROLE_LABEL[g.role] }}</span>
            <RouterLink v-for="r in g.items" :key="r.slug" :to="'/names/' + r.slug" class="chip m-0.5 text-sm hover:border-primary" :title="r.meaning">
              <span class="pali">{{ ps(r.name.toLowerCase()) }}</span><span class="ml-1 text-xs text-muted">{{ r.count }}</span>
            </RouterLink>
          </div>
        </section>
        <section class="mb-4" data-testid="name-dict">
          <div class="section-title">ශබ්දකෝෂය</div>
          <DictView :word="ps(page.lemma ? page.lemma.replace(/ [\d.]+$/, '') : page.name.toLowerCase())" mode="dict" compact />
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
import DictView from '@/components/DictView.vue'
import IconMap from '~icons/mdi/map-outline'
import { searchNames, entityPage, mapPlace, hasCoords, TYPE_LABEL, ROLE_LABEL, type Entity, type Related, type SettingRole, type NodeRef, type EntityPage, type EntityType } from '@/data/names'
import { usePaliSinh } from '@/composables/dict'
import { useTree } from '@/stores/tree'
import { toRoman } from '@/data/dictionary'
import { fold } from '@shared/normalize'

const route = useRoute(), ps = usePaliSinh(), tree = useTree()
const slug = computed(() => (route.params.slug as string) || '')
const q = ref(''), type = ref<EntityType>('place'), all = ref<Entity[]>([]), page = ref<EntityPage | null>(null), loading = ref(false)
const SETTING_TITLE: Record<string, string> = { place: 'මෙහිදී දේශනා කළ සූත්‍ර', teacher: 'දේශනා කළ සූත්‍ර', with: 'සහභාගී වූ සූත්‍ර', about: 'අරභයා දේශනා කළ සූත්‍ර' }
// the names of the same suttas' settings, by role
const related = computed(() => (['place', 'teacher', 'with', 'about'] as SettingRole[])
  .map(role => ({ role, items: (page.value?.related ?? []).filter((r: Related) => r.role === role).slice(0, 20) })).filter(g => g.items.length))
// the category, unless it only repeats the type (පුද්ගලයන් · පුද්ගලයෝ)
const showFamily = computed(() => !!page.value?.family && page.value.family.slice(0, 3) !== TYPE_LABEL[page.value.type].slice(0, 3))
// suttas grouped by book (in tree order), the book's count: the mentions (the suttas of a setting)
function byBook(nodes: NodeRef[]) {
  const out: { key: string; group: string; book: string; atta: boolean; count: number; items: NodeRef[] }[] = []
  for (const n of nodes) {
    const key = `${n.groupPali}|${n.bookPali}`
    let b = out.find(x => x.key === key)
    if (!b) out.push(b = { key, group: tree.nameOf({ pali: n.groupPali, sinh: n.groupSinh }), book: tree.nameOf({ pali: n.bookPali, sinh: n.bookSinh }), atta: n.atta, count: 0, items: [] })
    b.items.push(n)
    b.count += n.count || 1
  }
  return out
}
const mentionTotal = computed(() => (page.value?.mentionNodes ?? []).reduce((t, n) => t + (n.count || 1), 0))
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
