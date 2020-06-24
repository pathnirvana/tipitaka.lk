<template>
  <v-sheet>
    <v-banner v-if="!!inputError" color="error">{{ inputError }}</v-banner>
    <v-container fluid>
      <v-row dense>
        <template v-if="!isAdvancedMode">
          <v-col cols="12" :sm="showMatchPhrase ? 4 : 12">
            <v-radio-group v-model="exactWord" :mandatory="true" dense>
              <v-radio label="එම වචනයම සොයන්න" :value="1"></v-radio>
              <v-radio label="මේ අකුරු වලින් ඇරඹේන ඕනෑම වචනයක්" :value="0"></v-radio>
            </v-radio-group>
          </v-col>
          <v-col cols="12" sm="4" v-if="showMatchPhrase">
            <v-radio-group v-model="matchPhrase" :mandatory="true" dense>
              <v-radio label="සම්පුර්ණ වාක්‍යක් ලෙස" :value="1"></v-radio>
              <v-radio label="වෙන්වූ වචන සමූහයක් ලෙස" :value="0"></v-radio>
            </v-radio-group>
          </v-col>
          <v-col cols="12" sm="4" v-if="showMatchPhrase && !matchPhrase">
            <v-text-field label="වචන අතර උපරිම දුර" v-model="wordDistance"></v-text-field>
          </v-col>
        </template>
        <v-col cols="12" sm="6" md="8">
          <v-banner v-if="!!searchMessage">
            {{ searchMessage }}
            <ShareLinkIcon :link="linkToPage" />
          </v-banner>
        </v-col>
        <v-col cols="12" sm="6" md="4">
          <FilterTree searchType="fts" />
        </v-col>
      </v-row>
    </v-container>

    <v-card v-if="errorMessage" color="error">
      <v-card-title>අන්තර්ගතය සෙවීමේදී වරදක් සිදුවිය.</v-card-title>
      <v-card-text>{{ errorMessage + '. ඔබේ අන්තර්ජාල සම්බන්ධතාවය පරික්ෂා කර බලන්න.' }}</v-card-text>
    </v-card>

    <v-simple-table v-if="results.length" class="results-table">
      <tbody>
        <tr v-for="(res, i) in results" :key="i" >
          <td class="pb-2">
            <TipitakaLink v-if="res.key" :itemKey="res.key" :params="res"/>
            <div class="highlighted-text" v-html="res.hText" :style="$store.getters['styles']"></div>
          </td>
        </tr>
      </tbody>
    </v-simple-table>

    <v-skeleton-loader v-if="queryRunning" type="table"></v-skeleton-loader>

  </v-sheet>
</template>

<style scoped>
/*.results-table tr:nth-child(even) { background-color: lightgray; }*/
.highlighted-text { font-size: 1.1em; }
.highlighted-text >>> sr { background-color: var(--v-highlight-base); }
</style>

<script>
//
import { beautifyText } from '@/text-convert.mjs'
import { allFilterLength } from '@/constants.js'
import TipitakaLink from '@/components/TipitakaLink'
import FilterTree from '@/components/FilterTree'
import { mapState, mapGetters } from 'vuex'
import axios from 'axios'
import _ from 'lodash'

const searchBarRules = [
  v => !!v || 'සෙවීම සඳහා වචන ඇතුළු කරන්න.',
  v => !(/[a-z]/i.test(v) && !/AND|OR|NOT/.test(v)) || 'අන්තර්ගතය සෙවීමේදී සිංහල අකුරු පමණක් භාවිතා කරන්න.',
  v => !/[^a-z\u0D80-\u0DFF\u200D\*\^\(\) ]/i.test(v) || 'සෙවුම් පදය සඳහා ඉංග්‍රීසි සහ සිංහල අකුරු පමණක් යොදන්න.',
]

