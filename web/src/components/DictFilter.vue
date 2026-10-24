<!-- the dictionaries used for lookups (settings.dicts, [] = all; tipitaka.app DictFilter.vue): a button with a dialog, or the bare list -->
<template>
  <template v-if="!inline">
    <button :class="['btn shrink-0', compact ? 'px-2 py-1' : '', { 'border-primary text-primary': !all }]" title="ශබ්දකෝෂ තෝරන්න" data-testid="dict-filter" @click="open = true">
      <IconFilter /><span v-if="!compact" class="ml-1.5">ශබ්දකෝෂ</span>
      <span v-if="!all" class="ml-1 rounded-full bg-primary px-1.5 text-[11px] text-white">{{ settings.dicts.length }}</span>
    </button>
    <Dialog :open="open" title="ශබ්දකෝෂ තෝරන්න" width="420px" @close="open = false">
      <DictList />
      <div class="mt-3 flex items-center">
        <button class="btn" data-testid="dicts-all" @click="settings.dicts = []">සියල්ල</button>
        <span class="flex-1" />
        <button class="btn-primary" data-testid="dicts-done" @click="open = false">හරි</button>
      </div>
    </Dialog>
  </template>
  <DictList v-else />
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from 'vue'
import IconFilter from '~icons/mdi/filter-variant'
import Dialog from './Dialog.vue'
import { listDicts, langName, type Dict } from '@/data/dictionary'
import { useSettings } from '@/stores/settings'

defineProps<{ inline?: boolean; compact?: boolean }>()
const settings = useSettings()
const open = ref(false)
const dicts = ref<Dict[]>([])
listDicts().then(d => { dicts.value = d }).catch(() => {})
// "all" ([]) is every dictionary but the opt-in ones
const codes = computed(() => ['dpd', ...dicts.value.map(d => d.code)])
const defaults = computed(() => ['dpd', ...dicts.value.filter(d => !d.optIn).map(d => d.code)])
const all = computed(() => settings.dicts.length === 0)
const isOn = (code: string) => (all.value ? defaults.value.includes(code) : settings.dicts.includes(code))

function toggle(code: string) {
  const on = new Set(all.value ? defaults.value : settings.dicts)
  if (on.has(code)) {
    if (on.size === 1) return // keep at least one
    on.delete(code)
  } else on.add(code)
  const isDefault = on.size === defaults.value.length && defaults.value.every(c => on.has(c))
  settings.dicts = isDefault ? [] : codes.value.filter(c => on.has(c))
}

// the checklist: Sinhala dictionaries, then DPD and the English ones
const DictList = defineComponent(() => () => {
  const row = (code: string, short: string, label: string, title?: string) => h('label', { class: 'flex cursor-pointer items-center py-1', title }, [
    h('input', { type: 'checkbox', class: 'shrink-0', checked: isOn(code), 'data-testid': `dict-${code}`, onChange: () => toggle(code) }),
    h('span', { class: 'mx-2 w-9 shrink-0 text-center text-xs text-muted' }, short),
    h('span', label),
  ])
  const group = (title: string, rows: ReturnType<typeof row>[]) => h('div', { class: 'mb-3' }, [h('div', { class: 'section-title' }, title), ...rows])
  const byLang = (lang: string) => dicts.value.filter(d => d.lang === lang).map(d => row(d.code, d.short, d.name, d.desc || undefined))
  return h('div', { 'data-testid': 'dict-list' }, [
    group(langName('si'), byLang('si')),
    group(langName('en'), [row('dpd', 'DPD', 'Digital Pāḷi Dictionary', 'Digital Pāḷi Dictionary, Bodhirasa Bhikkhu (CC BY-NC-SA 4.0)'), ...byLang('en')]),
  ])
})
</script>
