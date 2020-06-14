<template>
  <div>
    <template v-if="short">
      <span v-for="(item, i) in shortItems" :key="item.key">
        <v-icon v-if="i > 0">mdi-chevron-right</v-icon>
        {{ item.text }}
      </span>
    </template>

    <template v-else>
      <span class="pitaka-icon mr-2 pa-1">{{ items[0].text }}</span>
      
      <span class="sutta-name mr-2">
        <router-link color="success" :to="routeLink">{{ suttaNameItem.text }}</router-link>
      </span>

      <span v-for="(item, i) in items.slice(1, -1)" :key="item.key" class="parent-name">
        <v-icon v-if="i > 0">mdi-chevron-right</v-icon>
        <router-link color="success" :to="item.to">{{ item.text }}</router-link>
      </span>
    </template>

    <!--<v-breadcrumbs v-else :items="items" large divider=">" class="ma-0 pa-0">
    </v-breadcrumbs>
     <template v-slot:item="{ item }">
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
.pitaka-icon { font-size: 1.1em; border: 1px solid black; border-radius: 10px; }
.sutta-name { font-size: 1.2em;  }
.sutta-name a { text-decoration: none; color: var(--v-info-base); }
.sutta-name a:hover { text-decoration: underline; }
.parent-name a { text-decoration: none; font-size: 1.1em; }
</style>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'TipitakaLink',
  props: {
    itemKey: String,
    short: Boolean,
    eInd: Array,
    language: String,
  },
  data() {
    return {
      keyToText: { 'vp': 'VP', 'sp': 'SP', 'ap': 'AP' },
    }
  },
  computed: {
    ...mapGetters('tree', ['getKey', 'getName']),
    items() {
      const items = [this.getKey(this.itemKey)]
      let parent = items[0].parent
      
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
    suttaNameItem() { return this.items.slice(-1)[0] },
    routeLink() { 
      if (!this.eInd) return this.suttaNameItem.to
      return `${this.suttaNameItem.to}/${this.eInd.join('-')}/${this.language}` 
    },
    shortItems() {
      return this.items.slice(0, 3)
    },
  },
  methods: {
    getLinkText(item) {
      return this.keyToText[item.key] || this.getName(item.key)
    }
  },

}
</script>