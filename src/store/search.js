import Vue from 'vue'
import router from '@/router'
import { allFilterKeys } from '@/constants.js'
import md5 from 'md5'

const routeToSearchPage = (input, type) => {
  if (!input) return
  if (['title', 'fts'].indexOf(router.currentRoute.name) < 0) {
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

    titleSearchCache: {},
    ftsSearchCache: {},
    maxResults: 100,  // search stopped after getting this many matches
  },
  getters: {
    getSearchInput: (state) => state.searchInput,
    getSearchType: (state) => state.searchType,
    getFilter: (state) => (type, param) => state.filter[type][param],
    getFilterTreeOpenKeys: (state) => state.filterTreeOpenKeys,

    getFtsCache: (state) => (sql) => state.ftsSearchCache[md5(sql)],
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

    setFtsCache(state, {results, sql}) {
      // if cache size gets too big - nuke it
      if (Object.keys(state.ftsSearchCache).length > 300) state.ftsSearchCache = {}
      state.ftsSearchCache[md5(sql)] = results
    },
    setTitleCache(state, {results, query}) {
      if (Object.keys(state.titleSearchCache).length > 300) state.titleSearchCache = {}
      state.titleSearchCache[query] = results
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
