<template>
  <td class="footnotes py-2" :lang="language" :style="{ fontSize }" v-if="entryVisible">
    <template v-if="footnotes.length">
      <hr>
      <div class="footnotes-list">
        <div v-for="(note, index) in footnotes" :key="index">
          <Footnote :footnote="note"></Footnote>
        </div>
      </div>
    </template>
  </td>
</template>

<script>
import Footnote from '@/components/Footnote.vue'

export default {
  name: 'FootnoteList',
  components: {
    Footnote,
  },
  props: {
    footnotes: Array,
    language: String,
  },
  data: function() {
      return {}
  },
  computed: {
    fontSize() { return 16 + this.$store.state.fontSize + 'px' },
    entryVisible() {
      return this.$store.state.footnoteMethod == 'end-page'
    }
  },
  methods: {
  }
}

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>

.footnotes-list { display: flex; flex-direction: row; flex-wrap:wrap; text-align: left; font-size: 0.9em; }
.footnotes-list > div { flex: 1 1 auto; padding: 0.1rem 1rem; }
</style>
