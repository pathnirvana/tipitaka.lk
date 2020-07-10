import Vue from 'vue'
import VueRouter from 'vue-router'
import Welcome from '../views/Welcome.vue'
import Home from '../views/Home.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'Welcome',
    component: Welcome,
  },
  {
    path: '/settings',
    name: 'Settings',
    // route level code-splitting
    // this generates a separate chunk (Settings.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "Settings" */ '../views/Settings.vue'),
  },
  {
    path: '/bookmarks',
    name: 'Bookmarks',
    component: () => import(/* webpackChunkName: "Bookmarks" */ '../views/Bookmarks.vue'),
  },
  {
    path: '/title/:term?',
    name: 'title',
    component: () => import(/* webpackChunkName: "title" */ '../views/TSearch.vue'),
  },
  {
    path: '/dict/:word?',
    name: 'dict',
    component: () => import(/* webpackChunkName: "dict" */ '../views/Dictionary.vue'),
  },
  {
    path: '/fts/:words?/:options?',
    name: 'fts',
    component: () => import(/* webpackChunkName: "FTS" */ '../views/FTS.vue'),
  },
  {
    path: '/:key?/:eIndStr([0-9\-]+)?/:language([a-z]{4})?',
    name: 'Home',
    component: Home,
  },
  // TODO add a not found handler here
  //{ path: '*', component: NotFoundComponent }
]

const router = new VueRouter({
  mode: (typeof Android !== 'undefined') ? 'hash' : 'history', // history mode not working in webview
  base: process.env.BASE_URL,
  routes
})

export default router
