<template>
  <td class="entry py-2" :lang="language" :style="{ fontSize }">
    <!--<span v-if="$parent.showTypeInfo" class="type-info">{{ entry.type + '.' + entry.level }}</span>-->
    <div class="text html" :class="entry.type" :level="entry.level" > <!-- v-html="renderedHtml" -->
      <span v-for="(se, i) in subEntries" :key="i" :class="se[0]">{{ se[1] || se[0] }}</span>
    </div>
  </td>
</template>

<style scoped>
/** Need to use em instead of rem because dynamic font-size is set at td */
td.entry { width: 50%; vertical-align: top; }
.text { font-family: 'sinhala'; font-size: 1.1em; line-height: 130%; position: relative; 
  word-break: break-word; white-space: pre-wrap; }

.heading { /*font-weight: bold;*/ font-family: 'heading2'; color: brown; text-align: center; }
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

/* need >>> for using styles with v-html */
.html >>> .fn-pointer { vertical-align: super; font-size: 0.9em; color: red; }
.html >>> u { text-decoration: underline; text-decoration-color: crimson; }
.html >>> s { text-decoration: line-through; text-decoration-color: orange; }
.html >>> b { color: rgb(5, 0, 0); }

.html .fn-pointer { vertical-align: super; font-size: 0.9em; color: red; }
.html .underline { text-decoration: underline; text-decoration-color: crimson; }
.html .strike { text-decoration: line-through; text-decoration-color: orange; }
.html .bold { color: rgb(7, 64, 150); }

td.entry { position: relative; }
.type-info { position: absolute; top: 0; left: 0; font-size: 0.8em; opacity: 0.5; color: gray; }
</style>

<script>
import { textToHtml, beautifySinh, addSpecialLetters, addBandiLetters } from '@/text-convert.mjs'
const footnoteRegEx = '\{(\\d+|\\S)([^\{\}]*?)\}'
const fnPointText = '|fn-pointer℗$1|'

export default {
  name: 'TextEntry',
  props: {
    filename: String,
    entry: Object,
    language: String,
  },
  data() {
    return {
      
    }
  },
  computed: {
    subEntries() {
      const {bandiLetters, specialLetters, footnoteMethod} = this.$store.state
      let text = this.entry.text
      text = text.replace(new RegExp(footnoteRegEx, 'g'), footnoteMethod == 'hidden' ? '' : fnPointText);
      text = beautifySinh(text)
      if (this.language == 'pali') {
          if (specialLetters) text = addSpecialLetters(text)
          if (bandiLetters) text = addBandiLetters(text)
      }
      text = text.replace(/\*\*(.*?)\*\*/g, '|bold℗$1|') // using the markdown styles
      text = text.replace(/__(.*?)__/g, '|underline℗$1|') // underline
      text = text.replace(/~~(.*?)~~/g, '|strike℗$1|') // strike through
      if (!text) text = '|strike℗Empty - තීරුව හිස් !|' // if left empty it is not clickable
      return text.split('|').filter(t => t.length).map(t => t.split('℗'))
    },
    renderedHtml() {
      return textToHtml(this.entry.text, this.language, this.$store.state)
    },
    fontSize() { return 16 + this.$store.state.fontSize + 'px' },
  },
  methods: {

  },

}
</script>