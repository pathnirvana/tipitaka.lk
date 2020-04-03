function genTree(key, index) {
  const { name, children } = index[key]
  const treeItem = { name, key }
  if (children.length) treeItem.children = children.map(cKey => genTree(cKey, index))
  return treeItem
}

export default {
  //namespaced: true,
  state: {
    index: {},
    items: [], // for the tree-view
    activeKeys: [], // open keys - sync between treeview and tabs
    isLoaded: false,
  },
  getters: {
    getName: (state) => (key) => {
      return state.index[key].name
    },
  },
  mutations: {
    setTree(state, jTree) {
      const index = {}, items = [], rootKeys = []
      Object.keys(jTree).forEach(key => {
        let [ name, level, parent ] = jTree[key]
        if (!parent) parent = key.replace(/-\d$/,'') // remove last number
        index[key] = { name, key, level, parent, children: [] }
        if (parent != 'root') {
          index[parent].children.push(key) 
        } else {
          rootKeys.push(key)
        }
      })
      
      rootKeys.forEach(key => items.push(genTree(key, index)))
      state.index = index
      state.items = items
      state.isLoaded = true
    },
    setActiveKeys(state, keys) {
      state.activeKeys = keys
    },
  },
  actions: {
    async load (context) {
    
    }
  }
}
