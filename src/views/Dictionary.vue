<template>
  <v-sheet>
    <v-banner v-if="!!inputError" color="error">{{ inputError }}</v-banner>
    
    <!-- <v-select v-model="selectedDictionaries" :items="Object.keys(dictionaryInfo)" 
       chips label="ශබ්දකෝෂ තෝරන්න" multiple class="mt-4 mx-4 mb-n4" outlined>
      <template v-slot:selection="{ item, index }">
        <v-chip small close :color="dictionaryInfo[item][0] == 'en' ? 'success' : 'info'" 
          @click:close="selectedDictionaries.splice(index, 1)">
          {{ dictionaryInfo[item][1] }}
        </v-chip>
      </template>
    </v-select> -->

    <v-banner v-if="!inputError && !!searchMessage" shaped>
      {{ searchMessage }}
      <ShareLinkIcon :link="linkToPage" />
    </v-banner>

    <DictionaryFilter />

    <v-skeleton-loader v-if="queryRunning" type="table"></v-skeleton-loader>

    <v-sheet v-if="breakups" class="d-flex flex-wrap my-2">
      <div v-for="({word, type, breakup}, i) in breakups" :key=i class="px-4 breakup">
        <span>{{ word }}</span>
        <v-chip outlined class="mx-1">{{ type }}</v-chip>
        <span>{{ breakup }}</span>
      </div>
    </v-sheet>

    <v-simple-table v-if="matchedResults.length">
      <tbody>
        <tr v-for="({ word, dict, meaning }, i) in matchedResults" :key="i">
          <td class="result" :style="$store.getters['styles']">
            <span class="word" color="primary">{{ word }}</span>
            <v-chip class="mx-3" x-small>{{ dict }}</v-chip>
            <span class="meaning" v-html="meaning"></span>
          </td>
        </tr>
      </tbody>
    </v-simple-table>

    <v-card v-if="prefixWords.length">
      <v-card-subtitle>ශබ්දකෝෂ වල ඇති මෙම අකුරු වලින් ඇරඹෙන වෙනත් වචන</v-card-subtitle>
      <v-card-text>
        <v-chip v-for="({ word }, i) in prefixWords" :key="i" class="ma-1"
          @click="$router.push({ name: 'dict', params: { word } })">{{ word }}</v-chip>
      </v-card-text>
    </v-card>
    
  </v-sheet>
</template>

<style scoped>
.result .word { color: var(--v-info-base); }
.breakup {  }
</style>

<script>
import { dictionaryInfo, Language } from '@/constants.js'
import { isSinglishQuery, getPossibleMatches } from '@/singlish.js'
import { mapState, mapGetters, mapMutations } from 'vuex'
import DictionaryFilter from '@/components/DictionaryFilter'
import axios from 'axios'
import _ from 'lodash'

const searchBarRules = [
  v => !!v || 'සෙවීම සඳහා පාලි වචනය ඇතුළු කරන්න.',
  v => v.length >= 2 || 'අඩුම තරමේ අකුරු 2 ක් වත් ඇතුළු කරන්න.',
  v => !/\s/.test(v) || 'හිස් තැන් රහිතව එක් පදයක් පමණක් යොදන්න.',
  v => (!isSinglishQuery(v) || v.length <= 10) || 'සිංග්ලිෂ් වලින් සෙවීමේ දී උපරිමය අකුරු 10 කට සීමා කර ඇත.',
  v => v.length <= 25 || 'උපරිම දිග අකුරු 25',
  v => !(/[^A-Za-z\u0D80-\u0DFF\u200D]/.test(v)) || 'සෙවුම් පදය සඳහා ඉංග්‍රීසි සහ සිංහල අකුරු පමණක් යොදන්න.',
]

