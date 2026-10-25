/**
 * Page layout: the fixed header (taller with the tab strip, which the columns view has not), the tree drawer on the left (a column from 1000 px, else
 * over the page) and the dictionary pane: a column on the right when the text keeps MIN_TEXT px beside the open columns,
 * otherwise a bottom sheet whose height (% of the screen) the reader sets by dragging its handle (tipitaka.app).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { viewport } from './breakpoints'
import { useUi } from '@/stores/ui'
import { useTabs } from '@/stores/tabs'
import { useInlineDict } from '@/stores/inlineDict'
import { useSettings } from '@/stores/settings'

export const TREE_WIDTH = 350, DICT_WIDTH = 400, MIN_TEXT = 600, TREE_COLUMN_FROM = 1000

export function useLayout() {
  const ui = useUi(), tabs = useTabs(), dict = useInlineDict(), settings = useSettings(), route = useRoute()
  const narrow = computed(() => viewport.width.value < TREE_COLUMN_FROM)
  const treeColumn = computed(() => ui.showTree && !narrow.value)
  /** the columns view (settings.tabView) with more than one text: no tab strip, the columns have headers */
  const columnsView = computed(() => route.name === 'Home' && settings.tabView === 'columns' && tabs.tabList.length > 1)
  const headerHeight = computed(() => (route.name === 'Home' && tabs.activeInd >= 0 && !columnsView.value ? 89 : 49))
  const dictOpen = computed(() => dict.show && route.name === 'Home')
  const dictSide = computed(() => viewport.width.value - (treeColumn.value ? TREE_WIDTH : 0) - DICT_WIDTH >= MIN_TEXT)
  /** room taken at the bottom / right of the page by the dictionary pane (px) */
  const dictBottom = computed(() => (dictOpen.value && !dictSide.value ? Math.round((settings.dictSheetHeight / 100) * viewport.height.value) : 0))
  const dictRight = computed(() => (dictOpen.value && dictSide.value ? DICT_WIDTH : 0))
  const contentLeft = computed(() => (treeColumn.value ? TREE_WIDTH : 0))
  return { narrow, treeColumn, columnsView, headerHeight, dictOpen, dictSide, dictBottom, dictRight, contentLeft }
}
