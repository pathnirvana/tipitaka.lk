import { getJson, entryToKeyStr } from '@/constants.js'
import Vue from 'vue'
import store from '@/store'
import axios from 'axios'

const audio = new Audio()
audio.onplay = () => {  store.commit('audio/setPlaying', true) };
audio.onerror = audio.onpause = audio.onended = () => store.commit('audio/setPlaying', false);
audio.ondurationchange = () => store.commit('audio/setDuration', audio.duration)
audio.ontimeupdate = () => store.dispatch('audio/timeUpdated', audio.currentTime)

// function entryToSrc(entry, data) {
//   // first determine src, if src different from current src load labels as well
//   const page = data.pages[entry.eInd[0]],
//     fileBase = `${data.bookId}-${Math.floor(page.pageNum / 100) * 100}`, // 100 pages per file
//     audioSrc = `/audio/vbr aac 32h 24k he v2.m4a`,//${fileBase}.m4a`, 
//     labelSrc = `/audio/${fileBase}.txt`
  
//   return { audioSrc, labelSrc }
// }
async function loadLabels(src) {
  const response = await axios.get(src + '.txt');
  
  return response.data.split('\r\n').slice(0, -1) // removes the last empty line
    .map(line => {
      const [start, end, text] = line.split('\t').map(n => Number(n))
      return {start, end, text, src: src + '.m4a'}; // 3 fields, start/end/num(starts at 1)
    }) 
}

export default {
  namespaced: true,
  state: {
    audioControls: false,
    curEntryInd: -1, // most recent playing entry
    entries: [], filename: '', // info about text entries
    labels: [], // for the text entries
    playbackRate: 1, silenceGap: 0.2, // in seconds (labels at 0.1 seconds in audacity)
    isPlaying: false,
    duration: 0,
    currentSrc: '',
    currentTime: 0,
    fileMap: {}, // mapping of text filenames to audio filenames
  },
  getters: {
    getActiveEntry: (state) => {
      return state.entries[state.curEntryInd]
    },
    getActiveLabel: (state) => { return state.labels[state.curEntryInd] },
    getIsPlaying: (state) => {
      return state.isPlaying
    },
    getAudioAvailable: (state, getters, rootState, rootGetters) => (key) => {
      const filename = rootGetters['tree/getKey'](key).filename
      return state.fileMap[filename]
    },
  },
  mutations: {
    setAudioControls(state, active) {
      state.audioControls = active
    },
    setPlaying(state, isPlaying) {
      state.isPlaying = isPlaying
    },
    setDuration: (state, val) => state.duration = val,
    setCurrentTime: (state, val) => state.currentTime = val,
    setActiveEntry(state, entryInd) {
      state.curEntryInd = entryInd
    },
    togglePlay(state) {
      if (!audio.src) return // or maybe check duration? (check if valid audio is loaded)
      if (state.isPlaying) {
        audio.pause()
      } else {
        audio.play()
      }
    },
    setPlaybackRate(state, playbackRate) {
      state.playbackRate = audio.playbackRate = playbackRate
    },
    setSilenceGap(state, silence) {
      state.silenceGap = silence
    },
    setFileMap(state, fileMap) {
      Object.preventExtensions(fileMap) // read-only not reactive - this improves perf
      state.fileMap = fileMap
    },
  },

  actions: {
    async initialize({commit}) {
      const fileMap = await getJson('/audio/file-map.json')
      console.log(fileMap)
      commit('setFileMap', fileMap)
    },

    async startEntry({state, commit, rootGetters, dispatch}, entry) {
      const data = rootGetters['tabs/getActiveTab'].data, entries = [], audioFiles = state.fileMap[data.filename]
      if (!audioFiles) return // audio not availabe for this file
      if (data.filename != state.filename) { // different text file being played
        // reload text entries and the labels
        data.pages.forEach(page => entries.push(...page.pali.entries))
        state.entries = entries
        state.filename = data.filename
        // parallel load all label files
        const promises = audioFiles.map(async labelFile => await loadLabels('/audio/' + labelFile))
        const labelArrays = await Promise.all(promises)
        state.labels = labelArrays.flat(1) // concat all arrays
      }

      commit('setAudioControls', true)
      dispatch('updateAudio', entry.cInd)
    },
  
    moveParagraph({state, dispatch}, inc) {
      const newInd = state.curEntryInd + inc
      if (0 <= newInd && newInd < state.entries.length) {
        dispatch('updateAudio', newInd)
      }
    },
    updateAudio({state, commit}, newEntryInd) {
      const label = state.labels[newEntryInd]
      // todo check errors
      audio.pause()
      audio.src = state.currentSrc = label.src
      audio.currentTime = label.start
      commit('setActiveEntry', newEntryInd)
      audio.play()
      console.log(`play para for key ${entryToKeyStr(state.entries[newEntryInd])} cInd: ${newEntryInd}, label: ${label.text}, time: ${audio.currentTime}`)
    },

    // check if needed to go to the next para
    async timeUpdated({state, commit}, newTime) {
      // find the current label from time
      const labelInd = state.labels.findIndex(label => newTime <= label.end && state.currentSrc == label.src)
      // set new index only if not the end of text file
      if (labelInd >= 0 && labelInd != state.curEntryInd) {
        if (newTime < state.labels[labelInd].start - state.silenceGap) { // seek to the beginning of next entry
          audio.currentTime = newTime = state.labels[labelInd].start - state.silenceGap
        }
        commit('setActiveEntry', labelInd)
      }
      
      commit('setCurrentTime', newTime)
    },



    async nextParagraph({state, dispatch}) {
      let [pInd, eInd] = state.activeEntry.eInd
      const curPage = state.activeTab.data.pages[pInd], entries = curPage[state.activeEntry.language].entries
      
      
      if (eInd + 1 >= entries.length) {
        eInd = 0
        pInd++
      } else {
        eInd++
      }
      if (pInd < 0 || pInd >= state.activeTab.data.pages.length) return // end of text file
      const newEntry = state.activeTab.data.pages[pInd][state.activeEntry.language].entries[eInd]

      if (state.entries.length > state.curEntryInd + 1) {
        
      }
    },
  }
}
