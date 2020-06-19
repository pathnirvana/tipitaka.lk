<template>
  <v-sheet>
    
    <v-sheet class="d-flex align-center tabs">
      <v-btn v-if="smAndUp" icon tile @click="scrollLeft"><v-icon>mdi-chevron-left</v-icon></v-btn>
      <v-sheet dense flat id="tabs-bar" :class="'d-flex overflow-x-' + (smAndUp ? 'hidden' : 'auto')">
        
        <div v-for="(tab, ind) in tabList" :key="ind"
          :class="'tab pa-0' + (ind == activeInd ? ' active' : '')">
          <v-btn text @click="tabClicked(ind)" :color="ind == activeInd ? 'primary' : 'secondary'">
            {{ getName(tab.key) }}
            <v-btn icon x-small fab color="error" class="ml-1 mr-n2" @click.stop="closeTab(ind)">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </v-btn>
          
        </div>
      </v-sheet>
      <v-btn v-if="smAndUp" icon tile @click="scrollRight"><v-icon>mdi-chevron-right</v-icon></v-btn>
    </v-sheet>

    <div class="tab-items">
        <TextTab v-for="(tab, ind) in tabList" :key="ind" :tabIndex="ind" v-show="ind == activeInd"/>
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
import { mapState, mapGetters } from 'vuex'
import TextTab from '@/components/TextTab.vue'

export default {
  name: 'Home',
  metaInfo() { return {  title: this.pageTitle } },
  components: {
    TextTab,
  },
  data: () => ({
    
  }),
  computed: {
    ...mapState('tabs', ['activeInd', 'tabList']),
    ...mapGetters('tree', ['getName']),
    smAndUp() { return this.$vuetify.breakpoint.smAndUp },
    pageTitle() {
      return this.getName(this.$store.getters['tabs/getActiveKey'])
    },
  },
  methods: {
    tabClicked(ind) {
      console.log(`change route from tabs to ind:${ind} key:${this.tabList[ind].key}`)
      this.$store.commit('tabs/setActiveInd', ind)
    },
    closeTab(ind) {
      this.$store.commit('tabs/closeTab', ind)
    },
    scrollLeft() {
      document.getElementById('tabs-bar').scrollLeft -= 100
    },
    scrollRight() {
      document.getElementById('tabs-bar').scrollLeft += 100
    }
  },

  watch: {

  },
  created() {
    
  }
}
</script>
