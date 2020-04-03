<template>
  <div>
    <v-treeview v-if="$store.state.tree.isLoaded"
      v-model="selected"
      :open="open"
      :items="items"
      activatable multiple-active
      :active.sync="activeKeys"
      item-key="key"
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

</style>

<script>
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
    items() {
      return this.$store.state.tree.items
    },
    activeKeys: {
      get () { return this.$store.state.tree.activeKeys  },
      set (value) { this.$store.commit('setActiveKeys', value) }
    },
    nodes() { 
      //console.log(this.$root);
      return this.$root.tree.nodes },
    getChildren() { 
      return this.nodes[this.nodeId].children.map(cid => this.nodes[cid]);
      //return this.$store.getters['tree/children'](this.nodeId) 
    },
    
  },
  methods: {
    toggleNode(id) {
      console.log(id);
      this.nodes[id].isOpen = !this.nodes[id].isOpen;
      //this.$store.commit('tree/toggle', id)
    },
    isOpen(id) { 
      return this.nodes[id].isOpen;
      //return this.$store.getters['tree/isOpen'](id) 
    },
  },

}
</script>
<style scoped>
span.tree-label { cursor: pointer; }
</style>
