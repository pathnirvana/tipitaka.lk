/**
 * Reads the aṭṭhakathā of a mūla passage (or the mūla of an aṭṭhakathā passage) alongside the text (tipitaka.app's
 * "open alongside"): switches to the columns view and opens it in a column next to the text (an open tab of that sutta
 * is reused, moved to the passage). The text keeps its place and stays the active one.
 */
import type { EInd } from '@shared/routes'
import { useTabs } from '@/stores/tabs'
import { useSettings } from '@/stores/settings'
import { countFeature } from './stats'

export function openAlongside(key: string, eInd?: EInd) {
  const tabs = useTabs(), settings = useSettings()
  countFeature('alongside')
  settings.tabView = 'columns'
  const from = tabs.activeInd
  void tabs.openTab({ key, eInd, afterActive: true, reuse: true })
  if (from >= 0) tabs.setActive(from) // (synchronously: the url stays on the text)
}
