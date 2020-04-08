import Vue from 'vue'
import router from '@/router'
import Vuetify from '@/plugins/vuetify'

// since the json tree is an object the sort order is not maintained
// need to sort the children in the correct order for the treeview
const childInd = key => parseInt(key.split('-').splice(-1)[0])
const childrenSort = (a, b) => {
  let ac, bc
  if (isNaN(ac = childInd(a.key)) || isNaN(bc = childInd(b.key))) return 0
  return ac - bc
}
function genTree(key, index) {
  const { pali, sinh, children } = index[key]
  const treeItem = { pali, sinh, key }
  if (children.length) treeItem.children = children.map(cKey => genTree(cKey, index)).sort(childrenSort)
  return treeItem
}

export default {
  namespaced: true,
  state: {
    index: {},
    treeView: [], // for the tree-view
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
    getName: (state) => (key) => {
      return state.index[key].pali // or sinh
    },
    getTabColumns: (state) => {
      const activeInd = state.openKeys.indexOf(state.activeKey)
      const cols = state.tabColumns[activeInd]
      if (!cols) return cols
      return Vuetify.framework.breakpoint.smAndUp ? cols : cols.slice(-1) // todo get preffered from settings
    },
  },
  mutations: {
    setTree(state, jTree) {
      const index = { 'root': {children: []} }
      Object.keys(jTree).forEach(key => {
        let [ pali, sinh, level, eind, parent, filename ] = jTree[key]
        index[key] = { pali, sinh, level, eind, parent, filename, key, children: [] }
        index[parent].children.push(key) 
      })
      
      state.treeView = []
      index['root'].children.forEach(key => state.treeView.push(genTree(key, index)))
      state.index = index
      state.isLoaded = true
    },
    
    /*openKey(state, key) { 
      if (state.openKeys.indexOf(key) < 0) state.openKeys.push(key)
    },*/
    setActiveKey(state, {key, columns}) {
      state.activeKey = key
      if (state.openKeys.indexOf(key) < 0) {
        state.openKeys.push(key)
        state.tabColumns.push([...columns]) // default columns - make a copy
      }
    },
    closeKey(state, key) {
      // change activeKey if closing the activeKey
      if (state.activeKey == key) router.back() // this will also set the activeKey
      const closeInd = state.openKeys.indexOf(key)
      state.openKeys.splice(closeInd, 1)
      state.tabColumns.splice(closeInd, 1)
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
    setActiveKey({rootState, commit}, key) { // made this an action since need rootState
      if (!key) return
      commit('setActiveKey', {key, columns: rootState.columns})
      if (router.currentRoute.params.pathMatch != key) {
        router.push('/' + key)
      }
    },

    async load (context) {
    
    }
  }
}
