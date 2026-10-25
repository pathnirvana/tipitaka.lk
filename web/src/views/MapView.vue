<!-- /map: every place a sutta or a commentary story was taught at (circle size: their number), the mahājanapadas, the
     great rivers, two journeys (tipitaka.app MapView.vue). ?place=<slug> selects a place, ?journey=<id> draws a journey. -->
<template>
  <div class="ui-app relative isolate" :style="{ height: `calc(100vh - ${headerHeight}px)` }" data-testid="map-page">
    <PlaceMap class="h-full !rounded-none !border-0" no-fit :focus="placeSlug" :places="places" :highlight="selected ? [selected.slug] : []" :journey="journeyId"
      @select="slug => setQuery({ place: slug, journey: undefined })" @journey="j => (journey = j)" />
    <!-- the journeys: in a row next to the zoom buttons, stopping short of the layer switch; on narrow screens one under
         the other, below the zoom buttons (tipitaka.app) -->
    <div class="absolute left-2 top-[5.25rem] z-[700] flex max-w-[calc(100%-1rem)] flex-col items-start sm:left-14 sm:right-64 sm:top-2.5 sm:max-w-none sm:flex-row sm:overflow-x-auto">
      <button v-for="j in JOURNEYS" :key="j.id" :class="['chip mb-1.5 shrink-0 whitespace-nowrap text-xs shadow-sm sm:mb-0 sm:mr-1.5', { 'border-primary text-primary': journeyId === j.id }]"
        :data-testid="`map-journey-${j.id}`" @click="setQuery({ journey: journeyId === j.id ? undefined : j.id, place: undefined })">{{ j.title }}</button>
    </div>
    <div v-if="selected || journey" class="absolute inset-x-2 bottom-6 z-[700] max-h-[45%] overflow-y-auto rounded-xl border border-line bg-surface p-3 text-sm shadow-xl sm:inset-x-auto sm:left-3 sm:w-80"
      data-testid="map-card">
      <button class="icon-btn float-right -mr-1 -mt-1" aria-label="close" @click="setQuery({ place: undefined, journey: undefined })"><IconClose /></button>
      <template v-if="selected">
        <RouterLink :to="'/names/' + selected.slug" class="pali text-lg font-semibold hover:text-primary" data-testid="map-card-name">{{ ps(selected.name.toLowerCase()) }}</RouterLink>
        <p class="mb-2 text-xs text-muted">{{ selected.meaning }}</p>
        <template v-if="info && info.settingNodes.length">
          <div class="section-title">මෙහිදී දේශනා කළ සූත්‍ර · {{ info.settingNodes.length }}</div>
          <ul>
            <li v-for="n in info.settingNodes.slice(0, 12)" :key="n.key">
              <RouterLink :to="'/' + n.key" class="pali block truncate py-0.5 hover:text-primary"><span v-if="n.parentPali" class="text-xs text-muted">{{ tree.nameOf(parentOf(n)) }} › </span>{{ tree.nameOf(n) }}</RouterLink>
            </li>
          </ul>
          <RouterLink v-if="info.settingNodes.length > 12" :to="'/names/' + selected.slug" class="mt-1 inline-block text-xs underline">සියල්ල ({{ info.settingNodes.length }})</RouterLink>
        </template>
      </template>
      <template v-else-if="journey">
        <RouterLink :to="'/' + journey.key" class="font-bold hover:text-primary">{{ JOURNEYS.find(j => j.id === journey!.id)?.title }}</RouterLink>
        <p class="mb-2 text-xs text-muted">සෘජු රේඛාවෙන් කි.මී. {{ journey.total }} පමණ (යොදුන් {{ Math.round(journey.total / YOJANA_KM) }} ක් පමණ)</p>
        <ol data-testid="map-journey-stops">
          <li v-for="(s, i) in journey.stops" :key="i" class="flex items-baseline py-0.5">
            <span class="mr-2 w-5 text-right text-xs text-muted">{{ i + 1 }}</span>
            <RouterLink v-if="s.slug" :to="'/names/' + s.slug" class="pali flex-1 hover:text-primary">{{ ps(s.name.toLowerCase()) }}</RouterLink>
            <span v-else class="pali flex-1">{{ ps(s.name.toLowerCase()) }}</span>
            <span v-if="i" class="text-xs text-muted">+{{ s.km }} km</span>
          </li>
        </ol>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import IconClose from '~icons/mdi/close'
import PlaceMap from '@/components/PlaceMap.vue'
import { placesWithCoords, entityPage, mapPlace, isArea, parentOf, JOURNEYS, type Entity, type EntityPage } from '@/data/names'
import type { JourneyInfo, MapPlace } from '@/map/draw'
import { YOJANA_KM } from '@/map/geo'
import { usePaliSinh } from '@/composables/dict'
import { useLayout } from '@/composables/layout'
import { useTree } from '@/stores/tree'

useHead({ title: 'ත්‍රිපිටකයේ ස්ථාන සිතියම' })
const route = useRoute(), router = useRouter(), ps = usePaliSinh(), tree = useTree()
const { headerHeight } = useLayout()
const all = ref<Entity[]>([])
placesWithCoords().then(p => { all.value = p })
const max = computed(() => Math.max(1, ...all.value.map(p => p.settings)))
const places = computed<MapPlace[]>(() => all.value.filter(p => !isArea(p) && p.type === 'place')
  .map(p => mapPlace(p, 'related', { count: Math.max(1, p.settings), label: p.settings >= max.value / 20 })))
const placeSlug = computed(() => (route.query.place as string) || undefined)
const journeyId = computed(() => (route.query.journey as string) || null)
const selected = computed(() => all.value.find(p => p.slug === placeSlug.value) ?? null)
const journey = ref<JourneyInfo | null>(null)
const info = ref<EntityPage | null>(null)
watch(selected, async s => { info.value = null; if (s) info.value = await entityPage(s.slug).catch(() => null) }, { immediate: true })
const setQuery = (q: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...q } })
</script>
