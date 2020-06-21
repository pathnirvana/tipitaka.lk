import Vue from 'vue'
import router from '@/router'
import { allFilterKeys, dictionaryInfo } from '@/constants.js'
import md5 from 'md5'

const routeToSearchPage = (input, type) => {
  if (!input) return
  if (['title', 'fts', 'dict'].indexOf(router.currentRoute.name) < 0) {
    router.push({ name: type })
  } else if (router.currentRoute.name != type) {
    router.replace({ name: type })
  }
}

export default {
  namespaced: true,
  state: {
    searchType: 'title',
    searchInput: '',  // search bar input

    filter: {
      'title': { 'keys': [...allFilterKeys], 'columns': [0, 1] },
      'fts': { 'keys': [...allFilterKeys], 'columns': [0, 1] },
    },
    filterTreeOpenKeys: ['sp'],
    selectedDictionaries: Object.keys(dictionaryInfo), // short names of all dictionaries

    titleSearchCache: {},
    md5SearchCache: { 'fts': {}, 'dict': {} },
    maxResults: 100,  // search stopped after getting this many matches
  },
  getters: {
    getSearchInput: (state) => state.searchInput,
    getSearchType: (state) => state.searchType,
    getFilter: (state) => (type, param) => state.filter[type][param],
    getFilterTreeOpenKeys: (state) => state.filterTreeOpenKeys,

    getMd5Cache: (state) => (type, sql) => state.md5SearchCache[type][md5(sql)],
    getTitleCache: (state) => (query) => state.titleSearchCache[query]
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
    routeToSearch(state) { routeToSearchPage(state.searchInput, state.searchType) },
    setFilter(state, { type, param, value }) {
      Vue.set(state.filter[type], param, value)
      if (type == 'title') state.titleSearchCache = {} // since filter is not part of the cache key
    },
    setFilterTreeOpenKeys(state, keys) { state.filterTreeOpenKeys = keys },

    setMd5Cache(state, { type, results, sql }) {
      // if cache size gets too big - nuke it
      if (Object.keys(state.md5SearchCache[type]).length > 300) state.md5SearchCache[type] = {}
      state.md5SearchCache[type][md5(sql)] = results // no need to Vue.set??
    },
    setTitleCache(state, { results, query }) {
      if (Object.keys(state.titleSearchCache).length > 300) state.titleSearchCache = {}
      state.titleSearchCache[query] = results
    },
    setSelectedDicts(state, newList) {
      state.selectedDictionaries = newList
    },
  },

  actions: {
    // async initialize({state, rootState, commit}) {
    //   const response = await axios.get('/static/data/searchIndex.json')
    //   const searchIndex = response.data
    //   commit('setSearchIndex', searchIndex)
    // },
  }
}
