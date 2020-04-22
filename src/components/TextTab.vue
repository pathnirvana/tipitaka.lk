<template>
<v-scale-transition hide-on-leave>
  <v-sheet class="my-4">
    <!--<div v-scroll:window="handleScroll">{{ scrollTop }}</div>-->
    <v-card v-if="isError" color="error">Error Loading</v-card>
    
    <v-skeleton-loader v-if="!isLoaded" type="paragraph"></v-skeleton-loader>
    
    <div v-else v-touch="{ left: () => touchSwipe('L'), right: () => touchSwipe('R') }">

      <v-simple-table v-for="({rows, footnotes}, j) in pages" :key="j" dense style="table-layout: fixed">
        <tr v-for="(row, i) in rows" :key="i">
          <TextEntry v-if="columns.pali" language="pali" :entry="row.pali" :footnotes="footnotes.pali"></TextEntry>
          <TextEntry v-if="columns.sinh" language="sinh" :entry="row.sinh" :footnotes="footnotes.sinh"></TextEntry>
        </tr>
        <tr>
          <Footnotes v-if="columns.pali" language="pali" :footnotes="footnotes.pali"></Footnotes>
          <Footnotes v-if="columns.sinh" language="sinh" :footnotes="footnotes.sinh"></Footnotes>
        </tr>
      </v-simple-table>

      <v-card v-if="entryEnd < paliEntries.length" class="text-center" @click="getNextEnd"
        v-intersect="{ handler: loadNextSection, options: {threshold: [0.5]} }">
        <v-card-text>ඊළඟ කොටස පෙන්වන්න.</v-card-text>
      </v-card>
    </div>

  </v-sheet>
</v-scale-transition>
</template>

<style scoped>
.snack { opacity: 0.85; font-size: 1.1rem; max-width: 100px; }
</style>

<script>
import TextEntry from '@/components/TextEntry.vue'
import Footnotes from '@/components/Footnotes.vue'
import { beautifySinh, addSpecialLetters, addBandiLetters } from '@/text-convert.mjs'
import { mapState } from 'vuex'
const footnoteRegEx = '\{(\\d+|\\S)([^\{\}]*?)\}'
const fnPointText = '|$1℗fn-pointer|'

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

    pages() { // split entries start->end to pages, also compute footnotes
      let rows = [], footnotes = { pali: [], sinh: [] }, pages = []
      for (let i = this.entryStart; i < this.entryEnd; i++) {
        if (this.paliEntries[i].type == 'page-break') {
          if (rows.length) {
            // note: no footnote dedup here (must be fixed somewhere else)
            pages.push({ rows, footnotes })
          }
          rows = []
          footnotes = { pali: [], sinh: [] }
        }
        footnotes.pali.push(...this.extractFootnotes(this.paliEntries[i].text, 'pali'))
        footnotes.sinh.push(...this.extractFootnotes(this.sinhEntries[i].text, 'sinh'))
        const pair = { pali: this.processEntry(this.paliEntries[i], 'pali'), 
                       sinh: this.processEntry(this.sinhEntries[i], 'sinh') }
        rows.push(pair)
      }
      return pages
    },
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
          this.getNextEnd()
        }
    },
    
    processEntry(entry, language) {
      return {...entry, text: this.textParts(entry.text, language)}
    },
    textParts(text, language) {
      const {bandiLetters, specialLetters, footnoteMethod} = this.$store.state
      text = text.replace(new RegExp(footnoteRegEx, 'g'), footnoteMethod == 'hidden' ? '' : fnPointText);
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

    extractFootnotes(text, language) {
      const regex = new RegExp(footnoteRegEx, 'g'), notes = [];
      let r;
      while ((r = regex.exec(text)) !== null) {
          const noteText = r[2].trim();
          if (noteText) {
              notes.push({ number: r[1], text: this.textParts(noteText, language) })
              //notes.push(`<span class="fn-number">${r[1]}.</span><span class="fn-text">${noteHtml}</span>`); 
          }
      }
      return notes;
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
    computeEntryLinks() {
      let curKey = '', headingDist = 0
      for (let i = 0; i < this.paliEntries.length; i++) {
        if (this.paliEntries[i].type == 'heading') {
          if (curKey) {
            curKey = this.orderedKeys[this.orderedKeys.indexOf(curKey) + 1] // get next key
          } else {
            curKey = this.item.filename
          }
          headingDist = 0
        }
        this.paliEntries[i].key = this.sinhEntries[i].key = curKey
        this.paliEntries[i].headingDist = this.sinhEntries[i].headingDist = headingDist++
      }
    },
  },

  created() {
    fetch(`/text/${this.item.filename}.json`)
        .then(response => response.json())
        .then(data => {
          if (!data.length || !data[0].entries.length) {
            this.isError = true
            return
          }
          this.paliEntries = data[0].entries
          this.sinhEntries = data[1].entries
          this.computeEntryLinks()
          
          const dist = this.$store.getters['tree/getTabDist']
          this.entryStart = this.entryEnd = (this.item.eind + dist)
          this.getNextEnd()
          this.isLoaded = true
          console.log(`loaded from file ${this.item.key}:${dist}`)
      })
  },

}
</script>
