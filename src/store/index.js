import Vue from 'vue'
import Vuex from 'vuex'

import tree from './tree.js'
Vue.use(Vuex)

export default new Vuex.Store({
  modules: {
    tree,
  },

  state: {
  },
  
  mutations: {
  },
  
  actions: {
    initialize({commit}) {
      fetch('data/tree.json')
        .then(response => response.json())
        .then(tree => {
          commit('setTree', tree)
      })
    },
  },
  
})
