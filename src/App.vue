<template>
  <v-app>
    
    <v-app-bar app dense clipped-left :hide-on-scroll="$vuetify.breakpoint.smAndDown">
      <v-app-bar-nav-icon @click="showTree = !showTree" :color="showTree ? 'primary' : ''"></v-app-bar-nav-icon>

      <v-spacer></v-spacer>

      <!--<v-btn icon @click="searchIconPressed = !searchIconPressed" :dark="searchIconPressed">
        <v-icon>mdi-magnify</v-icon>
      </v-btn>-->
      <v-autocomplete ref="searchbar" :menu-props="{ maxHeight: 400, closeOnClick: true }"
        :items="searchSuggestions" item-text="name" item-value="path" single-line
        placeholder="සෙවුම් පදය මෙතැන යොදන්න" hide-details no-filter hide-no-data
        :search-input.sync="searchInput" no-data-text="සෙවුම සඳහා ගැළපෙන වචන කිසිවක් හමුවුයේ නැත">
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
      </v-autocomplete>

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
        <v-icon>mdi-cog</v-icon>
      </v-btn>
    </v-app-bar>

    <v-navigation-drawer app clipped v-model="showTree" mobile-break-point="1000" 
      :width="Math.min(350, $vuetify.breakpoint.width)" >
      <v-sheet class="d-inline-flex">
        <TipitakaTree @closeTree="showTree = false"/>
      </v-sheet>
    </v-navigation-drawer>
    
    <v-content>
      <router-view></router-view>
    </v-content>

  </v-app>
</template>

<style>
@font-face { src: local('###'), url('./assets/fonts/UN-Abhaya.ttf') format('truetype'); font-weight: normal; font-family: 'sinhala'; }
/*@font-face { src: local('###'), url('./assets/fonts/AbhayaLibre-SemiBold.ttf') format('truetype'); font-weight: bold; font-family: 'sinhala'; }*/
@font-face { src: local('###'), url('./assets/fonts/UN-Alakamanda-4-95.ttf') format('truetype'); font-weight: normal; font-family: 'styled'; }
@font-face { src: local('###'), url('./assets/fonts/AbhayaLibre-SemiBold.ttf') format('truetype'); font-weight: normal; font-family: 'heading2'; }
#app {
  font-family: 'sinhala'
}
#title-bar-text { font-family: 'styled'; font-size: 1.8rem; }

.v-navigation-drawer__content { overflow-x: auto !important; } /** Need to be outside the scope */
</style>

<script>
import TipitakaTree from '@/components/TipitakaTree'
import TipitakaLink from '@/components/TipitakaLink'

export default {
  name: 'App',

  components: {
    TipitakaTree,
    TipitakaLink,
  },

  data: () => ({
    showTree: null,
    searchIconPressed: false,
    searchInput: '',  // search bar input
    searchLoading: false,
  }),
  computed: {
    showColumnButtons() {
      return this.$vuetify.breakpoint.smAndUp && this.$route.params.pathMatch
    },
    tabColumns: { // columns for the active tab
      get() { return this.$store.getters['tree/getTabColumns'] },
      set(cols) { this.$store.commit('tree/setTabColumns', cols) }
    },
    showSearchBar() {
      return this.searchIconPressed || this.$route.path == '/search' || this.$vuetify.breakpoint.mdAndUp
    },
    showNavigateButtons() {
      return this.$route.params.pathMatch && !(this.searchIconPressed && this.$vuetify.breakpoint.smAndDown)
    },
    searchSuggestions() {
      return this.$store.getters['search/getSuggestions'](this.searchInput)
    },
    isSettingsView() { return this.$route.path == '/settings' }
  },
  methods: {
    toggleSettings() {
      if (this.isSettingsView) this.$router.go(-1) // go back
      else this.$router.push('/settings')
    },
    toggleSearchMode() {
      this.searchIconPressed = !this.searchIconPressed
      //if (this.searchIconPressed) this.$refs.searchbar.focus()
    },
    searchBarAction(item) { if (item.name && !item.disabled) this.searchInput = item.name },
    //navigateOnSelect(path) { this.$router.push('/' + path) },
    searchResultClick(item) {
      if (!item.disabled) this.searchInput = item.text
      this.$router.push('/' + item.path) 
    },
  },

  created() {
    this.$store.dispatch('initialize')
    this.$store.dispatch('search/initialize')
  }
};
</script>
