import { getJson } from '@/constants.js'
import { beautifyText } from '@/text-convert.mjs'
import Vue from 'vue'

// since the json tree is an object the sort order is not maintained
// need to sort the children in the correct order for the treeview
const childInd = key => parseInt(key.split('-').splice(-1)[0])
const childrenSort = (a, b) => {
  let ac, bc
  if (isNaN(ac = childInd(a.key)) || isNaN(bc = childInd(b.key))) return 0
  return ac - bc
}

function genTree(key, index, keyLen, letterOpt) {
  let { pali, sinh, children } = index[key]
  pali = beautifyText(pali, 'pali', letterOpt) 
  sinh = beautifyText(sinh, 'sinh', letterOpt) 
  const treeItem = { pali, sinh, key }
  if (children.length && key.split('-').length < keyLen) {
    treeItem.children = children.map(cKey => genTree(cKey, index, keyLen, letterOpt)).sort(childrenSort)
  }
  return treeItem
}

function addOrder(treeItem, list) {
  list.push(treeItem.key)
  if (treeItem.children) treeItem.children.forEach(child => addOrder(child, list))
}

const isEIndLessEqual = (a, b) => a[0] < b[0] || (a[0] == b[0] && a[1] <= b[1])

export default {
  namespaced: true,
  state: {
    index: {}, // read-only
    treeView: [], // for the tree-view
    filterTree: [], // used for the search filter tree
    orderedKeys: [], // for prev/next sutta/key
    
    openBranches: ['sp'], // open in treeview
    isLoaded: false,
  },
  getters: {
    getKey: (state) => (key) => {
      return state.index[key]
    },
    getName: (state, getters, rState, rGetters) => (key, language) => {
      const lang = language || rState.treeLanguage
      const rawName = state.index[key] ? state.index[key][lang] : 'key error' // or sinh
      return beautifyText(rawName, lang, rState)
    },

    getKeyForEInd: (state) => (filename, eInd) => {
      let i = state.orderedKeys.length - 1
      for (; i >= 0; i--) { // loop in reverse order
        const item = state.index[state.orderedKeys[i]]
        if (item.filename == filename && isEIndLessEqual(item.eInd, eInd)) break
      }
      return i >= 0 ? state.orderedKeys[i] : ''
    },
  },
  mutations: {
    setIndex(state, jTree) {
      const index = { 'root': {children: []} }
      Object.keys(jTree).forEach(key => {
        let [ pali, sinh, level, eInd, parent, filename ] = jTree[key]
        index[key] = { pali, sinh, level, eInd, parent, filename, key, children: [] }
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
        key => state.treeView.push(genTree(key, state.index, 10, letterOpt)))
      state.index['root'].children.forEach(
        key => state.filterTree.push(genTree(key, state.index, 2, letterOpt))) // max two levels
      // gen order list
      state.treeView.forEach(child => addOrder(child, state.orderedKeys))
      state.isLoaded = true
    },

    setOpenBranches(state, ar) {
      state.openBranches = ar
    },
    closeAllBranches(state) {
      state.openBranches = []
    },
  },

  actions: {
    async initialize({commit, rootState}) {
      //const response = await axios.get('/static/data/tree.json')
      const index = await getJson('/static/data/tree-new.json') //response.data
      commit('setIndex', index)
      commit('recomputeTree', rootState)
    },

    syncOpenBranches({ state, commit, rootState, rootGetters }, force) { // open branches to key - show key in treeview
      if (!force && !rootState.syncTree) return
      let p = rootGetters['tabs/getActiveKey'], parents = []
      while((p = state.index[p].parent) != 'root') {
        parents.push(p)
      }
      commit('setOpenBranches', parents)
      Vue.nextTick(function() {
        const container = document.getElementsByClassName('v-navigation-drawer__content')[0]
        container.scrollTop = document.getElementById('activelabel').offsetParent.offsetTop - 100
      })
    },
  }
}
