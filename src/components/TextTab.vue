<template>
<!-- <v-scale-transition hide-on-leave> -->
  <v-sheet class="my-4">
    <!--<div v-scroll:window="handleScroll">{{ scrollTop }}</div>-->
    <v-card v-if="tab.errorMessage" color="error">
      <v-card-title>සූත්‍රය ලබාගැනීමේදී වරදක් සිදුවිය</v-card-title>
      <v-card-text>{{ tab.errorMessage }}</v-card-text>
    </v-card>
    
    <v-skeleton-loader v-else-if="!tab.isLoaded" type="paragraph"></v-skeleton-loader>
    
    <div v-else v-touch="{ left: () => touchSwipe('L'), right: () => touchSwipe('R') }">
      <v-btn absolute rounded small top right @click="loadPrevPage(tabIndex)">
        <v-icon>mdi-chevron-up</v-icon>
      </v-btn>

      <v-simple-table v-for="({rows, footnotes, pageNum }, pi) in visiblePages" :key="pi" dense style="table-layout: fixed">
        <tr v-if="$store.state.showPageNumbers">
          <td v-if="columns.pali" class="page-number">
            <v-btn text small color="info" @click.stop="displayScanned(pageNum)">{{ pageNum }}</v-btn>
          </td>
          <td v-if="columns.sinh && !paliOnly" class="page-number">
            <v-btn text small color="info" @click.stop="displayScanned(pageNum + 1)">{{ pageNum + 1 }}</v-btn>
          </td>
        </tr>
        <tr v-for="(row, ei) in rows" :key="ei">
          <TextEntry v-if="columns.pali" :entry="row.pali" :footnotes="footnotes.pali"></TextEntry>
          <TextEntry v-if="columns.sinh && !paliOnly" :entry="row.sinh" :footnotes="footnotes.sinh"></TextEntry>
        </tr>
        <tr>
          <Footnotes v-if="columns.pali" language="pali" :footnotes="footnotes.pali"></Footnotes>
          <Footnotes v-if="columns.sinh && !paliOnly" language="sinh" :footnotes="footnotes.sinh"></Footnotes>
        </tr>
      </v-simple-table>

      <v-card v-if="tab.pageEnd < tab.data.pages.length" class="text-center" @click="loadNextPage({ tabIndex, by: 1 })"
        v-intersect="{ handler: loadNextSection, options: {threshold: [0.5]} }">
        <v-card-text>ඊළඟ කොටස පෙන්වන්න.</v-card-text>
      </v-card>
    </div>

    <v-dialog v-if="tab.isLoaded" v-model="showScanPage" max-width="500">
      <v-card outlined >
        <v-img :src="bjtImgSrc"></v-img>
        <v-btn icon small top right absolute @click="showScanPage = false" color="accent"><v-icon>mdi-close</v-icon></v-btn>
      </v-card>
    </v-dialog>

  </v-sheet>
<!-- </v-scale-transition> -->
</template>

<style scoped>
.snack { opacity: 0.85; font-size: 1.1rem; max-width: 100px; }
.page-number { text-align: center; color: var(--v-info-base); }
</style>

<script>
import TextEntry from '@/components/TextEntry.vue'
import Footnotes from '@/components/Footnotes.vue'
import { beautifyText } from '@/text-convert.mjs'
import { mapState, mapGetters, mapMutations } from 'vuex'
import axios from 'axios'

const eIndEquals = (a, b) => a[0] == b[0] && a[1] == b[1]
const highlightWords = (text, words) => {
  const re = new RegExp(words.join('|'), 'g')
  return text.replace(re, '##$&##')
}

