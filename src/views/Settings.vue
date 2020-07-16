<template>
  <v-container fluid>
    <v-row dense>
      <v-col cols="12" sm="6" xl="4">
        <v-card>
          <v-card-title v-if="!darkMode">රාත්‍රී අඳුරු තිරය</v-card-title>
          <v-card-title v-else>දහවල් ආලෝකමත් තිරය</v-card-title>
          <v-card-text>රාත්‍රී අඳුරු තිරය සහ දහවල් ආලෝකමත් තිරය අතර මාරු වෙන්න. අඳුරු තිරය රාත්‍රියේදී ඇසට පහසුය.</v-card-text>
          <v-card-actions>
            <v-btn @click="darkMode = !darkMode" color="primary" outlined>
              <v-icon class="mr-2">{{ 'mdi-brightness-' + (darkMode ? '4' : '7') }}</v-icon>
              {{ darkMode ? 'ආලෝකමත් තිරය' : 'අඳුරු තිරය' }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" xl="4">
        <v-card>  
          <v-card-title>සූත්‍ර නාමාවලිය පෙන්වන භාෂාව</v-card-title>
          <v-card-actions>
            <v-radio-group v-model="treeLanguage" row>
              <v-radio label="පාළි" value="pali"></v-radio>
              <v-radio label="සිංහල" value="sinh"></v-radio>
            </v-radio-group>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" xl="4">
        <v-card>  
          <v-card-title>අධෝලිපි (Footnotes)</v-card-title>
          <v-card-text>අධෝලිපි යනු බුද්ධ ජයන්ති ත්‍රිපිටකය අනෙක් ත්‍රිපිටක ග්‍රන්ථ මාලා වලින් වෙනස් වන ස්ථාන පෙන්වීම පිණිස සෑම පිටුවකම යටින් සටහන් කර ඇති කොටසය.</v-card-text>
          <v-card-actions>
            <v-radio-group v-model="footnoteMethod">
              <v-radio label="නොපෙන්වන්න" value="hidden"></v-radio>
              <v-radio label="click එබූ විට පෙන්වන්න" value="click"></v-radio>
              <v-radio label="hover විට පෙන්වන්න" value="hover"></v-radio>
              <v-radio label="පිටුවේ අග පෙන්වන්න" value="end-page"></v-radio>
              <!--<v-radio label="එතැනම පෙන්වන්න" value="show-inline"></v-radio>-->
            </v-radio-group>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" xl="4">
        <v-card>  
          <v-card-title>වෙනත් සැකසුම්</v-card-title> <!-- bandi akuru, text size, show page numbers-->
          <v-card-text>
            <v-switch v-model="bandiLetters" class="mx-2" label="පාළි බැඳි අකුරු භාවිතා කරන්න"></v-switch>
            <v-switch v-model="specialLetters" class="mx-2" label="විශේෂ පාළි අකුරු භාවිතා කරන්න"></v-switch>
            <v-switch v-model="showPageNumbers" class="mx-2" label="පොතේ පිටු අංක පෙන්වන්න"></v-switch>
            <v-switch v-model="syncTree" class="mx-2" label="කියවන සූත්‍රය හා නාමාවලිය සමමුහු (Sync) කරන්න"></v-switch>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" xl="4">
        <v-card>  
          <v-card-title>අකුරු විශාලත්වය</v-card-title> 
          <v-card-text color="info">
            <span :style="{ fontSize: 16 + $store.state.fontSize + 'px' }">නමො තස‍්ස භගවතො අරහතො</span>
          </v-card-text>
          <v-card-actions>
            <v-slider v-model="fontSize" step="1" ticks="always" :thumb-size="24"
              thumb-label="always" :min="-5" :max="5"></v-slider>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" xl="4">
        <v-card>  
          <v-card-title>පාළි සිංහල තීරු තෝරන්න</v-card-title> 
          <v-card-text>අලුතෙන් සූත්‍රයක් ඇරීමේදී පෙන්වන්නේ පාළි, සිංහල හෝ ඒ තීරු දෙකමද යන්න.</v-card-text>
          <v-card-actions>
            <TabColumnSelector :iconType="false" varName="defaultColumns" />
            <span class="ml-3">{{ columnSelectionText }}</span>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" xl="4">
        <v-card>  
          <v-card-title>මෘදුකාංගය යාවත්කාලින (update) කිරීම</v-card-title> 
          <v-card-text>
            <div>{{ `ඔබ දැන් භාවිතා කරන්නේ version: ${version} වන මෘදුකාංගයයි.` }}</div>
            <div :class="versionColor">{{ versionText }}</div>
          </v-card-text>
          <v-card-actions>
            <v-btn @click="checkVersion" color="primary" outlined>
              <v-icon class="mr-2">mdi-update</v-icon>පරික්ෂා කරන්න
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

    </v-row>
  </v-container>
</template>

<script>
import TabColumnSelector from '@/components/TabColumnSelector'
import { mapState } from 'vuex'
import { tipitakaAppVersion } from '@/constants.js'
import axios from 'axios'

function getVuexBindings(props) {
  const bindings = {}
  props.forEach(prop => bindings[prop] = {
    get() { return this.$store.state[prop] },
    set(value) { this.$store.commit('set', { name: prop, value }) },
  })
  return bindings
}

export default {
  name: 'Settings',
  metaInfo: {  title: 'සැකසුම් / Settings' },
  components: { 
    TabColumnSelector,
  },

  data: () => ({
    version: tipitakaAppVersion, //Number(process.env.VUE_APP_VERSION),
    newVersion: 0,
  }),
  computed: {
    ...mapState(['bandiLetters', 'specialLetters']),

    ...getVuexBindings(['darkMode', 'treeLanguage', 'footnoteMethod', 
      'bandiLetters', 'specialLetters', 'showPageNumbers', 'fontSize', 'syncTree']),
    
    columnSelectionText() {
      switch(this.$store.state.defaultColumns) {
        case 2: return 'පාළි සිංහල දෙකම.'
        case 1: return 'පාළි පමණයි.'
        default: return 'සිංහල පමණයි.'
      }
    },
    versionText() {
      if (this.newVersion == -1) {
        return `පරික්ෂා කිරීමේදී දෝෂයක් මතුවිය. ඔබ අන්තර්ජාලයට සම්බන්ධ වී නැවත උත්සාහ කරන්න.`
      } else if (this.newVersion <= this.version) {
        return `ඔබ දැනටමත් අලුත්ම version එක භාවිතා කරමින් සිටී.`
      } else if (this.newVersion) {
        return `අලුත් version ${this.newVersion} පැමිණ ඇත. ඔබේ මෘදුකාංගය යාවත්කාලින කරගන්න.`
      }
      return `පහත බොත්තම ඔබා අලුත් version එකක් තිබේදැයි පරික්ෂා කරන්න.`
    },
    versionColor() {
      if (this.newVersion == -1) return 'error--text'
      else if (this.newVersion <= this.version) return 'success--text'
      return 'accent--text'
    }
  },

  methods: {
    async checkVersion() {
      try {
        const response = await axios.get('https://tipitaka.lk/tipitaka-query/version')
        this.newVersion = Number(response.data)
      } catch (err) {
        console.log(err)
        this.newVersion = -1
      }
    }
  },

  mounted() { this.checkVersion() },

  watch: {
    bandiLetters() { this.$store.commit('tree/recomputeTree', this.$store.state) },
    specialLetters() { this.$store.commit('tree/recomputeTree', this.$store.state) }
  },
}
</script>