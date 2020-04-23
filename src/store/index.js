import Vue from 'vue'
import Vuex from 'vuex'
import Vuetify from '@/plugins/vuetify'

import tree from './tree.js'
import search from './search.js'
Vue.use(Vuex)

const settingsVersion = '1', settingsKey = `tipitaka.lk-settings-${settingsVersion}`
const storedSettings = ['darkMode', 'defaultColumns', 'treeLanguage', 
  'footnoteMethod', 'bandiLetters', 'specialLetters', 'showPageNumbers', 'fontSize']
function saveSettings(state) {
  const obj = {}
  storedSettings.forEach(s => obj[s] = state[s])
  localStorage.setItem(settingsKey, JSON.stringify(obj))
}

export default new Vuex.Store({
  modules: {
    tree,
    search,
  },

  state: {
    darkMode: false,
    defaultColumns: [0, 1],
    treeLanguage: 'pali',
    footnoteMethod: Vuetify.framework.breakpoint.smAndDown ? 'click' : 'hover',
    bandiLetters: true,
    specialLetters: false,
    showPageNumbers: true,
    fontSize: 0,
    isLoaded: false,
    snackbar: {model: false, timeout: 1000, message: ''},
  },

  getters: {
    isLoaded: (state) => {
      return state.isLoaded && state.tree.isLoaded && state.search.isLoaded
    },
  },
  
  mutations: {
    set(state, {name, value}) {
      state[name] = value
      if (name == 'darkMode') Vuetify.framework.theme.dark = state.darkMode
      if (storedSettings.indexOf(name) >= 0) saveSettings(state)
    },
    loadSettings(state) {
      const json = localStorage.getItem(settingsKey)
      if (json) {
        const storedSettings = JSON.parse(json)
        Object.assign(state, storedSettings)
        console.log(`settings loaded from storage key ${settingsKey}`)
      }
      Vuetify.framework.theme.dark = !!state.darkMode // set the dark mode
      state.isLoaded = true
    },
    setSnackbar(state, {timeout, message}) {
      if (message) {
        state.snackbar = { model: true, timeout: timeout || 1000, message }
      }
    },
  },
  
  actions: {
    initialize({commit}) {
      // read settings from local storage
      commit('loadSettings')
    },
  },
  
})
