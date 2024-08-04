<template>
  <v-sheet>
    <div class="tab-items">
        <TextTab v-for="(tab, ind) in tabList" :key="ind" :tabIndex="ind" v-show="ind == activeInd"/>
    </div>
    
    <v-btn fab small fixed bottom right @click="$vuetify.goTo(0)">
        <v-icon>mdi-chevron-triple-up</v-icon>
    </v-btn>


    <v-sheet v-if="$store.state.audio.audioControls" class="bottom-sheet pb-2" :height="getAudioControlSheetHeight" :elevation="5">
      <AudioControl/>
    </v-sheet>
    
    <v-sheet v-if="showInlineDict" class="bottom-sheet pb-2" height="250px" :elevation="7">
      <v-toolbar dense flat>
        <v-text-field v-model="inlineWord" hide-details class="shrink"></v-text-field>
        <v-btn icon @click="inlineWordBackspace"><v-icon>mdi-backspace</v-icon></v-btn>
        <v-btn @click="$router.push('/fts/' + inlineWord)" :icon="!smAndUp">
          <span v-if="smAndUp">අන්තර්ගතයේ සොයන්න</span>
          <v-icon v-else color="primary">mdi-magnify</v-icon>
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn @click="showInlineDict = !showInlineDict" icon color="error">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>

      <v-sheet max-height="200px" style="overflow-y: auto">
        <DictionaryResults :results="inlineDict.results" />
    
        <v-skeleton-loader v-if="inlineDict.queryRunning" type="table"></v-skeleton-loader>
        <v-banner v-else-if="!!inlineDict.errorMessage" color="error">{{ inlineDict.errorMessage }}</v-banner>
        <div v-else-if="!dictResults.matches || !dictResults.matches.length" class="mx-3 search-message text-center">
          {{ `මෙම වචනය ශබ්දකෝෂ වල හමුවූයේ නැත. අකුරු කිහිපයක් අඩු කර උත්සාහ කරන්න.` }}
        </div>
      </v-sheet>

    </v-sheet>
    
  </v-sheet>
</template>

<style scoped>
.bottom-sheet { position: fixed; bottom: 0; width: 100%; max-width: 800px; left: 50%; transform: translateX(-50%); 
  z-index: 10; border-top: 1px solid var(--v-secondary-base); }
.result .word { color: var(--v-info-base); }
.search-message { font-size: 0.9rem; }
</style>

<script>
// @ is an alias to /src
import { mapState, mapGetters } from 'vuex'
import TextTab from '@/components/TextTab.vue'
import DictionaryResults from '@/components/DictionaryResults'
import AudioControl from '@/components/AudioControl'
import { copyMetaTitle } from '@/constants.js'
import _ from 'lodash'
import { IOS, platform } from '../constants';

export default {
  name: 'Home',
  components: {
    TextTab,
    DictionaryResults,
    AudioControl,
  },
  data: () => ({
    
  }),
  computed: {
    ...mapState('tabs', ['activeInd', 'tabList']),
    ...mapState('search', ['inlineDict']),
    ...mapGetters('tree', ['getName']),
    smAndUp() { return this.$vuetify.breakpoint.smAndUp },
    activeTabInd: {
      get() { return this.activeInd },
      set(ind) {  this.$store.commit('tabs/setActiveInd', ind) },
    },
    showInlineDict: {
      get() { return this.inlineDict.show },
      set(value) { this.$store.commit('search/setInlineDict', { prop: 'show', value }) }
    },
    dictResults() { return this.inlineDict.results },
    inlineWord: {
      get() { return this.inlineDict.word },
      set(value) { 
        this.$store.commit('search/setInlineDict', { prop: 'word', value })
        this.debouncedWordQuery()
      }
    },
    getAudioControlSheetHeight(){
        return platform === IOS ? '65px' : '50px'
    }
  },

  methods: {
    runInlineDictQuery() {
      this.$store.dispatch('search/runInlineDictQuery')
    },
    inlineWordBackspace() {
      // strip one consonent + vowel at a time
      this.inlineWord = this.inlineWord.replace(/[අ-ෆ][\u0DCA-\u0DDF\u0D82\u0D83\u200d]*$/, '')
    },
  },

  watch: {  },

  created() { 
    this.debouncedWordQuery = _.debounce(this.runInlineDictQuery, 400)
  },

  metaInfo() { // create page title by joining keyName and rootName 
    let tab = this.$store.getters['tabs/getActiveTab'], title = 'Home'
    if (!tab) return { title }
    title = this.getName(tab.key, tab.language)
    let keyRoot = tab.key.split('-')[0]
    if (keyRoot == 'atta') keyRoot = 'atta-' + tab.key.split('-')[1] // if atta root key has two parts
    if (keyRoot != tab.key) title += (' < ' + this.getName(keyRoot, tab.language))
    title = title.replace(/([ක-ෆ])\u200D\u0DCA([ක-ෆ])/g, '$1\u0DCA$2') // remove bandi
    return copyMetaTitle(title) 
  },
}
</script>