import Vue from 'vue'
import Vuex from 'vuex'

import tree from './tree.js'
Vue.use(Vuex)

export default new Vuex.Store({
  modules: {
    tree,
  },

  state: {
    columns: [0, 1],
  },
  
  mutations: {
    setColumns(state, columns) {
      state.columns = columns
    }
  },
  
  actions: {
    initialize({commit}) {
      
    },
  },
  
})
