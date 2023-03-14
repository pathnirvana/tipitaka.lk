<template>
  <v-app>
    
    <v-app-bar app dense clipped-left :hide-on-scroll="appBarHide" :extension-height="tabsHeight">
      <v-app-bar-nav-icon @click="showTree = !showTree" :color="showTree ? 'primary' : ''"></v-app-bar-nav-icon>

      <v-spacer></v-spacer>

      <v-menu offset-y> <!-- search type selector -->
        <template v-slot:activator="{ on }">
          <v-btn v-if="mdAndUp" tile outlined v-on="on"  class="mr-2">
            <v-icon color="primary">{{ searchTypeInfo[searchType][1] }}</v-icon>
            <span class="ml-1">{{ searchTypeInfo[searchType][0] }}</span>
          </v-btn>
          <v-btn v-else icon tile v-on="on" class="mr-1">
            <v-icon color="primary">{{ searchTypeInfo[searchType][1] }}</v-icon>
          </v-btn>
        </template>
        <v-list dense shaped>
          <v-list-item @click="searchType = 'title'">
            <v-list-item-icon><v-icon>mdi-format-title</v-icon></v-list-item-icon>
            <v-list-item-title>සූත්‍ර නාම සෙවීම</v-list-item-title>
            <v-list-item-icon><v-icon color="success">{{ searchType == 'title' ? 'mdi-check' : ''}}</v-icon></v-list-item-icon>
          </v-list-item>
          <v-list-item @click="searchType = 'fts'">
            <v-list-item-icon><v-icon>mdi-text</v-icon></v-list-item-icon>
            <v-list-item-title>සූත්‍ර අන්තර්ගතය සෙවීම</v-list-item-title>
            <v-list-item-icon><v-icon color="success">{{ searchType == 'fts' ? 'mdi-check' : ''}}</v-icon></v-list-item-icon>
          </v-list-item>
          <v-list-item @click="searchType = 'dict'">
            <v-list-item-icon><v-icon>mdi-book-open-page-variant</v-icon></v-list-item-icon>
            <v-list-item-title>පාලි ශබ්දකෝෂ සෙවීම</v-list-item-title>
            <v-list-item-icon><v-icon color="success">{{ searchType == 'dict' ? 'mdi-check' : ''}}</v-icon></v-list-item-icon>
          </v-list-item>
          <v-divider inset></v-divider>
          <v-list-item @click="toggleView('Settings')" :input-value="isView('Settings')">
            <v-list-item-icon><v-icon>mdi-cog</v-icon></v-list-item-icon>
            <v-list-item-title>{{ isView('Settings') ? 'සැකසුමෙන් පිටවෙන්න' : 'සැකසුම් / Settings' }}</v-list-item-title>
          </v-list-item>
          <v-list-item @click="toggleView('Bookmarks')" :input-value="isView('Bookmarks')">
            <v-list-item-icon><v-icon color="star">mdi-star</v-icon></v-list-item-icon>
            <v-list-item-title>{{ isView('Bookmarks') ? 'තරු යෙදුමෙන් පිටවෙන්න' : 'තරු යෙදූ සූත්‍ර / Bookmarks' }}</v-list-item-title>
          </v-list-item>
          <v-list-item to="Help" disabled>
            <v-list-item-icon><v-icon>mdi-help-circle</v-icon></v-list-item-icon>
            <v-list-item-title>උදව් / උපදෙස්</v-list-item-title>
          </v-list-item>
          <v-list-item to="About" disabled>
            <v-list-item-icon><v-icon>mdi-information</v-icon></v-list-item-icon>
            <v-list-item-title>අප ගැන</v-list-item-title>
          </v-list-item>
          <v-list-item href="https://github.com/pathnirvana/tipitaka.lk" target="_blank">
            <v-list-item-icon><v-icon>mdi-github</v-icon></v-list-item-icon>
            <v-list-item-title>කේත කෝෂ්ඨය / ගිට්හබ්</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <!-- search bar -->
      <v-text-field v-model="searchInput" hide-details placeholder="සෙවුම් පද මෙතැන යොදන්න"
        @focus="$store.commit('search/routeToSearch')" clearable>
      </v-text-field>

      <v-spacer></v-spacer>

      <template v-if="isTextTab">

        <template v-if="mdAndUp"><!--show only in bigger screens - swipe/menu for sm,xs-->
          <v-btn icon @click="$store.dispatch('tabs/navigateTabTo', -1)">
            <v-icon>mdi-skip-previous</v-icon>
          </v-btn>
          <TabColumnSelector :iconType="true" varName="tabColumns" />
          <v-divider vertical></v-divider>
          <v-btn-toggle v-model="showScanPage" dense mandatory rounded color="primary" v-if="!isAttaActive">
            <v-btn :value="false" icon><v-icon>mdi-text-box</v-icon></v-btn>
            <v-btn :value="true" icon><v-icon>mdi-scanner</v-icon></v-btn>
          </v-btn-toggle>
          <v-btn icon @click="$store.dispatch('tabs/navigateTabTo', 1)">
            <v-icon>mdi-skip-next</v-icon>
          </v-btn>
        </template>

        <v-menu v-else offset-y>
          <template v-slot:activator="{ on }">
            <v-btn icon tile v-on="on">
              <v-icon color="primary">mdi-dots-vertical</v-icon>
            </v-btn>
          </template>
          <v-list dense shaped>
            <v-list-item>
              <TabColumnSelector :iconType="false" varName="tabColumns" />
            </v-list-item>
            <v-divider inset></v-divider>
            <v-list-item @click="$store.dispatch('tabs/navigateTabTo', -1)">
              <v-list-item-icon><v-icon>mdi-skip-previous</v-icon></v-list-item-icon>
              <v-list-item-title>කලින් සූත්‍රයට</v-list-item-title>
              <v-list-item-icon><v-icon color="success">{{ searchType == 'dict' ? 'mdi-check' : ''}}</v-icon></v-list-item-icon>
            </v-list-item>
            <v-list-item @click="$store.dispatch('tabs/navigateTabTo', 1)">
              <v-list-item-icon><v-icon>mdi-skip-next</v-icon></v-list-item-icon>
              <v-list-item-title>ඊළඟ සුත්‍රයට</v-list-item-title>
            </v-list-item>
            <v-divider inset></v-divider>
            <v-list-item @click="showScanPage = !showScanPage" v-if="!isAttaActive">
              <v-list-item-icon><v-icon>{{ showScanPage ? 'mdi-text-box' : 'mdi-scanner' }}</v-icon></v-list-item-icon>
              <v-list-item-title>{{ showScanPage ? 'නව පිටපතට' : 'පැරණි පිටපතට' }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
    
      </template>
      <template v-else-if="tabList.length > 0"> <!-- not textTab but has tabs -->
        <v-spacer></v-spacer>
        <v-btn icon @click="$router.push({ name: 'Home' })" color="success">
          <v-icon>mdi-exit-to-app</v-icon>
        </v-btn>
      </template>

      <template v-slot:extension v-if="isTextTab">
        <v-tabs center-active centered show-arrows="mobile" v-model="activeTabInd" :height="tabsHeight">
          <v-tab v-for="(tab, ind) in tabList" :key="ind">
              {{ getName(tab.key) }}
              <v-btn icon x-small fab color="error" class="ml-1 mr-n2" @click.stop="$store.commit('tabs/closeTab', ind)">
                <v-icon>mdi-close</v-icon>
              </v-btn>
          </v-tab>
        </v-tabs>
      </template>

    </v-app-bar>

    <v-navigation-drawer app clipped v-model="showTree" mobile-breakpoint="1000"
      :width="Math.min(350, $vuetify.breakpoint.width)" >
      <v-sheet class="d-inline-flex">
        <TipitakaTree @closeTree="showTree = false"/>
      </v-sheet>
    </v-navigation-drawer>
    
    <v-main>
      <!-- <v-container fluid> adds too much padding -->
        <router-view></router-view>
      <!-- </v-container> -->
    </v-main>

    <v-snackbar app v-model="$store.state.snackbar.model" top rounded="pill" color="info"
      :timeout="$store.state.snackbar.timeout" >
      <div style="text-align: center;"><span>{{ $store.state.snackbar.message }}</span></div>
    </v-snackbar>

    <!-- <v-bottom-navigation app
      hide-on-scroll
      fixed
      horizontal
    >
      <v-btn text color="deep-purple accent-4">
        <span>Recents</span>
        <v-icon>mdi-history</v-icon>
      </v-btn>
    </v-bottom-navigation> -->

  </v-app>
</template>

<style>
@font-face { src: local('###'), url('./assets/fonts/UN-Abhaya.ttf') format('truetype'); font-weight: normal; font-family: 'sinhala'; }
/*@font-face { src: local('###'), url('./assets/fonts/AbhayaLibre-SemiBold.ttf') format('truetype'); font-weight: bold; font-family: 'sinhala'; }*/
@font-face { src: local('###'), url('./assets/fonts/UN-Alakamanda-4-95.ttf') format('truetype'); font-weight: normal; font-family: 'styled'; }
@font-face { src: local('###'), url('./assets/fonts/AbhayaLibre-SemiBold.ttf') format('truetype'); font-weight: normal; font-family: 'heading2'; }
#app {
  font-family: 'sinhala';
}

