<template>
<v-scale-transition hide-on-leave>
  <v-sheet class="my-4">
    <!--<div v-scroll:window="handleScroll">{{ scrollTop }}</div>-->
    <v-card v-if="isError" color="error">Error Loading</v-card>
    
    <v-skeleton-loader v-if="!isLoaded" type="paragraph"></v-skeleton-loader>
    
    <div v-else v-touch="{ left: () => touchSwipe('L'), right: () => touchSwipe('R') }">

      <v-simple-table v-for="({rows, footnotes}, j) in pages" :key="j" dense style="table-layout: fixed">
        <tr v-for="(row, i) in rows" :key="i">
          <TextEntry v-if="columns.pali" language="pali" :entry="row.pali"></TextEntry>
          <TextEntry v-if="columns.sinh" language="sinh" :entry="row.sinh"></TextEntry>
        </tr>
        <tr>
          <Footnotes v-if="columns.pali" language="pali" :footnotes="footnotes.pali"></Footnotes>
          <Footnotes v-if="columns.sinh" language="sinh" :footnotes="footnotes.sinh"></Footnotes>
        </tr>
      </v-simple-table>

      <v-banner v-if="entryEnd < paliEntries.length"
        v-intersect="{ handler: loadNextSection, options: {threshold: [0.5]} }">
        ඊළඟ කොටස ලබාගනිමින්...
      </v-banner>
    </div>

    <!--<v-footer v-if="isLoaded" fixed>
        <v-slider v-model="curPageNum" step="1" ticks="always" tick-size="4"
          :min="0" :max="pages.length - 1">
        </v-slider>
    </v-footer>-->
    <v-snackbar v-model="snackbar" bottom :timeout="1000" class="snack">
      <v-spacer></v-spacer><span>{{ snackbarMsg }}</span><v-spacer></v-spacer>
    </v-snackbar>
  </v-sheet>
</v-scale-transition>
</template>

<style scoped>
.snack { opacity: 0.85; font-size: 1.1rem; max-width: 100px; }
</style>

<script>
import TextEntry from '@/components/TextEntry.vue'
import Footnotes from '@/components/Footnotes.vue'
import { extractFootnotes } from '@/text-convert.mjs'

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
      isError: false,
      isLoaded: false,
      paliEntries: null,
      sinhEntries: null,
      entryStart: 0, entryEnd: 0,
      snackbar: false, snackbarMsg: '',

      scrollTop: null,
      pageStart: 0, pageEnd: 0,
      curPageNum: 0,
    }
  },
  computed: {
    columns() {
      const columns = this.$store.getters['tree/getTabColumns']
      //if (!columns) return [true, true]
      return { pali: columns.indexOf(0) >= 0, sinh: columns.indexOf(1) >= 0 }
    },
    item() {
      return this.$store.getters['tree/getKey'](this.itemKey)
    },
    entriesView() {
      const rows = []
      for (let i = this.entryStart; i < this.entryEnd; i++)  {
        rows.push({ pali: this.paliEntries[i], sinh: this.sinhEntries[i] })
      }
      return rows;
    },

    subPages() {
      return this.pages.slice(this.pageStart, this.pageEnd)
    },

    pages() { // split entries start->end to pages, also compute footnotes
      let rows = [], footnotes = { pali: [], sinh: [] }, pages = []
      for (let i = this.entryStart; i < this.entryEnd; i++) {
        if (this.paliEntries[i].type == 'page-break') {
          if (rows.length) {
            pages.push({ rows, footnotes })
          }
          rows = []
          footnotes = { pali: [], sinh: [] }
        }
        const pair = { pali: this.paliEntries[i], sinh: this.sinhEntries[i] }
        rows.push(pair)
        footnotes.pali.push(...extractFootnotes(pair.pali.text, 'pali', this.$store.state))
        footnotes.sinh.push(...extractFootnotes(pair.sinh.text, 'sinh', this.$store.state))
      }
      return pages
    },
  },
  methods: {
    touchSwipe(direction) {
      console.log('swipe ' + direction)
      if (this.columns[0] == this.columns[1]) return // both columns visible

      let swappedCols = [0]
      this.snackbarMsg = 'පාළි'
      if (this.columns[0]) {
        swappedCols = [1]
        this.snackbarMsg = 'සිංහල'
      }
      this.$store.commit('tree/setTabColumns', swappedCols)
      this.snackbar = true
    },
    loadNextSection (entries, observer) {
        if (entries[0].isIntersecting) {
          this.getNextEnd()
          //this.entryEnd = Math.min(this.entryEnd + 5, this.paliEntries.length)
        }
    },

    /*loadPrevSection (entries, observer) {
        if (entries[0].isIntersecting) {
          this.entryStart = Math.max(this.entryStart - 5, 0)
        }
    },
    handleScroll(e) {
      console.log('scrolled')
      this.scrollTop = e.target.scrollTop
    }*/
    getNextEnd() {
      this.entryEnd++
      while (this.entryEnd < this.paliEntries.length && this.paliEntries[this.entryEnd].type != 'page-break') {
        this.entryEnd++
      }
    },
  },
  created() {
    fetch(`data/${this.item.filename}.json`)
        .then(response => response.json())
        .then(data => {
          if (!data.length || !data[0].entries.length) {
            this.isError = true
            return
          }
          this.paliEntries = data[0].entries
          this.sinhEntries = data[1].entries
          
          //this.pageEnd = 1
          this.entryStart = this.entryEnd = this.item.eind
          this.getNextEnd()
          //this.entryEnd = Math.min(this.entryStart + 15, this.paliEntries.length) // todo 
          this.isLoaded = true
      })
  },

}
</script>
