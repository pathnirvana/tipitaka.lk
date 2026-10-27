<!-- web/src/components/SidePanel.vue with the reading mode in place of the columns and the scanned pages, pitaka.lk's name
     and links -->
<template>
  <Teleport to="body">
    <Transition enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="overlay" class="fixed inset-x-0 bottom-0 z-40 bg-black/30 transition-opacity duration-200" :style="{ top: `${APP_BAR}px` }" @click="ui.showPanel = false" />
    </Transition>
    <Transition enter-from-class="translate-x-full" leave-to-class="translate-x-full">
    <aside v-if="column || overlay" :class="['fixed bottom-0 right-0 flex max-w-[85vw] flex-col overflow-y-auto overscroll-contain border-l border-line bg-surface transition-transform duration-200', column ? 'z-30' : 'z-40 shadow-2xl']"
      :style="{ top: `${APP_BAR}px`, width: `${PANEL_WIDTH}px` }" :data-pinned="column" data-testid="side-panel">
      <div class="flex items-center border-b border-line px-3 py-2">
        <span class="flex-1 text-lg text-primary">{{ SITE_NAME }}</span>
        <button v-if="overlay && panelFits" class="icon-btn text-muted" title="විවෘතව තබන්න (pin)" data-testid="side-panel-pin" @click="pin"><IconPin /></button>
        <button class="icon-btn" title="close" data-testid="side-panel-close" @click="close"><IconClose /></button>
      </div>

      <section class="panel-section">
        <div class="panel-row" data-testid="panel-theme">
          <IconPalette class="panel-icon" /><ThemePicker />
        </div>
      </section>

      <section v-if="isTextTab" class="panel-section" data-testid="panel-reading">
        <div v-if="!untranslated(tabs.activeTab)" class="panel-row flex-wrap" data-testid="panel-mode">
          <IconColumns class="panel-icon" /><span class="mb-1 flex-1">කියවන ආකාරය</span>
          <ReadingModePicker />
        </div>
        <div class="panel-row">
          <button class="btn flex-1 justify-center" data-testid="prev-sutta" @click="tabs.navigate(-1)"><IconPrev class="mr-1" />කලින් සූත්‍රය</button>
          <button class="btn ml-2 flex-1 justify-center" data-testid="next-sutta" @click="tabs.navigate(1)">ඊළඟ සූත්‍රය<IconNext class="ml-1" /></button>
        </div>
      </section>

      <section class="panel-section">
        <div class="panel-row">
          <IconFormatSize class="panel-icon" />
          <span class="flex-1 whitespace-nowrap">අකුරු විශාලත්වය</span>
          <button class="icon-btn border border-line" title="smaller" data-testid="panel-font-down" :disabled="s.fontSize <= FONT_SIZE_RANGE[0]" @click="s.fontSize--"><IconMinus /></button>
          <span class="w-8 text-center" data-testid="panel-font-size">{{ s.fontSize > 0 ? '+' : '' }}{{ s.fontSize }}</span>
          <button class="icon-btn border border-line" title="larger" data-testid="panel-font-up" :disabled="s.fontSize >= FONT_SIZE_RANGE[1]" @click="s.fontSize++"><IconPlus /></button>
        </div>
        <div class="panel-row">
          <IconFileTree class="panel-icon" />
          <span class="flex-1">නාමාවලිය</span>
          <div class="inline-flex overflow-hidden rounded-full border border-line">
            <button v-for="l in langs" :key="l.value" :class="['px-3 py-1', s.treeLanguage === l.value ? 'bg-primary text-white' : 'hover:bg-surface2']" @click="s.treeLanguage = l.value">{{ l.label }}</button>
          </div>
        </div>
      </section>


      <nav class="panel-section">
        <RouterLink to="/settings" class="panel-row" data-testid="menu-settings" @click="ui.showPanel = false"><IconCog class="panel-icon" /><span class="flex-1">තවත් සැකසුම් / Settings</span></RouterLink>
        <RouterLink to="/bookmarks" class="panel-row" data-testid="menu-bookmarks" @click="ui.showPanel = false"><IconStar class="panel-icon text-star" /><span class="flex-1">තරු යෙදූ සහ කියවූ සූත්‍ර / Bookmarks</span></RouterLink>
        <RouterLink to="/map" class="panel-row" data-testid="menu-map" @click="ui.showPanel = false"><IconMap class="panel-icon" /><span class="flex-1">ස්ථාන සිතියම / Map</span></RouterLink>
        <RouterLink to="/names" class="panel-row" data-testid="menu-names" @click="ui.showPanel = false"><IconPeople class="panel-icon" /><span class="flex-1">ස්ථාන සහ පුද්ගලයන් / Names</span></RouterLink>
        <RouterLink to="/help" class="panel-row" data-testid="menu-help" @click="ui.showPanel = false"><IconHelp class="panel-icon" /><span class="flex-1">භාවිතා කරන ආකාරය / Help</span></RouterLink>
        <RouterLink to="/" class="panel-row" @click="ui.showPanel = false"><IconHome class="panel-icon" /><span class="flex-1">මුල් පිටුව / Home</span></RouterLink>
        <a class="panel-row" href="https://pitaka.lk/" target="_blank" rel="noopener"><IconInfo class="panel-icon" /><span class="flex-1">pitaka.lk අඩවිය / pitaka.lk</span></a>
        <a class="panel-row" href="https://github.com/pathnirvana/tipitaka.lk" target="_blank" rel="noopener"><IconGithub class="panel-icon" /><span class="flex-1">කේත කෝෂ්ඨය / GitHub</span></a>
      </nav>
    </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import IconClose from '~icons/mdi/close'
