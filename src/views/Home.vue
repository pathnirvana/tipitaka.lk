<template>
  <v-sheet>
    
    <v-sheet class="d-flex align-center tabs">
      <v-btn v-if="smAndUp" icon tile @click="scrollLeft"><v-icon>mdi-chevron-left</v-icon></v-btn>
      <v-sheet dense flat id="tabs-bar" :class="'d-flex overflow-x-' + (smAndUp ? 'hidden' : 'auto')">
        
        <div v-for="item in tabItems" :key="item.key"
          :class="'tab pa-0' + (item.active ? ' active' : '')">
          <v-btn text @click="tabClicked(item.key)" :color="item.active ? 'primary' : 'secondary'">
            {{ item[$store.state.treeLanguage] }}
            <v-btn icon x-small fab color="error" class="ml-1 mr-n2" @click.stop="closeTab(item.key)">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-btn>
          
        </div>
      </v-sheet>
      <v-btn v-if="smAndUp" icon tile @click="scrollRight"><v-icon>mdi-chevron-right</v-icon></v-btn>
    </v-sheet>

    <div class="tab-items">
        <TextTab v-for="item in tabItems" :key="item.key" :itemKey="item.key" v-show="item.active"/>
    </div>
    
    <v-btn fab small color="primary" fixed bottom right @click="$vuetify.goTo(0)">
        <v-icon>mdi-chevron-up</v-icon>
    </v-btn>
  </v-sheet>
</template>

<style scoped>
.tab.active { border-bottom: 2px solid black; }
</style>

<script>
// @ is an alias to /src
import { mapState } from 'vuex'
import TextTab from '@/components/TextTab.vue'

export default {
  name: 'Home',
  components: {
    TextTab,
  },
  data: () => ({
    
  }),
  computed: {
    ...mapState('tree', ['activeKey', 'openKeys']),
    tabItems() {
      return this.openKeys.map(key => 
        ({...this.$store.state.tree.index[key], active: this.isActiveTab(key)}))
    },
    smAndUp() { return this.$vuetify.breakpoint.smAndUp },
  },
  methods: {
    isActiveTab(key) { return key == this.activeKey },
    tabClicked(key) {
      console.log(`change route from tabs to ${key}`)
      this.$store.commit('tree/setActiveKey', key)
    },
    closeTab(key) {
      this.$store.commit('tree/closeTab', key)
    },
    scrollLeft() {
      document.getElementById('tabs-bar').scrollLeft -= 100
    },
    scrollRight() {
      document.getElementById('tabs-bar').scrollLeft += 100
    }
  },
  watch: {
    /*activeKey() {
      const left = document.getElementsByClassName('tab active')[0].offsetLeft
      document.getElementById('tabs-bar').scrollLeft = left
    },*/
  },
  created() {
    
  }
}
</script>
