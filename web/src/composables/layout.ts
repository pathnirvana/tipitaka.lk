/**
 * Page layout (tipitaka.app): the fixed app bar, below it the tree drawer on the left (a column from 1000 px, else over the
 * page) and the side panel (menu) on the right: a column when pinned and the text keeps MIN_TEXT px beside the open
 * columns (from 1200 px), else over the page. The tab strip is at the top of the text, sticky under the app bar (the
 * columns view has none). The dictionary pane: a column on the right when the text keeps MIN_TEXT px beside the open
 * columns, otherwise a bottom sheet whose height (% of the screen) the reader sets by dragging its handle.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { viewport } from './breakpoints'
import { useUi } from '@/stores/ui'
import { useTabs } from '@/stores/tabs'
import { useInlineDict } from '@/stores/inlineDict'
import { useSettings } from '@/stores/settings'

export const TREE_WIDTH = 350, DICT_WIDTH = 400, PANEL_WIDTH = 330, MIN_TEXT = 600, TREE_COLUMN_FROM = 1000, PANEL_COLUMN_FROM = 1200
export const APP_BAR = 49, TABS_BAR = 40

export function useLayout() {
  const ui = useUi(), tabs = useTabs(), dict = useInlineDict(), settings = useSettings(), route = useRoute()
  const narrow = computed(() => viewport.width.value < TREE_COLUMN_FROM)
  const treeColumn = computed(() => ui.showTree && !narrow.value)
  /** the columns view (settings.tabView) with more than one text: no tab strip, the columns have headers */
  const columnsView = computed(() => route.name === 'Home' && settings.tabView === 'columns' && tabs.tabList.length > 1)
  /** the top of the text: the app bar and the tab strip */
  const headerHeight = computed(() => APP_BAR + (route.name === 'Home' && tabs.activeInd >= 0 && !columnsView.value ? TABS_BAR : 0))
  const dictOpen = computed(() => dict.show && route.name === 'Home')
  /** there is room for the side panel as a column (the dictionary pane wins the room) */
  const panelFits = computed(() => viewport.width.value >= PANEL_COLUMN_FROM
    && viewport.width.value - (treeColumn.value ? TREE_WIDTH : 0) - (dictOpen.value ? DICT_WIDTH : 0) - PANEL_WIDTH >= MIN_TEXT)
  const panelColumn = computed(() => settings.panelPinned && panelFits.value)
  const panelRight = computed(() => (panelColumn.value ? PANEL_WIDTH : 0))
  const dictSide = computed(() => viewport.width.value - (treeColumn.value ? TREE_WIDTH : 0) - panelRight.value - DICT_WIDTH >= MIN_TEXT)
  /** room taken at the bottom / right of the page by the dictionary pane (px) */
  const dictBottom = computed(() => (dictOpen.value && !dictSide.value ? Math.round((settings.dictSheetHeight / 100) * viewport.height.value) : 0))
  const dictRight = computed(() => (dictOpen.value && dictSide.value ? DICT_WIDTH : 0))
  const contentLeft = computed(() => (treeColumn.value ? TREE_WIDTH : 0))
  /** room taken on the right of the page by the dictionary and side panel columns (px) */
  const contentRight = computed(() => dictRight.value + panelRight.value)
  /** the ⋮ button: closes the panel (a column is unpinned), or opens it over the page */
  function togglePanel() {
    if (panelColumn.value) settings.panelPinned = false
    else ui.showPanel = !ui.showPanel
  }
  return { narrow, treeColumn, columnsView, headerHeight, dictOpen, dictSide, dictBottom, dictRight, contentLeft, contentRight, panelFits, panelColumn, panelRight, togglePanel }
}
