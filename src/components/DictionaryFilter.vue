<template>
  <v-dialog v-model="dialog" max-width="300">
    <template v-slot:activator="{ on, attrs }">
      <v-btn v-bind="attrs" v-on="on" :depressed="!isLimited" class="my-2">
        <v-icon class="mr-2" :color="isLimited ? 'primary' : ''">mdi-book-open-page-variant</v-icon>
        {{ isLimited ? 'සෙවුම් ශබ්දකෝෂ සීමා වී ඇත' : 'සෙවුම් ශබ්දකෝෂ සීමා කිරීම' }}
      </v-btn>
    </template>
    
    <v-card>
      <v-card-title class="mb-4">ශබ්දකෝෂ තෝරන්න</v-card-title>
      <v-card-subtitle>ඔබගේ සෙවුම පහත ශබ්දකෝෂ වලට පමණක් සීමා වනු ඇත.</v-card-subtitle>
      <v-card-text>
        <v-treeview :items="dictionaryTree" v-model="selectedDictionaries" dense selectable
          item-key="key" item-text="key" :open="openKeys">
        </v-treeview>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn @click="dialog = false">
          <v-icon color="success" class="mr-1">mdi-close</v-icon>වසන්න
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>

</style>

<script>
import { dictionaryInfo, Language } from '@/constants.js'
import { mapGetters } from 'vuex'

const keysForLanguage = (lang) => Object.keys(dictionaryInfo)
  .filter(key => dictionaryInfo[key][0] == lang)
  .map(key => ({ key }))

export default {
  name: 'DictionaryFilter',
  props: {  },
  data() {
    return {
      dialog: false,
      dictionaryTree: [
        { key: 'සිංහල', children: keysForLanguage(Language.SI) },
        { key: 'English', children: keysForLanguage(Language.EN) },
      ],
      openKeys: [ 'සිංහල', 'English' ],
    }
  },
  computed: {
    ...mapGetters('search', ['getKey', 'getName']),
    selectedDictionaries: {
      get() { return this.$store.state.search.selectedDictionaries },
      set(newList) { this.$store.commit('search/setSelectedDicts', newList) },
    },
    isLimited() { return this.selectedDictionaries.length <  Object.keys(dictionaryInfo).length },
  },

  methods: {  },
}
</script>