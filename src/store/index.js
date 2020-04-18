import Vue from 'vue'
import Vuex from 'vuex'

import tree from './tree.js'
import search from './search.js'
Vue.use(Vuex)

export default new Vuex.Store({
  modules: {
    tree,
    search,
  },

  state: {
    columns: [0, 1],
    treeLanguage: 'pali',
    footnoteMethod: 'show-end',
    bandiLetters: true,
    specialLetters: false,
    showPageNumbers: true,
    fontSize: 0,
    isLoaded: false,
  },

  getters: {
    isLoaded: (state) => {
      return state.isLoaded && state.tree.isLoaded && state.search.isLoaded
    },
  },
  
  mutations: {
    setColumns(state, columns) {
      state.columns = columns
    },
    set(state, {name, value}) {
      state[name] = value
    },
    setSettings(state) {
      state.isLoaded = true
    },
  },
  
  actions: {
    initialize({commit}) {
      // read settings from local storage
      commit('setSettings')
    },
  },
  
})
