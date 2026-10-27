/** the reading mode shown: the setting, side by side only where the text has room for it (else interleaved), the pāḷi
 * where the sutta has no translation */
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
  const modeOf = (tab?: Tab): ReadingMode => {
    if (untranslated(tab)) return 'pali'
    const m = settings.readingMode
    return m === 'side' && !sideFits.value ? 'interleaved' : m
  }
  const mode = computed(() => modeOf(tabs.activeTab))
  return { mode, modeOf, sideFits, untranslated }
}
