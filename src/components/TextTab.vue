<template>
  <v-sheet>
    <div v-scroll:window="handleScroll">{{ scrollTop }}</div>
    <v-card v-if="isError" color="error">Error Loading</v-card>
    <v-skeleton-loader v-if="!isLoaded" type="paragraph"></v-skeleton-loader>
    <v-card v-else flat>
      <v-card-text>
        <v-simple-table dense style="table-layout: fixed">
          <tr v-for="(row, i) in pages[curPage].rows" :key="i">
            <TextEntry language="pali" :entry="row.pali"></TextEntry>
            <TextEntry language="sinh" :entry="row.sinh"></TextEntry>
          </tr>
        </v-simple-table>
      </v-card-text>
    </v-card>

    <v-footer v-if="isLoaded" fixed>
        <v-slider v-model="curPage" step="1" ticks="always" tick-size="4"
          :min="0" :max="pages.length - 1">
        </v-slider>
    </v-footer>
    <!--<v-banner v-if="pageEnd != pages.length"
      v-intersect="{ handler: loadNextPage, options: {threshold: [0.5]} }">
      Loading next page
    </v-banner>-->
  </v-sheet>
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
    filename: String, //key
  },
  data() {
    return {
      isError: false,
      isLoaded: false,
      paliEntries: null,
      sinhEntries: null,
      pageStart: 0,
      pageEnd: 0,
      scrollTop: null,
      curPage: 0,
    }
  },
  computed: {
    subPages() {
      return this.pages.slice(this.pageStart, this.pageEnd)
    },
    pages() { // split entries to pages
      if (!this.isLoaded) return []
      let curPage, pages = []
      for (let i=0; i < this.paliEntries.length; i++) {
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
    loadNextPage (entries, observer) {
        if (entries[0].isIntersecting) {
          this.pageEnd++
          if (this.pageEnd - this.pageStart > 3) this.pageStart++
          console.log(this.pageEnd)
        }
    },
    handleScroll(e) {
      console.log('scrolled')
      this.scrollTop = e.target.scrollTop
    }
  },
  created() {
    fetch(`data/${this.filename}.json`)
        .then(response => response.json())
        .then(data => {
          if (!data.length || !data[0].entries.length) {
            this.isError = true
            return
          }
          this.paliEntries = data[0].entries
          this.sinhEntries = data[1].entries
          this.isLoaded = true
          this.pageEnd = 1

      })
  },

}
</script>
