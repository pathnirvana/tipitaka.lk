<template>
<!-- <v-scale-transition hide-on-leave> -->
  <v-sheet class="my-2">
    <!--<div v-scroll:window="handleScroll">{{ scrollTop }}</div>-->
    <v-card v-if="tab.errorMessage" color="error">
      <v-card-title>සූත්‍රය ලබාගැනීමේදී වරදක් සිදුවිය</v-card-title>
      <v-card-text>{{ tab.errorMessage }}</v-card-text>
    </v-card>
    
    <v-skeleton-loader v-else-if="!tab.isLoaded" type="paragraph"></v-skeleton-loader>
    
    <div v-else v-touch="{ left: touchSwipe }"> <!-- v-touch="{ left: () => touchSwipe('L'), right: () => touchSwipe('R') }" -->
      <v-btn absolute rounded small top right @click="loadPrevPage(tabIndex)" class="load-prev-page">
        <v-icon>mdi-chevron-up</v-icon>
      </v-btn>

      <v-simple-table v-for="({rows, footnotes, pageNum }, pi) in visiblePages" :key="pi" dense style="table-layout: fixed">
        <template v-if="!tab.showScanPage">
          <tr v-if="$store.state.showPageNumbers && !isAtta">
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
        </template>

        <template v-else>
          <tr>
            <td v-if="columns.pali" class="img-holder"><img :src="getScanImgSrc(pageNum, 'pali')" /></td>
            <td v-if="columns.sinh && !paliOnly" class="img-holder"><img :src="getScanImgSrc(pageNum, 'sinh')" /></td>
          </tr>
        </template>
      </v-simple-table>

      <v-card v-if="tab.pageEnd < tab.data.pages.length" class="text-center" @click="loadNextPage({ tabIndex, by: 1 })"
        v-intersect="{ handler: loadNextSection, options: {threshold: [0.5]} }">
        <v-card-text>ඊළඟ කොටස පෙන්වන්න.</v-card-text>
      </v-card>
    </div>

  </v-sheet>
<!-- </v-scale-transition> -->
</template>

<style scoped>
/* .snack { opacity: 0.85; font-size: 1.1rem; max-width: 100px; } */
.page-number { text-align: center; color: var(--v-info-base); }
.img-holder { text-align: center; }
.img-holder img { 
  width: 100%; 
  max-width: 750px; 
  filter: grayscale(100%) contrast(90%) brightness(95%);
}
.theme--dark .img-holder > img { filter: invert(100%) contrast(70%) brightness(150%); }
.load-prev-page { z-index: 2; /* top: 60px; */ }
</style>

<script>
import TextEntry from '@/components/TextEntry.vue'
import Footnotes from '@/components/Footnotes.vue'
import { beautifyText } from '@/text-convert.mjs'
import { getBJTImageSrc } from '@/scanned-pages.js'
import { mapState, mapGetters, mapMutations } from 'vuex'

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
      clickedPageNum: 0,
      scrollTop: null,
    }
  },

  computed: {
    ...mapState('tree', ['orderedKeys']),
    ...mapState('tabs', ['tabList']),
    ...mapGetters('tabs', ['getVisiblePages']),
    columns() {
      const columns = this.$store.getters['tabs/getTabColumns']
      return { pali: [0, 2].indexOf(columns) >= 0, sinh: [1, 2].indexOf(columns) >= 0 }
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
    paliOnly() { return /^(ap-pat|vp-cv-5|kn-mn|kn-nc)/.test(this.filename) }, // TODO change to .startsWith('ap-pat') after all sinhala is added
    isAtta() { return this.filename.startsWith('atta-') },
  },

  methods: {
    ...mapMutations('tabs', ['loadNextPage', 'loadPrevPage', 'setShowScanPage']),
    displayScanned(num) {
      this.clickedPageNum = num
      this.setShowScanPage(true)
    },
    touchSwipe(e) { // e of type TouchWrapper
      console.log(e)
      //alert(JSON.stringify(e))
      // long left swipe without much vertical movement - prevent accidential swipes when selecting
      if (e.offsetX > -100 || Math.abs(e.offsetY) > 20) return 
      if (this.columns.sinh == this.columns.pali) return // both columns visible (dont check tabs/getTabColumns directly)

      const swappedCols = this.columns.pali ? 1 : 0
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
      if (this.tab.hWords && eIndEquals(this.tab.eInd, entry.eInd)) {
        text = highlightWords(text, this.tab.hWords) 
      }
      return {...entry, parts: this.textParts(text) }
    },
    processFootnote(fnote, language) {
      let _0, number, text = beautifyText(fnote.text, language, this.$store.state)
      const m = /^([^\s\.\{\}]+)[\.\s]([\s\S]+)$/.exec(text) // [\s\S]+ needed for matching new lines
      if (m) [_0, number, text] = m
      return {...fnote, number, parts: this.textParts(text, language) }
    },
    textParts(text) {
      text = text.replace(/\{(.+?)\}/g, this.$store.state.footnoteMethod == 'hidden' ? '' : '|$1℗fn-pointer|');
      // TODO do something about overlapping tags
      text = text.replace(/##(.*?)##/g, '|$1℗highlight|') // fts highlight
      text = text.replace(/\*\*(.*?)\*\*/g, '|$1℗bold|') // using the markdown styles
      text = text.replace(/__(.*?)__/g, '|$1℗underline|') // underline
      text = text.replace(/~~(.*?)~~/g, '|$1℗strike|') // strike through
      text = text.replace(/\$\$(.*?)\$\$/g, '$1') // just get rid of $$
      text = text.replace(/↴/g, '\n') // invisible in pdf - new line
      text = text.replace(/\n/g, '<br>') // if used {white-space: pre-wrap;} css this is not needed
      if (!text) text = '' //|Empty - තීරුව හිස් !℗strike|' // if left empty it is not clickable
      return text.split('|').filter(t => t.length).map(t => t.split('℗'))
    },
    getScanImgSrc(pageNum, lang) {
      pageNum += this.tab.data.pageOffset + (lang == 'sinh' ? 1 : 0)
      return getBJTImageSrc(this.tab.data.bookId, pageNum)
    }
  },

  created() {  },

}
</script>
