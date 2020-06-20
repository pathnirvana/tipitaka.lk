<template>
  <v-sheet :style="$store.getters['styles']">
    <v-treeview v-if="$store.state.tree.isLoaded"
      v-model="selected"
      :open.sync="openedBranches"
      :items="treeView"
      activatable hoverable
      :active="[this.getActiveKey]"
      item-key="key"
      dense shaped class="tipitaka-tree"
    >
      <template v-slot:prepend="{ item, open }">
        <span @click.stop="">
          <v-icon v-if="item.children">{{ open ? 'mdi-folder-open' : 'mdi-folder' }}</v-icon>
          <v-icon v-else>mdi-file-document-outline</v-icon>
        </span>
      </template>

      <template v-slot:label="{ item }">
        <span @click.stop="openNewTab(item.key)" :id="item.key == getActiveKey ? 'activelabel' : ''">
          {{ item[$store.state.treeLanguage] }}
        </span>
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

<style >
.tipitaka-tree .v-treeview-node__label { cursor: pointer; }
</style>

<script>
import { mapState, mapMutations, mapGetters } from 'vuex'

export default {
  name: 'TipitakaTree',
  props: {  },
  data() {
    return {
      speedDial: false, // speed dial with options
      selected: [], // not used
    }
  },
  computed: {
    ...mapState('tree', ['treeView', 'openBranches']),
    ...mapState(['defaultColumns']),
    ...mapState('tabs', ['activeInd']),
    ...mapGetters('tabs', ['getActiveKey']),
    openedBranches: {
      get() { return this.openBranches },
      set(open) { this.$store.commit('tree/setOpenBranches', open) }
    }
  },

  methods: {
    openNewTab(key) {
      this.$store.dispatch('tabs/openAndSetActive', { key, columns: [...this.defaultColumns] })
    },
    syncBranches() {
      this.$store.commit('tree/syncOpenBranches', this.getActiveKey)
      this.$nextTick(function() {
        const container = document.getElementsByClassName('v-navigation-drawer__content')[0]
        container.scrollTop = document.getElementById('activelabel').offsetParent.offsetTop
      })
    },
    parseParams(params) { // parse route params
      const columns = !params.language ? [...this.defaultColumns] : (params.language == 'pali' ? [0] : [1])
      const parseEInd = (str) => (str && str.split('-').length == 2) ? str.split('-').map(i => parseInt(i) || 0) : null
      const eInd = parseEInd(params.eIndStr)
      return {...params, eInd, columns }
    }

  },
  async created() {
    // init done here so can open tree afterwards
    await this.$store.dispatch('tree/initialize') // TODO can we open initial page before tree init completed - good for SEO

    const params = this.$route.params
    if (params.key) {
      console.log(`opening initial page ${JSON.stringify(params)}`)
      this.$store.dispatch('tabs/openAndSetActive', this.parseParams(params))
    }
  },
  watch: {
    $route(to, from) { // react to route changes...
      return
      const key = to.params.key //pathMatch
      if (key && key != this.getActiveKey) { // when user uses back/forward browser buttons
        // TODO possiblely check if other params change too
        console.log(`route change from ${this.getActiveKey} to ${key}`)
        //this.$vuetify.goTo(0) // get to top when setting new content
        if (this.getActiveKey) {
          this.$store.dispatch('tabs/replaceAndSetActive', this.parseParams(to.params))
        } else {
          this.$store.dispatch('tabs/openAndSetActive', this.parseParams(to.params))
        }
      }
    }
  }
}
</script>
