<template>
  <v-dialog v-model="dialog" max-width="300">
    <template v-slot:activator="{ on, attrs }">
      <v-btn outlined v-bind="attrs" v-on="on"><v-icon class="mr-1" color="primary">mdi-filter-variant</v-icon>සෙවුම සීමා කිරීම</v-btn>
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
        <v-spacer></v-spacer>
        <v-btn color="primary" outlined @click="filterKeys = allKeys">
          <v-icon class="mr-1">mdi-checkbox-marked</v-icon>තෝරන්න
        </v-btn>
        <v-btn outlined @click="filterKeys = []">
          <v-icon class="mr-1">mdi-checkbox-blank-outline</v-icon>මකන්න
        </v-btn>
        <v-btn color="success" outlined @click="dialog = false"><v-icon>mdi-close</v-icon></v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>

</style>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'TipitakaLink',
  props: {
    searchType: String,
  },
  data() {
    return {
      dialog: false,
      allKeys: ['vp', 'sp', 'ap'],
    }
  },
  computed: {
    ...mapGetters('search', ['getKey', 'getName']),
    filterTreeOpenKeys: {
      get() { return this.$store.getters['search/getFilterTreeOpenKeys'] },
      set(keys) { this.$store.commit('search/setFilterTreeOpenKeys', keys) }
    },
    filterKeys: {
      get() { return this.$store.getters['search/getFilterKeys'](this.searchType) },
      set(keys) { this.$store.commit('search/setFilterKeys', { type: this.searchType, keys }) }
    },
    filterColumns: {
      get() { return this.$store.getters['search/getFilterColumns'] },
      set(cols) { this.$store.commit('search/setFilterColumns', cols) }
    },
  },

  methods: {
  },
}
</script>