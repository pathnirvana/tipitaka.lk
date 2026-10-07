<!-- right hand panel: quick settings, reading controls and navigation links (like open.tipitaka.lk) -->
<template>
  <Teleport to="body">
    <div v-if="ui.showPanel" class="fixed inset-0 z-40 bg-black/30" @click="ui.showPanel = false" />
    <Transition enter-from-class="translate-x-full" leave-to-class="translate-x-full">
    <aside v-if="ui.showPanel" class="fixed bottom-0 right-0 top-0 z-50 flex w-[330px] max-w-full flex-col overflow-y-auto border-l border-line bg-surface shadow-2xl transition-transform duration-200"
      data-testid="side-panel">
      <div class="flex items-center border-b border-line px-3 py-2">
        <span class="flex-1 text-lg text-primary">බුද්ධ ජයන්ති ත්‍රිපිටකය</span>
        <button class="icon-btn" title="close" data-testid="side-panel-close" @click="ui.showPanel = false"><IconClose /></button>
      </div>

      <section class="panel-section">
        <button class="panel-row" data-testid="panel-dark" @click="s.darkMode = !s.darkMode">
          <IconSun v-if="s.darkMode" class="panel-icon" /><IconMoon v-else class="panel-icon" />
          <span class="flex-1">{{ s.darkMode ? 'ආලෝකමත් තිරය' : 'අඳුරු තිරය' }}</span>
        </button>
        <div class="panel-row">
          <IconFormatSize class="panel-icon" />
          <span class="flex-1 whitespace-nowrap">අකුරු විශාලත්වය</span>
          <button class="icon-btn border border-line" title="smaller" data-testid="panel-font-down" :disabled="s.fontSize <= -5" @click="s.fontSize--"><IconMinus /></button>
          <span class="w-8 text-center" data-testid="panel-font-size">{{ s.fontSize > 0 ? '+' : '' }}{{ s.fontSize }}</span>
          <button class="icon-btn border border-line" title="larger" data-testid="panel-font-up" :disabled="s.fontSize >= 5" @click="s.fontSize++"><IconPlus /></button>
        </div>
        <div class="panel-row">
          <IconFileTree class="panel-icon" />
          <span class="flex-1">නාමාවලිය</span>
          <div class="inline-flex overflow-hidden rounded-full border border-line">
            <button v-for="l in langs" :key="l.value" :class="['px-3 py-1', s.treeLanguage === l.value ? 'bg-primary text-white' : 'hover:bg-surface2']" @click="s.treeLanguage = l.value">{{ l.label }}</button>
          </div>
        </div>
        <label class="panel-row">
          <IconFootnote class="panel-icon" />
          <span class="flex-1">අධෝලිපි</span>
          <select v-model="s.footnoteMethod" class="input w-auto py-1" data-testid="panel-footnotes">
            <option value="hidden">නොපෙන්වන්න</option><option value="click">ඔබන විට</option>
            <option value="hover">මතින් යනවිට</option><option value="end-page">පිටුවේ අග</option>
          </select>
        </label>
      </section>

      <section v-if="isTextTab" class="panel-section" data-testid="panel-reading">
        <div class="panel-row">
          <IconColumns class="panel-icon" /><span class="flex-1">තීරු</span>
          <ColumnSelector v-model="columns" />
        </div>
        <button v-if="!tabs.isAtta(tabs.activeTab)" class="panel-row" data-testid="scan-toggle" @click="toggleScan">
          <IconText v-if="scan" class="panel-icon" /><IconScanner v-else class="panel-icon" />
          <span class="flex-1">{{ scan ? 'නව පිටපතට' : 'පැරණි පිටපතට (scan)' }}</span>
        </button>
        <div class="panel-row">
          <button class="btn flex-1 justify-center" data-testid="prev-sutta" @click="tabs.navigate(-1)"><IconPrev class="mr-1" />කලින් සූත්‍රය</button>
          <button class="btn ml-2 flex-1 justify-center" data-testid="next-sutta" @click="tabs.navigate(1)">ඊළඟ සූත්‍රය<IconNext class="ml-1" /></button>
        </div>
      </section>

      <nav class="panel-section">
        <RouterLink to="/settings" class="panel-row" data-testid="menu-settings" @click="ui.showPanel = false"><IconCog class="panel-icon" />තවත් සැකසුම් / Settings</RouterLink>
        <RouterLink to="/bookmarks" class="panel-row" data-testid="menu-bookmarks" @click="ui.showPanel = false"><IconStar class="panel-icon text-star" />තරු යෙදූ සූත්‍ර / Bookmarks</RouterLink>
        <RouterLink to="/abbreviations" class="panel-row" data-testid="menu-abbreviations" @click="ui.showPanel = false"><IconAsterisk class="panel-icon" />කෙටි යෙදුම් / Abbreviations</RouterLink>
        <RouterLink to="/" class="panel-row" @click="ui.showPanel = false"><IconHome class="panel-icon" />මුල් පිටුව / Home</RouterLink>
        <a class="panel-row" href="https://pathnirvana.github.io/tipitaka.lk/" target="_blank" rel="noopener"><IconInfo class="panel-icon" />අප ගැන / About</a>
        <a class="panel-row" href="https://github.com/pathnirvana/tipitaka.lk" target="_blank" rel="noopener"><IconGithub class="panel-icon" />කේත කෝෂ්ඨය / GitHub</a>
      </nav>
    </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import IconClose from '~icons/mdi/close'
import IconSun from '~icons/mdi/brightness-7'
import IconMoon from '~icons/mdi/brightness-4'
import IconFormatSize from '~icons/mdi/format-size'
import IconMinus from '~icons/mdi/minus'
import IconPlus from '~icons/mdi/plus'
import IconFileTree from '~icons/mdi/file-tree'
import IconFootnote from '~icons/mdi/format-superscript'
import IconColumns from '~icons/mdi/view-column'
import IconText from '~icons/mdi/text-box'
import IconScanner from '~icons/mdi/scanner'
import IconPrev from '~icons/mdi/skip-previous'
import IconNext from '~icons/mdi/skip-next'
import IconCog from '~icons/mdi/cog'
import IconStar from '~icons/mdi/star'
import IconAsterisk from '~icons/mdi/asterisk'
import IconHome from '~icons/mdi/home'
import IconInfo from '~icons/mdi/information'
import IconGithub from '~icons/mdi/github'
import ColumnSelector from './ColumnSelector.vue'
import { useUi } from '@/stores/ui'
import { useSettings } from '@/stores/settings'
import { useTabs } from '@/stores/tabs'
import { useTabColumns } from '@/composables/columns'

const ui = useUi(), s = useSettings(), tabs = useTabs(), route = useRoute()
const langs = [{ value: 'pali' as const, label: 'පාළි' }, { value: 'sinh' as const, label: 'සිංහල' }]
const isTextTab = computed(() => route.name === 'Home' && tabs.activeInd >= 0)
const columns = useTabColumns()
const scan = computed(() => !!tabs.activeTab?.showScanPage)
function toggleScan() { if (tabs.activeTab) tabs.update(tabs.activeTab, { showScanPage: !scan.value }) }
watch(() => route.fullPath, () => { ui.showPanel = false })
</script>
