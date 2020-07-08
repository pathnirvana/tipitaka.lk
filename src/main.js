import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import vuetify from './plugins/vuetify';
import VueMeta from 'vue-meta'
import ShareLinkIcon from '@/components/ShareLinkIcon'
import BookmarkIcon from '@/components/BookmarkIcon'

Vue.use(VueMeta)

Vue.config.productionTip = false
Vue.component('ShareLinkIcon', ShareLinkIcon) // register globally
Vue.component('BookmarkIcon', BookmarkIcon)

new Vue({
  router,
  store,
  vuetify,
  render: h => h(App)
}).$mount('#app')