export default {
  name: 'FTS',
  metaInfo: {  title: 'අන්තර්ගත සෙවුම' },
  components: {
    TipitakaLink,
    FilterTree,
  },

  data: () => ({
    results: [],
    resultsInput: '',
    errorMessage: '',
    queryRunning: false,
    
    exactWord: 0,
    matchPhrase: 0, 
    wordDistance: 10,
  }),
  
  computed: {
    ...mapGetters('tree', ['getKeyForEInd']),
    ...mapState('search', ['maxResults', 'searchType']),
    searchInput() {
      // TODO add more here
      return this.$store.state.search.searchInput.trim().replace(/[\u200d\.,]/g, '').replace(/\s+/g, ' ') 
    },
    showMatchPhrase() { return this.searchInput.split(' ').length > 1 },
    searchMessage() {
      if (this.inputError) return ''
      const terms = beautifyText(this.searchInput, 'sinh', this.$store.state)
      if (!this.results.length)
        return `“${terms}” යන සෙවුම සඳහා ගැළපෙන පරිච්ඡේද කිසිවක් හමුවුයේ නැත. වෙනත් සෙවුමක් උත්සාහ කර බලන්න.`
      else if(this.results.length < this.maxResults)
        return `“${terms}” යන සෙවුම සඳහා ගැළපෙන පරිච්ඡේද ${this.results.length} ක් හමුවුනා.`
      else 
        return `ඔබගේ “${terms}” යන සෙවුම සඳහා ගැළපෙන පරිච්ඡේද ${this.maxResults} කට වඩා හමුවුනා. එයින් මුල් ${this.maxResults} පහත දැක්වේ.`
    },
    inputError() { // check rules
      for (let rule of searchBarRules) {
          const val = rule(this.searchInput)
          if (val !== true) return val
      }
      return ''
    },
    isAdvancedMode() { return /AND|OR|NOT|[\*\^\(\)]/.test(this.searchInput) },
    ftsMatchClause() {
      // check sqlite fts spec here https://www.sqlite.org/fts5.html
      if (this.isAdvancedMode) return this.searchInput // adding boolean AND OR NOT queries
      let words  = this.searchInput.split(' ')
      if (!this.exactWord) words = words.map(w => w + '*')
      let clause = words[0]
      if (words.length > 1) {
        clause = this.matchPhrase ? words.join('+') : `NEAR(${words.join(' ')}, ${this.wordDistance})`
      }
      return clause
    },
    filterClause() { // (filename LIKE 'an-6%' OR filename LIKE 'sn-1%')
      const clauses = []
      if (this.filterFTS.keys.length < allFilterLength) {
        clauses.push('(' + this.filterFTS.keys.map(key => `filename LIKE '${key}%'`).join(' OR ') + ')')
      }
      if (this.filterFTS.columns.length < 2) {
        clauses.push(`language = '${this.filterFTS.columns[0] == 1 ? 'sinh' : 'pali'}'`)
      }
      return clauses.join(' AND ')
    },
    filterFTS() { return this.$store.state.search.filter.fts  },
    linkToPage() {
      const options = [this.exactWord, this.matchPhrase, this.wordDistance].join('-')
      return `/fts/${this.searchInput}/${options}`
    }
  },

  methods: {
    async getSearchResults() {
      if (this.inputError) return
      this.errorMessage = ''

      const sql = `SELECT filename, eind, language, highlight(tipitaka, 5, '<sr>', '</sr>') AS htext FROM tipitaka 
          WHERE text MATCH '${this.ftsMatchClause}' ${this.filterClause ? (' AND ' + this.filterClause) : ''} 
          ORDER BY rank LIMIT ${this.$store.state.search.maxResults};`
      const cachedRes = this.$store.getters['search/getMd5Cache']('fts', sql)
      if (cachedRes) {
        this.results = cachedRes
        console.log(`received fts results with ${this.results.length} from fts cache`)
        return
      }

      this.queryRunning = true
      try {
        const baseUrl = process.env.NODE_ENV == 'development' ? 'http://192.168.1.107:5555' : ''
        //const baseUrl = 'https://tipitaka.lk' // force prod server
        const response = await axios.post(baseUrl + '/tipitaka-query/fts', { type: 'fts', sql })
        console.log(`received fts response with ${response.data.length} rows for query ${this.ftsMatchClause}`)
        this.results = response.data.map(res => {
          const ftsEInd = res.eind.split('-').map(i => parseInt(i))
          const hText = beautifyText(res.htext, res.language, this.$store.state)
          return { ftsEInd, hText, 
            key: this.getKeyForEInd(res.filename, ftsEInd),
            hWords: this.getHighlightWords(hText),
            language: res.language
          }
        })
        this.resultsInput = this.searchInput
        this.$store.commit('search/setMd5Cache', { type: 'fts', sql, results: this.results })
      } catch (e) {
        console.error(e)
        this.errorMessage = e.message
      }
      this.queryRunning = false
    },
    getHighlightWords(hText) {
      const words = {} // extract content within <sr> tags
      hText.replace(/<sr>(.*?)<\/sr>/g, (_1, g1) => words[g1] = 1);
      return Object.keys(words) // de-dup
    },
    updatePage() {
      //const options = [this.exactWord, this.matchPhrase, this.wordDistance].join('-')
      if (this.$route.path != this.linkToPage) { // prevent duplicated navigation
        this.$router.replace(this.linkToPage)
      }
      this.debouncedGetResults()
    },
  },
  
  watch: {
    searchInput(newInput, oldInput) {
      if (newInput != this.resultsInput) {
        this.updatePage() // update route too
      }
    },
    exactWord() { this.updatePage() },
    matchPhrase() { this.updatePage() },
    wordDistance() { this.updatePage() },
    filterFTS: {
      deep: true,
      handler() {
        console.log(`filter fts updated`)
        this.debouncedGetResults() // no need to update the route
      },
    },
  },
  
  mounted() {
    if (this.searchInput != this.resultsInput) {
      this.updatePage() // update route too
    }
  },
  
  created() {
    this.debouncedGetResults = _.debounce(this.getSearchResults, 200)
    const { words, options } = this.$route.params
    this.$store.commit('search/setSearchType', 'fts')
    if (words) this.$store.commit('search/setSearchInput', words)
    if (options) {
      [this.exactWord, this.matchPhrase, this.wordDistance] = options.split('-').map(o => parseInt(o))
    }
  },
}
</script>
