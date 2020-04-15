import Vue from 'vue'
import router from '@/router'
import Vuetify from '@/plugins/vuetify'
import { isSinglishQuery, getPossibleMatches } from '@/singlish.js'

/* simple function to prefer shorter matches that occur more frequently */
function computeScore(matchLen, queryLen, numKeys) {
  // range 1 - 0.25 to 1 - 0.5
  return (1 - 0.05 * Math.min(Math.max(5, matchLen), 10)) * numKeys
}

const searchBarRules = [
  v => !!v || 'please enter sutta name',
  v => v.length >= 3 || 'අඩුම තරමේ අකුරු 3 ක් වත් ඇතුළු කරන්න.',
  v => (!isSinglishQuery(v) || v.length <= 10) || 'සිංග්ලිෂ් වලින් සෙවීමේ දී උපරිමය අකුරු 10 කට සීමා කර ඇත.',
  v => v.length <= 25 || 'උපරිම දිග අකුරු 25',
  v => !(/[^A-Za-z\u0D80-\u0DFF\u200D]/.test(v)) || 'සෙවුම් පදය සඳහා ඉංග්‍රීසි සහ සිංහල අකුරු පමණක් යොදන්න.',
]

export default {
  namespaced: true,
  state: {
    searchIndex: [],
    isLoaded: false,
    searchCache: {},
    filterKeys: ['dn-1', 'sn'],
    minQueryLength: 2,
    maxSinglishLength: 10,
    maxResults: 100,  // search stopped after getting this many matches
  },
  getters: {
    inFilterKeys: (state) => (keys) => {
      if (!state.filterKeys.length) return keys
      return keys.filter(key => state.filterKeys.some(fKey => key.startsWith(fKey)))
    },
    getSearchResults: (state, getters, rState, rGetters) => (input) => {
      if (!input || !state.isLoaded) return ['not loaded']
      const query = input.toLowerCase()
      const results = getters.searchDataSet(query)
      return results.map(res => res[1]).flat().map(key => [key, rGetters['tree/getName'](key)])
    },
    
    getSuggestions: (state, getters, rState, rGetters) => (input) => {
      if (!input) return []
      if (!state.isLoaded) return [{ name: 'search index not loaded - wait', disabled: true }]
      const query = input.toLowerCase()
      for (let rule of searchBarRules) {
          const val = rule(query)
          if (val !== true) return [{ name: val, disabled: true }]
      }
  
      const results = getters.searchDataSet(query)
  
      // extract text for each index and sort based on pali text
      // compute score for sorting
      return results.map(([i, keys]) => ({ 
          name: keys.length == 1 ? rGetters['tree/getName'](keys[0]) : state.searchIndex[i][0], 
          score: computeScore(state.searchIndex[i][0].length, query.length, keys.length),
          keys, // key occurances in filter
          path: keys.length == 1 ? keys[0] : ('search/' + state.searchIndex[i][0]),
      })).sort((a, b) => b.score - a.score) // descending order
    },

    searchDataSet: (state, getters) => (query) => {
      //Check if we've searched for this term before
      let results = state.searchCache[query]
      if (results) {
          console.log(`query ${query} found in cache ${results.length} results`);
          return results;
      }
      
      // Search all singlish_combinations of translations from roman to sinhala
      let words = isSinglishQuery(query) ? getPossibleMatches(query) : [];
      if (!words.length) words = [query]; // if not singlish or no possible matches found
      // TODO: improve this code to ignore na na la la sha sha variations at the comparison
      results = []
      const queryReg = new RegExp(words.join('|'), "i");
      for (let i = 0; i < state.searchIndex.length && results.length < state.maxResults; i++) {
          if (queryReg.test(state.searchIndex[i][0])) {
              const filteredKeys = getters.inFilterKeys(state.searchIndex[i][1])
              if (filteredKeys.length) results.push([i, filteredKeys]);
          }
      }
      console.log(`query ${query} full search ${results.length} results`);
      state.searchCache[query] = results // dont have to be reactive
      return results
    },
  },

  mutations: {
    setIndex(state, index) { 
      state.searchIndex = index
      state.isLoaded = true
    },
  },

  actions: {
    async initialize({state, rootState, commit}) {
      const response = await fetch('/data/searchIndex.json')
      const searchIndex = await response.json()
      commit('setIndex', searchIndex)
    },
  }
}
