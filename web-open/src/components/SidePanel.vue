<!-- the panel on the right (web/src/components/SidePanel.vue: over the page, or pinned as a column on wide screens):
     the pāḷi script, the settings of the reader and the links to the other pages and sites (site.ts LINKS) -->
<template>
  <Teleport to="body">
    <Transition enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="overlay" class="fixed inset-x-0 bottom-0 z-40 bg-black/30 transition-opacity duration-200" :style="{ top: `${APP_BAR}px` }" @click="ui.showPanel = false" />
    </Transition>
    <Transition enter-from-class="translate-x-full" leave-to-class="translate-x-full">
    <aside v-if="column || overlay" :class="['fixed bottom-0 right-0 flex max-w-[85vw] flex-col overflow-y-auto overscroll-contain border-l border-line bg-surface transition-transform duration-200', column ? 'z-30' : 'z-40 shadow-2xl']"
      :style="{ top: `${APP_BAR}px`, width: `${PANEL_WIDTH}px` }" :data-pinned="column" data-testid="side-panel">
      <div class="flex items-center border-b border-line px-3 py-2">
        <span class="flex-1 text-lg text-primary">{{ t('Settings') }}</span>
        <button v-if="overlay && panelFits" class="icon-btn text-muted" :title="t('Keep open')" data-testid="side-panel-pin" @click="pin"><IconPin /></button>
        <button class="icon-btn" :title="t('Close')" data-testid="side-panel-close" @click="close"><IconClose /></button>
      </div>

      <section class="panel-section" data-testid="panel-script">
        <div class="panel-row !pb-1"><IconScript class="panel-icon" /><span class="flex-1">{{ t('Pali script') }}</span></div>
        <div class="grid grid-cols-3 gap-1 px-3 pb-2">
          <button v-for="sc in shownScripts" :key="sc.code" class="flex min-w-0 flex-col items-start rounded-lg px-2 py-1 text-left hover:bg-surface2"
            :class="{ 'bg-primary-soft text-primary': sc.code === script }" :aria-current="sc.code === script" :data-testid="`script-${sc.code}`" @click="switchScript(sc.code)">
            <span class="script-sample max-w-full truncate text-base leading-tight" :data-script="sc.code">{{ sample(sc.code) }}</span>
            <span class="text-[11px] text-muted">{{ sc.name }}</span>
          </button>
        </div>
        <button v-if="!allScripts" class="panel-row !py-1.5 text-info" data-testid="script-more" @click="allScripts = true"><span class="panel-icon" /><span>{{ t('More') }}…</span></button>
      </section>

      <section class="panel-section">
        <label class="panel-row" data-testid="panel-ui-lang">
          <IconLanguage class="panel-icon" /><span class="flex-1">{{ t('Interface language') }}</span>
          <select v-model="s.uiLang" class="h-8 rounded border border-line bg-surface px-1 text-fg">
            <option v-for="l in UI_LANGS" :key="l.code" :value="l.code">{{ l.name }}</option>
          </select>
        </label>
        <div class="panel-row" data-testid="panel-theme"><IconPalette class="panel-icon" /><ThemePicker /></div>
        <div class="panel-row">
          <IconFormatSize class="panel-icon" />
          <span class="flex-1 whitespace-nowrap">{{ t('Text size') }}</span>
          <button class="icon-btn border border-line" :title="t('Smaller')" data-testid="panel-font-down" :disabled="s.fontSize <= FONT_SIZE_RANGE[0]" @click="s.fontSize--"><IconMinus /></button>
          <span class="w-8 text-center" data-testid="panel-font-size">{{ s.fontSize > 0 ? '+' : '' }}{{ s.fontSize }}</span>
          <button class="icon-btn border border-line" :title="t('Larger')" data-testid="panel-font-up" :disabled="s.fontSize >= FONT_SIZE_RANGE[1]" @click="s.fontSize++"><IconPlus /></button>
        </div>
      </section>

      <section class="panel-section">
        <label class="panel-row" data-testid="panel-footnotes">
          <IconFootnote class="panel-icon" /><span class="flex-1">{{ t('Variant readings') }}</span>
          <select v-model="s.footnoteMethod" class="h-8 rounded border border-line bg-surface px-1 text-fg">
            <option v-for="m in footnoteMethods" :key="m.value" :value="m.value">{{ t(m.label) }}</option>
          </select>
        </label>
        <label class="panel-row" data-testid="panel-page-numbers">
          <IconPage class="panel-icon" /><span class="flex-1">{{ t('Page numbers') }}</span>
          <input v-model="s.showPageNumbers" type="checkbox" class="h-5 w-5 accent-[var(--c-primary)]">
        </label>
        <label class="panel-row" data-testid="panel-tab-view">
          <IconTabs class="panel-icon" /><span class="flex-1">{{ t('Tab view') }}</span>
          <select v-model="s.tabView" class="h-8 rounded border border-line bg-surface px-1 text-fg">
            <option value="single">{{ t('Single') }}</option>
            <option value="tabs">{{ t('Tabs') }}</option>
            <option value="columns">{{ t('Columns') }}</option>
          </select>
        </label>
        <label class="panel-row" data-testid="panel-audio-follow">
          <IconFollow class="panel-icon" /><span class="flex-1">{{ t('Follow the recitation') }}</span>
          <input v-model="s.audioFollow" type="checkbox" class="h-5 w-5 accent-[var(--c-primary)]">
        </label>
      </section>

      <nav class="panel-section">
        <RouterLink to="/" class="panel-row" data-testid="menu-home"><IconHome class="panel-icon" /><span class="flex-1">{{ t('Home') }}</span></RouterLink>
        <RouterLink to="/bookmarks" class="panel-row" data-testid="menu-bookmarks"><IconStar class="panel-icon text-star" /><span class="flex-1">{{ t('Bookmarks') }}</span></RouterLink>
      </nav>
      <nav class="panel-section" data-testid="panel-links">
        <!-- the text being read in the other editions (the sites themselves when no text is open) -->
        <a class="panel-row" :href="editions.cst.value" target="_blank" rel="noopener" data-testid="link-cst"><IconBook class="panel-icon" /><span class="flex-1">{{ t('Chaṭṭha Saṅgāyana edition') }}</span></a>
        <a class="panel-row" :href="editions.sinhala.value" target="_blank" rel="noopener" data-testid="link-sinhala"><IconLanguage class="panel-icon" /><span class="flex-1">{{ t('BJ Sinhala translation') }}</span></a>
        <a v-for="l in LINKS" :key="l.href" class="panel-row" :href="l.href" target="_blank" rel="noopener">
          <component :is="linkIcons[l.icon]" class="panel-icon" /><span class="flex-1">{{ t(l.label) }}</span>
        </a>
      </nav>
    </aside>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import IconClose from '~icons/mdi/close'
