<template>
  <div>
    <v-treeview v-if="$store.state.tree.isLoaded"
      v-model="selected"
      :open="open"
      :items="treeView"
      activatable
      :active.sync="activeKeyAr"
      item-key="key"
      item-text="pali"
      open-on-click dense
    >
      <template v-slot:prepend="{ item, open }">
        <v-icon v-if="item.children">
          {{ open ? 'mdi-folder-open' : 'mdi-folder' }}
        </v-icon>
        <v-icon v-else>mdi-file-document-outline</v-icon>
      </template>
    </v-treeview>

    <v-skeleton-loader v-else type="paragraph"></v-skeleton-loader>
  </div>
</template>

<style scoped>
span.tree-label { cursor: pointer; }
</style>

<script>
import { mapState } from 'vuex'

export default {
  name: 'TipitakaTree',
  props: {
    
  },
  data() {
    return {
      open: ['sp'], // open nodes
      selected: [], // not used
    }
  },
  computed: {
    ...mapState('tree', ['activeKey', 'treeView']),
    /*items() {
      return this.$store.state.tree.treeView
    },*/
    activeKeyAr: {
      get () { return [this.activeKey]  },
      set ([newKey]) {
        if (newKey == this.activeKey) return; // this one is getting called even when tabs are changed - so prevent
        console.log(`change route from treeview to ${newKey}`)
        this.$store.commit('tree/setActiveKey', newKey)
        this.$router.push('/' + newKey)
      }
    },
  },
  methods: {
  },
  async created() {
    const response = await fetch('data/tree.json')
    const tree = await response.json()
    this.$store.commit('tree/setTree', tree)

    const key = this.$route.params.pathMatch
    if (key) {
      console.log(`opening initial key ${key} with router`)
      this.$store.commit('tree/setActiveKey', key)
    }
  },
  watch: {
    $route(to, from) { // react to route changes...
      const key = to.params.pathMatch
      console.log(`route change from ${from.params.pathMatch} to ${key}`)
      if (key) { // when user uses back/forward browser buttons
        this.$store.commit('tree/setActiveKey', key)
      }
    }
  }
}
</script>
