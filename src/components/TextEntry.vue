<template>
  <td class="entry py-2" :lang="entry.language" :style="{ fontSize }" v-if="entryVisible" @click="toggleOptions">
    <!--<span v-if="$parent.showTypeInfo" class="type-info">{{ entry.type + '.' + entry.level }}</span>-->
    <div class="text html" :class="entry.type" :level="entry.level">
      <hr v-if="entry.type == 'page-break'"/>
      <template v-for="(se, i) in entry.text">

        <v-tooltip v-if="se[1] == 'fn-pointer' && footnoteMethod != 'end-page'" :key="i" bottom
          :open-on-click="footnoteMethod == 'click'" :open-on-hover="footnoteMethod == 'hover'" color="black">
          <template v-slot:activator="{ on }">
            <span v-on="on" class="fn-pointer">{{ se[0] }}</span>
          </template>
          <span v-for="(ne, j) in matchingNoteText(se[0])" :key="j" :class="ne[1] || false">{{ ne[0] }}</span>
        </v-tooltip>

        <span v-else :class="se[1] || false" :key="i">{{ se[0] }}</span>

      </template>
      <v-btn v-if="entry.type == 'heading'" icon x-small color="info"
        v-clipboard:copy="linkToEntry" v-clipboard:success="onCopyLink">
        <v-icon small>mdi-share-variant</v-icon>
      </v-btn>
    </div>

    <v-menu v-if="showOptions" offset-y>
      <template v-slot:activator="{ on }">
        <v-btn color="info" rounded icon absolute top left small class="ma-n2 pa-0"  v-on="on">
          <v-icon>mdi-dots-horizontal</v-icon>
        </v-btn>
      </template>
      <v-list dense>
        <v-list-item v-clipboard:copy="linkToEntry" v-clipboard:success="onCopyLink">
          <v-list-item-icon><v-icon dense>mdi-share-variant</v-icon></v-list-item-icon>
          <v-list-item-title>link එකක් ලබාගන්න</v-list-item-title>
        </v-list-item>
        <v-list-item @click="2">
          <v-list-item-icon><v-icon dense>mdi-redo</v-icon></v-list-item-icon>
          <v-list-item-title>අටුවාව වෙත</v-list-item-title>
        </v-list-item>
        <v-list-item @click="2">
          <v-list-item-icon><v-icon dense>mdi-star-outline</v-icon></v-list-item-icon>
          <v-list-item-title>තරුවක් යොදන්න</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>

  </td>
</template>

<style scoped>
/** Need to use em instead of rem because dynamic font-size is set at td */
td.entry { width: 50%; vertical-align: top; }
.text { font-family: 'sinhala'; font-size: 1.1em; line-height: 130%; position: relative; 
  word-break: break-word; white-space: pre-wrap; }

.page-break { text-align: center; color: var(--v-info-base); }
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

td.entry { position: relative; }
.type-info { position: absolute; top: 0; left: 0; font-size: 0.8em; opacity: 0.5; color: gray; }
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
    }
  },
  
  computed: {
    ...mapState(['footnoteMethod']),
    fontSize() { return 16 + this.$store.state.fontSize + 'px' },
    entryVisible() {
      if (this.entry.type != 'page-break') return true
      return this.$store.state.showPageNumbers
    },
    entryColor() {
      if (this.entry.type == 'heading') return 'primary'
      if (this.entry.type == 'page-break') return 'info'
      return ''
    },
    linkToEntry() {
      if (this.entry.type == 'heading') {
        return `https://tipitaka.lk/${this.entry.key}/${this.entry.language}`
      }
      return `https://tipitaka.lk/${this.entry.key}/${this.entry.eind[0]}:${this.entry.eind[1]}/${this.entry.language}`
    },
  },

  methods: {
    matchingNoteText(number) {
      const ff = this.footnotes.find(note => note.number == number)
      return ff ? ff.text : []
    },
    onCopyLink() {
      const message = 'link copied'
      this.$store.commit('setSnackbar', {message, timeout: 1000})
    },
    toggleOptions() {
      if (optionsAllowedTypes.indexOf(this.entry.type) < 0) return
      this.showOptions = !this.showOptions
    },
  },

}
</script>