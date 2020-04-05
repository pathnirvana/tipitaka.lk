function genTree(key, index) {
  const { pali, sinh, children } = index[key]
  const treeItem = { pali, sinh, key }
  if (children.length) treeItem.children = children.map(cKey => genTree(cKey, index))
  return treeItem
}

export default {
  namespaced: true,
  state: {
    index: {},
    treeView: [], // for the tree-view
    activeKey: null, // sync between treeview and tabs
    openKeys: [], // open tabs
    isLoaded: false,
  },
  getters: {
    getName: (state) => (key) => {
      return state.index[key].pali // or sinh
    },
  },
  mutations: {
    setTree(state, jTree) {
      const index = { 'root': {children: []} }
      Object.keys(jTree).forEach(key => {
        let [ pali, sinh, level, eind, parent, filename ] = jTree[key]
        //if (!parent) parent = key.replace(/-\d$/,'') // remove last number
        index[key] = { pali, sinh, level, eind, parent, filename, key, children: [] }
        index[parent].children.push(key) 
      })
      
      index['root'].children.forEach(key => state.treeView.push(genTree(key, index)))
      state.index = index
      state.isLoaded = true
    },
    setActiveKey(state, key) {
      state.activeKey = key
      if (state.openKeys.indexOf(key) < 0) state.openKeys.push(key)
    },
    closeTab(state, key) {
      // allow closing the last tab?
      // change activeKey if closing the activeKey
    }
  },
  actions: {
    async load (context) {
    
    }
  }
}
