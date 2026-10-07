/** column choice helpers shared by the header, the side panel and settings */
import { computed } from 'vue'
import { useTabs, type Columns } from '@/stores/tabs'
import { useSettings } from '@/stores/settings'
import { smAndUp } from './breakpoints'

/** columns of the active tab; choosing "both" on a small screen is honoured for that tab */
export function useTabColumns() {
  const tabs = useTabs()
  return computed<Columns>({
    get: () => tabs.tabColumns(tabs.activeTab),
    set: v => { if (tabs.activeTab) tabs.update(tabs.activeTab, { columns: v, explicitBoth: v === 2 && !smAndUp.value }) },
  })
}
/** default columns for new suttas; choosing "both" on a small screen means both on small screens too */
export function useDefaultColumns() {
  const settings = useSettings()
  return computed<Columns>({
    get: () => (settings.defaultColumns === 2 && !smAndUp.value && !settings.bothColumnsOnSmallScreens ? (settings.treeLanguage === 'pali' ? 0 : 1) : settings.defaultColumns),
    set: v => {
      settings.defaultColumns = v
      if (!smAndUp.value) settings.bothColumnsOnSmallScreens = v === 2
    },
  })
}
