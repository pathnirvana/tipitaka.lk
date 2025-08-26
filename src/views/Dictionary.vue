<template>
  <v-sheet>
    <v-banner v-if="!!inputError" color="error">{{ inputError }}</v-banner>

    <v-banner v-if="!inputError && !!searchMessage" shaped>
      {{ searchMessage }}
      <ShareLinkIcon :link="linkToPage" />
    </v-banner>
    <v-row >
    <v-col cols="12">
      <DictionaryFilter />
    </v-col>
    <v-col cols="12">
      <v-btn v-model="exactMatchPage" @click="toggleExactMatch" class="mb-6">
        <v-icon :color="exactMatchPage ? 'primary' : ''" class="mr-1">mdi-format-letter-matches</v-icon>
        <span>එම වචනයම සොයන්න</span>
      </v-btn>
    </v-col>
  </v-row>

    <v-spacer></v-spacer>
    <v-skeleton-loader v-if="queryRunning" type="table"></v-skeleton-loader>

    <DictionaryResults :results="results" />
    
  </v-sheet>
</template>

<style scoped>

</style>

<script>
import { dictionaryInfo, Language, copyMetaTitle } from '@/constants.js'
import { isSinglishQuery } from '@pnfo/singlish-search'
import { mapState } from 'vuex'
import DictionaryFilter from '@/components/DictionaryFilter'
import DictionaryResults from '@/components/DictionaryResults'
import _ from 'lodash'

const searchBarRules = [
  v => !!v || 'සෙවීමට පාලි වචනය ඇතුල් කරන්න.',
  v => v.length >= 2 || 'අවම වශයෙන් අකුරු 2 ක් ඇතුල් කරන්න.',
  v => !/\s/.test(v) || 'හිස් තැන් රහිතව එක් පදයක් පමණක් යොදන්න.',
  v => (!isSinglishQuery(v) || v.length <= 10) || 'සිංග්ලිෂ් වලින් සෙවීමේ දී උපරිමය අකුරු 10 කට සීමා කර ඇත.',
  v => v.length <= 25 || 'උපරිම දිග අකුරු 25',
  v => !(/[^A-Za-z\u0D80-\u0DFF\u200D]/.test(v)) || 'සෙවුම් පදය සඳහා ඉංග්‍රීසි සහ සිංහල අකුරු පමණක් යොදන්න.',
]

export default {
  name: 'Dictionary',
  components: { DictionaryFilter, DictionaryResults },

  data: () => ({
    results: {},
    resultsInput: '',
    queryRunning: false,
    dictionaryInfo,
  }),
  
  computed: {
    ...mapState('search', ['maxResults', 'searchInput', 'searchType', 'exactMatchPage']),
    searchMessage() {
      if (!this.searchInput || _.isEmpty(this.results)) return ''
      const matchedMessage = !this.results.matches.length ?
        `“${this.searchInput}” යන සෙවුම සඳහා ගැළපෙන වචන ශබ්දකෝෂ වල අඩංගු නොවේ. ` :
        `“${this.searchInput}” යන සෙවුම සඳහා ගැළපෙන වචන ${this.results.matches.length} ක් හමුවිය. `
      const prefixMessage = this.results.prefixWords.length ? 
        `මෙම අකුරු වලින් ඇරඹෙන වෙනත් වචන ${this.results.prefixWords.length} ක් ශබ්දකෝෂ වල හමුවිය.` : ''
      return matchedMessage + prefixMessage
    },
    inputError() { // check rules
      for (let rule of searchBarRules) {
          const val = rule(this.searchInput)
          if (val !== true) return val
      }
      return ''
    },
    selectedDictionaries() { return this.$store.state.search.selectedDictionaries }, // just for watching 
    linkToPage() { return '/dict/' + this.searchInput },
    exactMatchPage: {
      get() { return this.$store.state.search.exactMatchPage },
      set(value) {
        this.$store.commit('search/setExactMatchPage', value)
        this.debouncedGetResults();
      } 
    },
  },

  metaInfo() {  
    return copyMetaTitle(this.searchInput ? `“${this.searchInput}” යන සෙවුමට ශබ්දකෝෂ වලින් ලැබුණු ප්‍රතිඵල` : 'පාළි ශබ්දකෝෂ සෙවීම')
  },

  methods: {
    async getSearchResults() {
      if (this.inputError) return
      this.resultsInput = this.searchInput
      this.queryRunning = true
      try {
        console.log("exactMatchPage: " + this.exactMatchPage);
        this.results = await this.$store.dispatch('search/runPageDictQuery', { input: this.searchInput, exactMatchPage: this.exactMatchPage })
      } catch (e) {
        console.error(e.message)
        this.errorMessage = e.message
      }
      this.queryRunning = false
    },

    updatePage() {
      if (this.$route.path != this.linkToPage) { // prevent duplicated navigation at the beginning
        this.$router.push(this.linkToPage)
      }
      this.debouncedGetResults()
    },
    toggleExactMatch() {
      this.exactMatchPage = !this.exactMatchPage
    },
  },
  
  watch: {
    searchInput(newInput, oldInput) {
      if (newInput != this.resultsInput) {
        this.updatePage() // update route too
      }
    },
    selectedDictionaries: {
      deep: true,
      handler() {
        console.log(`dictionary list updated`)
        this.debouncedGetResults()
      },
    },
    // when user uses back/forward browser buttons or param change while in the same view
    $route(to, from) { // from this same view
      const word = to.params.word
      if (to.name == 'dict' && word && word != this.resultsInput) { 
        console.log(`new dict search from route change ${word}`)
        this.$store.commit('search/setSearchInput', word)
      }
    }
  },

  mounted() { // coming from a different view
    if (this.searchInput != this.resultsInput) {
      this.updatePage() // update route too
    }
  },

  created() { // initial loading from a url
    this.debouncedGetResults = _.debounce(this.getSearchResults, 400)
    const { word } = this.$route.params
    this.$store.commit('search/setSearchType', 'dict')
    if (word) this.$store.commit('search/setSearchInput', word)
  }
}
</script>
