import type { Router } from 'vue-router'
import type { SearchType } from '@/stores/search'

const SEARCH_ROUTES = ['title', 'fts', 'dict']
/** v2 routeToSearchPage: push when coming from a non search view, replace when switching between search views */
export function routeToSearchPage(router: Router, input: string, type: SearchType) {
  if (!input) return
  const current = String(router.currentRoute.value.name || '')
  if (!SEARCH_ROUTES.includes(current)) router.push(`/${type}/${input}`)
  else if (current !== type) router.replace(`/${type}/${input}`)
}
