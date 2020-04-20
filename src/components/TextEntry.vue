<template>
  <td class="entry py-2" :lang="language" :style="{ fontSize }" v-if="entryVisible">
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
      <v-btn v-if="entry.type == 'heading'" icon x-small v-clipboard:copy="linkToEntry" color="info">
        <v-icon>mdi-share-variant</v-icon>
      </v-btn>
    </div>
  </td>
</template>

<style scoped>
/** Need to use em instead of rem because dynamic font-size is set at td */
td.entry { width: 50%; vertical-align: top; }
.text { font-family: 'sinhala'; font-size: 1.1em; line-height: 130%; position: relative; 
  word-break: break-word; white-space: pre-wrap; }

.page-break { text-align: center; color: var(--v-info-base); }
.heading { /*font-weight: bold;*/ font-family: 'heading2'; color: var(--v-primary-base); text-align: center; }
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
.centered[level="2"] { font-size: 1.3em; }
.centered[level="1"] { font-size: 1.2em; }

.html .fn-pointer { vertical-align: super; font-size: 0.9em; color: var(--v-error-base); cursor: pointer; }
.html .underline { text-decoration: underline; text-decoration-color: var(--v-error-base); }
.html .strike { text-decoration: line-through; text-decoration-color: var(--v-accent-base); }
.html .bold { color: var(--v-info-base); }

td.entry { position: relative; }
.type-info { position: absolute; top: 0; left: 0; font-size: 0.8em; opacity: 0.5; color: gray; }
</style>

<script>
import { mapState } from 'vuex'
export default {
  name: 'TextEntry',
  props: {
    entry: Object,
    language: String,
    footnotes: Array,
  },
  
  data() {
    return { }
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
      return 'https://tipitaka.lk/dn-1-1'
    },
  },

  methods: {
    matchingNoteText(number) {
      const ff = this.footnotes.find(note => note.number == number)
      return ff ? ff.text : []
    },
  },

}
</script>