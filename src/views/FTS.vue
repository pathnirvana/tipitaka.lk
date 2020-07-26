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

    <div class="d-flex flex-column" v-if="results.length">
      <div v-for="group in results" :key="group.key" class="result-group pa-2">

        <div v-if="!group.isOpen" class="result">
          <TipitakaLink v-if="group.key" :itemKey="group.key" :params="group.items[0]" />
          <div class="html" v-html="group.items[0].hText" :style="$store.getters['styles']"></div>
        </div>

        <template v-else>
          <div v-for="(res, i) in group.items" :key="i" class="result my-2">
            <TipitakaLink v-if="res.key" :itemKey="res.key" :params="res" />
            <div class="html" v-html="res.hText" :style="$store.getters['styles']"></div>
          </div>
        </template>

        <v-btn v-if="group.items.length > 1" text @click="toggleGroup(group.key)" :color="group.isOpen ? 'success' : 'info'" >
          <template v-if="group.isOpen">
            {{ `මෙම ඡේද ${group.items.length} වසන්න.` }}<v-icon>mdi-unfold-less-horizontal</v-icon>
          </template>
          <template v-else>
            {{ `මෙම සූත්‍රයේම තවත් ඡේද ${group.items.length} ක ඇත. බලන්න.` }}<v-icon>mdi-unfold-more-horizontal</v-icon>
          </template>
        </v-btn>

      </div>
    </div>

    <v-skeleton-loader v-if="queryRunning" type="table"></v-skeleton-loader>

  </v-sheet>
</template>

<style scoped>
/*.results-table tr:nth-child(even) { background-color: lightgray; }*/
.html { font-size: 1.1em; }
.html >>> sr { background-color: var(--v-highlight-base); }
.expand-group { background-color: var(--v-success-base); cursor: pointer; }
.result-group { border: 0.5px dotted var(--v-secondary-base) }
</style>

<script>
//
import { beautifyFTSText } from '@/text-convert.mjs'
import { allFilterLength, copyMetaTitle } from '@/constants.js'
import TipitakaLink from '@/components/TipitakaLink'
import FilterTree from '@/components/FilterTree'
import { mapState, mapGetters } from 'vuex'
import _ from 'lodash'

const searchBarRules = [
  v => !!v || 'සෙවීම සඳහා වචන ඇතුළු කරන්න.',
  v => v.length >= 2 || 'අඩුම තරමේ අකුරු 2 ක් වත් ඇතුළු කරන්න.',  // very slow in android
  v => !(/[a-z]/i.test(v) && !/AND|OR|NOT/.test(v)) || 'අන්තර්ගතය සෙවීමේදී සිංහල අකුරු පමණක් භාවිතා කරන්න.',
  v => !/[^a-z\u0D80-\u0DFF\u200D\*\^\(\) ]/i.test(v) || 'සෙවුම් පදය සඳහා ඉංග්‍රීසි සහ සිංහල අකුරු පමණක් යොදන්න.',
]
const rankResult = a => a.numMatches / Math.log2(a.textLength)

export default {
  name: 'FTS',
  components: {
    TipitakaLink,
    FilterTree,
  },

  data: () => ({
    results: [], // search results grouped by the key/sutta
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
      const terms = beautifyFTSText(this.searchInput, 'sinh', this.$store.state)
      const numResults = this.results.reduce((acc, grp) => acc += grp.items.length, 0)
      if (!numResults)
        return `“${terms}” යන සෙවුම සඳහා ගැළපෙන පරිච්ඡේද කිසිවක් හමුවුයේ නැත. වෙනත් සෙවුමක් උත්සාහ කර බලන්න.`
      else if(numResults < this.maxResults)
        return `“${terms}” යන සෙවුම සඳහා ගැළපෙන පරිච්ඡේද ${numResults} ක් හමුවුනා.`
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
      // check sqlite fts4 spec here https://www.sqlite.org/fts3.html
      if (this.isAdvancedMode) return this.searchInput // adding boolean AND OR NOT queries
      let words  = this.searchInput.split(' ')
      if (!this.exactWord) words = words.map(w => w + '*')
      let clause = words[0]
      if (words.length > 1) {
        clause = this.matchPhrase ? `"${words.join(' ')}"` : words.join(` NEAR/${this.wordDistance} `) // fts4
        // clause = this.matchPhrase ? words.join('+') : `NEAR(${words.join(' ')}, ${this.wordDistance})` // fts5
      }
      return clause
    },
    filterClause() { // (filename LIKE 'an-6%' OR filename LIKE 'sn-1%')
      const clauses = []
      if (this.filterFTS.keys.length && this.filterFTS.keys.length < allFilterLength) {
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
      const inputUrl = this.searchInput.replace(/\s/g, '%20') 
      return `/fts/${inputUrl}/${options}`
    },
  },

  metaInfo() {
    return copyMetaTitle(this.searchInput ? `“${this.searchInput}” යන අන්තර්ගත සෙවුම සඳහා ලැබුණු ප්‍රතිඵල` : 'සූත්‍ර අන්තර්ගතය සෙවීම')
  },

  methods: {
    async getSearchResults() {
      if (this.inputError) return
      this.errorMessage = ''
      this.resultsInput = this.searchInput
      this.queryRunning = true

      const highlightFunc = "snippet(tipitaka, '<sr>', '</sr>', '<b>…</b>', 5, 64)" // max-64 for last param. fts5 - highlight(tipitaka, 5, '<sr>', '</sr>')
      const sql = `SELECT filename, eind, language, type, ${highlightFunc} AS htext, 
          length(text) AS textlength, offsets(tipitaka) as offsets FROM tipitaka 
          WHERE text MATCH '${this.ftsMatchClause}' ${this.filterClause ? (' AND ' + this.filterClause) : ''} 
          ORDER BY length(offsets(tipitaka))/length(text) DESC LIMIT ${this.$store.state.search.maxResults};` // fts5 - ORDER BY rank

      try {
        const data = await this.$store.dispatch('search/runFTSQuery', { sql, 'input': this.searchInput })
        this.results = this.buildResults(data)
      } catch (e) {
        console.error(e)
        this.errorMessage = e.message
      }
      this.queryRunning = false
    },

    buildResults(data) {
      const groups = {}
      data.forEach(row => {
        const eInd = row.eind.split('-').map(i => parseInt(i))
        const hText = beautifyFTSText(row.htext, row.language, this.$store.state)
        const key = this.getKeyForEInd(row.filename, eInd)
        const res = { eInd, hText, key,
          hWords: this.getHighlightWords(hText),
          language: row.language,
          numMatches: row.offsets.split(' ').length / 4,
          textLength: row.textlength,
        }
        if (groups[key]) {
          groups[key].items.push(res)
          groups[key].numMatches += res.numMatches
        } else {
          groups[key] = { key, items: [res], isOpen: false, numMatches: res.numMatches }
        }
      })
      for (const key in groups) groups[key].items.sort((a, b) => rankResult(b) - rankResult(a)) // sort items
      return Object.values(groups).sort((a, b) => b.numMatches - a.numMatches) // sort groups
    },

    getHighlightWords(hText) {
      const words = {} // extract content within <sr> tags
      hText.replace(/<sr>(.*?)<\/sr>/g, (_1, g1) => words[g1] = 1);
      return Object.keys(words) // de-dup
    },
    toggleGroup(key) {
      const g = this.results.find(g => g.key == key)
      this.$set(g, 'isOpen', !g.isOpen)
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
