import Vue from 'vue'
import router from '@/router'
import { allFilterKeys, dictionaryInfo, searchSettingsKey, 
  bookmarksStorageKey, callAndroidAsync, IOS, platform } from '@/constants.js'
import md5 from 'md5'
import { isSinglishQuery, getPossibleMatches } from '@pnfo/singlish-search'
import axios from 'axios'

//ios
import { querySqlite } from '../services/sqlite-service'
import { copyDatabaseFiles } from '../services/filecopy-service'

const routeToSearchPage = (input, type) => {
  if (!input) return
  if (['title', 'fts', 'dict'].indexOf(router.currentRoute.name) < 0) {
    router.push(`/${type}/${input}`)
  } else if (router.currentRoute.name != type) {
    router.replace(`/${type}/${input}`)
  }
}

function dictWordList(input) {
	const query = input.toLowerCase().replace(/[\u200d\.,:\?\(\)“”‘’]/g, '') // remove common chars in the words
	// Search all singlish_combinations of translations from roman to sinhala
	let words = isSinglishQuery(query) ? getPossibleMatches(query) : []
	if (!words.length) words = [query]; // if not singlish or no possible matches found
	// TODO: improve this code to ignore na na la la sha sha variations at the comparison
	// for each word generate the stripEnd variation and add it
	const stripEnd = words.map(w => w.replace(/[\u0DCA-\u0DDF\u0D82\u0D83]+$/g, ''))
	// add possible vowels only if non singlish (only one word) - otherwise will be too many words
	const addVowel = !isSinglishQuery(query) ? ['ා', 'ි', 'ී', 'ු', 'ූ', 'ෙ', 'ො'].map(v => stripEnd[0] + v) : []
	return [...words, ...stripEnd, ...addVowel].filter((w, i, ar) => ar.indexOf(w) == i) // concat and remove duplicates
}

function normalizeWord(input) {
  return input.toLowerCase().replace(/[\u200d\.,:\?\(\)“”‘’]/g, '') 
}

const dbVersions = { // updated dbs need to be marked here for update in android app
  'dict': 2,
  'fts': 2
}

const storedSettings = ['filter', 'selectedDictionaries', 'searchType']
function saveSettings(state) {
  const obj = {}
  storedSettings.forEach(s => obj[s] = state[s])
  localStorage.setItem(searchSettingsKey, JSON.stringify(obj))
}

