import Vue from 'vue'
import router from '@/router'
import { allFilterKeys, dictionaryInfo, bookmarksStorageKey, callAndroidAsync } from '@/constants.js'
import md5 from 'md5'
import { dictWordList } from '../singlish'
import axios from 'axios'

const routeToSearchPage = (input, type) => {
  if (!input) return
  if (['title', 'fts', 'dict'].indexOf(router.currentRoute.name) < 0) {
    router.push(`/${type}/${input}`)
  } else if (router.currentRoute.name != type) {
    router.replace(`/${type}/${input}`)
  }
}

const dbVersions = { // updated dbs need to be marked here for update in android app
  'dict': 1,
  'fts': 1
}

export default {
  namespaced: true,
  state: {
    searchType: '', // init from rootState.lastSearchType
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
    bottomSheet: { show: false, wordElem: null, word: '', results: {} },

    bookmarks: {}, // loaded from localStorage
  },

  getters: {
    getSearchInput: (state) => state.searchInput,
    getSearchType: (state) => state.searchType,
    getFilter: (state) => (type, param) => state.filter[type][param],
    getFilterTreeOpenKeys: (state) => state.filterTreeOpenKeys,

    getMd5Cache: (state) => (type, sql) => state.md5SearchCache[type][md5(sql)],
    getTitleCache: (state) => (query) => state.titleSearchCache[query],
    getShortDicts: (state) => state.selectedDictionaries.map(dict => dictionaryInfo[dict][1]),
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
    setBottomSheet(state, { prop, value }) {
      if (prop == 'show' && !value && state.bottomSheet.wordElem) {
        state.bottomSheet.wordElem.classList.remove('bottom-open')
      }
      if (prop == 'wordElem' && value) {
        if (state.bottomSheet.wordElem) state.bottomSheet.wordElem.classList.remove('bottom-open')
        value.classList.add('bottom-open')
      }
      Vue.set(state.bottomSheet, prop, value)
    },

    loadBookmarks(state) {
      const json = localStorage.getItem(bookmarksStorageKey)
      if (json) {
        state.bookmarks = JSON.parse(json)
        console.log(`loaded ${Object.keys(state.bookmarks).length} bookmarks from storage key ${bookmarksStorageKey}`)
      }
    },
    toggleBookmark(state, { key, obj }) {
      if (state.bookmarks[key]) {
        Vue.delete(state.bookmarks, key)
      } else {
        Vue.set(state.bookmarks, key, obj)
      }
      localStorage.setItem(bookmarksStorageKey, JSON.stringify(state.bookmarks))
    },
  },

  actions: {
    async initialize({state, rootState, commit}) {
      commit('loadBookmarks')
      commit('setSearchType', rootState.lastSearchType) // last user selected value
      if (typeof Android !== 'undefined') {
        commit('set', { name: 'androidBusy', value: true }, { root: true })
        await callAndroidAsync('openDbs', dbVersions) // opens all dbs copying from assets if necessary
        commit('set', { name: 'androidBusy', value: false }, { root: true })
      }
    },

    async openBottomSheet({ commit, dispatch }, target) {
      commit('setBottomSheet', { prop: 'show', value: true })
      commit('setBottomSheet', { prop: 'wordElem', value: target })
      const word = target.innerText.replace(/[\.,:\?\(\)“”‘’]/g, '')
      commit('setBottomSheet', { prop: 'word', value: word })
      return dispatch('runBottomWordQuery')
    },

    async runBottomWordQuery({ commit, dispatch, getters, state }) {
      commit('setBottomSheet', { prop: 'queryRunning', value: true })
      commit('setBottomSheet', { prop: 'errorMessage', value: '' })
      const word = state.bottomSheet.word
      const dictList = getters['getShortDicts']
      const sql = `SELECT word, dict, meaning FROM dictionary 
        WHERE word IN ('${dictWordList(word).join("','")}') AND dict IN ('${[...dictList, 'BR'].join("','")}')
        ORDER BY word LIMIT 50;`
      try {
        const results = await dispatch('runDictQuery', { sql, 'input': word })
        commit('setBottomSheet', { prop: 'results', value: results })
      } catch (e) {
        commit('setBottomSheet', { prop: 'errorMessage', value: e.message })
      }
      commit('setBottomSheet', { prop: 'queryRunning', value: false })
    },

    // no error checking - callers must call within a try-catch
    async runDictQuery({ commit, getters }, { sql, input }) {
      // check if we've searched for this word before
      const cachedRes = getters['getMd5Cache']('dict', sql)
      if (cachedRes) {
        console.log(`dict search '${input}' found in cache ${cachedRes.matches.length} matches.`);
        return cachedRes
      }

      const data = await sendSearchQuery('dict', sql)
      console.log(`received dict response with ${data.length} rows for query ${input}`)
      const results = processDictRows(data)
      commit('setMd5Cache', { type: 'dict', sql, results })
      return results
    },

    async runFTSQuery({ getters, commit }, { sql, input }) {
      const cachedRes = getters['getMd5Cache']('fts', sql)
      if (cachedRes) {
        console.log(`received fts results with ${cachedRes.length} from fts cache`)
        return cachedRes
      }

      const data = await sendSearchQuery('fts', sql)
      console.log(`received fts response with ${data.length} rows for query ${input}`)
      commit('setMd5Cache', { type: 'fts', sql, results: data })
      return data
    },
  }
}

async function sendSearchQuery(type, sql) {
  if (typeof Android !== 'undefined') {
    const jsonStr = await callAndroidAsync('runSqliteQuery', { type, sql })
    return JSON.parse(jsonStr)
  }
  //const baseUrl = process.env.NODE_ENV == 'development' ? 'http://192.168.1.107:5555' : ''
  //const baseUrl = 'https://tipitaka.lk' // force prod server
  // check devServer.proxy setting in vue.config.js
  const response = await axios.post('/tipitaka-query/' + type, { type, sql })
  return response.data
}

function processDictRows(rows) {
  const matches = rows.filter(({ dict, meaning }) => dict != 'BR' && meaning != 'like')
  const breakups = rows.filter(({ dict }) => dict == 'BR').map(({ word, meaning }) => {
    const [type, breakup] = meaning.split('|')
    return { word, type, breakup }
  })
  const matchedWords = matches.map(r => r.word)
  const prefixWords = rows.filter(r => r.meaning == 'like' && matchedWords.indexOf(r.word) < 0)
        .sort((a, b) => a.dict > b.dict)
  return { breakups, matches, prefixWords }
}