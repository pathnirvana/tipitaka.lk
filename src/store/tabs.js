import Vue from 'vue'
import router from '@/router'
import Vuetify from '@/plugins/vuetify'
import axios from 'axios'

function addEntryFields(pages, orderedKeys, filename) { // move to vuex
  let curKey = ''
  pages.forEach((page, pi) => {
    page.pali.entries.forEach((paliEntry, ei) => {
      if (paliEntry.type == 'heading') {
        if (curKey) {
          curKey = orderedKeys[orderedKeys.indexOf(curKey) + 1] // get next key
        } else {
          curKey = filename
        }
      }
      
      const addProps = { key: curKey, eInd: [pi, ei]}
      Object.assign(paliEntry, addProps)
      paliEntry.language = 'pali'
      const sinhEntry = page.sinh.entries[ei]
      if (sinhEntry) {
        Object.assign(sinhEntry, addProps)
        sinhEntry.language = 'sinh'
      }
    })
  })
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
    getTabInfo: (state) => (ind, prop) => state.tabList[ind][prop],
    getVisiblePages: (state) => (ind) => {
      const tab = state.tabList[ind]
      if (!tab.isLoaded) return []
      return tab.data.pages.slice(tab.pageStart, tab.pageEnd)
    }
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
      state.tabList.push(params)
    },
    replaceActiveTab(state, params) {
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
    setError(state, message) {
      Vue.set(state.tabList[state.activeInd], 'errorMessage', message)
    },
    setTabInfo(state, {tabIndex, type, value}) {
      Vue.set(state.tabList[tabIndex], type, value)
    },
    loadNextPage(state, ind) {
      const tab = state.tabList[ind]
      Vue.set(tab, 'pageEnd', Math.min(tab.pageEnd + 1, tab.data.pages.length))
    },
    loadPrevPage(state, ind) {
      const tab = state.tabList[ind]
      Vue.set(tab, 'entryStart', -1) // reset it
      Vue.set(tab, 'pageStart', Math.max(0, tab.pageStart - 1))
    },
  },
  actions: {
    normalizeParams({ rootGetters }, params) {
      // cant commit anything yet since params not added to state yet
      if (!params.key) {
        params.errorMessage = `supplied tab params ${params} is missing the key`
        return
      }
      params.keyProp = rootGetters['tree/getKey'](params.key)
      if (!params.keyProp || !params.keyProp.filename) {
        params.errorMessage = `supplied tab params ${params} is missing key props`
        return
      }
      if (!params.eInd) params.eInd = [...params.keyProp.eInd]
      params.entryStart = params.eInd[1]
      params.pageEnd = params.pageStart = params.eInd[0]
      params.isLoaded = false
    },
    
    openAndSetActive({state, commit, dispatch}, params) {
      dispatch('normalizeParams', params)
      commit('openTab', params) // add params to state
      commit('setActiveInd', state.tabList.length - 1)
      dispatch('loadTextData', state.tabList.length - 1)
    },

    replaceAndSetActive({state, commit, dispatch}, params) {
      dispatch('normalizeParams', params)
      commit('replaceActiveTab', params)
      dispatch('loadTextData', state.activeInd)
    },

    async loadTextData({ state, commit, rootState, getters }, tabIndex) {
      const tabInfo = state.tabList[tabIndex]
      const newFilename = tabInfo.keyProp.filename
      if (!tabInfo.data || newFilename != tabInfo.data.filename) { // loaded file is not what is needed
        try {
          const response = await axios.get(`/static/text/${newFilename}.json`)
          const data = response.data
          if (!data.pages || !data.pages.length) {
            return commit('setError', `pages are missing in loaded data from ${newFilename}`)
          }
          addEntryFields(data.pages, rootState.tree.orderedKeys, newFilename) // add computed entries - modifies data
          Object.preventExtensions(data) // no more modification to data after this
          commit('setTabInfo', { tabIndex, type: 'data', value: data })
        } catch(e) {
          return commit('setError', `Failed to load the file ${newFilename} with error "${e.message}"`)
        }

        commit('loadNextPage', tabIndex)
        console.log(`loaded from file key:${tabInfo.key} eInd:${tabInfo.pageStart}-${tabInfo.entryStart}`)
      }
      commit('setTabInfo', { tabIndex, type: 'isLoaded', value: true })
    },

    // replace the active tab with prev/next sutta
    navigateTabTo({state, dispatch, rootState}, direction) {
      const oldKey = state.tabList[state.activeInd].key
      const newOrderInd = rootState.tree.orderedKeys.indexOf(oldKey) + direction
      if (newOrderInd < 0 || newOrderInd >= rootState.tree.orderedKeys.length) return
      const key = rootState.tree.orderedKeys[newOrderInd]
      if (!rootState.tree.index[key].filename) return // can not be opened
      console.log(`replace key ${oldKey} -> ${key}`)
      
      const oldParams = state.tabList[state.activeInd]
      dispatch('replaceAndSetActive', {...oldParams, key, eInd: null })
    },

  }
}
