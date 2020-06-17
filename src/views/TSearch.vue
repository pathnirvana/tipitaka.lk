<template>
  <v-sheet>
    <v-banner v-if="!!inputError" color="error">{{ inputError }}</v-banner>
    <v-banner v-else-if="!!searchMessage">{{ searchMessage }}</v-banner>
    <FilterTree searchType="title" />

    <v-simple-table v-if="$store.getters.isLoaded">
      <tbody>
        <tr v-for="({key, lang}, i) in results" :key="i">
          <td>
            <TipitakaLink :itemKey="key" :language="lang" />
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
import { isSinglishQuery } from '@/singlish.js'
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

export default {
  name: 'TSearch',
  metaInfo: { title: 'සූත්‍ර සෙවුම' },
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
    ...mapGetters('search', ['searchDataSet']),
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
    filterTitle() { return this.$store.state.search.filter.title  }, // just for watching 
  },
  methods: {
    ...mapMutations('search', ['setSearchInput']),
    getSearchResults() {
      if (this.inputError) return;
      this.results = this.searchDataSet(this.searchInput)
      console.log(`title search for term ${this.searchInput} got ${this.results.length} results`)
      this.resultsInput = this.searchInput
    },
    updatePage() {
      if (this.$route.params.term != this.searchInput) {
        // prevent duplicated navigation at the beginning
        this.$router.replace({ name: 'title', params: { term: this.searchInput } })
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

  mounted() {
    if (this.searchInput != this.resultsInput) {
      this.updatePage() // update route too
    }
  },

  created() {
    this.debouncedGetResults = _.debounce(this.getSearchResults, 200)
    const { term } = this.$route.params
    this.$store.commit('search/setSearchType', 'title')
    if (term) this.$store.commit('search/setSearchInput', term)
  }
}
</script>
