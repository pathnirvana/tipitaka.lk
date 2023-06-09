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
      <template v-slot:label="{ item, open }">
          <span @mouseenter="hoveredKey = item.key">
            <v-hover v-slot="{ hover: hoverIcon }">
              <v-icon v-if="hoveredKey == item.key && getAudioAvailable(item.key)" 
                @click.stop="openNewTab(item.key, true)" :color="hoverIcon ? 'error' : 'info'">mdi-play-circle</v-icon>
              <v-icon v-else-if="item.children">{{ open ? 'mdi-folder-open' : 'mdi-folder' }}</v-icon>
              <v-icon v-else>mdi-file-document-outline</v-icon>
            </v-hover>
            <span @click.stop="openNewTab(item.key)" :id="item.key == getActiveKey ? 'activelabel' : ''">
              {{ item[$store.state.treeLanguage] }}
            </span>
          </span>
      </template>
    </v-treeview>

    <v-skeleton-loader v-else type="paragraph"></v-skeleton-loader>
    
    <v-layout>
      <v-flex class="absolute-top-right">
        <v-btn fab x-small color="error" @click="$emit('closeTree')" class="mb-2">
          <v-icon>mdi-close</v-icon>
        </v-btn>
        <v-btn fab x-small color="success" @click="syncBranches" class="mb-2">
          <v-icon>mdi-sync</v-icon>
        </v-btn>
        <v-btn fab x-small color="success" @click="$store.commit('tree/closeAllBranches')" class="mb-2">
          <v-icon>mdi-arrow-collapse-vertical</v-icon>
        </v-btn>
      </v-flex>
    </v-layout>  

  </v-sheet>
</template>

<style >
.tipitaka-tree .v-treeview-node__label { cursor: pointer; }
.absolute-top-right {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin: 10pt;
}
</style>

<script>
import { mapState, mapMutations, mapGetters } from 'vuex'

export default {
  name: 'TipitakaTree',
  props: {  },
  data() {
    return {
      selected: [], // not used
      hoveredKey: '',
    }
  },
  computed: {
    ...mapState('tree', ['treeView', 'openBranches']),
    ...mapState('tabs', ['activeInd']),
    ...mapGetters('tabs', ['getActiveKey']),
    ...mapGetters('audio', ['getAudioAvailable']),
    openedBranches: {
      get() { return this.openBranches },
      set(open) { this.$store.commit('tree/setOpenBranches', open) }
    }
  },

  methods: {
    openNewTab(key, playAudio = false) {
      this.$store.dispatch('tabs/openAndSetActive', { key, playAudio })
    },
    syncBranches() {
      this.$store.dispatch('tree/syncOpenBranches', true) // force sync
    },
    parseParams(params) { // parse route params - columns will be added later
      const parseEInd = (str) => (str && str.split('-').length == 2) ? str.split('-').map(i => parseInt(i) || 0) : null
      const eInd = parseEInd(params.eIndStr)
      return {...params, eInd }
    }

  },
  async created() {
    // init done here so can open tree afterwards
    await this.$store.dispatch('tree/initialize') // TODO can we open initial page before tree init completed - good for SEO

    const params = {...this.$route.params, ...this.$route.query}  // query could contain playAudio=true - however might not allow audio without user interaction
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
