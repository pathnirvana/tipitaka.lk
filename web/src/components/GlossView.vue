<!-- the aṭṭhakathā of a clicked underlined word (tipitaka.app GlossView.vue): for a mūla word the aṭṭhakathā from its
     lemma to the next lemma, the lemma marked; for an aṭṭhakathā lemma the mūla words it quotes, in their paragraphs.
     Each passage opens alongside the text (a column next to it in the columns view). -->
<template>
  <section class="text-[15px]" data-testid="gloss-view">
    <div v-if="loading && !items.length" class="h-16 animate-pulse rounded bg-surface2" />
    <div v-for="it in items" :key="it.id" class="mb-4" data-testid="gloss-item">
      <div class="mb-1 flex items-center">
        <span class="min-w-0 flex-1 truncate text-sm text-muted">{{ it.title }}</span>
        <button class="btn ml-2 shrink-0 px-2 py-0.5 text-sm" data-testid="gloss-alongside" @click="openAlongside(it.key, [it.page, it.entry])">
          <IconColumns class="mr-1" />සමඟ කියවන්න
        </button>
      </div>
      <!-- the passage at the reader's text size (a little smaller, as in tipitaka.app) -->
      <div class="rounded-lg border border-line px-3 py-2" :style="{ fontSize: `calc(${settings.fontPx} * 0.95)` }">
        <!-- (RichText renders no element of its own: the classes go on a wrapper) -->
        <div v-for="p in it.paras" :key="p.k" class="entry-text mb-1.5 last:mb-0"><RichText :text="p.text" lang="pali" index-words :gloss-words="p.marks" /></div>
        <div v-if="it.more" class="text-center text-muted">…</div>
        <details v-if="it.sinh.length && settings.defaultColumns !== 0" class="mt-1.5" :open="!it.cut">
          <summary class="cursor-pointer text-[15px] text-muted">සිංහල පරිවර්තනය</summary>
          <div v-for="(t, i) in it.sinh" :key="i" class="entry-text mt-1 text-muted"><RichText :text="t" lang="sinh" /></div>
        </details>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import IconColumns from '~icons/mdi/view-split-vertical'
import RichText from './RichText'
import type { Gloss } from '@/data/names'
import type { EntryRow } from '@/data/types'
import { spanWords } from '@/composables/glosses'
import { openAlongside } from '@/composables/alongside'
import { useText } from '@/stores/text'
import { useTree } from '@/stores/tree'
import { useSettings } from '@/stores/settings'
import { tokenize } from '@shared/tokenize'

const props = defineProps<{ glosses: Gloss[] }>()
const text = useText(), tree = useTree(), settings = useSettings()

type Marks = Map<number, { g: string; cls: string }>
interface Item { id: string; key: string; title: string; page: number; entry: number; paras: { k: string; text: string; marks: Marks }[]; sinh: string[]; more: boolean; cut: boolean }
const items = ref<Item[]>([])
const loading = ref(false)
const MAX_PARAS = 8, MAX_ITEMS = 6

/** marks words [a, b] (inclusive) shifted by `shift` */
function mark(r: [number, number] | null, shift: number, last: number): Marks {
  const m: Marks = new Map()
  if (r) for (let i = Math.max(0, r[0] - shift); i <= Math.min(r[1] - shift, last); i++) m.set(i, { g: '', cls: 'gl gl-hover' })
  return m
}

/** the rows of a file from (p, e) to (ep, ee) inclusive, at most n */
async function rows(file: string, p: number, e: number, ep: number, ee: number, n: number): Promise<{ rows: EntryRow[]; more: boolean }> {
  const out: EntryRow[] = []
  await text.loadRange(file, p, Math.min(ep, p + 2))
  for (let pg = p; pg <= ep && out.length <= n; pg++) {
    const page = text.getPage(file, pg)
    if (!page) break
    for (const r of page.rows) if ((pg > p || r.entry_idx >= e) && (pg < ep || r.entry_idx <= ee)) out.push(r)
  }
  return { rows: out.slice(0, n), more: out.length > n }
}

/** where an explanation starts: the ** that opens the lemma (or the lemma itself) */
function lemmaOpen(t: string, s: number) {
  const i = t.lastIndexOf('**', s)
  return i >= 0 && s - i <= 4 ? i : s
}

/** the aṭṭhakathā from the lemma to the next lemma */
async function explanation(g: Gloss, id: string): Promise<Item> {
  const { rows: list, more } = await rows(g.file, g.tp, g.te, g.xp, g.xe, MAX_PARAS)
  const paras: Item['paras'] = []
  let cut = false
  for (const r of list) {
    const toks = tokenize(r.p_text)
    const first = r.page_idx === g.tp && r.entry_idx === g.te, last = r.page_idx === g.xp && r.entry_idx === g.xe
    if (last && !first && g.xw === 0) break
    const start = first ? lemmaOpen(r.p_text, toks[g.tw]?.s ?? 0) : 0
    const end = last && toks[g.xw] ? lemmaOpen(r.p_text, toks[g.xw].s) : r.p_text.length // (before the next lemma's **)
    cut ||= start > 0 || end < r.p_text.length
    const before = toks.filter(t => t.e <= start).length
    const slice = r.p_text.slice(start, end)
    paras.push({ k: `${r.page_idx}-${r.entry_idx}`, text: slice, marks: mark(spanWords(r.page_idx, r.entry_idx, g.tp, g.te, g.tw, g.tep, g.tee, g.tew), before, tokenize(slice).length - 1) })
  }
  return { id, key: g.key, title: await title(g.key), page: g.tp, entry: g.te, paras: paras.filter(p => p.text.trim()), sinh: list.map(r => r.s_text).filter(Boolean), more, cut }
}

/** the mūla words an aṭṭhakathā lemma quotes, in their paragraphs */
async function quoted(g: Gloss, id: string): Promise<Item> {
  const { rows: list, more } = await rows(g.file, g.tp, g.te, g.tep, g.tee, 4)
  const paras = list.map(r => ({ k: `${r.page_idx}-${r.entry_idx}`, text: r.p_text,
    marks: mark(spanWords(r.page_idx, r.entry_idx, g.tp, g.te, g.tw, g.tep, g.tee, g.tew), 0, tokenize(r.p_text).length - 1) }))
  return { id, key: g.key, title: await title(g.key), page: g.tp, entry: g.te, paras, sinh: list.map(r => r.s_text).filter(Boolean), more, cut: false }
}

async function title(key: string) {
  const path = (await tree.getPaths([key]).catch(() => null))?.get(key) ?? []
  return path.slice(1).map(i => tree.nameOf(i)).join(' › ') || key
}

watch(() => props.glosses, async gs => {
  loading.value = true
  const out: Item[] = []
  const seen = new Set<string>()
  try {
    for (const g of [...gs].sort((a, b) => b.conf - a.conf)) {
      const id = `${g.side}:${g.file}:${g.tp}:${g.te}:${g.tw}`
      if (seen.has(id) || seen.size >= MAX_ITEMS) continue
      seen.add(id)
      out.push(await (g.side === 't' ? explanation(g, id) : quoted(g, id)))
    }
  } catch { /* shown as far as loaded */ } finally {
    if (gs === props.glosses) items.value = out
    loading.value = false
  }
}, { immediate: true })
</script>
