<template>
  <v-sheet>
    <v-banner >{{ searchMessage }}</v-banner>
    <v-simple-table dense>
      <thead><tr>
        <th class="text-left">Name</th>
        <th class="text-left">Location</th>
      </tr></thead>
      <tbody v-if="$store.state.tree.isLoaded">
        <tr v-for="[itemKey, suttaName] in searchResults" :key="itemKey">
          <td class="sutta-name"><router-link :to="'/' + itemKey">{{ suttaName }}</router-link></td>
          <td><TipitakaLink :itemKey="itemKey"/></td>
        </tr>
      </tbody>
      <!-- v-else show loading indicator -->
    </v-simple-table>
  </v-sheet>
</template>

<style scoped>
.sutta-name { font-size: 1.1rem; }
.sutta-name a { text-decoration: none; }
</style>

<script>
//
import TipitakaLink from '@/components/TipitakaLink'
import { mapState } from 'vuex'

export default {
  name: 'Search',
  components: {
    TipitakaLink,
  },

  data: () => ({
    results: [],
  }),
  
  computed: {
    ...mapState('search', ['maxResults']),
    searchResults() {
      return this.$store.getters['search/getSearchResults'](this.term)
    },
    term() { return this.$route.params.term },
    searchMessage() {
      if (!this.searchResults.length)
        return `“${this.term}” යන සෙවුම සඳහා ගැළපෙන වචන කිසිවක් හමුවුයේ නැත. වෙනත් සෙවුමක් උත්සාහ කර බලන්න.`
      else if(this.searchResults.length < this.maxResults)
        return `“${this.term}” යන සෙවුම සඳහා ගැළපෙන වචන ${this.searchResults.length} ක් හමුවුනා.`
      else 
        return `ඔබගේ සෙවුම සඳහා ගැළපෙන වචන ${this.maxResults} කට වඩා හමුවුනා. එයින් මුල් වචන ${this.maxResults} පහත දැක්වේ.`
    },
  },
  methods: {
    getSuttaName() {
      return 
    },
  },
  watch: {
    /*$route(to, from) { // react to route changes...
      if (to.params.term) {
        this.$store.dispatch('search/getResults', to.params.term).then(function(res) {
          this.results = res
        })
      }
    },*/
  },

  mounted() {},
}
</script>
