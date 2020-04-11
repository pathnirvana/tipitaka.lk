<template>
<v-scale-transition hide-on-leave>
  <v-sheet class="my-4">
    <!--<div v-scroll:window="handleScroll">{{ scrollTop }}</div>-->
    <v-card v-if="isError" color="error">Error Loading</v-card>
    
    <v-skeleton-loader v-if="!isLoaded" type="paragraph"></v-skeleton-loader>
    
    <div v-else>
      

      <v-simple-table dense style="table-layout: fixed">
        <tr v-for="(row, i) in subEntries" :key="i">
          <TextEntry v-if="columns[0]" language="pali" :entry="row.pali"></TextEntry>
          <TextEntry v-if="columns[1]" language="sinh" :entry="row.sinh"></TextEntry>
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
    
  </v-sheet>
</v-scale-transition>
</template>

<style scoped>

</style>

<script>
import TextEntry from '@/components/TextEntry.vue'

export default {
  name: 'TextTab',
  components: {
    TextEntry,
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
      pageStart: 0, pageEnd: 0,
      entryStart: 0, entryEnd: 0,
      scrollTop: null,
      curPageNum: 0,
    }
  },
  computed: {
    columns() {
      const columns = this.$store.getters['tree/getTabColumns']
      //if (!columns) return [true, true]
      return [columns.indexOf(0) >= 0, columns.indexOf(1) >= 0]
    },
    item() {
      return this.$store.getters['tree/getKey'](this.itemKey)
    },
    subEntries() {
      const rows = []
      for (let i = this.entryStart; i < this.entryEnd; i++)  {
        rows.push({ pali: this.paliEntries[i], sinh: this.sinhEntries[i] })
      }
      return rows;
    },

    subPages() {
      return this.pages.slice(this.pageStart, this.pageEnd)
    },
    pages() { // split entries to pages
      if (!this.isLoaded) return []
      let curPage, pages = []
      for (let i = 0; i < this.paliEntries.length; i++) {
        if (this.paliEntries[i].type == 'page-break') {
          if (curPage) pages.push(curPage)
          curPage = { num: this.paliEntries[i].text, rows: [] }
        } else {
          curPage.rows.push({ pali: this.paliEntries[i], sinh: this.sinhEntries[i] })
        }
      }
      return pages
    },
  },
  methods: {
    loadPrevSection (entries, observer) {
        if (entries[0].isIntersecting) {
          this.entryStart = Math.max(this.entryStart - 5, 0)
        }
    },
    loadNextSection (entries, observer) {
        if (entries[0].isIntersecting) {
          this.entryEnd = Math.min(this.entryEnd + 5, this.paliEntries.length)
        }
    },
    handleScroll(e) {
      console.log('scrolled')
      this.scrollTop = e.target.scrollTop
    }
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
          
          this.pageEnd = 1
          this.entryStart = this.item.eind
          this.entryEnd = Math.min(this.entryStart + 15, this.paliEntries.length) // todo 
          this.isLoaded = true
      })
  },

}
</script>