import IconPin from '~icons/mdi/pin-outline'
import IconScript from '~icons/mdi/alphabetical-variant'
import IconLanguage from '~icons/mdi/translate'
import IconPalette from '~icons/mdi/palette'
import IconFormatSize from '~icons/mdi/format-size'
import IconMinus from '~icons/mdi/minus'
import IconPlus from '~icons/mdi/plus'
import IconFootnote from '~icons/mdi/format-superscript'
import IconPage from '~icons/mdi/numeric'
import IconTabs from '~icons/mdi/tab'
import IconFollow from '~icons/mdi/target'
import IconHome from '~icons/mdi/home'
import IconStar from '~icons/mdi/star'
import IconBook from '~icons/mdi/book-open-variant'
import IconGithub from '~icons/mdi/github'
import IconEmail from '~icons/mdi/email-outline'
import IconLink from '~icons/mdi/open-in-new'
import ThemePicker from './ThemePicker.vue'
import { useUi } from '@/stores/ui'
import { useSettings, FONT_SIZE_RANGE } from '@o/overrides/settings'
import { useLayout, APP_BAR, PANEL_WIDTH } from '@/composables/layout'
import { SCRIPTS } from '@shared/scripts'
import { LINKS } from '@o/site'
import { script, switchScript, convertTo } from '@o/script'
import { t, UI_LANGS } from '@o/i18n'
import { useEditionLinks } from '@o/composables/editions'

const ui = useUi(), s = useSettings(), route = useRoute()
const { panelColumn: column, panelFits } = useLayout()
const overlay = computed(() => !column.value && ui.showPanel)
const editions = useEditionLinks()

/** the scripts most read (tipitaka.app's visitors) and the script of the page first; all of them on "More" */
const COMMON = ['latn', 'thai', 'khmr', 'sinh', 'deva', 'mymr']
const allScripts = ref(false)
const shownScripts = computed(() => (allScripts.value ? SCRIPTS : SCRIPTS.filter(x => COMMON.includes(x.code) || x.code === script)))
const sample = (code: string) => convertTo('ධම්ම', code)

const footnoteMethods = [{ value: 'hover', label: 'On hover' }, { value: 'click', label: 'On click' }, { value: 'end-page', label: 'End of the page' }, { value: 'hidden', label: 'Hidden' }] as const
const linkIcons = { translate: IconLanguage, book: IconBook, github: IconGithub, email: IconEmail, link: IconLink }

function pin() { s.panelPinned = true; ui.showPanel = false }
function close() { if (column.value) s.panelPinned = false; else ui.showPanel = false }
// the panel over the page closes when a page is chosen and when it becomes a column
watch(() => route.fullPath, () => { ui.showPanel = false })
watch(column, c => { if (c) ui.showPanel = false })
</script>
