/** the reading mode shown: the setting, or the language of the /pali or /sinh link the tab was opened from (tipitaka.lk's
 * column of such a link, stores/tabs.ts columnsFor) until a mode is picked; side by side only where the text has room for
 * it (else interleaved); the pāḷi where the sutta has no translation */
import { computed } from 'vue'
import { useSettings, SIDE_BY_SIDE_FROM, type ReadingMode } from '@p/overrides/settings'
import { useTabs, type Tab } from '@/stores/tabs'
import { useLayout } from '@/composables/layout'
import { viewport } from '@/composables/breakpoints'

export const MODE_LABELS: Record<ReadingMode, string> = { sinh: 'සිංහල', pali: 'පාළි', interleaved: 'පාළිය සමඟ', side: 'දෙපසින්' }
export const MODE_HELP: Record<ReadingMode, string> = {
  sinh: 'සරල සිංහල පරිවර්තනය පමණක්',
  pali: 'පාළි පාඨය පමණක්',
  interleaved: 'එක් එක් පාළි ඡේදය, ඊට පසු එහි සිංහල පරිවර්තනය',
  side: 'පාළිය සහ සිංහල පරිවර්තනය දෙපසින් (පුළුල් තිර වල පමණි)',
}

export function useReadingMode() {
  const settings = useSettings(), tabs = useTabs(), { contentLeft, contentRight } = useLayout()
  const sideFits = computed(() => viewport.width.value - contentLeft.value - contentRight.value >= SIDE_BY_SIDE_FROM)
  const untranslated = (tab?: Tab) => !!tab?.node?.pali_only
  const linkMode = (tab?: Tab): ReadingMode | null => (tab?.columns === 0 ? 'pali' : tab?.columns === 1 ? 'sinh' : null)
  /** the mode picked: the link's language or the setting (side by side even where it does not fit) */
  const picked = computed(() => linkMode(tabs.activeTab) ?? settings.readingMode)
  const modeOf = (tab?: Tab): ReadingMode => {
    if (untranslated(tab)) return 'pali'
    const m = linkMode(tab) ?? settings.readingMode
    return m === 'side' && !sideFits.value ? 'interleaved' : m
  }
  const mode = computed(() => modeOf(tabs.activeTab))
  /** the picker: the setting, and the open sutta leaves its link's language */
  function pick(m: ReadingMode) {
    settings.readingMode = m
    if (tabs.activeTab) tabs.activeTab.columns = 2
  }
  return { mode, modeOf, picked, pick, sideFits, untranslated }
}