import IconPin from '~icons/mdi/pin-outline'
import IconPalette from '~icons/mdi/palette'
import IconMap from '~icons/mdi/map-outline'
import IconPeople from '~icons/mdi/account-group-outline'
import IconFormatSize from '~icons/mdi/format-size'
import IconMinus from '~icons/mdi/minus'
import IconPlus from '~icons/mdi/plus'
import IconFileTree from '~icons/mdi/file-tree'
import IconColumns from '~icons/mdi/view-column'
import IconPrev from '~icons/mdi/skip-previous'
import IconNext from '~icons/mdi/skip-next'
import IconCog from '~icons/mdi/cog'
import IconStar from '~icons/mdi/star'
import IconHelp from '~icons/mdi/help-circle-outline'
import IconHome from '~icons/mdi/home'
import IconInfo from '~icons/mdi/information'
import IconGithub from '~icons/mdi/github'
import ReadingModePicker from './ReadingModePicker.vue'
import ThemePicker from '@/components/ThemePicker.vue'
import { useUi } from '@/stores/ui'
import { useSettings, FONT_SIZE_RANGE } from '@/stores/settings'
import { useTabs } from '@/stores/tabs'
import { useReadingMode } from '@p/composables/readingMode'
import { SITE_NAME } from '@p/site'
import { useLayout, APP_BAR, PANEL_WIDTH } from '@/composables/layout'

const ui = useUi(), s = useSettings(), tabs = useTabs(), route = useRoute()
const langs = [{ value: 'pali' as const, label: 'පාළි' }, { value: 'sinh' as const, label: 'සිංහල' }]
const isTextTab = computed(() => route.name === 'Home' && tabs.activeInd >= 0)
const { untranslated } = useReadingMode()
const { panelColumn: column, panelFits } = useLayout()
const overlay = computed(() => !column.value && ui.showPanel)
function pin() { s.panelPinned = true; ui.showPanel = false }
function close() { if (column.value) s.panelPinned = false; else ui.showPanel = false }
// the panel over the page closes when a page is chosen and when it becomes a column
watch(() => route.fullPath, () => { ui.showPanel = false })
watch(column, c => { if (c) ui.showPanel = false })
</script>
