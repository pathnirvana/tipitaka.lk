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
    
    <v-speed-dial v-model="fab" top right direction="bottom" open-on-hover transition="slide-y-transition" absolute>
      <template v-slot:activator>
        <v-btn v-model="fab" color="accent" dark fab small>
          <v-icon v-if="fab">mdi-close</v-icon>
          <v-icon v-else>mdi-menu-open</v-icon>
        </v-btn>
      </template>
      <v-btn fab small dark color="success"
        @click="$store.commit('tree/closeAllBranches')">
        <v-icon>mdi-arrow-collapse-vertical</v-icon>
      </v-btn>
      <v-btn fab small dark color="success" @click.stop="syncBranches">
        <v-icon>mdi-sync</v-icon>
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
      fab: false, // speed dial with options
      selected: [], // not used
    }
  },
  computed: {
    ...mapState('tree', ['activeKey', 'treeView', 'openBranches']),
    activeKeyAr: {
      get () { return [this.activeKey]  },
      set ([newKey]) {
        //if (newKey == this.activeKey) return; // this one is getting called even when tabs are changed - so prevent
        console.log(`change route from treeview to ${newKey}`)
        //this.$store.commit('tree/openKey', newKey)
        this.$store.dispatch('tree/setActiveKey', newKey)
        //this.$router.push('/' + newKey)
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
    }
  },
  async created() {
    const response = await fetch('data/tree.json')
    const tree = await response.json()
    this.$store.commit('tree/setTree', tree)

    const key = this.$route.params.pathMatch
    if (key) {
      console.log(`opening initial key ${key} with router`)
      //this.$store.commit('tree/openKey', key)
      this.$store.dispatch('tree/setActiveKey', key)
    }
  },
  watch: {
    $route(to, from) { // react to route changes...
      const key = to.params.pathMatch
      console.log(`route change from ${from.params.pathMatch} to ${key}`)
      if (key) { // when user uses back/forward browser buttons
        this.$store.dispatch('tree/setActiveKey', key)
      }
    }
  }
}
</script>
