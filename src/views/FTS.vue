<template>
  <v-sheet>
    <v-form>
      <v-text-field label="Search terms" v-model="searchInputRaw" hide-details="auto"></v-text-field>
      <v-switch v-model="matchPhrase" :label="matchPhrase ? 'matching phrase' : 'as terms'"></v-switch>
      <v-text-field label="dist" v-model="wordDistance" :disabled="matchPhrase"></v-text-field>
    </v-form>

    <v-banner>{{ searchMessage }}
      <template v-slot:actions="{ }">
        <v-btn color="primary" @click.stop="showFilter = true" icon><v-icon>mdi-filter-variant</v-icon></v-btn>
      </template>
    </v-banner>
    
    <v-simple-table v-if="results.length" dense>
      <tbody>
        <tr v-for="(res, i) in results" :key="i">
          <td>{{ res.file }}</td>
          <td><div v-html="res.htext"></div></td>
        </tr>
      </tbody>
    </v-simple-table>
    <!-- v-else show loading indicator -->
    <!--<v-skeleton-loader v-else type="table"></v-skeleton-loader>-->

    <v-dialog v-model="showFilter" max-width="290">
      <v-card>
        <v-card-title>Setup Search Filter</v-card-title>
        <v-card-text>
          <v-treeview :items="$store.state.tree.filterTree" v-model="filterKeys" dense selectable
            item-key="key" :item-text="$store.state.treeLanguage" :open.sync="filterTreeOpenKeys">
          </v-treeview>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="error" text @click="$store.commit('search/setFilter', [])">Clear</v-btn>
          <v-btn color="success" text @click="showFilter = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

  </v-sheet>
</template>

<style scoped>

</style>

<script>
//
import TipitakaLink from '@/components/TipitakaLink'
import { mapState, mapGetters } from 'vuex'
import axios from 'axios'
import _ from 'lodash'

export default {
  name: 'FTS',
  components: {
    TipitakaLink,
  },

  data: () => ({
    results: [],
    maxResults: 100,
    showFilter: false,
    filterTreeOpenKeys: ['sp'],
    searchInputRaw: '',
    matchPhrase: false,
    wordDistance: 10,
  }),
  
  computed: {
    //...mapState('search', ['maxResults']),
    //...mapGetters('search', ['getSearchResults']),
    searchInput() {
      return this.searchInputRaw.trim().replace(/\u200d/, '') // TODO add more here
    },
    //term() { return this.$route.params.term },
    searchMessage() {
      if (!this.results.length)
        return `“${this.searchInput}” යන සෙවුම සඳහා ගැළපෙන වචන කිසිවක් හමුවුයේ නැත. වෙනත් සෙවුමක් උත්සාහ කර බලන්න.`
      else if(this.results.length < this.maxResults)
        return `“${this.searchInput}” යන සෙවුම සඳහා ගැළපෙන වචන ${this.results.length} ක් හමුවුනා.`
      else 
        return `ඔබගේ සෙවුම සඳහා ගැළපෙන වචන ${this.maxResults} කට වඩා හමුවුනා. එයින් මුල් වචන ${this.maxResults} පහත දැක්වේ.`
    },
    filterKeys: {
      get() { return this.$store.state.search.filterKeys  },
      set(keys) { this.$store.commit('search/setFilter', keys) },
    },
  },
  methods: {
    async getSearchResults() {
      const match = this.matchPhrase ? `"${this.searchInput}"` : `NEAR(${this.searchInput}, ${this.wordDistance})`
      const sql = `SELECT file, eind, lang, highlight(tipitaka, 5, '<b>', '</b>') AS htext FROM tipitaka 
          WHERE text MATCH '${match}' ORDER BY rank LIMIT 100;`
      const res = await axios.post('http://localhost:5555/tipitaka-query/fts', { type: 'fts', sql })
      console.log(res.data)
      this.results = res.data
    },
  },
  
  watch: {
    searchInput(newInput, oldInput) {
      if (newInput) {
        this.debouncedGetResults()
      }
    },
    matchPhrase() { this.debouncedGetResults() },
    wordDistance() { this.debouncedGetResults() },
  },
  created() {
    this.debouncedGetResults = _.debounce(this.getSearchResults, 200)
  }
}
</script>
