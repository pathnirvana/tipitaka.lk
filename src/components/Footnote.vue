<template>
  <v-card v-if="footnote" class="html">
    <span class="fn-number">{{ footnote.number }}.</span>
    <template v-for="(se, i) in footnote.parts">

      <v-tooltip v-if="se[1] == 'fn-abbr'" :key="i" bottom color="black"
        :open-on-click="footnoteMethod != 'hover'" :open-on-hover="footnoteMethod == 'hover'">
        <template v-slot:activator="{ on }">
          <span v-on="on" class="fn-abbr">{{ se[0] }}</span>
        </template>
        <span class="fn-abbr-desc">{{ matchingAbbrDescription(se[0]) }}</span>
      </v-tooltip>

      <span v-else :class="se[1] || false" :key="i+'else'" v-html="se[0]"></span>
    </template>
  </v-card>
</template>

<script>
import { mapState } from 'vuex'

export default {
  name: 'Footnote',
  components: {
  },
  props: {
    footnote: Object,
    language: String,
  },
  data: function() {
      return {}
  },
  computed: {
    ...mapState(['footnoteMethod']),
  },
  methods: {
    matchingAbbrDescription(abbr) { return this.$store.state.footnoteAbbreviations[abbr][0] }
  }
}

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.html .fn-number { color: var(--v-info-base); padding-right: 0.3rem; }

/* following copied from the TextEntry styles */
.html .underline { text-decoration: underline; text-decoration-color: var(--v-error-base); }
.html .bold { color: var(--v-info-base); }
.html .fn-abbr { color: var(--v-info-base); }
</style>
