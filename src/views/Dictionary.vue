<template>
  <v-sheet>
    <v-banner v-if="!!inputError" color="error">{{ inputError }}</v-banner>
    <v-banner v-else-if="!!searchMessage">{{ searchMessage }}</v-banner>
    <v-select v-model="selectedDictionaries" :items="allDictionaries" 
       chips label="ශබ්දකෝෂ තෝරන්න" multiple>
       <template v-slot:selection="{ item, index }">
          <v-chip v-if="index < 2"><span>{{ item }}</span></v-chip>
          <span v-if="index === 2" class="grey--text caption">(සහ තවත් ශබ්දකෝෂ +{{ selectedDictionaries.length - 2 }} ක්)</span>
        </template>
    </v-select>

    <v-skeleton-loader v-if="queryRunning" type="table"></v-skeleton-loader>

    <v-simple-table v-if="results.length">
      <tbody>
        <tr v-for="({ word, dict, meaning }, i) in results" :key="i">
          <td>{{ word }}</td>
          <td>{{ dict }}</td>
          <td v-html="meaning"></td>
        </tr>
      </tbody>
    </v-simple-table>
    
  </v-sheet>
</template>

<style scoped>

</style>

<script>
import { dictionaryInfo } from '@/constants.js'
import { isSinglishQuery, getPossibleMatches } from '@/singlish.js'
import { mapState, mapGetters, mapMutations } from 'vuex'
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
  components: {  },

  data: () => ({
    results: [],
    resultsInput: '',
    queryRunning: false,
    allDictionaries: Object.keys(dictionaryInfo),
  }),
  
  computed: {
    ...mapState('search', ['maxResults', 'searchInput', 'searchType']),
    
    searchMessage() {
      if (!this.searchInput) return ''
      if (!this.results.length) {
        return `“${this.searchInput}” යන සෙවුම සඳහා ගැළපෙන වචන ශබ්දකෝෂවල හමුවුයේ නැත. වෙනත් සෙවුමක් උත්සාහ කර බලන්න.`
      } else if (this.results.length < this.maxResults) {
        return `“${this.searchInput}” යන සෙවුම සඳහා ගැළපෙන වචන ${this.results.length} ක් හමුවුනා.`
      } else { 
        return `ඔබගේ “${this.searchInput}” යන සෙවුම සඳහා ගැළපෙන වචන ${this.maxResults} කට වඩා හමුවුනා. එයින් මුල් වචන ${this.maxResults} පහත දැක්වේ.`
      }
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
      return `dict IN ('${this.selectedDictionaries.map(dict => dictionaryInfo[dict][1]).join("', '")}')`
    },
    selectedDictionaries: {
      get() { return this.$store.state.search.selectedDictionaries },
      set(newList) { this.$store.commit('search/setSelectedDicts', newList) },
    }
  },

  methods: {
    async getSearchResults() {
      if (this.inputError) return
      this.resultsInput = this.searchInput
      
      const sql = `SELECT word, dict, meaning FROM dictionary 
            WHERE word IN ('${this.wordsList.join("','")}') AND (${this.dictFilter} OR dict = 'BR')
          UNION
          SELECT word, COUNT(dict) AS num, 'like' AS meaning FROM dictionary 
            WHERE (word LIKE '${this.wordsList.join("_%' OR word LIKE '")}_%') AND ${this.dictFilter}
            GROUP BY word
          ORDER BY word LIMIT 50;`

      //Check if we've searched for this term before
      const cachedRes = this.$store.getters['search/getMd5Cache']('dict', sql)
      if (cachedRes) {
        this.results = cachedRes
        console.log(`title search '${this.searchInput}' found in cache ${cachedRes.length} results`);
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
      if (this.$route.params.term != this.searchInput) { // prevent duplicated navigation at the beginning
        this.$router.push({ name: 'dict', params: { term: this.searchInput } })
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
    selectedDictionaries: {
      deep: true,
      handler() {
        console.log(`dictionary list updated`)
        this.debouncedGetResults()
      },
    },
  },

  mounted() {
    if (this.searchInput != this.resultsInput) {
      this.updatePage() // update route too
    }
  },

  created() { // initial loading from a url
    this.debouncedGetResults = _.debounce(this.getSearchResults, 400)
    const { term } = this.$route.params
    this.$store.commit('search/setSearchType', 'dict')
    if (term) this.$store.commit('search/setSearchInput', term)
  }
}
</script>
