<template>
  <v-sheet>
    <v-treeview v-if="$store.state.tree.isLoaded"
      v-model="selected"
      :open.sync="openedBranches"
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
        <span v-if="item.key == activeKey" id="activelabel"></span>
      </template>
    </v-treeview>

    <v-skeleton-loader v-else type="paragraph"></v-skeleton-loader>
    
    <v-speed-dial v-model="speedDial" top right direction="bottom" transition="slide-y-transition" absolute>
      <template v-slot:activator>
        <v-btn v-model="speedDial" color="primary" fab small>
          <v-icon v-if="speedDial">mdi-close</v-icon>
          <v-icon v-else>mdi-dots-vertical</v-icon>
        </v-btn>
      </template>
      <v-btn fab small color="success" @click="syncBranches">
        <v-icon>mdi-sync</v-icon>
      </v-btn>
      <v-btn fab small color="success" @click="$store.commit('tree/closeAllBranches')">
        <v-icon>mdi-arrow-collapse-vertical</v-icon>
      </v-btn>
      <v-btn fab small color="success" @click="$emit('closeTree')">
        <v-icon>mdi-menu-open</v-icon>
      </v-btn>
    </v-speed-dial>

  </v-sheet>
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
      speedDial: false, // speed dial with options
      selected: [], // not used
    }
  },
  computed: {
    ...mapState('tree', ['activeKey', 'treeView', 'openBranches']),
    activeKeyAr: {
      get () { return [this.activeKey]  },
      set ([key]) {
        if (!key) return; // if user deselects
        console.log(`change route from treeview to ${key}`)
        this.$store.dispatch('tree/openAndSetActive', key)
      }
    },
    openedBranches: {
      get() { return this.openBranches },
      set(open) { this.$store.commit('tree/setOpenBranches', open) }
    }
  },
  methods: {
    syncBranches() {
      this.$store.commit('tree/syncOpenBranches', this.activeKey)
      this.$nextTick(function() {
        const container = document.getElementsByClassName('v-navigation-drawer__content')[0]
        container.scrollTop = document.getElementById('activelabel').offsetParent.offsetTop
        //this.$vuetify.goTo(1000, { offset: 100 })//'#activelabel'
      })
    },

  },
  async created() {
    // init done here so can open tree afterwards
    await this.$store.dispatch('tree/initialize')

    const key = this.$route.params.pathMatch
    if (key) {
      console.log(`opening initial key ${key} with router`)
      this.$store.dispatch('tree/openAndSetActive', key)
    }
  },
  watch: {
    $route(to, from) { // react to route changes...
      const key = to.params.pathMatch
      if (key != this.activeKey) { // when user uses back/forward browser buttons
        console.log(`route change from ${this.activeKey} to ${key}`)
        this.$store.commit('tree/replaceTab', {oldKey: this.activeKey, key})
        this.$store.commit('tree/setActiveKey', key) // do not open a new tab
      }
    }
  }
}
</script>
