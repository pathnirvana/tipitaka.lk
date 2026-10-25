<!-- a map of places (tipitaka.app PlaceMap.vue; web/src/map/draw.ts, loaded on first use): the places of a page, an optional
     journey, a highlighted region. Emits select(slug) when a place is tapped. The drawn map works offline. -->
<template>
  <div class="ui-app relative isolate overflow-hidden rounded-lg border border-line" data-testid="place-map">
    <div ref="el" class="h-full w-full" />
    <div v-if="failed" class="absolute inset-0 flex items-center justify-center text-sm text-muted">සිතියම ලබාගත නොහැකි විය.</div>
    <div v-if="!compact" class="absolute right-2 top-2 z-[1000] flex overflow-hidden rounded-full border border-line bg-surface text-xs shadow-sm" role="radiogroup"
      aria-label="සිතියම් ස්තරය" data-testid="map-base">
      <button v-for="b in BASES" :key="b.id" class="px-2.5 py-1" :class="base === b.id ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface2'"
        role="radio" :aria-checked="base === b.id" :title="b.title" :data-testid="`map-base-${b.id}`" @click="base = b.id">{{ b.label }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { JourneyInfo, MapBase, MapPlace, PlaceMap } from '@/map/draw'
import { usePaliSinh } from '@/composables/dict'

const props = defineProps<{
  places: MapPlace[]
  highlight?: string[] // slugs of regions / rivers to outline
  journey?: string | null
  journeyKey?: string // draw the journey told by this text (DN 16, Sn 5)
  compact?: boolean
  fitMain?: boolean // fit the view to the main places
  noFit?: boolean
  focus?: string // centre this place, zoomed in
}>()
const emit = defineEmits<{ select: [slug: string]; journey: [info: JourneyInfo | null] }>()
const ps = usePaliSinh()
const conv = (s: string) => ps(s.toLowerCase())
const el = ref<HTMLElement | null>(null)
const map = shallowRef<PlaceMap | null>(null)
const failed = ref(false)

const BASES: { id: MapBase; label: string; title: string }[] = [
  { id: 'drawn', label: 'සිතියම', title: 'ග්‍රන්ථවල සඳහන් ස්ථාන (අන්තර්ජාලය නැතිවද ක්‍රියා කරයි)' },
  { id: 'today', label: 'වර්තමාන', title: 'වර්තමාන නගර හා මාර්ග (OpenStreetMap, අන්තර්ජාලය අවශ්‍යයි)' },
  { id: 'satellite', label: 'චන්ද්‍රිකා', title: 'චන්ද්‍රිකා දසුන (Sentinel-2, අන්තර්ජාලය අවශ්‍යයි)' },
]
const readBase = (): MapBase => { try { return (localStorage.getItem('tipitaka.lk-map-base') as MapBase) || 'drawn' } catch { return 'drawn' } }
const base = ref<MapBase>(props.compact ? 'drawn' : readBase())
watch(base, b => { if (!props.compact) try { localStorage.setItem('tipitaka.lk-map-base', b) } catch { /* private mode */ } ; map.value?.setBase(b) })

const link = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`
const texts = {
  sources: 'සිතියමේ මූලාශ්‍ර',
  sourcesHtml: [
    `Places, mahājanapadas, journeys: ${link('https://suttacentral.net/map', 'SuttaCentral')} (CC0), DPPN`,
    `Coast, rivers, mountains, relief, borders: ${link('https://www.naturalearthdata.com', 'Natural Earth')} (public domain)`,
    `Names: ${link('https://digitalpalidictionary.github.io', 'DPD')}, DPPN (Malalasekera, revised by Ānandajoti, CC BY-SA)`,
    `Map: ${link('https://leafletjs.com', 'Leaflet')}, data: ${link('https://tipitaka.app', 'tipitaka.app')}`,
  ].join('<br>'),
  approx: 'ආසන්න ස්ථානය', near: 'මෙම ස්ථානයෙහි හෝ ආසන්නයෙහි',
}

function fit() {
  const m = map.value
  if (!m || props.noFit || props.journey || m.hasJourney()) return
  const main = props.places.filter(p => p.kind === 'main')
  const shown = props.fitMain && main.length ? main : props.places.filter(p => p.kind !== 'context')
  m.fit(shown.length ? shown : main, props.compact ? 7 : 9)
}
let focused = ''
function focusPlace() {
  const p = props.focus && props.places.find(x => x.slug === props.focus)
  if (!p || !map.value || focused === props.focus) return
  focused = props.focus!
  map.value.focusOn(p.lat, p.lon)
}
onMounted(async () => {
  try {
    const { PlaceMap, journeyFor } = await import('@/map/draw')
    if (!el.value) return
    map.value = new PlaceMap(el.value, { conv, compact: props.compact, texts, onSelect: slug => emit('select', slug) })
    map.value.setBase(base.value)
    map.value.setPlaces(props.places)
    map.value.highlight(props.highlight ?? [])
    emit('journey', map.value.setJourney(props.journey ?? (props.journeyKey ? journeyFor(props.journeyKey) : null)))
    fit()
    focusPlace()
  } catch (e) { console.error('map', e); failed.value = true }
})
onBeforeUnmount(() => map.value?.destroy())
watch(() => props.places, p => { map.value?.setPlaces(p); fit(); focusPlace() })
watch(() => props.highlight, h => { map.value?.highlight(h ?? []); fit() })
watch(() => props.journey, j => { if (map.value) { emit('journey', map.value.setJourney(j ?? null)); if (!j) fit() } })
watch(() => props.focus, () => { focused = ''; focusPlace() })
defineExpose({ map })
</script>
