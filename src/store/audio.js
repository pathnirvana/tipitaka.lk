import { getJson, entryToKeyStr } from '@/constants.js'
import store from '@/store'
import axios from 'axios'

const audio = new Audio()
audio.onplay = () => {  store.commit('audio/setPlaying', true) };
audio.onerror = audio.onpause = audio.onended = () => store.commit('audio/setPlaying', false);
audio.ondurationchange = () => store.commit('audio/setDuration', audio.duration)
audio.ontimeupdate = () => store.dispatch('audio/timeUpdated', audio.currentTime)

const audioBaseUrl = 'https://sajjha.sgp1.cdn.digitaloceanspaces.com/original/'

async function loadLabels(src) {
    try {
      const req = src + '.txt';
      console.log("Request : " + req);
      const response = await axios.get(req, { timeout: 5000 });
      
      return response.data.split('\n').slice(0, -1) // removes the last empty line (for mac only \n)
        .map(line => {
          const [start, end, text] = line.trim().split('\t').map(n => Number(n))
          return {start, end, text, src: src + '.m4a'}; // 3 fields, start/end/num(starts at 1)
        }) 
    }
    catch (error) {
      if (error.response) {
          // Server responded with a status other than 2xx
          console.error(`Server responded with status ${error.response.status} for URL: ${src}`);
      } else if (error.request) {
          // Request was made but no response was received
          console.error(`No response received for URL: ${src}`, error.message);
      } else {
          // Something happened in setting up the request
          console.error(`Error in setting up request for URL: ${src}`, error.message);
      }
      throw error;
    }
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
    getActiveLabel: (state) => { return state.entries[state.curEntryInd].label },
    getIsPlaying: (state) => {
      return state.isPlaying
    },
    getAudioAvailable: (state, getters, rootState, rootGetters) => (key) => {
      const filename = rootGetters['tree/getKey'](key).filename
      return state.fileMap[filename] // TODO some files may only have partial audio coverage
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
    pauseAudio(state) {
      if (!audio.src) return
      audio.pause();
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
      const fileMap = await getJson('/static/data/file-map.json')
      commit('setFileMap', fileMap)
    },

    async startEntry({state, commit, rootGetters, dispatch}, eInd) {
      try {
        const data = rootGetters['tabs/getActiveTab'].data, entries = [], audioFiles = state.fileMap[data.filename]
        if (!audioFiles) return // audio not availabe for this file
        if (data.filename != state.filename) { // different text file being played
          // reload text entries and the labels
          data.pages.forEach(page => entries.push(...page.pali.entries))
          
          // parallel load all label files
          const promises = audioFiles.map(async labelFile => await loadLabels(audioBaseUrl + labelFile))
          const labelArrays = await Promise.all(promises), labels = []
          labelArrays.flat(1).forEach(label => labels[label.text - 1] = label) // concat all arrays and sort by label text
          entries.filter(e => !e.noAudio).forEach((entry, i) => entry.label = labels[i]) // assign labels to entries
          Object.preventExtensions(entries)
          state.entries = entries
          state.filename = data.filename
          //const noAudio = /(^$|^\$.+$|^[\d\.,\- ]+$)/.test(paliEntry.text) || paliEntry.noAudio // empty, starts with $ or all numbers
        }
        commit('setAudioControls', true)
        const playEntry = state.entries.find(e => e.eInd[0] == eInd[0] && e.eInd[1] >= eInd[1])
        dispatch('updateAudio', { newInd: playEntry ? playEntry.cInd : 0, dir: 1 })
      } catch (error) {
        console.error('Error in startEntry:', error.message);
      }
    },
  
    moveParagraph({state, dispatch}, inc) {
      const newInd = state.curEntryInd + inc
      dispatch('updateAudio', { newInd, dir: inc })
    },

    updateAudio({state, commit}, {newInd, dir} ) {
      if (newInd < 0 || state.entries.length <= newInd) return
      while (!state.entries[newInd].label) { // find the next audio available paragraph
        newInd += dir
        if (newInd < 0 || state.entries.length <= newInd) return
      }
      const label = state.entries[newInd].label
      // todo check errors
      audio.pause()
      audio.src = state.currentSrc = label.src
      audio.currentTime = label.start
      audio.playbackRate = state.playbackRate // move para after setting custom playbackRate needs this to stick
      commit('setActiveEntry', newInd)
      audio.play()
      console.log(`play para for key ${entryToKeyStr(state.entries[newInd])} cInd: ${newInd}, label: ${label.text}, time: ${audio.currentTime}`)
    },

    // check if needed to go to the next para
    async timeUpdated({state, commit}, newTime) {
      // find the current label from time
      const entryInd = state.entries.findIndex(({label}) => label && state.currentSrc == label.src && newTime <= label.end)
      // set new index only if not the end of text file
      if (entryInd >= 0 && entryInd != state.curEntryInd) {
        const label = state.entries[entryInd].label
        if (newTime < label.start - state.silenceGap) { // seek to the beginning of next entry
          audio.currentTime = newTime = label.start - state.silenceGap
        }
        commit('setActiveEntry', entryInd)
      }
      commit('setCurrentTime', newTime)
    },
  },
}
