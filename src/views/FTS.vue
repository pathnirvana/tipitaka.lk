<template>
  <v-sheet>
    <v-container fluid>
      <v-row dense>
        <!--<v-col cols="12" sm="6">
          <v-text-field label="සෙවිය යුතු වචන" v-model="searchInputRaw" hide-details="auto"></v-text-field>
        </v-col>-->
        <v-col cols="12" sm="6">
          <v-btn outlined @click.stop="showFilter = true"><v-icon class="mr-1" color="primary">mdi-filter-variant</v-icon>සෙවුම සීමා කිරීම</v-btn>
        </v-col>
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
      </v-row>
    </v-container>

    <v-banner v-if="!!searchMessage">{{ searchMessage }}</v-banner>
    
    <v-card v-if="errorMessage" color="error">
      <v-card-title>අන්තර්ගතය සෙවීමේදී වරදක් සිදුවිය.</v-card-title>
      <v-card-text>{{ errorMessage + '. ඔබේ අන්තර්ජාල සම්බන්ධතාවය පරික්ෂා කර බලන්න.' }}</v-card-text>
    </v-card>

    <v-simple-table v-if="results.length" class="results-table">
      <tbody>
        <tr v-for="(res, i) in results" :key="i" >
          <td class="py-2">
            <TipitakaLink v-if="res.itemKey" :itemKey="res.itemKey" :eInd="res.eind" :language="res.lang"/>
            <div class="highlighted-text" v-html="res.htext"></div>
          </td>
        </tr>
      </tbody>
    </v-simple-table>
    <!-- v-else show loading indicator -->
    <!--<v-skeleton-loader v-else type="table"></v-skeleton-loader>-->

    <FilterTree searchType="fts" />

  </v-sheet>
</template>

<style scoped>
/*.results-table tr:nth-child(even) { background-color: lightgray; }*/
.highlighted-text { font-size: 1.1em; }
.highlighted-text >>> sr { background-color: yellow; }
</style>

<script>
//
import { beautifyText } from '@/text-convert.mjs'
import TipitakaLink from '@/components/TipitakaLink'
import FilterTree from '@/components/FilterTree'
import { mapState, mapGetters } from 'vuex'
import axios from 'axios'
import _ from 'lodash'

export default {
  name: 'FTS',
  metaInfo: {  title: 'අන්තර්ගතය සෙවීම' },
  components: {
    TipitakaLink,
    FilterTree,
  },

  data: () => ({
    results: [],
    errorMessage: '',
    
    //searchInputRaw: '',
    exactWord: 1,
    matchPhrase: 0, 
    wordDistance: 10,

    showFilter: false,
    filterTreeOpenKeys: ['sp'],
  }),
  
  computed: {
    ...mapGetters('tree', ['getKeyForEInd']),
    ...mapState('search', ['maxResults']),
    searchInput() {
      return this.$store.state.search.searchInput.trim().replace(/\u200d/g, '').replace(/\s+/g, ' ') // TODO add more here
    },
    showMatchPhrase() { return this.searchInput.split(' ').length > 1 },
    searchMessage() {
      if (!this.searchInput) return ''
      const terms = beautifyText(this.searchInput, 'sinh', this.$store.state)
      if (!this.results.length)
        return `“${terms}” යන සෙවුම සඳහා ගැළපෙන පරිච්ඡේද කිසිවක් හමුවුයේ නැත. වෙනත් සෙවුමක් උත්සාහ කර බලන්න.`
      else if(this.results.length < this.maxResults)
        return `“${terms}” යන සෙවුම සඳහා ගැළපෙන පරිච්ඡේද ${this.results.length} ක් හමුවුනා.`
      else 
        return `ඔබගේ “${terms}” යන සෙවුම සඳහා ගැළපෙන පරිච්ඡේද ${this.maxResults} කට වඩා හමුවුනා. එයින් මුල් පරිච්ඡේද ${this.maxResults} පහත දැක්වේ.`
    },
    filterKeys: {
      get() { return this.$store.state.search.filterKeys  },
      set(keys) { this.$store.commit('search/setFilter', keys) },
    },
    isAdvancedMode() { return /AND|OR|NOT|\*|\^/.test(this.searchInput) },
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
    }
  },
  methods: {
    async getSearchResults() {
      if (!this.searchInput) return // empty input
      const sql = `SELECT file, eind, lang, highlight(tipitaka, 5, '<sr>', '</sr>') AS htext FROM tipitaka 
          WHERE text MATCH '${this.ftsMatchClause}' ORDER BY rank LIMIT 100;`
      try {
        const response = await axios.post('http://192.168.1.107:5555/tipitaka-query/fts', { type: 'fts', sql })
        console.log(`received fts response with ${response.data.length} rows for query ${this.ftsMatchClause}`)
        response.data.forEach(res => {
          res.eind = res.eind.split('-').map(i => parseInt(i))
          res.itemKey = this.getKeyForEInd(res.file, res.eind)
          res.htext = beautifyText(res.htext, res.lang, this.$store.state)
        })
        this.results = response.data
        this.errorMessage = ''
      } catch (e) {
        this.errorMessage = e.message
      }
    },
    updatePage() {
      const options = [this.exactWord, this.matchPhrase, this.wordDistance].join('-')
      if (this.$route.params.words != this.searchInput || this.$route.params.options != options) {
        // prevent duplicated navigation at the beginning
        this.$router.replace({ name: 'fts', params: { words: this.searchInput, options } })
      }
      this.debouncedGetResults()
    },
  },
  
  watch: {
    searchInput(newInput, oldInput) {
      if (newInput) {
        this.updatePage()
      }
    },
    exactWord() { this.updatePage() },
    matchPhrase() { this.updatePage() },
    wordDistance() { this.updatePage() },
  },
  created() {
    this.debouncedGetResults = _.debounce(this.getSearchResults, 200)
    const { words, options } = this.$route.params
    if (words) this.$store.commit('search/setSearchInput', words)
    if (options) {
      [this.exactWord, this.matchPhrase, this.wordDistance] = options.split('-').map(o => parseInt(o))
    }
  }
}
</script>
