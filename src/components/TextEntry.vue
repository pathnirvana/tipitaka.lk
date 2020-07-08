<template>
  <td class="entry pa-2" :lang="entry.language" :style="$store.getters['styles']" 
    @mouseover="showEntryOptions" @mouseleave="entryOptions = false">
    <!--<span v-if="$parent.showTypeInfo" class="type-info">{{ entry.type + '.' + entry.level }}</span>-->
    <div :class="cssClasses" :level="entry.level" @click="showWordOptions">
      <template v-for="(se, i) in entry.text">

        <v-tooltip v-if="se[1] == 'fn-pointer' && footnoteMethod != 'end-page'" :key="i" bottom
          :open-on-click="footnoteMethod == 'click'" :open-on-hover="footnoteMethod == 'hover'" color="black">
          <template v-slot:activator="{ on }">
            <span v-on="on" class="fn-pointer">{{ se[0] }}</span>
          </template>
          <span v-for="(ne, j) in matchingNoteText(se[0])" :key="j" :class="ne[1] || false">{{ ne[0] }}</span>
        </v-tooltip>

        <span v-else :class="se[1] || false" :key="i" v-html="genWords(se[0])"></span>

      </template>
      <ShareLinkIcon v-if="entry.type == 'heading'" :link="linkToEntry" />
      <BookmarkIcon v-if="entry.type == 'heading'" :entry="entry" />
    </div>

    <v-menu v-if="entryOptions || menuOpen" v-model="menuOpen" offset-y class="options-menu">
      <template v-slot:activator="{ on }">
        <v-btn color="info" rounded icon absolute top left small class="ma-n2 pa-0"  v-on="on">
          <v-icon>mdi-dots-horizontal</v-icon>
        </v-btn>
      </template>
      <v-list dense>
        <v-list-item v-clipboard:copy="'https://tipitaka.lk' + linkToEntry" v-clipboard:success="onCopyLink" class="cursor-pointer">
          <v-list-item-icon><v-icon dense>mdi-share-variant</v-icon></v-list-item-icon>
          <v-list-item-title>link එකක් ලබාගන්න</v-list-item-title>
        </v-list-item>
        <v-list-item @click="2" disabled>
          <v-list-item-icon><v-icon dense>mdi-redo</v-icon></v-list-item-icon>
          <v-list-item-title>අටුවාව වෙත</v-list-item-title>
        </v-list-item>
        <BookmarkIcon :entry="entry" :isListItem="true" />
      </v-list>
    </v-menu>

  </td>
</template>

<style scoped>
/** Need to use em instead of rem because dynamic font-size is set at td */
td.entry { width: 50%; vertical-align: top; }
.text { font-family: 'sinhala'; font-size: 1.1em; line-height: 130%; position: relative; 
  word-break: break-word; white-space: pre-wrap; }

.heading { /*font-weight: bold;*/ font-family: 'heading2'; color: var(--v-primary-base); text-align: center; }
.heading[level="5"] { font-size: 2.0em; } /* sn-2 */
.heading[level="4"] { font-size: 1.8em; } /* sn-2-1-9 */
.heading[level="3"] { font-size: 1.6em; }
.heading[level="2"] { font-size: 1.4em; }
.heading[level="1"] { font-size: 1.3em; }

.paragraph { text-indent: 1.4em; padding-left: 0em; text-align: justify; }

.gatha { text-indent: 0em; padding-left: 2.4em; text-align: left; }
.gatha[level="2"] { padding-left: 5em; }

.unindented { text-indent: 0em; padding-left: 0em; text-align: left; }

.centered { text-align: center; /*font-weight: bold;*/ font-family: 'heading2' }
.centered[level="5"] { font-size: 2.1em; }
.centered[level="4"] { font-size: 1.8em; }
.centered[level="3"] { font-size: 1.5em; }
.centered[level="2"] { font-size: 1.25em; }
.centered[level="1"] { font-size: 1.1em; } /* normal text size here */
.centered[level="0"] { font-family: 'sinhala'; } /* non bold, just centered */

.html .fn-pointer { font-size: 0.9em; color: var(--v-error-base); cursor: pointer; padding: 0px 3px; }
.html .underline { text-decoration: underline; text-decoration-color: var(--v-error-base); }
.html .strike { text-decoration: line-through; text-decoration-color: var(--v-accent-base); }
.html .bold { color: var(--v-info-base); }
.html .highlight { background-color: var(--v-highlight-base); } /* fts */

td.entry { position: relative; }
/* .type-info { position: absolute; top: 0; left: 0; font-size: 0.8em; opacity: 0.5; color: gray; } */
.cursor-pointer { cursor: pointer; } /* cursor is not set properly in some menu items */
.html >>> w.bottom-open { background-color: var(--v-highlight-base); }
</style>

<script>
import { mapState } from 'vuex'

const optionsAllowedTypes = ['heading', 'gatha', 'paragraph']

export default {
  name: 'TextEntry',
  props: {
    entry: Object,
    footnotes: Array,
  },
  
  data() {
    return {
      showOptions: false,
      entryOptions: false,
      menuOpen: false,
    }
  },
  
  computed: {
    ...mapState(['footnoteMethod']),
    cssClasses() { return `text html ${this.entry.type}`},
    entryColor() {
      if (this.entry.type == 'heading') return 'primary'
      return ''
    },
    linkToEntry() {
      if (this.entry.type == 'heading') {
        return `/${this.entry.key}/${this.entry.language}`
      }
      return `/${this.entry.key}/${this.entry.eInd.join('-')}/${this.entry.language}`
    },
  },

  methods: {
    genWords(text) {
      if (this.entry.language == 'sinh') return text // for now only for pali
      return '<w>' + text.replace(/(\s)/g, '</w>$1<w>') + '</w>' // need to handle \n in gatha
      //return text.split(' ').map(w => `<w>${w}</w>`).join(' ')
    },
    matchingNoteText(number) {
      const ff = this.footnotes.find(note => note.number == number)
      return ff ? ff.text : []
    },
    onCopyLink() {
      this.$store.commit('setSnackbar', { type: 'link-copied' })
    },
    showEntryOptions() {
      this.entryOptions = optionsAllowedTypes.indexOf(this.entry.type) >= 0 && this.entry.key
    },
    showWordOptions(e) {
      if (e.target.matches('w')) {
        console.log(e.target.innerText)
        this.$store.dispatch('search/openBottomSheet', e.target)
      }
    },
  },

}
</script>