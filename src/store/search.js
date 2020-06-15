import Vue from 'vue'
import router from '@/router'
import Vuetify from '@/plugins/vuetify'
import { isSinglishQuery, getPossibleMatches } from '@/singlish.js'

const routeToSearchPage = (input, type) => {
  if (!input) return
  if (['title', 'fts'].indexOf(router.currentRoute.name) < 0) {
    router.push({ name: type })
  } else if (router.currentRoute.name != type) {
    router.replace({ name: type })
  }
}
const allKeys = ["vp-prj","vp-pct","vp-mv","dn-1","dn-2","dn-3","mn-1","mn-2","mn-3","sn-1","sn-2","sn-3","sn-4","sn-5",
"an-1","an-2","an-3","an-4","an-5","an-6","an-7","an-8","an-9","an-10","an-11","kn-khp","kn-dhp","kn-ud","kn-iti","kn-snp",
"kn-vv","kn-pv","kn-thag","kn-thig","kn-jat","kn-ps","kn-ap","kn-bv","kn-cp","kn-nett","kn-petk","ap-dhs","ap-vbh","ap-kvu",
"ap-dhk","ap-pug","ap-yam","ap-pat"]
const inFilter = (key, filterKeys) => filterKeys.some(fKey => key.startsWith(fKey))

export default {
  namespaced: true,
  state: {
    searchType: 'title',
    searchInput: '',  // search bar input

    filter: {
      'title': { 'keys': [...allKeys], 'columns': [0, 1] },
      'fts': { 'keys': [...allKeys], 'columns': [0, 1] },
    },
    filterTreeOpenKeys: ['sp'],

    searchCache: {},
    maxResults: 100,  // search stopped after getting this many matches
  },
  getters: {
    getSearchInput: (state) => state.searchInput,
    getSearchType: (state) => state.searchType,
    getFilter: (state) => (type, param) => state.filter[type][param],
    getFilterTreeOpenKeys: (state) => state.filterTreeOpenKeys,
    inFilterKeys: (state) => (keys, type) => {
      if (!state.filterKeys[type].length) return keys
      return keys.filter(key => state.filterKeys[type].some(fKey => key.startsWith(fKey)))
    },

    searchDataSet: (state, getters, rState, rGetters) => (input) => {
      if (!input) return []
      if (!rState.tree.isLoaded) return []
      const query = input.toLowerCase().replace(/\u200d/g, '')

      //Check if we've searched for this term before
      let results = state.searchCache[query]
      if (results) {
          console.log(`query ${query} found in cache ${results.length} results`);
          return results
      }
      
      // Search all singlish_combinations of translations from roman to sinhala
      let words = isSinglishQuery(query) ? getPossibleMatches(query) : []
      if (!words.length) words = [query]; // if not singlish or no possible matches found
      // TODO: improve this code to ignore na na la la sha sha variations at the comparison
      results = []
      const queryReg = new RegExp(words.join('|'), "i");
      for (let i = 0; i < rState.tree.orderedKeys.length && results.length < state.maxResults; i++) {
        const { key, pali, sinh } = rState.tree.index[rState.tree.orderedKeys[i]]

        const matchPali = queryReg.test(pali) && state.filter.title.columns.indexOf(0) >= 0
        const match = matchPali || (queryReg.test(sinh) && state.filter.title.columns.indexOf(1) >= 0)
        if (match && inFilter(key, state.filter['title'].keys)) {  
          const lang = matchPali ? 'pali' : 'sinh'
          results.push({ key, lang })
        }
      }
      console.log(`query ${query} full search ${results.length} index entries`);
      state.searchCache[query] = results // dont have to be reactive
      return results
    },
  },

  mutations: {
    setSearchInput(state, input) {
      state.searchInput = input
      routeToSearchPage(input, state.searchType)
    },
    setSearchType(state, type) {
      state.searchType = type
      routeToSearchPage(state.searchInput, type)
    },
    setFilter(state, { type, param, value }) {
      Vue.set(state.filter[type], param, value)
      if (type == 'title') state.searchCache = {}
    },
    setFilterTreeOpenKeys(state, keys) { state.filterTreeOpenKeys = keys },
  },

  actions: {
    // async initialize({state, rootState, commit}) {
    //   const response = await axios.get('/static/data/searchIndex.json')
    //   const searchIndex = response.data
    //   commit('setSearchIndex', searchIndex)
    // },
  }
}
