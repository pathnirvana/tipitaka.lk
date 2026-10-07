<template>
  <div class="flex flex-wrap p-1.5">
    <section class="card m-1.5 w-full sm:w-[calc(50%-12px)] xl:w-[calc(33.3%-12px)]">
      <h2 class="mb-1 text-xl">{{ s.darkMode ? 'දහවල් ආලෝකමත් තිරය' : 'රාත්‍රී අඳුරු තිරය' }}</h2>
      <p class="mb-2 text-[15px] text-muted">රාත්‍රී අඳුරු තිරය සහ දහවල් ආලෝකමත් තිරය අතර මාරු වෙන්න. අඳුරු තිරය රාත්‍රියේදී ඇසට පහසුය.</p>
      <button class="btn-primary" data-testid="dark-toggle" @click="s.darkMode = !s.darkMode">
        <IconSun v-if="s.darkMode" class="mr-2" /><IconMoon v-else class="mr-2" />{{ s.darkMode ? 'ආලෝකමත් තිරය' : 'අඳුරු තිරය' }}
      </button>
    </section>
    <section class="card m-1.5 w-full sm:w-[calc(50%-12px)] xl:w-[calc(33.3%-12px)]">
      <h2 class="mb-2 text-xl">සූත්‍ර නාමාවලිය පෙන්වන භාෂාව</h2>
      <label class="mr-4"><input v-model="s.treeLanguage" type="radio" value="pali" data-testid="tree-lang-pali"> පාළි</label>
      <label><input v-model="s.treeLanguage" type="radio" value="sinh" data-testid="tree-lang-sinh"> සිංහල</label>
    </section>
    <section class="card m-1.5 w-full sm:w-[calc(50%-12px)] xl:w-[calc(33.3%-12px)]">
      <h2 class="mb-1 text-xl">අධෝලිපි (Footnotes)</h2>
      <p class="mb-2 text-[15px] text-muted">අධෝලිපි යනු බුද්ධ ජයන්ති ත්‍රිපිටකය අනෙක් ත්‍රිපිටක ග්‍රන්ථ මාලා වලින් වෙනස් වන ස්ථාන පෙන්වීම පිණිස සෑම පිටුවකම යටින් සටහන් කර ඇති කොටසය.</p>
      <label v-for="o in footnoteOptions" :key="o.value" class="block"><input v-model="s.footnoteMethod" type="radio" :value="o.value" :data-testid="`fn-${o.value}`"> {{ o.label }}</label>
    </section>
    <section class="card m-1.5 w-full sm:w-[calc(50%-12px)] xl:w-[calc(33.3%-12px)]">
      <h2 class="mb-2 text-xl">වෙනත් සැකසුම්</h2>
      <label v-for="o in switches" :key="o.key" class="mb-1 flex items-center gap-2">
        <input v-model="(s as any)[o.key]" type="checkbox" class="h-4 w-4 accent-[var(--c-primary)]" :data-testid="`setting-${o.key}`"> {{ o.label }}
      </label>
    </section>
    <section class="card m-1.5 w-full sm:w-[calc(50%-12px)] xl:w-[calc(33.3%-12px)]">
      <h2 class="mb-2 text-xl">අකුරු විශාලත්වය</h2>
      <div class="mb-2 text-info" :style="{ fontSize: s.fontPx }">නමො තස‍්ස භගවතො අරහතො</div>
      <input v-model.number="s.fontSize" type="range" min="-5" max="5" step="1" class="w-full" data-testid="font-size"> <span class="text-[15px]">{{ s.fontSize }}</span>
    </section>
    <section class="card m-1.5 w-full sm:w-[calc(50%-12px)] xl:w-[calc(33.3%-12px)]">
      <h2 class="mb-1 text-xl">පාළි සිංහල තීරු තෝරන්න</h2>
      <p class="mb-2 text-[15px] text-muted">නව සූත්‍රයක් ඇරීමේදී පෙන්වන්නේ පාළි, සිංහල හෝ ඒ තීරු දෙකමද බව.</p>
      <ColumnSelector v-model="defaultColumns" /> <span class="ml-3 text-[15px]">{{ columnText }}</span>
    </section>
    <section v-if="showUpdate" class="card m-1.5 w-full sm:w-[calc(50%-12px)] xl:w-[calc(33.3%-12px)]">
      <h2 class="mb-1 text-xl">මෘදුකාංගය යාවත්කාලීන කිරීම</h2>
      <div class="text-[15px]">ඔබගේ වත්මන් අනුවාදය (version): {{ APP_VERSION.toFixed(1) }}</div>
      <div :class="['mb-2 text-[15px]', versionClass]" data-testid="version-text">{{ versionText }}</div>
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
import { useDefaultColumns } from '@/composables/columns'
import { isNativeApp } from '@/data/source'
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
const defaultColumns = useDefaultColumns()
const columnText = computed(() => ({ 2: 'පාළි සිංහල දෙකම.', 0: 'පාළි පමණයි.', 1: 'සිංහල පමණයි.' })[defaultColumns.value])

const newVersion = ref(0)
async function checkVersion() {
  try {
    const res = await fetch(versionUrl)
    if (!res.ok) throw new Error(String(res.status))
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
// the website is always the latest version. Offline apps ask tipitaka.lk (file:// pages may), the desktop app asks
// its local server which forwards the request (a cross-origin request from localhost would be blocked by CORS)
const showUpdate = isNativeApp() || location.hostname !== 'tipitaka.lk'
const versionUrl = isNativeApp() ? 'https://tipitaka.lk/tipitaka-query/version' : `${import.meta.env.BASE_URL}tipitaka-query/latest-version`
onMounted(() => { if (showUpdate) checkVersion() })
</script>
