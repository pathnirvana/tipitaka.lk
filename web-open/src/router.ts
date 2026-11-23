import { createRouter, createWebHistory } from 'vue-router'
import Welcome from './views/Welcome.vue'
import Reader from './views/Reader.vue'
import { script } from './script'

// https://open.tipitaka.lk/<script>/<key>[/<page>-<entry>]: the script is the base of the router (src/script.ts), the
// routes below are what follows it. The url formats are a public contract (shared links) - dev-docs/open-flavor.md.
export const routes = [
  { path: '/', name: 'Welcome', component: Welcome },
  { path: '/titles/:term?', name: 'title', component: () => import('./views/TitleSearch.vue') },
  { path: '/search/:words?/:options?', name: 'fts', component: () => import('./views/FtsSearch.vue') },
  { path: '/bookmarks', name: 'Bookmarks', component: () => import('./views/Bookmarks.vue') },
  { path: '/:key/:eIndStr([0-9\\-]+)?', name: 'Home', component: Reader },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('./views/NotFound.vue') },
]

export function makeRouter() {
  return createRouter({
    history: createWebHistory(`/${script}/`),
    routes,
    scrollBehavior: (_to, _from, saved) => saved || undefined,
  })
}
