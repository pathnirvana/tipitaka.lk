<template>
  <td class="entry py-2" :lang="language">
    <!--<span v-if="$parent.showTypeInfo" class="type-info">{{ entry.type + '.' + entry.level }}</span>-->
    <div class="text html" :class="entry.type" :level="entry.level" v-html="renderedHtml">
    </div>
  </td>
</template>

<style scoped>
td.entry { width: 50%; vertical-align: top; }
.text { font-family: 'sinhala'; font-size: 1.1rem; line-height: 130%; position: relative; word-break: break-word; }

.heading { /*font-weight: bold;*/ font-family: 'heading2'; color: brown; text-align: center; }
.heading[level="3"] { font-size: 1.6rem; }
.heading[level="2"] { font-size: 1.4rem; }
.heading[level="1"] { font-size: 1.3rem; }

.paragraph { text-indent: 1.4rem; padding-left: 0rem; text-align: justify; }

.gatha { text-indent: 0rem; padding-left: 2.4rem; text-align: left; }
.gatha[level="2"] { padding-left: 5rem; }

.unindented { text-indent: 0rem; padding-left: 0rem; text-align: left; }

.centered { text-align: center; /*font-weight: bold;*/ font-family: 'heading2' }
.centered[level="5"] { font-size: 2.1rem; }
.centered[level="4"] { font-size: 1.8rem; }
.centered[level="3"] { font-size: 1.5rem; }
.centered[level="2"] { font-size: 1.3rem; }
.centered[level="1"] { font-size: 1.2rem; }

/* need >>> for using styles with v-html */
.html >>> .fn-pointer { vertical-align: super; font-size: 1rem; color: red; }
.html >>> u { text-decoration: underline; text-decoration-color: crimson; }
.html >>> s { text-decoration: line-through; text-decoration-color: orange; }
.html >>> b { color: rgb(5, 0, 0); }

td.entry { position: relative; }
.type-info { position: absolute; top: 0; left: 0; font-size: 0.8rem; opacity: 0.5; color: gray; }
</style>

<script>
import { textToHtml } from '@/text-convert.mjs'

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
    renderedHtml() {
      return textToHtml(this.entry.text, this.language)
    },
  },
  methods: {
  },

}
</script>