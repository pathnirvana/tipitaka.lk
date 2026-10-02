import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import Welcome from './views/Welcome.vue'
import Reader from './views/Reader.vue'
import { isNativeApp } from './data/source'

// URL formats are a public contract (shared links) - see docs/architecture.md
export const routes = [
  { path: '/', name: 'Welcome', component: Welcome },
  { path: '/settings', name: 'Settings', component: () => import('./views/Settings.vue') },
  { path: '/abbreviations', name: 'Abbreviations', component: () => import('./views/Abbreviations.vue') },
  { path: '/bookmarks', name: 'Bookmarks', component: () => import('./views/Bookmarks.vue') },
  { path: '/title/:term?', name: 'title', component: () => import('./views/TitleSearch.vue') },
  { path: '/dict/:word?', name: 'dict', component: () => import('./views/Dictionary.vue') },
  { path: '/fts/:words?/:options?', name: 'fts', component: () => import('./views/FtsSearch.vue') },
  { path: '/:key/:eIndStr([0-9\\-]+)?/:language([a-z]{4})?', name: 'Home', component: Reader },
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: () => import('./views/NotFound.vue') },
]

export function makeRouter() {
  return createRouter({
    history: isNativeApp() ? createWebHashHistory() : createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior: (_to, _from, saved) => saved || undefined,
  })
}
