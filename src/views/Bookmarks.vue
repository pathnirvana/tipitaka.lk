<template>
  <v-sheet>
    <v-banner>{{ bookmarkMessage }}</v-banner>

    <v-simple-table v-if="$store.getters.isLoaded">
      <tbody>
        <tr v-for="(bookmark, bKey) in bookmarks" :key="bKey">
          <td :style="getTdStyle">
            <TipitakaLink :itemKey="bookmark.key" :params="bookmark" />

            <div v-if="bookmark.type != 'heading'" :class="bookmark.type" :style="$store.getters['styles']">
              <template v-if="!!bookmark.text">
                <span v-for="(se, i) in bookmark.text" :class="se[1] || false" :key="i" v-html="se[0]"></span>
              </template>
              <div v-else class="html" v-html="bookmark.hText"></div>
            </div>
          </td>
        </tr>
      </tbody>
    </v-simple-table>

    <!-- v-else show loading indicator -->
    <v-skeleton-loader v-else type="table"></v-skeleton-loader>
  </v-sheet>
</template>

<style scoped>
/* TODO consider copying some basic styles for gatha/para/centered here from TextEntry */
.html >>> sr { background-color: var(--v-highlight-base); }
</style>

<script>
/**
 * while it is possible to provide search and filter functions for the bookmarks
 * for now lets keep things simple and just show the bookmarks
 */
import TipitakaLink from '@/components/TipitakaLink'
import { copyMetaTitle } from '@/constants.js'
import { mapState } from 'vuex'
import _ from 'lodash'
import { IOS, platform } from '../constants';

export default {
  name: 'Bookmarks',
  components: {
    TipitakaLink,
  },

  data: () => ({ }),
  
  computed: {
    ...mapState('search', ['bookmarks']),
    
    bookmarkMessage() {
      if (!this.bookmarksCount) {
        return `ඔබ කිසිම සූත්‍රයකට හෝ පරිච්ඡේදයකට තරු යොදා නැත. සටහන් තැබීමට තරු ලකුණ මත ඔබන්න.`
      } else { 
        return `ඔබ විසින් තරු යෙදු සූත්‍ර ${this.bookmarksCount} ක ලැයිස්තුවක් පහත දැක්වේ.`
      }
    },
    bookmarksCount() { return Object.keys(this.bookmarks).length },
    getTdStyle(){
        return platform === IOS ? { paddingTop: '10px', paddingBottom: '10px' } : {};
    }
  },

  metaInfo() {  
    return copyMetaTitle('තරු යෙදූ සූත්‍ර - Starred')
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