export default {
  namespaced: true,
  state: {
    searchType: 'title', // init from storage
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
    inlineDict: { show: false, wordElem: null, word: '', results: {}, exactMatch: false },
    exactMatchPage: false,

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

    isDictionaryFilterLimited: (state) => state.selectedDictionaries.length < Object.keys(dictionaryInfo).length,
  },

  mutations: {
    setSearchInput(state, input) {
      state.searchInput = input
      routeToSearchPage(input, state.searchType)
    },
    setSearchType(state, type) {
      state.searchType = type
      routeToSearchPage(state.searchInput, type)
      saveSettings(state)
    },
    routeToSearch(state) { routeToSearchPage(state.searchInput, state.searchType) },
    setFilter(state, { type, param, value }) {
      Vue.set(state.filter[type], param, value)
      if (type == 'title') state.titleSearchCache = {} // since filter is not part of the cache key
      saveSettings(state)
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
      saveSettings(state)
    },
    setExactMatchPage(state, value) {
      state.exactMatchPage = value
    },

    setInlineDict(state, { prop, value }) {
      if (prop == 'show' && !value && state.inlineDict.wordElem) {
        state.inlineDict.wordElem.classList.remove('bottom-open')
      }
      if (prop == 'wordElem' && value) {
        if (state.inlineDict.wordElem) state.inlineDict.wordElem.classList.remove('bottom-open')
        value.classList.add('bottom-open')
      }
      Vue.set(state.inlineDict, prop, value)
    },
    loadSearchSettings(state) {
      const json = localStorage.getItem(searchSettingsKey)
      if (json) {
        const storedSettings = JSON.parse(json)
        Object.assign(state, storedSettings)
        console.log(`search settings loaded from storage key ${searchSettingsKey}`)
      }
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
      commit('loadSearchSettings')
      commit('loadBookmarks')
      if (typeof Android !== 'undefined') {
        commit('set', { name: 'androidBusy', value: true }, { root: true })
        await callAndroidAsync('openDbs', dbVersions) // opens all dbs copying from assets if necessary
        commit('set', { name: 'androidBusy', value: false }, { root: true })
      }

      //The platform check can be removed if android logic is also added to sqlite-service.
      //So this file is free of platform specific details.
      //Using the same variable name androidBusy due to duplication. would be good to rename to avoid confusion.
      if (platform === IOS) {
        commit('set', { name: 'androidBusy', value: true }, { root: true })
        await copyDatabaseFiles();
        commit('set', { name: 'androidBusy', value: false }, { root: true })
      }
    },

    async openInlineDict({ commit, dispatch }, target) {
      commit('setInlineDict', { prop: 'show', value: true })
      commit('setInlineDict', { prop: 'wordElem', value: target })
      const word = target.innerText.replace(/[\.,:\?\(\)“”‘’]/g, '')
      commit('setInlineDict', { prop: 'word', value: word })
      return dispatch('runInlineDictQuery')
    },

    async runInlineDictQuery({ commit, dispatch, getters, state }) {
      commit('setInlineDict', { prop: 'queryRunning', value: true })
      commit('setInlineDict', { prop: 'errorMessage', value: '' })

      const word = state.inlineDict.word
      const exactMatch = state.inlineDict.exactMatch
      const dictList = getters['getShortDicts']

      const whereClause = exactMatch ? `WHERE word = '${normalizeWord(word)}'`
                                     : `WHERE word IN ('${dictWordList(word).join("','")}')`;

      const sql = `SELECT word, dict, meaning FROM dictionary 
                   ${whereClause} AND dict IN ('${[...dictList, 'BR'].join("','")}')
                   ORDER BY word LIMIT 50;`
      try {
        const results = await dispatch('runDictQuery', { sql, 'input': word })
        commit('setInlineDict', { prop: 'results', value: results })
      } catch (e) {
        commit('setInlineDict', { prop: 'errorMessage', value: e.message })
      }
      commit('setInlineDict', { prop: 'queryRunning', value: false })
    },

    async runPageDictQuery({ dispatch, getters }, {input, exactMatchPage}) {
      const wordsList = dictWordList(input), dictFilter = `dict IN ('${getters['getShortDicts'].join("', '")}')`

      const whereClause = exactMatchPage ? `WHERE word = '${normalizeWord(input)}'`
                                         : `WHERE word IN ('${wordsList.join("','")}')`;

      const likePrefixQuery = (wordsList.length > 100 || exactMatchPage) ? '' :
       `UNION
          SELECT word, COUNT(dict) AS num, 'like' AS meaning, 2 as priority FROM dictionary 
            WHERE (word LIKE '${wordsList.join("_%' OR word LIKE '")}_%') AND ${dictFilter}
            GROUP BY word`

      const sql = `SELECT word, dict, meaning, priority FROM (
                    SELECT word, dict, meaning, 1 as priority FROM dictionary 
                    ${whereClause} AND (${dictFilter} OR dict = 'BR')
                    ${likePrefixQuery}
                  ) combined_results ORDER BY priority, word LIMIT 50;`
      return dispatch('runDictQuery', { sql, input })
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
  } else if (platform === IOS) {
    return await querySqlite(type, sql);
  }
  //const baseUrl = 'https://tipitaka.lk' // force prod server
  //check devServer.proxy setting in vue.config.js
  const response = await axios.post('/sql-query/' + type, { type, sql }) // for js server. changed to sql-query from tipitaka-query to work
  //const response = await axios.post('/sql-query', { dbname: type + '.db', query: sql }) // for go server
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