export default {
  name: 'Dictionary',
  metaInfo: { title: 'ශබ්දකෝෂ සෙවුම' },
  components: { DictionaryFilter },

  data: () => ({
    results: [],
    resultsInput: '',
    queryRunning: false,
    dictionaryInfo,
  }),
  
  computed: {
    ...mapState('search', ['maxResults', 'searchInput', 'searchType']),
    
    searchMessage() {
      if (!this.searchInput) return ''
      const matchedMessage = !this.matchedResults.length ?
        `“${this.searchInput}” යන සෙවුම සඳහා ගැළපෙන වචන ශබ්දකෝෂ වල හමුවුයේ නැත. ` :
        `“${this.searchInput}” යන සෙවුම සඳහා ගැළපෙන වචන ${this.matchedResults.length} ක් හමුවුනා. `
      const prefixMessage = this.prefixWords.length ? 
        `මෙම අකුරු වලින් ඇරඹෙන වෙනත් වචන ${this.prefixWords.length} ක් ශබ්දකෝෂ වල හමුවුනා.` : ''
      return matchedMessage + prefixMessage
    },
    inputError() { // check rules
      for (let rule of searchBarRules) {
          const val = rule(this.searchInput)
          if (val !== true) return val
      }
      return ''
    },
    wordsList() {
      const query = this.searchInput.toLowerCase().replace(/\u200d/g, '')
      // Search all singlish_combinations of translations from roman to sinhala
      let words = isSinglishQuery(query) ? getPossibleMatches(query) : []
      if (!words.length) words = [query]; // if not singlish or no possible matches found
      // TODO: improve this code to ignore na na la la sha sha variations at the comparison
      // for each word generate the stripEnd variation and add it
      const stripEnd = words.map(w => w.replace(/[\u0DCA-\u0DDF\u0D82\u0D83]$/g, ''))
      return [...words, ...stripEnd].filter((w, i, ar) => ar.indexOf(w) == i) // concat and remove duplicates
    },
    dictFilter() { // short names of the selected dictionaries
      return `dict IN ('${this.selectedShortDicts.join("', '")}')`
    },
    likePrefixQuery() { // this is slow for large number of words hence limit
      if (this.wordsList.length > 100) return ''
      return `UNION
          SELECT word, COUNT(dict) AS num, 'like' AS meaning FROM dictionary 
            WHERE (word LIKE '${this.wordsList.join("_%' OR word LIKE '")}_%') AND ${this.dictFilter}
            GROUP BY word`
    },
    selectedDictionaries: {
      get() { return this.$store.state.search.selectedDictionaries },
      set(newList) { this.$store.commit('search/setSelectedDicts', newList) },
    },
    selectedShortDicts() { return this.selectedDictionaries.map(dict => dictionaryInfo[dict][1]) },
    matchedResults() { // sort by the order in the selected dicts
      return this.results.filter(({ dict, meaning }) => dict != 'BR' && meaning != 'like')
        .sort((a, b) => this.selectedShortDicts.indexOf(b.dict) < this.selectedShortDicts.indexOf(a.dict))
    },
    breakups() {
      return this.results.filter(({ dict }) => dict == 'BR').map(({ word, meaning }) => {
        const [type, breakup] = meaning.split('|')
        return { word, type, breakup }
      })
    },
    prefixWords() { // sort by number of occurances
      const matchedWords = this.matchedResults.map(r => r.word)
      return this.results.filter(r => r.meaning == 'like' && matchedWords.indexOf(r.word) < 0)
        .sort((a, b) => a.dict > b.dict)
    },
    linkToPage() { return '/dict/' + this.searchInput },
  },

  methods: {
    async getSearchResults() {
      if (this.inputError) return
      this.resultsInput = this.searchInput
      console.log(this.wordsList.length)
      const sql = `SELECT word, dict, meaning FROM dictionary 
            WHERE word IN ('${this.wordsList.join("','")}') AND (${this.dictFilter} OR dict = 'BR')
          ${this.likePrefixQuery} ORDER BY word LIMIT 50;`

      //Check if we've searched for this word before
      const cachedRes = this.$store.getters['search/getMd5Cache']('dict', sql)
      if (cachedRes) {
        this.results = cachedRes
        console.log(`dict search '${this.searchInput}' found in cache ${cachedRes.length} results`);
        return
      }

      this.queryRunning = true
      try {
        const baseUrl = process.env.NODE_ENV == 'development' ? 'http://192.168.1.107:5555' : ''
        const response = await axios.post(baseUrl + '/tipitaka-query/dict', { type: 'dict', sql })
        console.log(`received dict response with ${response.data.length} rows for query ${this.wordsList}`)
        this.results = response.data
        this.$store.commit('search/setMd5Cache', { type: 'dict', sql, results: this.results })
      } catch(e) {
        console.error(e)
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
    removeDictionary(index) {
      this.selectedDictionaries.splice(index, 1)
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
