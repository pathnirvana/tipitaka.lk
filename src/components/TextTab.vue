<template>
<v-scale-transition hide-on-leave>
  <v-sheet class="my-4">
    <!--<div v-scroll:window="handleScroll">{{ scrollTop }}</div>-->
    <v-card v-if="errorMessage" color="error">
      <v-card-title>සූත්‍රය ලබාගැනීමේදී වරදක් සිදුවිය</v-card-title>
      <v-card-text>{{ errorMessage }}</v-card-text>
    </v-card>
    
    <v-skeleton-loader v-else-if="!isLoaded" type="paragraph"></v-skeleton-loader>
    
    <div v-else v-touch="{ left: () => touchSwipe('L'), right: () => touchSwipe('R') }">

      <v-simple-table v-for="({rows, footnotes, pageNum }, pi) in visiblePages" :key="pi" dense style="table-layout: fixed">
        <tr v-if="$store.state.showPageNumbers">
          <td><div v-if="columns.pali" class="page-number">{{ pageNum }}</div></td>
          <td><div v-if="columns.sinh && !paliOnly" class="page-number">{{ pageNum + 1 }}</div></td>
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

      <v-card v-if="pageEnd < pages.length" class="text-center" @click="incPageEnd"
        v-intersect="{ handler: loadNextSection, options: {threshold: [0.5]} }">
        <v-card-text>ඊළඟ කොටස පෙන්වන්න.</v-card-text>
      </v-card>
    </div>

  </v-sheet>
</v-scale-transition>
</template>

<style scoped>
.snack { opacity: 0.85; font-size: 1.1rem; max-width: 100px; }
.page-number { text-align: center; color: var(--v-info-base); }
</style>

<script>
import TextEntry from '@/components/TextEntry.vue'
import Footnotes from '@/components/Footnotes.vue'
import { beautifySinh, addSpecialLetters, addBandiLetters } from '@/text-convert.mjs'
import { mapState } from 'vuex'
import axios from 'axios'

export default {
  name: 'TextTab',
  components: {
    TextEntry,
    Footnotes,
  },
  props: {
    itemKey: String,
  },

  data() {
    return {
      errorMessage: null,
      isLoaded: false,
      pages: null,
      pageStart: 0, pageEnd: 0, 
      eind: null, // from link params or from sutta heading

      scrollTop: null,
    }
  },

  computed: {
    ...mapState('tree', ['orderedKeys']),
    columns() {
      const columns = this.$store.getters['tree/getTabColumns']
      //if (!columns) return [true, true]
      return { pali: columns.indexOf(0) >= 0, sinh: columns.indexOf(1) >= 0 }
    },
    item() {
      return this.$store.getters['tree/getKey'](this.itemKey)
    },
    visiblePages() {
      return this.pages.slice(this.pageStart, this.pageEnd).map((page, i) => {
        const rows = [], footnotes = { pali: [], sinh: [] }, pi = i + this.pageStart
        page.pali.entries.forEach((paliEntry, ei) => {
          if (pi <= this.eind[0] && ei < this.eind[1]) return;
          const pair = { pali: this.processEntry(paliEntry), 
                         sinh: !this.paliOnly ? this.processEntry(page.sinh.entries[ei]) : null }
          rows.push(pair)
        })
        footnotes.pali = page.pali.footnotes.map(f => this.processFootnote(f, 'pali'))
        footnotes.sinh = page.sinh.footnotes.map(f => this.processFootnote(f, 'sinh'))
        return ({ rows, footnotes, pageNum: parseInt(page.pageNum) })
      })
    },
    paliOnly() { return this.item.filename.startsWith('ap-pat') },
  },

  methods: {
    touchSwipe(direction) {
      console.log('swipe ' + direction)
      if (this.columns.sinh == this.columns.pali) return // both columns visible

      const swappedCols = this.columns.pali ? [1] : [0]
      const message = this.columns.pali ? 'සිංහල' : 'පාළි'
      this.$store.commit('tree/setTabColumns', swappedCols)
      this.$store.commit('setSnackbar', {message, timeout: 1000})
    },
    loadNextSection (entries, observer) {
        if (entries[0].isIntersecting) {
          this.incPageEnd()
        }
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
      const {bandiLetters, specialLetters, footnoteMethod} = this.$store.state
      text = text.replace(/\{(.+?)\}/g, footnoteMethod == 'hidden' ? '' : '|$1℗fn-pointer|');
      //text = text.replace(new RegExp(footnoteRegEx, 'g'), footnoteMethod == 'hidden' ? '' : fnPointText);
      text = beautifySinh(text)
      if (language == 'pali') {
          if (specialLetters) text = addSpecialLetters(text)
          if (bandiLetters) text = addBandiLetters(text)
      }
      text = text.replace(/\*\*(.*?)\*\*/g, '|$1℗bold|') // using the markdown styles
      text = text.replace(/__(.*?)__/g, '|$1℗underline|') // underline
      text = text.replace(/~~(.*?)~~/g, '|$1℗strike|') // strike through
      if (!text) text = '|Empty - තීරුව හිස් !℗strike|' // if left empty it is not clickable
      return text.split('|').filter(t => t.length).map(t => t.split('℗'))
    },

    incPageEnd(by = 1) {
      this.pageEnd = Math.min(this.pages.length, this.pageEnd + by)
    },

    addEntryFields() {
      let curKey = ''
      this.pages.forEach((page, pi) => {
        page.pali.entries.forEach((paliEntry, ei) => {
          if (paliEntry.type == 'heading') {
            if (curKey) {
              curKey = this.orderedKeys[this.orderedKeys.indexOf(curKey) + 1] // get next key
            } else {
              curKey = this.item.filename
            }
          }
          
          paliEntry.key = curKey
          paliEntry.eind = [pi, ei]
          paliEntry.language = 'pali'
          if (!this.paliOnly) {
            const sinhEntry = page.sinh.entries[ei]
            sinhEntry.key = paliEntry.key
            sinhEntry.eind = paliEntry.eind
            sinhEntry.language = 'sinh'
          }
        })
      })
    },
  },

  created() {
    if (!this.item || !this.item.filename) { // error in link params
      this.errorMessage = `${this.itemKey} non existant or loading failed`
      return
    }
    axios.get(`/static/text/${this.item.filename}.json`)
      //.then(response => response.json())
      .then(({ data }) => {
        if (!data.pages || !data.pages.length) {
          this.isError = true
          return
        }
        this.pages = data.pages
        this.addEntryFields()
        this.eind = this.$store.getters['tree/getTabEInd'] || this.item.eind
        this.pageStart = this.pageEnd = this.eind[0] // pageInd
        this.incPageEnd(2)
        this.isLoaded = true
        console.log(`loaded from file ${this.item.key} ${this.eind[0]}:${this.eind[1]}`)
      }).catch(error => {
        // handle error
        this.errorMessage = error
        console.log(error);
      })
  },

}
</script>
