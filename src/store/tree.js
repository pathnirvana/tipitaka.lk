import Vue from 'vue'
import router from '@/router'
import Vuetify from '@/plugins/vuetify'
import { addSpecialLetters, addBandiLetters, beautifySinh } from '@/text-convert.mjs'

// since the json tree is an object the sort order is not maintained
// need to sort the children in the correct order for the treeview
const childInd = key => parseInt(key.split('-').splice(-1)[0])
const childrenSort = (a, b) => {
  let ac, bc
  if (isNaN(ac = childInd(a.key)) || isNaN(bc = childInd(b.key))) return 0
  return ac - bc
}

function genTree(key, index, depth, letterOpt) {
  let { pali, sinh, children } = index[key]
  pali = beautifySinh(pali) // add rakar and common conjuncts
  sinh = beautifySinh(sinh)
  if (letterOpt.specialLetters) pali = addSpecialLetters(pali)
  if (letterOpt.bandiLetters) pali = addBandiLetters(pali)
  const treeItem = { pali, sinh, key }
  if (children.length && depth > 0) {
    treeItem.children = children.map(cKey => genTree(cKey, index, depth - 1, letterOpt)).sort(childrenSort)
  }
  return treeItem
}

function addOrder(treeItem, list) {
  list.push(treeItem.key)
  if (treeItem.children) treeItem.children.forEach(child => addOrder(child, list))
}

export default {
  namespaced: true,
  state: {
    index: {},
    treeView: [], // for the tree-view
    filterTree: [], // used for the search filter tree
    orderedKeys: [], // for prev/next sutta/key
    activeKey: null, // sync between treeview and tabs
    openKeys: [], // open tabs
    tabColumns: [], // columns for each open tab
    openBranches: ['sp'], // open in treeview
    isLoaded: false,
  },
  getters: {
    getKey: (state) => (key) => {
      return state.index[key]
    },
    getName: (state, getters, rState, rGetters) => (key) => {
      const lang = rState.treeLanguage
      return state.index[key] ? state.index[key][lang] : 'key error' // or sinh
    },
    getTabColumns: (state) => {
      const activeInd = state.openKeys.indexOf(state.activeKey)
      const cols = state.tabColumns[activeInd]
      if (!cols) return cols
      return Vuetify.framework.breakpoint.smAndUp ? cols : cols.slice(-1) // todo get preffered from settings
    },
  },
  mutations: {
    setIndex(state, jTree) {
      const index = { 'root': {children: []} }
      Object.keys(jTree).forEach(key => {
        let [ pali, sinh, level, eind, parent, filename ] = jTree[key]
        index[key] = { pali, sinh, level, eind, parent, filename, key, children: [] }
        index[parent].children.push(key) 
      })
      state.index = index
    },

    recomputeTree(state, letterOpt) { // when bandiLetter settings are changed
      state.isLoaded = false
      state.treeView = []
      state.filterTree = []
      state.index['root'].children.forEach(
        key => state.treeView.push(genTree(key, state.index, 100, letterOpt)))
      state.index['root'].children.forEach(
        key => state.filterTree.push(genTree(key, state.index, 2, letterOpt))) // max two levels
      // gen order list
      state.treeView.forEach(child => addOrder(child, state.orderedKeys))
      state.isLoaded = true
    },

    // make existing tab active
    setActiveKey(state, key) {
      state.activeKey = key
      if (router.currentRoute.params.pathMatch != key) {
        router.push('/' + key)
      }
    },

    openTab(state, {key, columns}) {
      if (state.openKeys.indexOf(key) < 0) {
        state.openKeys.push(key)
        state.tabColumns.push([...columns]) // default columns - make a copy
      }
    },
    closeTab(state, key) {
      const closeInd = state.openKeys.indexOf(key)
      state.openKeys.splice(closeInd, 1)
      state.tabColumns.splice(closeInd, 1)
      // if activeKey is closed go to the first tab
      if (state.openKeys.indexOf(state.activeKey) < 0) state.activeKey = state.openKeys[0]
      // if all tabs closed - go to welcome page
      if (!state.openKeys.length) router.replace('/') 
    },
    replaceTab(state, {oldKey, key}) {
      if (state.openKeys.indexOf(key) >= 0) return; // the newkey already exists
      const ind = state.openKeys.indexOf(oldKey)
      Vue.set(state.openKeys, ind, key)
    },


    setOpenBranches(state, ar) {
      state.openBranches = ar
    },
    closeAllBranches(state) {
      state.openBranches = []
    },
    syncOpenBranches(state, key) { // open branches to key - show key in treeview
      let p = key, parents = []
      while((p = state.index[p].parent) != 'root') {
        parents.push(p)
      }
      state.openBranches = parents
    },

    setTabColumns(state, cols) {
      const activeInd = state.openKeys.indexOf(state.activeKey)
      // last element in cols is the last added col - choose that
      cols = Vuetify.framework.breakpoint.xsOnly && cols.length > 1 ? cols.slice(-1) : cols
      Vue.set(state.tabColumns, activeInd, cols)
    },
  },
  actions: {
    // made this an action since need rootState
    openAndSetActive({rootState, commit}, key) {
      commit('openTab', {key, columns: rootState.columns}) // open if not existing
      commit('setActiveKey', key)
    },

    // replace the active tab with prev/next sutta
    navigateTabTo({state, commit}, direction) {
      const newOrderInd = state.orderedKeys.indexOf(state.activeKey) + direction
      if (newOrderInd < 0 || newOrderInd >= state.orderedKeys.length) return;
      const key = state.orderedKeys[newOrderInd]
      if (!state.index[key].filename) return; // can not be opened
      console.log(`replace key ${state.activeKey} -> ${key}`)

      commit('replaceTab', {oldKey: state.activeKey, key})
      commit('setActiveKey', key)
    },

    async initialize({commit, rootState}) {
      const response = await fetch('/data/tree.json')
      const index = await response.json()
      commit('setIndex', index)
      commit('recomputeTree', rootState)
    }
  }
}
