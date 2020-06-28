<template>
  <v-sheet>
    
    <!-- <v-tabs center-active short show-arrows="mobile" v-model="activeTabInd">
      <v-tab v-for="(tab, ind) in tabList" :key="ind">
          {{ getName(tab.key) }}
          <v-btn icon x-small fab color="error" class="ml-1 mr-n2" @click.stop="$store.commit('tabs/closeTab', ind)">
            <v-icon>mdi-close</v-icon>
          </v-btn>
      </v-tab> 
    </v-tabs>-->

    <!-- <v-sheet class="d-flex align-center tabs">
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
    </v-sheet> -->

    <div class="tab-items">
        <TextTab v-for="(tab, ind) in tabList" :key="ind" :tabIndex="ind" v-show="ind == activeInd"/>
    </div>
    
    <v-btn fab small fixed bottom right @click="$vuetify.goTo(0)">
        <v-icon>mdi-chevron-triple-up</v-icon>
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
import { copyMetaTitle } from '@/constants.js'

export default {
  name: 'Home',
  components: {
    TextTab,
  },
  data: () => ({
    
  }),
  computed: {
    ...mapState('tabs', ['activeInd', 'tabList']),
    ...mapGetters('tree', ['getName']),
    // smAndUp() { return this.$vuetify.breakpoint.smAndUp },
    activeTabInd: {
      get() { return this.activeInd },
      set(ind) {  this.$store.commit('tabs/setActiveInd', ind) },
    },
  },

  metaInfo() { // create page title by joining keyName and rootName 
    let tab = this.$store.getters['tabs/getActiveTab'], title = 'Home'
    if (!tab) return { title }
    title = this.getName(tab.key, tab.language)
    const keyRoot = tab.key.split('-')[0]
    if (keyRoot != tab.key) title += (' < ' + this.getName(keyRoot, tab.language))
    title = title.replace(/([ක-ෆ])\u200D\u0DCA([ක-ෆ])/g, '$1\u0DCA$2') // remove bandi
    return copyMetaTitle(title) 
  },

  methods: {
    // tabClicked(ind) {
    //   console.log(`change route from tabs to ind:${ind} key:${this.tabList[ind].key}`)
    //   this.$store.commit('tabs/setActiveInd', ind)
    // },
    // closeTab(ind) {
    //   this.$store.commit('tabs/closeTab', ind)
    // },
    // scrollLeft() {
    //   document.getElementById('tabs-bar').scrollLeft -= 100
    // },
    // scrollRight() {
    //   document.getElementById('tabs-bar').scrollLeft += 100
    // }
  },

  watch: {

  },
  created() {
    
  }
}
</script>
