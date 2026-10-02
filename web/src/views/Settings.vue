<template>
  <div class="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
    <section class="card">
      <h2 class="mb-1 text-lg">{{ s.darkMode ? 'දහවල් ආලෝකමත් තිරය' : 'රාත්‍රී අඳුරු තිරය' }}</h2>
      <p class="mb-2 text-sm text-muted">රාත්‍රී අඳුරු තිරය සහ දහවල් ආලෝකමත් තිරය අතර මාරු වෙන්න. අඳුරු තිරය රාත්‍රියේදී ඇසට පහසුය.</p>
      <button class="btn-primary" data-testid="dark-toggle" @click="s.darkMode = !s.darkMode">
        <IconSun v-if="s.darkMode" class="mr-2" /><IconMoon v-else class="mr-2" />{{ s.darkMode ? 'ආලෝකමත් තිරය' : 'අඳුරු තිරය' }}
      </button>
    </section>
    <section class="card">
      <h2 class="mb-2 text-lg">සූත්‍ර නාමාවලිය පෙන්වන භාෂාව</h2>
      <label class="mr-4"><input v-model="s.treeLanguage" type="radio" value="pali" data-testid="tree-lang-pali"> පාළි</label>
      <label><input v-model="s.treeLanguage" type="radio" value="sinh" data-testid="tree-lang-sinh"> සිංහල</label>
    </section>
    <section class="card">
      <h2 class="mb-1 text-lg">අධෝලිපි (Footnotes)</h2>
      <p class="mb-2 text-sm text-muted">අධෝලිපි යනු බුද්ධ ජයන්ති ත්‍රිපිටකය අනෙක් ත්‍රිපිටක ග්‍රන්ථ මාලා වලින් වෙනස් වන ස්ථාන පෙන්වීම පිණිස සෑම පිටුවකම යටින් සටහන් කර ඇති කොටසය.</p>
      <label v-for="o in footnoteOptions" :key="o.value" class="block"><input v-model="s.footnoteMethod" type="radio" :value="o.value" :data-testid="`fn-${o.value}`"> {{ o.label }}</label>
    </section>
    <section class="card">
      <h2 class="mb-2 text-lg">වෙනත් සැකසුම්</h2>
      <label v-for="o in switches" :key="o.key" class="mb-1 flex items-center gap-2">
        <input v-model="(s as any)[o.key]" type="checkbox" class="h-4 w-4 accent-[var(--c-primary)]" :data-testid="`setting-${o.key}`"> {{ o.label }}
      </label>
    </section>
    <section class="card">
      <h2 class="mb-2 text-lg">අකුරු විශාලත්වය</h2>
      <div class="mb-2 text-info" :style="{ fontSize: s.fontPx }">නමො තස‍්ස භගවතො අරහතො</div>
      <input v-model.number="s.fontSize" type="range" min="-5" max="5" step="1" class="w-full" data-testid="font-size"> <span class="text-sm">{{ s.fontSize }}</span>
    </section>
    <section class="card">
      <h2 class="mb-1 text-lg">පාළි සිංහල තීරු තෝරන්න</h2>
      <p class="mb-2 text-sm text-muted">නව සූත්‍රයක් ඇරීමේදී පෙන්වන්නේ පාළි, සිංහල හෝ ඒ තීරු දෙකමද බව.</p>
      <ColumnSelector v-model="s.defaultColumns" /> <span class="ml-3 text-sm">{{ columnText }}</span>
    </section>
    <section class="card">
      <h2 class="mb-1 text-lg">මෘදුකාංගය යාවත්කාලීන කිරීම</h2>
      <div class="text-sm">ඔබගේ වත්මන් අනුවාදය (version): {{ APP_VERSION.toFixed(1) }}</div>
      <div :class="['mb-2 text-sm', versionClass]" data-testid="version-text">{{ versionText }}</div>
      <button class="btn-primary" @click="checkVersion"><IconUpdate class="mr-2" />පරීක්‍ෂා කරන්න</button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useHead } from '@unhead/vue'
import IconSun from '~icons/mdi/brightness-7'
import IconMoon from '~icons/mdi/brightness-4'
import IconUpdate from '~icons/mdi/update'
import ColumnSelector from '@/components/ColumnSelector.vue'
import { useSettings } from '@/stores/settings'
import { APP_VERSION } from '@shared/constants'

useHead({ title: 'සැකසුම් / Settings' })
const s = useSettings()
const footnoteOptions = [
  { value: 'hidden', label: 'නොපෙන්වන්න' }, { value: 'click', label: 'ඔබන විට පෙන්වන්න (on click)' },
  { value: 'hover', label: 'මතින් යනවිට පෙන්වන්න (on hover)' }, { value: 'end-page', label: 'පිටුවේ අග පෙන්වන්න' },
]
const switches = [
  { key: 'bandiLetters', label: 'පාළි බැඳි අකුරු භාවිතා කරන්න' }, { key: 'specialLetters', label: 'විශේෂ පාළි අකුරු භාවිතා කරන්න' },
  { key: 'showPageNumbers', label: 'පොතේ පිටු අංක පෙන්වන්න' }, { key: 'syncTree', label: 'කියවන සූත්‍රය හා නාමාවලිය සමමුහූර්ත (sync) කරන්න' },
  { key: 'autoHideSearchBar', label: 'සෙවුම් කොටුව ඉබේ අරින්න වසන්න' },
]
const columnText = computed(() => ({ 2: 'පාළි සිංහල දෙකම.', 0: 'පාළි පමණයි.', 1: 'සිංහල පමණයි.' })[s.defaultColumns])

const newVersion = ref(0)
async function checkVersion() {
  try {
    const res = await fetch('https://tipitaka.lk/tipitaka-query/version')
    newVersion.value = Number((await res.text()).split('v').pop()) // "Tipitaka.lk v3.0"
  } catch { newVersion.value = -1 }
}
const versionText = computed(() => {
  if (newVersion.value === -1) return 'පරික්‍ෂා කිරීමේදී දෝෂයක් මතුවිය. අන්තර්ජාලයට සම්බන්ධ වී නැවත උත්සාහ කරන්න.'
  if (newVersion.value && newVersion.value <= APP_VERSION) return 'ඔබ නවතම අනුවාදය භාවිතා කරමින් සිටියි.'
  if (newVersion.value) return `නව අනුවාදයක් (${newVersion.value}) තිබේ. ඔබගේ මෘදුකාංගය යාවත්කාල කරගන්න.`
  return 'පහත බොත්තම එබීමෙන් නව අනුවාදයක් තිබේදැයි බලන්න.'
})
const versionClass = computed(() => (newVersion.value === -1 ? 'text-error' : newVersion.value && newVersion.value <= APP_VERSION ? 'text-success' : 'text-accent'))
onMounted(checkVersion)
</script>
