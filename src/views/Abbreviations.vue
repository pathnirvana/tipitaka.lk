<template>
  <v-sheet>
    <v-banner>{{ `සියලුම පොත් වල අඩංගු කෙටි යෙදුම් වල එකතුවක් පහත දක්වා ඇත.` }}</v-banner>

    <v-simple-table v-if="$store.getters.isLoaded" dense>
      <thead>
        <tr>
          <th class="table-heading">කෙටි යෙදුම</th>
          <th class="table-heading">අර්ථ විස්තරය</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(desc, abbr) in footnoteAbbreviations" :key="abbr">
          <td class="abbr">{{ abbr }}</td>
          <td class="desc">{{ desc }}</td>
        </tr>
      </tbody>
    </v-simple-table>

    <!-- v-else show loading indicator -->
    <v-skeleton-loader v-else type="table"></v-skeleton-loader>
  </v-sheet>
</template>

<style scoped>
th.table-heading { font-size: 1rem !important; font-weight: normal; }
td.abbr { font-size: 1rem !important; color: var(--v-info-base); }
td.desc { font-size: 1rem !important; }
</style>

<script>
import { copyMetaTitle } from '@/constants.js'
import { mapState } from 'vuex'

export default {
  name: 'Abbreviations',
  components: {
  },

  data: () => ({ }),
  
  computed: {
    ...mapState(['footnoteAbbreviations', 'footnoteAbbreviationKeys']),
    
    abbreviationsCount() { return this.footnoteAbbreviationKeys.length }
  },

  metaInfo() {  
    return copyMetaTitle('කෙටි යෙදුම් - Abbreviations')
  },

  methods: {
  },
  
  watch: {
  },

  mounted() { // coming from a different view

  },

  created() { // initial load from a url
  }
}
</script>
