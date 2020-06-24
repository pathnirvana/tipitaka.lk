<template>
  <v-dialog v-model="dialog" max-width="300">
    <template v-slot:activator="{ on, attrs }">
      <v-btn v-bind="attrs" v-on="on" :depressed="!isLimited">
        <v-icon class="mr-1" :color="isLimited ? 'primary' : ''">mdi-filter-variant</v-icon>
        {{ isLimited ? 'සෙවුම සීමා වී ඇත' : 'සෙවුම සීමා කිරීම' }}
      </v-btn>
    </template>
    
    <v-card>
      <v-card-title>සෙවුම් සීමා කරන්න</v-card-title>
      <v-card-text>
        <v-btn-toggle v-model="filterColumns" dense multiple mandatory shaped color="primary">
          <v-btn :value="0" text>පාළි</v-btn>
          <v-btn :value="1" text>සිංහල</v-btn>
        </v-btn-toggle>
        <v-treeview :items="$store.state.tree.filterTree" v-model="filterKeys" dense selectable
          item-key="key" :item-text="$store.state.treeLanguage" :open.sync="filterTreeOpenKeys">
        </v-treeview>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="filterKeys = [...allKeys]" text>
          <v-icon color="accent" class="mr-1">mdi-checkbox-marked</v-icon>සියල්ල තෝරන්න
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn @click="dialog = false" text>
          <v-icon color="success" class="mr-1">mdi-close</v-icon>වසන්න
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>

</style>

<script>
import { allFilterKeys, allFilterLength } from '@/constants.js'
import { mapGetters } from 'vuex'

export default {
  name: 'FilterTree',
  props: {
    searchType: String,
  },
  data() {
    return {
      dialog: false,
      allKeys: allFilterKeys,
    }
  },
  computed: {
    ...mapGetters('search', ['getKey', 'getName']),
    filterTreeOpenKeys: {
      get() { return this.$store.getters['search/getFilterTreeOpenKeys'] },
      set(keys) { this.$store.commit('search/setFilterTreeOpenKeys', keys) }
    },
    filterKeys: {
      get() { return this.$store.getters['search/getFilter'](this.searchType, 'keys') },
      set(value) { this.$store.commit('search/setFilter', { type: this.searchType, param: 'keys', value }) }
    },
    filterColumns: {
      get() { return this.$store.getters['search/getFilter'](this.searchType, 'columns') },
      set(value) { this.$store.commit('search/setFilter', { type: this.searchType, param: 'columns', value }) }
    },
    isLimited() { return this.filterKeys.length < allFilterLength || this.filterColumns.length < 2 },
  },

  methods: {
  },
}
</script>