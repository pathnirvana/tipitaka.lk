import Vue from 'vue'
import router from '@/router'
import Vuetify from '@/plugins/vuetify'
import axios from 'axios'

const checkParams = (params) => {
  if (!params.key) console.error(`supplied tab params ${params} is missing the key prop`)
}

export default {
  namespaced: true,
  state: {
    activeInd: -1,
    tabList: [],
  },

  getters: {
    getActiveTab: (state) => state.tabList[state.activeInd],
    getActiveKey: (state) => state.activeInd >= 0 ? state.tabList[state.activeInd].key : '',
    getTabColumns: (state, getters, rState) => {
      const cols = state.activeInd < 0 ? rState.defaultColumns : getters['getActiveTab'].columns // error check
      if (cols.length == 1 || Vuetify.framework.breakpoint.smAndUp) return cols // if big screen
      if (rState.defaultColumns.length == 1) return rState.defaultColumns
      return rState.treeLanguage == 'pali' ? [0] : [1] // use the tree language to determine default column (last resort)
    },
  },

  mutations: {
    // make an existing tab active
    setActiveInd(state, newInd) {
      state.activeInd = newInd
      const newKey = state.tabList[state.activeInd].key
      if (router.currentRoute.params.key != newKey) { //pathMatch
        router.push('/' + newKey) // TODO set columns (and eInd? - might cause issues)
      }
    },

    openTab(state, params) {
      checkParams(params)
      state.tabList.push(params)
    },
    replaceActiveTab(state, params) {
      checkParams(params)
      Vue.set(state.tabList, state.activeInd, params)
    },
    closeTab(state, closeInd) {
      state.tabList.splice(closeInd, 1)
      // if activeInd or lower is closed decrement activeInd
      if (state.activeInd >= closeInd) state.activeInd-- // TODO check if route is updated
      // if all tabs closed - go to welcome page
      if (!state.tabList.length) router.replace('/') 
    },

    setTabColumns(state, cols) {
      Vue.set(state.tabList[state.activeInd], 'columns', cols)
    },
  },
  actions: {
    // made this an action since need rootState
    openAndSetActive({state, commit}, params) {
      commit('openTab', params)
      commit('setActiveInd', state.tabList.length - 1) // TODO should remove
    },

    replaceAndSetActive({state, commit}, params) {
      commit('replaceActiveTab', params)
    },

    // replace the active tab with prev/next sutta
    navigateTabTo({state, commit, rootState}, direction) {
      const oldKey = state.tabList[state.activeInd].key
      const newOrderInd = rootState.tree.orderedKeys.indexOf(oldKey) + direction
      if (newOrderInd < 0 || newOrderInd >= rootState.tree.orderedKeys.length) return
      const key = rootState.tree.orderedKeys[newOrderInd]
      if (!rootState.tree.index[key].filename) return // can not be opened
      console.log(`replace key ${oldKey} -> ${key}`)
      
      const oldParams = state.tabList[state.activeInd]
      commit('replaceActiveTab', {...oldParams, key, eInd: null })
    },

  }
}
