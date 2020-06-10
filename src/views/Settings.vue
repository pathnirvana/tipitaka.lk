<template>
  <v-container fluid>
    <v-row dense>
      <v-col cols="12" sm="6" xl="4">
        <v-card>
          <v-card-title v-if="!darkMode">රාත්‍රී අඳුරු තිරය</v-card-title>
          <v-card-title v-else>දහවල් ආලෝකමත් තිරය</v-card-title>
          <v-card-subtitle>රාත්‍රී අඳුරු තිරය සහ දහවල් ආලෝකමත් තිරය අතර මාරු වෙන්න. අඳුරු තිරය රාත්‍රියේදී ඇසට පහසුය.</v-card-subtitle>
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
          <v-card-subtitle>අධෝලිපි යනු බුද්ධ ජයන්ති ත්‍රිපිටකය අනෙක් ත්‍රිපිටක ග්‍රන්ථ මාලා වලින් වෙනස් වන ස්ථාන පෙන්වීම පිණිස සෑම පිටුවකම යටින් සටහන් කර ඇති කොටසය.</v-card-subtitle>
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
          <v-card-subtitle>අලුතෙන් සූත්‍රයක් ඇරීමේදී පෙන්වන්නේ පාළි, සිංහල හෝ ඒ තීරු දෙකමද යන්න.</v-card-subtitle>
          <v-card-actions>
            <v-btn-toggle v-model="defaultColumns" dense multiple mandatory shaped color="primary">
              <v-btn :value="0" text>පාළි</v-btn>
              <v-btn :value="1" text>සිංහල</v-btn>
            </v-btn-toggle>
            <span class="ml-3">{{ columnSelectionText }}</span>
          </v-card-actions>
        </v-card>
      </v-col>

    </v-row>
  </v-container>
</template>

<script>
import { mapState } from 'vuex'

export default {
  name: 'Settings',
  metaInfo: {  title: 'සැකසුම්' },
  components: { },

  data: () => ({
  }),
  computed: {
    ...mapState(['bandiLetters', 'specialLetters']),
    darkMode: {
      get() { return this.$store.state.darkMode },
      set(value) { this.$store.commit('set', { name: 'darkMode', value }) },
    },
    defaultColumns: {
      get() { return this.$store.state.defaultColumns },
      set(value) { this.$store.commit('set', { name: 'defaultColumns', value }) },
    },
    treeLanguage: {
      get() { return this.$store.state.treeLanguage },
      set(value) { this.$store.commit('set', { name: 'treeLanguage', value }) },
    },
    footnoteMethod: {
      get() { return this.$store.state.footnoteMethod },
      set(value) { this.$store.commit('set', { name: 'footnoteMethod', value }) },
    },
    bandiLetters: {
      get() { return this.$store.state.bandiLetters },
      set(value) { this.$store.commit('set', { name: 'bandiLetters', value }) },
    },
    specialLetters: {
      get() { return this.$store.state.specialLetters },
      set(value) { this.$store.commit('set', { name: 'specialLetters', value }) },
    },
    showPageNumbers: {
      get() { return this.$store.state.showPageNumbers },
      set(value) { this.$store.commit('set', { name: 'showPageNumbers', value }) },
    },
    fontSize: {
      get() { return this.$store.state.fontSize },
      set(value) { this.$store.commit('set', { name: 'fontSize', value }) },
    },
    columnSelectionText() {
      if (this.defaultColumns.length == 2) return 'පාළි සිංහල දෙකම'
      return (this.defaultColumns[0] == 0 ? 'පාළි' : 'සිංහල') + ' පමණයි'
    },
  },
  watch: {
    bandiLetters() { this.$store.commit('tree/recomputeTree', this.$store.state) },
    specialLetters() { this.$store.commit('tree/recomputeTree', this.$store.state) }
  },
}
</script>