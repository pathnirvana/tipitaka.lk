<template>
  <v-sheet>
    <v-banner>{{ searchMessage }}
      <template v-slot:actions="{ }">
        <v-btn color="primary" @click.stop="showFilter = true" icon><v-icon>mdi-filter-variant</v-icon></v-btn>
      </template>
    </v-banner>
    
    <v-simple-table v-if="$store.getters.isLoaded" dense>
      <thead><tr>
        <th class="text-left">Name</th>
      </tr></thead>
      <tbody>
        <tr v-for="itemKey in searchResults" :key="itemKey">
          <td><TipitakaLink :itemKey="itemKey"/></td>
        </tr>
      </tbody>
    </v-simple-table>
    <!-- v-else show loading indicator -->
    <v-skeleton-loader v-else type="table"></v-skeleton-loader>

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

export default {
  name: 'Search',
  components: {
    TipitakaLink,
  },

  data: () => ({
    results: [],
    showFilter: false,
    filterTreeOpenKeys: ['sp'],
  }),
  
  computed: {
    ...mapState('search', ['maxResults']),
    ...mapGetters('search', ['getSearchResults']),
    searchResults() {
      console.log('searching for term')
      return this.getSearchResults(this.term)
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
    filterKeys: {
      get() { return this.$store.state.search.filterKeys  },
      set(keys) { this.$store.commit('search/setFilter', keys) },
    },
  },
  methods: {
    refreshSearch() {
      if (!this.term) return;
      //console.log(`searching for term ${this.term}`)
      //this.searchResults = this.getSearchResults(this.term)
    },
  },
  /*mounted() {
    this.refreshSearch()
  },
  watch: {
    $route(to, from) { // react to route changes...
      if (to.params.term) {
        this.refreshSearch()
      }
    },
  },*/
}
</script>
