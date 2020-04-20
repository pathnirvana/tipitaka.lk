<template>
  <td class="footnotes py-2" :lang="language" :style="{ fontSize }" v-if="entryVisible">
    <template v-if="footnotes.length">
      <hr>
      <div class="footnotes-list html">
        <div v-for="(note, index) in footnotes" :key="index">
          <span class="fn-number">{{ note.number }}.</span>
          <span v-for="(se, i) in note.text" :key="i" :class="se[1] || false">{{ se[0] }}</span>
        </div>
      </div>
    </template>
  </td>
</template>

<script>

export default {
  name: 'Footnote',
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
.html .fn-number { color: blue; padding-right: 0.3rem; }

.footnotes-list { display: flex; flex-direction: row; flex-wrap:wrap; text-align: left; font-size: 0.9em; }
.footnotes-list > div { flex: 1 1 auto; padding: 0.1rem 1rem; }
</style>