.v-navigation-drawer__content { overflow-x: auto !important; } /* Need to be outside the scope */
.v-sheet.d-inline-flex { min-width: 100%; min-height: 100%; } /** Needed to fill the drawer */
</style>

<script>
import TipitakaTree from '@/components/TipitakaTree'
import TipitakaLink from '@/components/TipitakaLink'
import TabColumnSelector from '@/components/TabColumnSelector'
import { mapState, mapGetters } from 'vuex'

export default {
  name: 'App',
  metaInfo: {
    title: 'Home',  
    titleTemplate: '%s | බුද්ධ ජයන්ති ත්‍රිපිටකය', // all titles will be injected into this template
    meta: [ // remove from index.html and add here - otherwise duplicate tags will be created
      { property: 'og:title', content: 'බුද්ධ ජයන්ති ත්‍රිපිටකය', vmid: 'og:title' },
    ],
  },

  components: {
    TipitakaTree,
    TipitakaLink,
    TabColumnSelector,
  },

  data() {
    return {
      showTree: null,
      searchTypeInfo: {
        'title': ['සූත්‍ර නාම', 'mdi-format-title'],
        'fts': ['සූත්‍ර අන්තර්ගතය', 'mdi-text'], 
        'dict': ['පාලි ශබ්දකෝෂ', 'mdi-book-open-page-variant'], 
      },
      tabsHeight: '40px',
    }
  },
  computed: {
    ...mapState('tabs', ['tabList']),
    ...mapGetters('tree', ['getName']),
    isTextTab() { // not render at the startup until things are loaded
      return this.$route.name == 'Home' && this.activeTabInd >= 0 
    },
    searchInput: {
      get() { return this.$store.getters['search/getSearchInput'] },
      set(input) { this.$store.commit('search/setSearchInput', input ? input.trim() : '') }
    },
    searchType: {
      get() { return this.$store.getters['search/getSearchType'] },
      set(value) { 
        this.$store.commit('search/setSearchType', value) 
      }
    },
    showScanPage: { // null for not selected or 1 if selected
      get() { return this.$store.getters['tabs/getShowScanPage'] },
      set(val) { this.$store.commit('tabs/setShowScanPage', val) }
    },
    isAttaActive() { return this.$store.getters['tabs/getIsAtta'] },
    mdAndUp() { return this.$vuetify.breakpoint.mdAndUp },
    smAndUp() { return this.$vuetify.breakpoint.smAndUp },
    //isSettingsView() { return this.$route.path == '/settings' },
    activeTabInd: {
      get() { return this.$store.state.tabs.activeInd },
      set(ind) {  
        this.$store.commit('tabs/setActiveInd', ind)
        this.$store.dispatch('tree/syncOpenBranches', false)
      },
    },
    appBarHide() {
      return this.$vuetify.breakpoint.height < 700 || !this.smAndUp
    }
  },
  methods: {
    // toggleSettings() {
    //   if (this.isSettingsView) this.$router.go(-1) // go back
    //   else this.$router.push('/settings')
    // },
    isView(name) { return this.$route.name == name },
    toggleView(name) {
      if (this.isView(name)) this.$router.go(-1) // go back
      else this.$router.push({ name })
    },
  },

  created() {
    this.$store.dispatch('initialize')
    this.$store.dispatch('search/initialize')
    this.$store.dispatch('audio/initialize')
  }
};
</script>
