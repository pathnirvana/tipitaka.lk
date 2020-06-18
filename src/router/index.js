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
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/Settings.vue'),
  },
  {
    path: '/title/:term?',
    name: 'title',
    component: () => import(/* webpackChunkName: "title" */ '../views/TSearch.vue'),
  },
  {
    path: '/fts/:words?/:options?',
    name: 'fts',
    component: () => import(/* webpackChunkName: "FTS" */ '../views/FTS.vue'),
  },
  {
    path: '/:key/:eIndStr([0-9\-]+)?/:language([a-z]{4})?',
    name: 'Home',
    component: Home,
  },
  // TODO add a not found handler here
  //{ path: '*', component: NotFoundComponent }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router
