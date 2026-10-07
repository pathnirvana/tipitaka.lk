/** column choice helpers shared by the header, the side panel and settings */
import { computed } from 'vue'
import { useTabs, type Columns } from '@/stores/tabs'
import { useSettings } from '@/stores/settings'

/** columns shown in the active tab (small screens always show one column, like v2) */
export function useTabColumns() {
  const tabs = useTabs()
  return computed<Columns>({
    get: () => tabs.tabColumns(tabs.activeTab),
    set: v => { if (tabs.activeTab) tabs.update(tabs.activeTab, { columns: v }) },
  })
}
/** default columns for new suttas (the stored value - on small screens "both" falls back to one column) */
export function useDefaultColumns() {
  const settings = useSettings()
  return computed<Columns>({ get: () => settings.defaultColumns, set: v => { settings.defaultColumns = v } })
}
