import Vue from 'vue'
import router from '@/router'
import Vuetify from '@/plugins/vuetify'
import { getJson } from '@/constants.js'

function addEntryFields(pages, orderedKeys, filename) {
  let curKey = '', cInd = 0 // cInd used for audio
  pages.forEach((page, pi) => {
    page.pali.entries.forEach((paliEntry, ei) => {
      if (paliEntry.type == 'heading') {
        if (curKey) {
          curKey = orderedKeys[orderedKeys.indexOf(curKey) + 1] // get next key
        } else {
          curKey = filename
        }
      }
      
      const addProps = { key: curKey, eInd: [pi, ei], cInd: cInd++ } 
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

const updateRoute = (newKey) => {
  if (router.currentRoute.params.key != newKey) { //pathMatch
    router.push('/' + newKey) // TODO set columns (and eInd? - might cause issues)
  }
}

export default {
  namespaced: true,
  state: {
    activeInd: -1,
    tabList: [],
    tabScrollPositions: {}, // Store scroll positions for each tab
  },

  getters: {
    getActiveTab: (state) => state.tabList[state.activeInd],
    getActiveKey: (state) => state.activeInd >= 0 ? state.tabList[state.activeInd].key : '',
    getTabColumns: (state, getters, rState) => {
      const cols = state.activeInd < 0 ? rState.defaultColumns : getters['getActiveTab'].columns // error check
      if (cols != 2 || Vuetify.framework.breakpoint.smAndUp) return cols // if big screen
      if (rState.defaultColumns != 2) return rState.defaultColumns
      return rState.treeLanguage == 'pali' ? 0 : 1 // use the tree language to determine default column (last resort)
    },
    getShowScanPage: (state) => state.tabList[state.activeInd].showScanPage,
    getIsAtta: (state) => state.tabList[state.activeInd].keyProp.filename.startsWith('atta-'),
    getTabInfo: (state) => (ind, prop) => state.tabList[ind][prop],
    getVisiblePages: (state) => (ind) => {
      const tab = state.tabList[ind]
      if (!tab.isLoaded) return []
      return tab.data.pages.slice(tab.pageStart, tab.pageEnd)
    },
    // Get saved scroll position for a tab
    getTabScrollPosition: (state) => (tabIndex) => {
      return state.tabScrollPositions[tabIndex] || 0
    },
  },

  mutations: {
    openTab(state, params) {
      state.tabList.push(params)
    },
    replaceActiveTab(state, params) {
      Vue.set(state.tabList, state.activeInd, params)
      updateRoute(params.key)
    },
    closeTab(state, closeInd) {
      // Clear scroll position when tab is closed
      Vue.delete(state.tabScrollPositions, closeInd)
      
      // Remove the tab from the list
      state.tabList.splice(closeInd, 1)
      
      // Check if there are any tabs left
      if (state.tabList.length) {
        // Still have tabs - remap scroll positions
        const newScrollPositions = {}
        Object.keys(state.tabScrollPositions).forEach(key => {
          const index = parseInt(key)
          if (index > closeInd) {
            newScrollPositions[index - 1] = state.tabScrollPositions[index]
          } else {
            newScrollPositions[index] = state.tabScrollPositions[index]
          }
        })
        state.tabScrollPositions = newScrollPositions
        
        // Update active index
        if (closeInd <= state.activeInd) {
          state.activeInd = Math.max(0, state.activeInd - 1)
        }
        updateRoute(state.tabList[state.activeInd].key)
      } else {
        // All tabs closed - clear everything and go to welcome page
        state.tabScrollPositions = {}
        state.activeInd = -1
        router.replace('/')
      }
    },
    // make an existing tab active
    setActiveInd(state, newInd) {
      state.activeInd = newInd
      updateRoute(state.tabList[state.activeInd].key)
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
    loadPrevPage(state, tabIndex) {
      const tab = state.tabList[tabIndex]
      if (tab.entryStart > 0) {
        Vue.set(tab, 'entryStart', 0) // reset it
      } else {
        Vue.set(tab, 'pageStart', Math.max(0, tab.pageStart - 1))
      }
    },
    loadNextPage(state, { tabIndex, by }) {
      const tab = state.tabList[tabIndex]
      Vue.set(tab, 'pageEnd', Math.min(tab.pageEnd + by, tab.data.pages.length))
    },
    setShowScanPage(state, val) {
      Vue.set(state.tabList[state.activeInd], 'showScanPage', val)
    },
    // Save scroll position for a tab
    saveTabScrollPosition(state, { tabIndex, scrollPosition }) {
      Vue.set(state.tabScrollPositions, tabIndex, scrollPosition)
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
      params.eInd = params.eInd || params.keyProp.eInd // TipitakaLink, eIndStr or from key
      params.entryStart = params.eInd[1]
      params.pageEnd = params.pageStart = params.eInd[0]
      params.isLoaded = false
    },
    
    async openAndSetActive({ state, commit, dispatch, rootState }, params) {
      params.showScanPage = false // set initial values
      params.columns = !params.language ? rootState.defaultColumns : Number(params.language == 'sinh')
      dispatch('normalizeParams', params)
      commit('openTab', params) // add params to state
      commit('setActiveInd', state.tabList.length - 1)
      await dispatch('loadTextData', state.tabList.length - 1)
      dispatch('tree/syncOpenBranches', false, { root: true })
      if (params.playAudio) await dispatch('audio/startEntry', params.eInd, { root: true })
    },

    replaceAndSetActive({state, commit, dispatch}, params) {
      dispatch('normalizeParams', params)
      commit('replaceActiveTab', params)
      dispatch('loadTextData', state.activeInd)
    },

    async loadTextData({ state, commit, rootState }, tabIndex) {
      const tabInfo = state.tabList[tabIndex]
      const newFilename = tabInfo.keyProp.filename
      if (!tabInfo.data || newFilename != tabInfo.data.filename) { // loaded file is not what is needed
        try {
          //const response = await axios.get(`/static/text/${newFilename}.json`)
          const data = await getJson(`/static/text/${newFilename}.json`) //response.data
          if (!data.pages || !data.pages.length) {
            return commit('setError', `pages are missing in loaded data from ${newFilename}`)
          }
          addEntryFields(data.pages, rootState.tree.orderedKeys, newFilename) // add computed entries - modifies data
          Object.preventExtensions(data) // no more modification to data/entries after this
          commit('setTabInfo', { tabIndex, type: 'data', value: data })
        } catch(e) {
          return commit('setError', `Failed to load the file ${newFilename} with error "${e.message}"`)
        }
        console.log(`loaded from file key:${tabInfo.key} eInd:${tabInfo.pageStart}-${tabInfo.entryStart}`)
      }
      commit('loadNextPage', { tabIndex, by: 2 })
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
      dispatch('replaceAndSetActive', {...oldParams, key, hWords: null })
    },

  }
}
