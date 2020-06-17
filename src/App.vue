<template>
  <v-app>
    
    <v-app-bar app dense clipped-left :hide-on-scroll="$vuetify.breakpoint.smAndDown">
      <v-app-bar-nav-icon @click="showTree = !showTree" :color="showTree ? 'primary' : ''"></v-app-bar-nav-icon>

      <v-spacer></v-spacer>

      <!--<v-btn icon @click="searchIconPressed = !searchIconPressed" :dark="searchIconPressed">
        <v-icon>mdi-magnify</v-icon>
      </v-btn>
      <v-autocomplete ref="searchbar" :menu-props="{ maxHeight: 400, closeOnClick: true }"
        :items="searchSuggestions" item-text="name" item-value="path" single-line
        placeholder="සෙවුම් පදය මෙතැන යොදන්න" hide-details no-filter hide-no-data
        :search-input.sync="searchInput" no-data-text="සෙවුම සඳහා ගැළපෙන වචන කිසිවක් හමුවුයේ නැත"
        @update:search-input="runSearch">
        <template v-slot:item="{ item }">
          <v-list-item-content @click.stop="searchResultClick(item)">
            <v-list-item-title v-text="item.name"></v-list-item-title>
            <v-list-item-subtitle v-if="!item.disabled">
              <TipitakaLink v-if="item.keys.length == 1" :itemKey="item.keys[0]" short/>
              <span v-else>{{ `සූත්‍ර ${item.keys.length} ක මේ පදය අඩංගුයි` }}</span>
            </v-list-item-subtitle>
          </v-list-item-content>
          <v-list-item-action>
            <v-btn icon x-small @click.stop="searchBarAction(item)" :color="item.disabled ? 'error' : 'accent'">
              <v-icon>{{ item.disabled ? 'mdi-alert-circle' : 'mdi-content-copy' }}</v-icon>
            </v-btn>
          </v-list-item-action>
        </template>
      </v-autocomplete>-->

      <v-menu offset-y> <!-- search type selector -->
        <template v-slot:activator="{ on }">
          <v-btn v-if="isBigScreen" tile outlined v-on="on"  class="mr-2">
            <v-icon color="primary">{{ searchTypeIcon }}</v-icon>
            <span class="ml-1">{{ searchTypeDesc }}</span>
          </v-btn>
          <v-btn v-else icon tile v-on="on" class="mr-1">
            <v-icon color="primary">{{ searchTypeIcon }}</v-icon>
          </v-btn>
        </template>
        <v-list dense rounded>
          <v-list-item @click="searchType = 'title'">
            <!--<v-list-item-icon><v-icon>mdi-format-title</v-icon></v-list-item-icon>-->
            <v-list-item-title>සූත්‍ර නම් සෙවීම</v-list-item-title>
            <v-list-item-icon><v-icon color="success">{{ searchType == 'title' ? 'mdi-check' : ''}}</v-icon></v-list-item-icon>
          </v-list-item>
          <v-list-item @click="searchType = 'fts'" color="primary">
            <!--<v-list-item-icon ><v-icon>mdi-text</v-icon></v-list-item-icon>-->
            <v-list-item-title>සූත්‍ර අන්තර්ගතය සෙවීම</v-list-item-title>
            <v-list-item-icon><v-icon color="success">{{ searchType == 'fts' ? 'mdi-check' : ''}}</v-icon></v-list-item-icon>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-text-field v-model="searchInput" hide-details placeholder="සෙවුම් පද මෙතැන යොදන්න"
        @focus="$store.commit('search/routeToSearch')">
      </v-text-field> <!-- search bar -->

      <v-spacer></v-spacer>

      <template v-if="showColumnButtons"><!--show only in bigger screens - swipe for xs-->
        <v-btn icon @click="$store.dispatch('tree/navigateTabTo', -1)">
          <v-icon>mdi-skip-previous</v-icon>
        </v-btn>
        <v-btn-toggle v-model="tabColumns" dense multiple mandatory shaped color="primary">
          <v-btn :value="0" text>පාළි</v-btn>
          <v-btn :value="1" text>සිංහල</v-btn>
        </v-btn-toggle>
        <v-btn icon @click="$store.dispatch('tree/navigateTabTo', 1)">
          <v-icon>mdi-skip-next</v-icon>
        </v-btn>
      </template>
      <!--<v-toolbar-title v-if="!showNavigateButtons && !showSearchBar" id="title-bar-text">{{ 'බුද්ධ ජයන්ති ත්‍රිපිටකය' }}</v-toolbar-title>-->
      
      <v-spacer></v-spacer>

      <v-btn icon @click="toggleSettings" :color="isSettingsView ? 'primary' : ''">
        <v-icon>{{ isSettingsView ? 'mdi-arrow-left' : 'mdi-cog' }} </v-icon>
      </v-btn>
    </v-app-bar>

    <v-navigation-drawer app clipped v-model="showTree" mobile-breakpoint="1000" 
      :width="Math.min(350, $vuetify.breakpoint.width)" >
      <v-sheet class="d-inline-flex">
        <TipitakaTree @closeTree="showTree = false"/>
      </v-sheet>
    </v-navigation-drawer>
    
    <v-main>
      <router-view></router-view>
    </v-main>

    <v-snackbar v-model="$store.state.snackbar.model" bottom :timeout="$store.state.snackbar.timeout" class="snack">
      <v-spacer></v-spacer><span>{{ $store.state.snackbar.message }}</span><v-spacer></v-spacer>
    </v-snackbar>

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
/*-#title-bar-text { font-family: 'styled'; font-size: 1.8rem; }*/

