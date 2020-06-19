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
      <v-btn absolute rounded small top right @click="loadPrevSection">
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

      <v-card v-if="tab.pageEnd < tab.data.pages.length" class="text-center" @click="loadNextSection"
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
import { mapState, mapGetters } from 'vuex'
import axios from 'axios'

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
      // errorMessage: null,
      // isLoaded: false,
      // pages: null,
      // pageStart: 0, pageEnd: 0, 
      // entryStart: 0, // from link params or from sutta heading

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
      this.$store.commit('setSnackbar', {message, timeout: 1000})
    },
    loadNextSection(entries, observer) {
        if (entries[0].isIntersecting) {
          this.$store.commit('tabs/loadNextPage', this.tabIndex)
        }
    },
    loadPrevSection() {
      this.$store.commit('tabs/loadPrevPage', this.tabIndex)
    },

    processEntry(entry) {
      return {...entry, text: this.textParts(entry.text, entry.language) }
    },
    processFootnote(entry, language) {
      const m = /^([^\s\.\{\}]+)[\.\s]([\s\S]+)$/.exec(entry.text)
      if (!m) return {...entry, text: this.textParts(entry.text, language) }
      return {...entry, number: m[1], text: this.textParts(m[2], language) }
    },
    textParts(text, language) {
      text = text.replace(/\{(.+?)\}/g, this.$store.state.footnoteMethod == 'hidden' ? '' : '|$1℗fn-pointer|');
      text = beautifyText(text, language, this.$store.state)

      text = text.replace(/\*\*(.*?)\*\*/g, '|$1℗bold|') // using the markdown styles
      text = text.replace(/__(.*?)__/g, '|$1℗underline|') // underline
      text = text.replace(/~~(.*?)~~/g, '|$1℗strike|') // strike through
      text = text.replace(/\$\$(.*?)\$\$/g, '$1') // just get rid of $$
      if (!text) text = '' //|Empty - තීරුව හිස් !℗strike|' // if left empty it is not clickable
      return text.split('|').filter(t => t.length).map(t => t.split('℗'))
    },

    // incPageEnd(by = 1) {
    //   this.pageEnd = Math.min(this.pages.length, this.pageEnd + by)
    // },

    // addEntryFields() { // move to vuex
    //   let curKey = ''
    //   this.pages.forEach((page, pi) => {
    //     page.pali.entries.forEach((paliEntry, ei) => {
    //       if (paliEntry.type == 'heading') {
    //         if (curKey) {
    //           curKey = this.orderedKeys[this.orderedKeys.indexOf(curKey) + 1] // get next key
    //         } else {
    //           curKey = this.filename
    //         }
    //       }
          
    //       const addProps = { key: curKey, eInd: [pi, ei], active: pi == 0 && ei == this.entryStart }
    //       Object.assign(paliEntry, addProps)
    //       paliEntry.language = 'pali'
    //       if (!this.paliOnly) {
    //         const sinhEntry = page.sinh.entries[ei]
    //         Object.assign(sinhEntry, addProps)
    //         sinhEntry.language = 'sinh'
    //       }
    //     })
    //   })
    // },
  },

  created() {
    // if (!this.tab || !this.filename) { // error in link params
    //   this.errorMessage = `${this.tab.key} non existant or loading failed`
    //   return
    // }
    // axios.get(`/static/text/${this.filename}.json`)
    //   .then(({ data }) => {
    //     if (!data.pages || !data.pages.length) {
    //       this.isError = true
    //       return
    //     }
    //     // copy over data fields
    //     this.pages = data.pages
    //     this.bookId = data.bookId
    //     this.pageOffset = data.pageOffset
    //     // add computed entries
    //     this.addEntryFields()
    //     const eInd = this.tab.eInd
    //     this.entryStart = eInd[1]
    //     this.pageEnd = this.pageStart = eInd[0]
    //     this.incPageEnd(2)
    //     this.isLoaded = true
    //     console.log(`loaded from file key:${this.tab.key} eInd:${this.pageStart}-${this.entryStart}`)
    //   }).catch(error => {
    //     this.errorMessage = error
    //     console.log(error);
    //   })
  },

}
</script>
