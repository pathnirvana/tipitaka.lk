<template>
  <v-app>
    
    <v-app-bar app dense clipped-left color="primary" dark hide-on-scroll >
      <v-btn icon color="primary--text" @click="showTree = !showTree">
          <v-icon>mdi-format-list-bulleted</v-icon>
      </v-btn>

      <v-spacer></v-spacer>
      <v-toolbar-title id="title-bar-text">{{ 'බුද්ධ ජයන්ති ත්‍රිපිටකය' }}</v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn icon to="/settings">
        <v-icon>mdi-cog</v-icon>
      </v-btn>
    </v-app-bar>

    <v-navigation-drawer app clipped v-model="showTree" mobile-break-point="1000" width="350">
      <v-sheet flat class="d-inline-flex">
        <TipitakaTree/>
      </v-sheet>
    </v-navigation-drawer>
    
    <v-content>
      <router-view></router-view>
    </v-content>

  </v-app>
</template>

<style scoped>
@font-face { src: local('###'), url('./assets/fonts/UN-Abhaya.ttf') format('truetype'); font-weight: normal; font-family: 'sinhala'; }
/*@font-face { src: local('###'), url('./assets/fonts/AbhayaLibre-SemiBold.ttf') format('truetype'); font-weight: bold; font-family: 'sinhala'; }*/
@font-face { src: local('###'), url('./assets/fonts/UN-Alakamanda-4-95.ttf') format('truetype'); font-weight: normal; font-family: 'styled'; }
@font-face { src: local('###'), url('./assets/fonts/AbhayaLibre-SemiBold.ttf') format('truetype'); font-weight: normal; font-family: 'heading2'; }
#app {
  font-family: 'sinhala'
}
#title-bar-text { font-family: 'styled'; font-size: 1.8rem; }
</style>
<style>
.v-navigation-drawer__content { overflow-x: auto !important; } /** Need to be outside the scope */
</style>

<script>
import TipitakaTree from './components/TipitakaTree';

export default {
  name: 'App',

  components: {
    TipitakaTree,
  },

  data: () => ({
    showTree: null,
  }),

  created() {
    this.$store.dispatch('initialize')
  }
};
</script>
