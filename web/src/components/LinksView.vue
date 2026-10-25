<!-- the aṭṭhakathā of a mūla paragraph, or the mūla an aṭṭhakathā paragraph explains (tipitaka.app's links, mapped to
     tipitaka.lk's entries): runs of consecutive entries per sutta, each opens in a new tab -->
<template>
  <div class="text-[15px]" data-testid="links-view">
    <div v-if="loading" class="h-20 animate-pulse rounded bg-surface2" />
    <div v-else-if="error" class="banner border-error">{{ error }}</div>
    <div v-else-if="!runs.length" class="py-6 text-center text-muted" data-testid="links-empty">{{ toAtta ? 'මෙම ඡේදයට අදාළ අටුවා ඡේද හමු නොවිණි.' : 'මෙම අටුවා ඡේදයට අදාළ මූල පාළි ඡේද හමු නොවිණි.' }}</div>
    <template v-else>
      <div v-for="(r, ri) in shownRuns" :key="ri" class="mb-4" data-testid="links-run">
        <div class="mb-1 flex items-center">
          <span class="min-w-0 flex-1 truncate text-sm text-muted">{{ r.title }}</span>
          <button class="btn ml-2 shrink-0 px-2 py-0.5 text-sm" data-testid="links-open" @click="openRun(r)"><IconOpen class="mr-1" />විවෘත කරන්න</button>
        </div>
        <div class="rounded-lg border border-line px-3 py-2" :style="{ fontSize: `calc(${settings.fontPx} * 0.95)` }">
          <div v-for="t in r.items" :key="t.page + ':' + t.entry" class="mb-1.5 last:mb-0">
            <!-- (RichText renders no element of its own: the classes go on a wrapper) -->
            <div class="entry-text"><RichText :text="t.text" lang="pali" /></div>
            <div v-if="t.sinh && settings.defaultColumns !== 0" class="entry-text mt-0.5 text-[0.92em] text-muted"><RichText :text="t.sinh" lang="sinh" /></div>
          </div>
        </div>
      </div>
      <button v-if="runs.length > shownRuns.length || hidden" class="text-sm text-info underline" data-testid="links-more" @click="all = true">
        තවත් ඡේද {{ hidden }} ක්
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import IconOpen from '~icons/mdi/open-in-new'
import RichText from './RichText'
import { links, type LinkTarget } from '@/data/names'
import { useTabs } from '@/stores/tabs'
import { useTree } from '@/stores/tree'
import { useSettings } from '@/stores/settings'

const props = defineProps<{ file: string; page: number; entry: number }>()
const tabs = useTabs(), tree = useTree(), settings = useSettings()
const toAtta = computed(() => !props.file.startsWith('atta-'))
const loading = ref(false), error = ref(''), all = ref(false)
const targets = ref<LinkTarget[]>([])
const names = ref(new Map<string, string>())

/** runs: consecutive entries of one sutta (≤ 2 entries apart) */
const runs = computed(() => {
  const out: { key: string; title: string; items: LinkTarget[] }[] = []
  for (const t of targets.value) {
    const last = out[out.length - 1], prev = last?.items[last.items.length - 1]
    const near = prev && prev.key === t.key && prev.file === t.file && ((t.page === prev.page && t.entry - prev.entry <= 3) || (t.page === prev.page + 1 && t.entry <= 3))
    if (last && near) last.items.push(t)
    else out.push({ key: t.key, title: names.value.get(t.key) ?? t.key, items: [t] })
  }
  return out
})
const LIMIT = 6 // entries shown before "more"
const shownRuns = computed(() => {
  if (all.value) return runs.value
  const out: typeof runs.value = []
  let n = 0
  for (const r of runs.value) { if (n >= LIMIT) break; const items = r.items.slice(0, LIMIT - n); n += items.length; out.push({ ...r, items }) }
  return out
})
const hidden = computed(() => (all.value ? 0 : targets.value.length - shownRuns.value.reduce((n, r) => n + r.items.length, 0)))

function openRun(r: { key: string; items: LinkTarget[] }) {
  const t = r.items[0]
  tabs.openTab({ key: t.key, eInd: [t.page, t.entry] })
}

watch(() => [props.file, props.page, props.entry] as const, async ([f, p, e]) => {
  loading.value = true; error.value = ''; all.value = false
  try {
    targets.value = await links(f, p, e)
    const paths = await tree.getPaths([...new Set(targets.value.map(t => t.key))])
    names.value = new Map([...paths].map(([k, path]) => [k, path.slice(1).map(i => tree.nameOf(i)).join(' › ')]))
  } catch (err) { error.value = (err as Error).message; targets.value = [] } finally { loading.value = false }
}, { immediate: true })
</script>
