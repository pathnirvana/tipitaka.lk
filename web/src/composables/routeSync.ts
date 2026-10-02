/**
 * Keeps the URL and the active tab in sync in both directions (v2 had the route watcher disabled, so
 * back/forward did not change the open sutta - A7).
 */
import { watch } from 'vue'
import type { Router } from 'vue-router'
import { useTabs } from '@/stores/tabs'
import { useAudio } from '@/stores/audio'
import { useTree } from '@/stores/tree'
import { parseEIndStr, isLanguage } from '@shared/routes'

export function useRouteSync(router: Router) {
  const tabs = useTabs(), audio = useAudio(), tree = useTree()
  watch(() => router.currentRoute.value, async route => {
    if (route.name !== 'Home') return
    const key = String(route.params.key || '')
    if (!key || key === tabs.activeKey) return
    const i = tabs.findTab(key)
    if (i >= 0) { tabs.setActive(i); return }
    if (!(await tree.getNode(key).catch(() => null))) { // unknown key -> not found view (url kept)
      router.replace({ name: 'NotFound', params: { pathMatch: route.path.slice(1).split('/') }, query: route.query })
      return
    }
    const language = isLanguage(route.params.language) ? route.params.language : undefined
    const tab = await tabs.openTab({ key, eInd: parseEIndStr(String(route.params.eIndStr || '')), language })
    if (route.query.playAudio && tab.node) audio.startEntry(tab.node.file, tab.eInd)
  }, { immediate: true })

  watch(() => tabs.activeKey, key => {
    const route = router.currentRoute.value
    if (!key) {
      if (route.name === 'Home') router.replace('/')
      return
    }
    if (route.name !== 'Home' || route.params.key !== key) router.push('/' + key)
  })
}
