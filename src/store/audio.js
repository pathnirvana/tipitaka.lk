import { getJson, entryToKeyStr } from '@/constants.js'
import store from '@/store'
import axios from 'axios'

const audio = new Audio()
audio.onplay = () => {  store.commit('audio/setPlaying', true) };
audio.onerror = (error) => {
  store.commit('audio/setPlaying', false);
  store.commit('audio/setAudioError', commonErrorMessage);
  store.commit('audio/setAudioLoading', false);
};
audio.onpause = audio.onended = () => store.commit('audio/setPlaying', false);
audio.ondurationchange = () => store.commit('audio/setDuration', audio.duration)
audio.ontimeupdate = () => store.dispatch('audio/timeUpdated', audio.currentTime)

// Add loading state handlers
audio.onloadstart = () => {
  store.commit('audio/setAudioLoading', true);
  store.commit('audio/setAudioError', null);
};
audio.onloadeddata = () => {
  store.commit('audio/setAudioLoading', false);
};

const audioBaseUrl = 'https://sajjha.sgp1.cdn.digitaloceanspaces.com/original/'
const commonErrorMessage = 'සජ්ඣායනා දත්ත ලබාගත නොහැකි වි​ය. කරුණාකර අන්තර්ජාල සම්බන්ධතාවය පරීක්ෂා කරන්​න.'

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
      console.error(`Failed to load audio metadata for ${src}:`, error.message);
      store.commit('audio/setAudioError', commonErrorMessage);
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
    isLoading: false,
    audioError: null,
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
        // Clear any previous errors before attempting to play
        commit('clearAudioError');
        audio.play().catch(error => {
          this.commit('audio/setAudioError', `දෝෂයක් ඇතිවි​ය: ${error.message}`);
          this.commit('audio/setPlaying', false);
        });
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
    setLoading(state, loading) {
      state.isLoading = loading
    },
    setAudioError(state, error) {
      state.audioError = error
    },
    clearAudioError(state) {
      state.audioError = null
    },
  },

  actions: {
    async initialize({commit}) {
      const fileMap = await getJson('/static/data/file-map.json')
      commit('setFileMap', fileMap)
    },

    async startEntry({state, commit, rootGetters, dispatch}, eInd) {
      try {
        commit('clearAudioError');
        const data = rootGetters['tabs/getActiveTab'].data, entries = [], audioFiles = state.fileMap[data.filename]
        
        if (!audioFiles) {
          commit('setAudioError', 'මෙම ඡේද​ය සඳහා සජ්ඣායනා දත්ත නොමැත');
          return;
        }

        if (data.filename != state.filename) { // different text file being played
          commit('setLoading', true);

          try {
            // reload text entries and the labels
            data.pages.forEach(page => entries.push(...page.pali.entries))
            
            // parallel load all label files with error handling
            const promises = audioFiles.map(async labelFile => await loadLabels(audioBaseUrl + labelFile))

            const labelArrays = await Promise.all(promises);
            const labels = []
            labelArrays.flat(1).forEach(label => labels[label.text - 1] = label) // concat all arrays and sort by label text
            entries.filter(e => !e.noAudio).forEach((entry, i) => entry.label = labels[i]) // assign labels to entries
            Object.preventExtensions(entries)
            state.entries = entries
            state.filename = data.filename
            //const noAudio = /(^$|^\$.+$|^[\d\.,\- ]+$)/.test(paliEntry.text) || paliEntry.noAudio // empty, starts with $ or all numbers
          } catch (error) {
            commit('setLoading', false);
            commit('setAudioError', commonErrorMessage);
            console.error('Error loading labels:', error.message);
            return;
          } finally {
            commit('setLoading', false);
          }
        }

        commit('setAudioControls', true)
        const playEntry = state.entries.find(e => e.eInd[0] == eInd[0] && e.eInd[1] >= eInd[1])
        dispatch('updateAudio', { newInd: playEntry ? playEntry.cInd : 0, dir: 1 })
       
        } catch (error) {
          commit('setAudioError', `දෝෂයක් ඇති වි​ය: ${error.message}`);
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
      
      commit('clearAudioError');

      audio.pause()
      audio.src = state.currentSrc = label.src
      audio.currentTime = label.start
      audio.playbackRate = state.playbackRate // move para after setting custom playbackRate needs this to stick
      commit('setActiveEntry', newInd)

      try {
        audio.play()
        console.log(`play para for key ${entryToKeyStr(state.entries[newInd])} cInd: ${newInd}, label: ${label.text}, time: ${audio.currentTime}`)
      } catch (playError) {
        commit('setAudioError', `දෝෂයක් ඇති වි​ය: ${playError.message}`);
        console.error('Audio play error:', playError.message);
      }
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
