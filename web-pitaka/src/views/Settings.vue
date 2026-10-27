<!-- the settings (web/src/views/Settings.vue, the few that pitaka.lk has) -->
<template>
  <div class="flex flex-wrap p-1.5" data-testid="settings">
    <section class="card m-1.5 w-full sm:w-[calc(50%-12px)] xl:w-[calc(33.3%-12px)]" data-testid="settings-mode">
      <h2 class="mb-1 text-xl">කියවන ආකාරය</h2>
      <label v-for="m in READING_MODES" :key="m" class="block"><input v-model="s.readingMode" type="radio" :value="m" :data-testid="`setting-mode-${m}`"> {{ MODE_LABELS[m] }} <span class="text-[15px] text-muted">- {{ MODE_HELP[m] }}</span></label>
    </section>
    <section class="card m-1.5 w-full sm:w-[calc(50%-12px)] xl:w-[calc(33.3%-12px)]">
      <h2 class="mb-1 text-xl">තිරයේ වර්ණ</h2>
      <p class="mb-2 text-[15px] text-muted">අඳුරු තිරය රාත්‍රියේදී ඇසට පහසුය. ස්වයංක්‍රීය: ඔබගේ උපාංගයේ සැකසුම අනුව ආලෝකමත් හෝ අඳුරු.</p>
      <ThemePicker labels />
    </section>
    <section class="card m-1.5 w-full sm:w-[calc(50%-12px)] xl:w-[calc(33.3%-12px)]">
      <h2 class="mb-2 text-xl">අකුරු විශාලත්වය</h2>
      <div class="entry-text mb-2" :style="{ fontSize: s.fontPx }">නමො තස්ස භගවතො අරහතො සම්මාසම්බුද්ධස්ස</div>
      <input v-model.number="s.fontSize" type="range" :min="FONT_SIZE_RANGE[0]" :max="FONT_SIZE_RANGE[1]" step="1" class="w-full" data-testid="font-size"> <span class="text-[15px]">{{ s.fontSize > 0 ? '+' : '' }}{{ s.fontSize }}</span>
    </section>
    <section class="card m-1.5 w-full sm:w-[calc(50%-12px)] xl:w-[calc(33.3%-12px)]">
      <h2 class="mb-2 text-xl">සූත්‍ර නාමාවලිය පෙන්වන භාෂාව</h2>
      <label class="mr-4"><input v-model="s.treeLanguage" type="radio" value="sinh" data-testid="tree-lang-sinh"> සිංහල</label>
      <label><input v-model="s.treeLanguage" type="radio" value="pali" data-testid="tree-lang-pali"> පාළි</label>
    </section>
    <section class="card m-1.5 w-full sm:w-[calc(50%-12px)] xl:w-[calc(33.3%-12px)]">
      <h2 class="mb-2 text-xl">වෙනත් සැකසුම්</h2>
      <label v-for="o in switches" :key="o.key" class="mb-1 flex items-center space-x-2">
        <input v-model="(s as any)[o.key]" type="checkbox" class="h-4 w-4 accent-[var(--c-primary)]" :data-testid="`setting-${o.key}`"> {{ o.label }}
      </label>
    </section>
    <section class="card m-1.5 w-full sm:w-[calc(50%-12px)] xl:w-[calc(33.3%-12px)]" data-testid="settings-dicts">
      <h2 class="mb-1 text-xl">ශබ්දකෝෂ</h2>
      <p class="mb-2 text-[15px] text-muted">පාළි වචනයක් එබූ විට සහ ශබ්දකෝෂ සෙවීමේදී භාවිතා කරන ශබ්දකෝෂ.</p>
      <DictFilter inline />
    </section>
  </div>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useSettings, FONT_SIZE_RANGE, READING_MODES } from '@p/overrides/settings'
import ThemePicker from '@/components/ThemePicker.vue'
import DictFilter from '@/components/DictFilter.vue'
import { MODE_LABELS, MODE_HELP } from '@p/composables/readingMode'

useHead({ title: 'සැකසුම් / Settings' })
const s = useSettings()
const switches = [
  { key: 'audioFollow', label: 'සජ්ඣායනය අසන විට කියවෙන තැනට ස්වයංක්‍රීයව යන්න' },
  { key: 'bandiLetters', label: 'පාළි බැඳි අකුරු භාවිතා කරන්න' },
  { key: 'syncTree', label: 'කියවන සූත්‍රය හා නාමාවලිය සමමුහූර්ත (sync) කරන්න' },
  { key: 'autoHideSearchBar', label: 'කුඩා තිර වල පහළට යන විට සෙවුම් තීරුව සඟවන්න' },
]
</script>
