import Vue from 'vue'
import router from '@/router'
import Vuetify from '@/plugins/vuetify'
import { isSinglishQuery, getPossibleMatches } from '@/singlish.js'
import axios from 'axios'

/* simple function to prefer shorter matches that occur more frequently */
function computeScore(matchLen, queryLen, numKeys) {
  // range 1 - 0.25 to 1 - 0.5
  return (1 - 0.05 * Math.min(Math.max(5, matchLen), 10)) * numKeys
}

const routeToSearchPage = (state) => {
  if (!state.searchInput) return
  if (['title', 'fts'].indexOf(router.currentRoute.name) < 0) {
    router.push({ name: state.searchType })
  } else if (router.currentRoute.name != state.searchType) {
    router.replace({ name: state.searchType })
  }
}

const inFilter = (key, filterKeys) => filterKeys.some(fKey => key.startsWith(fKey))

export default {
  namespaced: true,
  state: {
    searchType: 'title',
    searchInput: '',  // search bar input

    searchIndex: [],
    isLoaded: false,
    searchCache: {},

    filterColumns: [0, 1],
    filterKeys: {
      'title': ['vp', 'sp', 'ap'],
      'fts': ['vp', 'sp', 'ap'],
    },
    filterTreeOpenKeys: ['sp'],

    maxResults: 100,  // search stopped after getting this many matches
  },
  getters: {
    getSearchInput: (state) => state.searchInput,
    getSearchType: (state) => state.searchType,
    getFilterColumns: (state) => state.filterColumns,
    getFilterKeys: (state) => (type) => state.filterKeys[type],
    getFilterTreeOpenKeys: (state) => state.filterTreeOpenKeys,
    inFilterKeys: (state) => (keys, type) => {
      if (!state.filterKeys[type].length) return keys
      return keys.filter(key => state.filterKeys[type].some(fKey => key.startsWith(fKey)))
    },
    // getSearchResults: (state, getters, rState, rGetters) => (input) => {
    //   if (!input || !state.isLoaded) return [['vp', 'search index not loaded - wait']]
    //   const query = input.toLowerCase()
    //   const results = getters.searchDataSet(query)
    //   return results.map(res => res[1]).flat() // this will increase the size of array beyond maxResults
    //     .slice(0, state.maxResults) // remove extra from flatting above
    //     .filter((elem, pos, arr) => arr.indexOf(elem) == pos) // dedup
    //     //.map(key => [key, rGetters['tree/getName'](key)]) // key and name
    // },
    
    // getSuggestions: (state, getters, rState, rGetters) => (input) => {

  
    //   // extract text for each index and sort based on pali text
    //   // compute score for sorting
    //   return results.map(([i, key, lang]) => ({ 
    //       name: keys.length == 1 ? rGetters['tree/getName'](keys[0]) : state.searchIndex[i][0],
    //       score: computeScore(state.searchIndex[i][0].length, query.length, keys.length),
    //       keys, // key occurances in filter
    //       path: keys.length == 1 ? keys[0] : ('search/' + state.searchIndex[i][0]),
    //   })).sort((a, b) => b.score - a.score) // descending order
    // },

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

        if ((queryReg.test(pali) || queryReg.test(sinh)) && inFilter(key, state.filterKeys['title'])) {  
          const lang = queryReg.test(pali) ? 'pali' : 'sinh'
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
      routeToSearchPage(state)
    },
    setSearchType(state, type) {
      state.searchType = type
      routeToSearchPage(state)
    },
    setFilterKeys(state, { type, keys }) {
      Vue.set(state.filterKeys, type, keys)
      if (type == 'title') state.searchCache = {}
    },
    setFilterColumns(state, cols) { state.filterColumns = cols },
    setFilterTreeOpenKeys(state, keys) { state.filterTreeOpenKeys = keys },
    setSearchIndex(state, index) {
      Object.preventExtensions(index) // readonly does not have to be reactive - improves perf
      state.searchIndex = index
      state.isLoaded = true
    },
  },

  actions: {
    async initialize({state, rootState, commit}) {
      const response = await axios.get('/static/data/searchIndex.json')
      const searchIndex = response.data
      commit('setSearchIndex', searchIndex)
    },
  }
}
