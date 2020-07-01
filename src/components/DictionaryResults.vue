<template>
  <v-sheet v-if="!isEmptyResults">
    <v-sheet v-if="results.breakups.length" class="d-flex flex-wrap my-2">
      <div v-for="({word, type, breakup}, i) in results.breakups" :key=i class="px-4 breakup">
        <span>{{ word }}</span>
        <v-chip outlined class="mx-1">{{ type }}</v-chip>
        <span>{{ breakup }}</span>
      </div>
    </v-sheet>

    <v-simple-table v-if="results.matches.length">
      <tbody>
        <tr v-for="({ word, dict, meaning }, i) in results.matches" :key="i">
          <td class="result" :style="$store.getters['styles']">
            <span class="word">{{ word }}</span>
            <v-chip class="mx-3" x-small>{{ dict }}</v-chip>
            <span class="meaning" v-html="meaning"></span>
          </td>
        </tr>
      </tbody>
    </v-simple-table>

    <v-card v-if="results.prefixWords.length">
      <v-card-subtitle>ශබ්දකෝෂ වල ඇති මෙම අකුරු වලින් ඇරඹෙන වෙනත් වචන</v-card-subtitle>
      <v-card-text>
        <v-chip v-for="({ word }, i) in results.prefixWords" :key="i" class="ma-1"
          @click="$router.push({ name: 'dict', params: { word } })">{{ word }}</v-chip>
      </v-card-text>
    </v-card>
  </v-sheet>
</template>

<style scoped>
.result .word { color: var(--v-info-base); }
</style>

<script>
import { dictionaryInfo, Language } from '@/constants.js'
import { mapGetters } from 'vuex'
import _ from 'lodash'

export default {
  name: 'DictionaryResults',
  props: { 
    results: Object
  },
  data() {
    return {
      dialog: false,
    }
  },
  computed: {
    ...mapGetters('search', ['getKey', 'getName']),
    isEmptyResults() { return _.isEmpty(this.results) },
  },

  methods: {  },
}
</script>