export default {
  name: 'TextTab',
  components: {
    TextEntry,
    Footnotes,
  },
  props: {
    tabIndex: Number,
  },

  data() {
    return {
      showScanPage: false, clickedPageNum: 0,
      scrollTop: null,
    }
  },

  computed: {
    ...mapState('tree', ['orderedKeys']),
    ...mapState('tabs', ['tabList']),
    ...mapGetters('tabs', ['getVisiblePages']),
    columns() {
      const columns = this.$store.getters['tabs/getTabColumns']
      return { pali: columns.indexOf(0) >= 0, sinh: columns.indexOf(1) >= 0 }
    },
    tab() { return this.tabList[this.tabIndex] },
    //errorMessage() { return this.tab.errorMessage },
    filename() { return this.tab.keyProp.filename }, // or from data
    visiblePages() {
      return this.getVisiblePages(this.tabIndex).map((page, i) => {
        const rows = [], footnotes = { pali: [], sinh: [] }
        page.pali.entries.forEach((paliEntry, ei) => {
          if (i == 0 && ei < this.tab.entryStart) return
          const pair = { pali: this.processEntry(paliEntry), 
                         sinh: !this.paliOnly ? this.processEntry(page.sinh.entries[ei]) : null }
          rows.push(pair)
        })
        footnotes.pali = page.pali.footnotes.map(f => this.processFootnote(f, 'pali'))
        footnotes.sinh = page.sinh.footnotes.map(f => this.processFootnote(f, 'sinh'))
        return ({ rows, footnotes, pageNum: parseInt(page.pageNum) })
      })
    },
    paliOnly() { return this.filename.startsWith('ap-pat') },
    bjtImgSrc() {
      const pageNum = parseInt(this.clickedPageNum) + parseInt(this.tab.data.pageOffset)
      // getBJTImageSrc is imported from https://pitaka.lk/bjt/scripts/books.js
      return 'https://pitaka.lk/bjt/' + getBJTImageSrc(this.tab.data.bookId, pageNum)
    },
  },

  methods: {
    ...mapMutations('tabs', ['loadNextPage', 'loadPrevPage']),
    displayScanned(num) {
      this.clickedPageNum = num
      this.showScanPage = true
    },
    touchSwipe(direction) {
      console.log('swipe ' + direction)
      if (this.columns.sinh == this.columns.pali) return // both columns visible

      const swappedCols = this.columns.pali ? [1] : [0]
      const message = this.columns.pali ? 'සිංහල' : 'පාළි'
      this.$store.commit('tabs/setTabColumns', swappedCols)
      this.$store.commit('setSnackbar', { message, timeout: 1000 })
    },
    loadNextSection(entries, observer) {
        if (entries[0].isIntersecting) {
          this.loadNextPage({ tabIndex: this.tabIndex, by: 1 })
        }
    },

    processEntry(entry) {
      // do not change entry fields - instead make a copy
      let text = beautifyText(entry.text, entry.language, this.$store.state) 
      if (this.tab.ftsEInd && eIndEquals(this.tab.ftsEInd, entry.eInd)) {
        text = highlightWords(text, this.tab.hWords) 
      }
      return {...entry, text: this.textParts(text) }
    },
    processFootnote(entry, language) {
      const m = /^([^\s\.\{\}]+)[\.\s]([\s\S]+)$/.exec(entry.text)
      if (!m) return {...entry, text: this.textParts(entry.text, language) }
      return {...entry, number: m[1], text: this.textParts(m[2], language) }
    },
    textParts(text) {
      text = text.replace(/\{(.+?)\}/g, this.$store.state.footnoteMethod == 'hidden' ? '' : '|$1℗fn-pointer|');
      // TODO do something about overlapping tags
      text = text.replace(/##(.*?)##/g, '|$1℗highlight|') // fts highlight
      text = text.replace(/\*\*(.*?)\*\*/g, '|$1℗bold|') // using the markdown styles
      text = text.replace(/__(.*?)__/g, '|$1℗underline|') // underline
      text = text.replace(/~~(.*?)~~/g, '|$1℗strike|') // strike through
      text = text.replace(/\$\$(.*?)\$\$/g, '$1') // just get rid of $$
      if (!text) text = '' //|Empty - තීරුව හිස් !℗strike|' // if left empty it is not clickable
      return text.split('|').filter(t => t.length).map(t => t.split('℗'))
    },
  },

  created() {
  },

}
</script>
