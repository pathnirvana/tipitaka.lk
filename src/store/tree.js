import Vue from 'vue'
import router from '@/router'
import Vuetify from '@/plugins/vuetify'
import axios from 'axios'
import { addSpecialLetters, addBandiLetters, beautifySinh } from '@/text-convert.mjs'

// since the json tree is an object the sort order is not maintained
// need to sort the children in the correct order for the treeview
const childInd = key => parseInt(key.split('-').splice(-1)[0])
const childrenSort = (a, b) => {
  let ac, bc
  if (isNaN(ac = childInd(a.key)) || isNaN(bc = childInd(b.key))) return 0
  return ac - bc
}

// add rakar and common conjuncts
function displayName(name, lang, letterOpt) {
  if (lang == 'sinh') return beautifySinh(name)
  name = beautifySinh(name)
  if (letterOpt.specialLetters) name = addSpecialLetters(name)
  if (letterOpt.bandiLetters) name = addBandiLetters(name)
  return name
}

function genTree(key, index, depth, letterOpt) {
  let { pali, sinh, children } = index[key]
  pali = displayName(pali, 'pali', letterOpt) 
  sinh = displayName(sinh, 'sinh', letterOpt) 
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
    index: {}, // read-only
    treeView: [], // for the tree-view
    filterTree: [], // used for the search filter tree
    orderedKeys: [], // for prev/next sutta/key
    activeKey: null, // sync between treeview and tabs
    openKeys: [], // open tabs
    tabInfo: [], // info about each open tab (columns and eind)
    openBranches: ['sp'], // open in treeview
    isLoaded: false,
  },
  getters: {
    getKey: (state) => (key) => {
      return state.index[key]
    },
    getName: (state, getters, rState, rGetters) => (key) => {
      const lang = rState.treeLanguage
      const rawName = state.index[key] ? state.index[key][lang] : 'key error' // or sinh
      return displayName(rawName, lang, rState)
    },
    getTabColumns: (state, getters, rState) => {
      const activeInd = state.openKeys.indexOf(state.activeKey)
      const cols = activeInd < 0 ? rState.defaultColumns : state.tabInfo[activeInd].columns // error check
      if (Vuetify.framework.breakpoint.smAndUp) return cols // if big screen
      if (cols.length == 1) return cols
      if (rState.defaultColumns == 1) return rState.defaultColumns
      return rState.treeLanguage == 'pali' ? [0] : [1] // use the tree language to determine default column (last resort)
    },
    getTabEInd: (state) => {
      const activeInd = state.openKeys.indexOf(state.activeKey)
      return state.tabInfo[activeInd].eind
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
      Object.preventExtensions(index) // read-only not reactive - this improves perf
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
      if (router.currentRoute.params.key != key) { //pathMatch
        router.push('/' + key)
      }
    },

    openTab(state, {key, columns, eind}) {
      if (state.openKeys.indexOf(key) < 0) {
        state.openKeys.push(key)
        state.tabInfo.push({columns, eind}) 
      }
    },
    closeTab(state, key) {
      const closeInd = state.openKeys.indexOf(key)
      state.openKeys.splice(closeInd, 1)
      state.tabInfo.splice(closeInd, 1)
      // if activeKey is closed go to the first tab
      if (state.openKeys.indexOf(state.activeKey) < 0) state.activeKey = state.openKeys[0]
      // if all tabs closed - go to welcome page
      if (!state.openKeys.length) router.replace('/') 
    },
    replaceTab(state, {oldKey, key}) {
      if (state.openKeys.indexOf(key) >= 0) return; // the newkey already exists
      const ind = state.openKeys.indexOf(oldKey)
      Vue.set(state.openKeys, ind, key)
      Vue.set(state.tabInfo[ind], 'eind', null) // reset eind to 0, columns are unchanged
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
      // last element in cols is the last added col - choose that (todo use defaultColumns?)
      cols = Vuetify.framework.breakpoint.xsOnly && cols.length > 1 ? cols.slice(-1) : cols
      Vue.set(state.tabInfo[activeInd], 'columns', cols)
    },
  },
  actions: {
    // made this an action since need rootState
    openAndSetActive({rootState, commit}, {key, column, eindStr}) {
      // if no column passed in use default columns - make a copy
      const columns = !column ? [...rootState.defaultColumns] : (column == 'pali' ? [0] : [1])
      const eind = (eindStr && eindStr.split(':').length == 2) ? 
        eindStr.split(':').map(i => parseInt(i) || 0) : null
      commit('openTab', {key, columns, eind}) // open if not existing
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
      const response = await axios.get('/static/data/tree-2.json')
      const index = response.data
      commit('setIndex', index)
      commit('recomputeTree', rootState)
    }
  }
}
