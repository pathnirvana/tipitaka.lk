<template>
  <v-sheet>
    <v-banner v-if="!!inputError" color="error">{{ inputError }}</v-banner>
    <v-banner v-else-if="!!searchMessage">{{ searchMessage }}<ShareLinkIcon :link="linkToPage" /></v-banner>
    <FilterTree searchType="title" />

    <v-simple-table v-if="$store.getters.isLoaded">
      <tbody>
        <tr v-for="({key, language}, i) in results" :key="i">
          <td>
            <TipitakaLink :itemKey="key" :params="{ language }" />
          </td>
        </tr>
      </tbody>
    </v-simple-table>
    <!-- v-else show loading indicator -->
    <v-skeleton-loader v-else type="table"></v-skeleton-loader>
  </v-sheet>
</template>

<style scoped>

</style>

<script>
import TipitakaLink from '@/components/TipitakaLink'
import FilterTree from '@/components/FilterTree'
import { isSinglishQuery, getPossibleMatches } from '@/singlish.js'
import { copyMetaTitle } from '@/constants.js'
import { mapState, mapGetters, mapMutations } from 'vuex'
import _ from 'lodash'

const searchBarRules = [
  v => !!v || 'සෙවීම සඳහා සූත්‍ර නමේ කොටසක් ඇතුළු කරන්න.',
  v => v.length >= 2 || 'අඩුම තරමේ අකුරු 2 ක් වත් ඇතුළු කරන්න.',
  v => !/\s/.test(v) || 'හිස් තැන් රහිතව එක් පදයක් පමණක් යොදන්න.',
  v => (!isSinglishQuery(v) || v.length <= 10) || 'සිංග්ලිෂ් වලින් සෙවීමේ දී උපරිමය අකුරු 10 කට සීමා කර ඇත.',
  v => v.length <= 25 || 'උපරිම දිග අකුරු 25',
  v => !(/[^A-Za-z\u0D80-\u0DFF\u200D]/.test(v)) || 'සෙවුම් පදය සඳහා ඉංග්‍රීසි සහ සිංහල අකුරු පමණක් යොදන්න.',
]

const inFilter = (key, filterKeys) => filterKeys.some(fKey => key.startsWith(fKey))

export default {
  name: 'TSearch',
  components: {
    TipitakaLink,
    FilterTree,
  },

  data: () => ({
    results: [],
    resultsInput: '',
  }),
  
  computed: {
    ...mapState('search', ['maxResults', 'searchInput', 'searchType']),
    ...mapState('tree', ['orderedKeys']),
    filterTitle() { return this.$store.state.search.filter.title  },
    
    searchMessage() {
      if (!this.searchInput) return ''
      if (!this.results.length) {
        return `“${this.searchInput}” යන සෙවුම සඳහා ගැළපෙන වචන කිසිවක් හමුවුයේ නැත. වෙනත් සෙවුමක් උත්සාහ කර බලන්න.`
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
    linkToPage() { return '/title/' + this.searchInput },
  },

  metaInfo() {  
    return copyMetaTitle(this.searchInput ? `“${this.searchInput}” යන සූත්‍ර නම් සෙවීම සඳහා ලැබුණු ප්‍රතිඵල` : 'සූත්‍ර නම් සෙවීම')
  },

  methods: {
    getSearchResults() {
      if (this.inputError) return
      if (!this.$store.getters.isLoaded) return
      this.resultsInput = this.searchInput
      const query = this.searchInput.toLowerCase().replace(/\u200d/g, '')

      //Check if we've searched for this term before
      const cachedRes = this.$store.getters['search/getTitleCache'](query)
      if (cachedRes) {
        this.results = cachedRes
        console.log(`title search '${query}' found in cache ${cachedRes.length} results`);
        return
      }
      
      // Search all singlish_combinations of translations from roman to sinhala
      let words = isSinglishQuery(query) ? getPossibleMatches(query) : []
      if (!words.length) words = [query]; // if not singlish or no possible matches found
      // TODO: improve this code to ignore na na la la sha sha variations at the comparison
      const results = []
      const queryReg = new RegExp(words.join('|'), "i");
      // searching in the order of VP, SP and AP so the results will be in that order too
      for (let i = 0; i < this.orderedKeys.length && results.length < this.maxResults; i++) {
        const { key, pali, sinh } = this.$store.state.tree.index[this.orderedKeys[i]]

        const matchPali = queryReg.test(pali) && this.filterTitle.columns.indexOf(0) >= 0
        const match = matchPali || (queryReg.test(sinh) && this.filterTitle.columns.indexOf(1) >= 0)
        if (match && inFilter(key, this.filterTitle.keys)) {  
          const language = matchPali ? 'pali' : 'sinh'
          results.push({ key, language })
        }
      }

      console.log(`title search '${query}' full search ${results.length} results`);
      this.$store.commit('search/setTitleCache', { query, results })
      this.results = results
    },

    updatePage() {
      if (this.$route.path != this.linkToPage) { // prevent duplicated navigation at the beginning
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
    filterTitle: {
      deep: true,
      handler() {
        console.log(`filter title updated`)
        this.debouncedGetResults()
      },
    },
  },

  mounted() { // coming from a different view
    if (this.searchInput != this.resultsInput) {
      this.updatePage() // update route too
    }
  },

  created() { // initial load from a url
    this.debouncedGetResults = _.debounce(this.getSearchResults, 200)
    const { term } = this.$route.params
    this.$store.commit('search/setSearchType', 'title')
    if (term) this.$store.commit('search/setSearchInput', term)
  }
}
</script>
