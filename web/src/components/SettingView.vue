<!-- the setting of the sutta / story of a paragraph (tipitaka.app SettingView.vue): where it was taught, by whom, with whom,
     whom it is about, and the names in the paragraph. Every name links to its page. -->
<template>
  <div class="ui-app text-sm" data-testid="setting-view">
    <div v-if="loading" class="h-20 animate-pulse rounded bg-surface2" />
    <template v-else>
      <div v-if="!roles.length" class="py-4 text-center text-muted" data-testid="setting-empty">මෙය දේශනා කළ ස්ථානය ග්‍රන්ථයේ සඳහන් නොවේ.</div>
      <div v-if="unitTitle" class="pali mb-3 font-medium">{{ unitTitle }}</div>
      <PlaceMap v-if="hasMap" :key="setting!.key" class="mb-2 h-52" compact fit-main :places="mapPlaces" :highlight="placeSlugs" :journey-key="setting!.key"
        @select="openName" @journey="j => (journey = j)" />
      <p v-if="journey" class="mb-1 text-xs text-muted" data-testid="setting-journey">
        ගමන් මාර්ගය: නැවතුම් {{ journey.stops.length }}, කි.මී. {{ journey.total }} පමණ · {{ ps(journey.stops[0].name.toLowerCase()) }} → {{ ps(journey.stops[journey.stops.length - 1].name.toLowerCase()) }}
      </p>
      <RouterLink v-if="hasMap" :to="mapLink" class="mb-3 inline-block text-xs text-muted underline hover:text-primary" data-testid="setting-map-link">සිතියම විවෘත කරන්න</RouterLink>
      <div v-for="g in groups" :key="g.role" class="mb-3" :data-testid="`setting-${g.role}`">
        <div class="section-title">{{ ROLE_LABEL[g.role] }}</div>
        <div class="-m-0.5 flex flex-wrap">
          <RouterLink v-for="r in g.rows" :key="r.slug" :to="'/names/' + r.slug" class="chip pali m-0.5 text-sm hover:border-primary" :title="r.meaning" data-testid="setting-name">{{ ps(r.name.toLowerCase()) }}</RouterLink>
        </div>
      </div>
      <div v-if="named.length" class="mb-3 mt-4" data-testid="setting-named">
        <div class="section-title">මෙම ඡේදයේ සඳහන් නම්</div>
        <div class="-m-0.5 flex flex-wrap">
          <RouterLink v-for="r in named" :key="r.slug" :to="'/names/' + r.slug" class="chip pali m-0.5 text-sm hover:border-primary" :title="r.meaning" data-testid="named-name">{{ ps(r.name.toLowerCase()) }}</RouterLink>
        </div>
      </div>
      <p v-for="n in notes" :key="n" class="mt-4 text-xs text-muted" data-testid="setting-note">{{ n }}</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PlaceMap from './PlaceMap.vue'
import { settingOf, paraNames, contextPlaces, mapPlace, hasCoords, isArea, JOURNEYS, ROLE_LABEL, type Entity, type SettingResult, type SettingRole } from '@/data/names'
import type { JourneyInfo, MapPlace } from '@/map/draw'
import { usePaliSinh } from '@/composables/dict'
import { useTree } from '@/stores/tree'

/** nodeKey: the sutta / node of the paragraph; file, page, entry: the paragraph (its names) */
const props = defineProps<{ nodeKey: string; file?: string; page?: number; entry?: number }>()
const ps = usePaliSinh(), router = useRouter(), tree = useTree()
const loading = ref(false)
const setting = ref<SettingResult | null>(null)
const named = ref<Entity[]>([])
const unitTitle = ref('')
const journey = ref<JourneyInfo | null>(null)
const context = ref<MapPlace[]>([])
contextPlaces().then(c => { context.value = c })

watch(() => [props.nodeKey, props.file, props.page, props.entry] as const, async ([key, f, p, e]) => {
  loading.value = true
  journey.value = null
  try {
    const [s, n] = await Promise.all([settingOf(key).catch(() => null), f && p !== undefined && e !== undefined ? paraNames(f, p, e).catch(() => []) : Promise.resolve([])])
    setting.value = s
    named.value = n
    unitTitle.value = s && s.from ? tree.nameOf((await tree.getPath(s.key)).slice(-1)[0]) : ''
  } finally { loading.value = false }
}, { immediate: true })

const roles = computed(() => setting.value?.roles ?? [])
const placeRows = computed(() => roles.value.filter(r => r.role === 'place'))
const placeSlugs = computed(() => placeRows.value.map(r => r.slug))
const mapPlaces = computed<MapPlace[]>(() => [
  ...context.value.filter(c => !placeSlugs.value.includes(c.slug)),
  ...placeRows.value.filter(r => hasCoords(r) && !isArea(r)).map(r => mapPlace(r, 'main', { label: true })),
])
const journeyId = computed(() => JOURNEYS.find(j => j.key === setting.value?.key)?.id)
const hasMap = computed(() => !!setting.value && (placeRows.value.some(hasCoords) || !!journeyId.value))
const mapLink = computed(() => ({ path: '/map', query: journeyId.value ? { journey: journeyId.value } : { place: placeRows.value.find(hasCoords)?.slug } }))
const openName = (slug: string) => router.push('/names/' + slug)
const ROLES: SettingRole[] = ['place', 'teacher', 'with', 'about']
const groups = computed(() => ROLES.map(role => ({ role, rows: roles.value.filter(r => r.role === role) })).filter(g => g.rows.length))
const notes = computed(() => {
  const s = setting.value, out: string[] = []
  if (!s || !s.roles.length) return out
  if (s.from === 'parent') out.push('මෙම සූත්‍රයේ ස්ථානය සඳහන් නොවේ: එය අයත් වර්ගයේ / ග්‍රන්ථයේ ස්ථානය පෙන්වයි.')
  if (s.from === 'first') out.push('මෙම කොටසේ පළමු සූත්‍රයේ ස්ථානය පෙන්වයි.')
  if (s.roles.some(r => r.source === 'atta')) out.push('අටුවාව අනුව.')
  if (s.roles.some(r => r.source === 'inherit')) out.push('මෙම සූත්‍රයේ ස්ථානය සඳහන් නොවේ: පෙර සූත්‍රයේ ස්ථානයයි.')
  return out
})
</script>