.v-navigation-drawer__content { overflow-x: auto !important; } /** Need to be outside the scope */
.v-sheet.d-inline-flex { min-width: 100%; min-height: 100%; } /** Needed to fill the drawer */
</style>

<script>
import TipitakaTree from '@/components/TipitakaTree'
import TipitakaLink from '@/components/TipitakaLink'

export default {
  name: 'App',
  metaInfo: {
    title: 'Home',  
    titleTemplate: '%s | බුද්ධ ජයන්ති ත්‍රිපිටකය' // all titles will be injected into this template
  },

  components: {
    TipitakaTree,
    TipitakaLink,
  },

  data() {
    return {
      showTree: null,
    }
  },
  computed: {
    showColumnButtons() {
      return this.$vuetify.breakpoint.smAndUp && this.$route.name == 'Home' 
        && this.$store.state.tree.activeKey // not render at the startup until things are loaded
    },
    tabColumns: { // columns for the active tab
      get() { return this.$store.getters['tree/getTabColumns'] },
      set(cols) { this.$store.commit('tree/setTabColumns', cols) }
    },
    searchInput: {
      get() { return this.$store.getters['search/getSearchInput'] },
      set(input) { this.$store.commit('search/setSearchInput', input.trim()) }
    },
    searchType: {
      get() { return this.$store.getters['search/getSearchType'] },
      set(type) { this.$store.commit('search/setSearchType', type) }
    },
    searchTypeIcon() { return this.searchType == 'fts' ? 'mdi-text' : 'mdi-format-title' },
    isBigScreen() { return this.$vuetify.breakpoint.smAndUp },
    searchTypeDesc() { return this.searchType == 'fts' ? 'සූත්‍ර අන්තර්ගතය' : 'සූත්‍ර නම්' },
    isSettingsView() { return this.$route.path == '/settings' }
  },
  methods: {
    toggleSettings() {
      if (this.isSettingsView) this.$router.go(-1) // go back
      else this.$router.push('/settings')
    },
  },

  created() {
    this.$store.dispatch('initialize')
    //this.$store.dispatch('search/initialize')
    //this.$vuetify.theme.dark = true
  }
};
</script>
