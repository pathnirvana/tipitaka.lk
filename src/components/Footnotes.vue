<template>
  <td class="footnotes" :lang="language">
    <div class="footnotes" v-if="footnotes.length">
        <hr>
        <div class="footnotes-list html">
            <div v-for="(note, index) in footnotes" :key="index" v-html="note"></div>
        </div>
    </div>
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
      
  },
  methods: {
      
  }
}

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.html >>> .fn-number { color: blue; padding-right: 0.3rem; }

.footnotes-list { display: flex; flex-direction: row; flex-wrap:wrap; text-align: left; font-size: 1rem; }
.footnotes-list > div { flex: 1 1 auto; padding: 0.1rem 1rem; font-family: 'sinhala'; }
</style>
