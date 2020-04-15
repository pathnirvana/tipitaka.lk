<template>
  <div>
    <template v-if="short">
      <span v-for="(item, i) in shortItems" :key="item.key">
        <v-icon v-if="i > 0">mdi-chevron-right</v-icon>
        {{ item.text }}
      </span>
    </template>
    <v-breadcrumbs v-else :items="items" large divider=">" class="ma-0 pa-0">
    </v-breadcrumbs>
     <!--<template v-slot:item="{ item }">
        <v-breadcrumbs-item :to="item.to" :disabled="item.disabled" class="ma-0 pa-0">
          {{ item.text }}
        </v-breadcrumbs-item>
      </template>
      <template v-slot:divider >
        <v-icon>mdi-chevron-right</v-icon>
      </template>
    -->
  </div>
</template>

<style scoped>
</style>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'TipitakaLink',
  props: {
    itemKey: String,
    short: Boolean,
  },
  data() {
    return {
      keyToText: { 'vp': 'VP', 'sp': 'SP', 'ap': 'AP' },
    }
  },
  computed: {
    ...mapGetters('tree', ['getKey']),
    items() {
      const items = [] //this.getKey(this.itemKey)
      let parent = this.getKey(this.itemKey).parent
      while (parent != 'root') {
        items.push(this.getKey(parent))
        parent = items[items.length - 1].parent
      }
      return items.reverse().map(item => ({
        text: this.getLinkText(item),
        to: '/' + item.key, // router link
        disabled: !item.filename, // empty filename means disabled
      }))
    },
    shortItems() {
      return this.items.slice(0, 3)
    },
  },
  methods: {
    getLinkText(item) {
      return this.keyToText[item.key] || item.pali // TODO - choose lang based on settings
    }
  },

}
</script>