<template>
  <v-btn-toggle v-model="modelValue" dense mandatory shaped color="primary">
    <v-btn :value="0" :icon="iconType">පාළි</v-btn>
    <v-btn :value="2" :icon="iconType" v-if="smAndUp"><v-icon>mdi-view-column</v-icon></v-btn>
    <v-btn :value="1" :icon="iconType">සිංහල</v-btn>
  </v-btn-toggle>
</template>

<style scoped>
</style>

<script>
export default {
  name: 'TabColumnSelector',
  props: {
    varName: String,
    iconType: Boolean,
  },
  data() {
    return { }
  },

  computed: {
    smAndUp() { return this.$vuetify.breakpoint.smAndUp },
    modelValue: {
      get() { return this.varName == 'tabColumns' ? this.tabColumns : this.defaultColumns },
      set(col) { 
        if (this.varName == 'tabColumns') this.tabColumns = col
        else this.defaultColumns = col
      }
    },
    tabColumns: { // columns for the active tab
      get() { return this.$store.getters['tabs/getTabColumns'] },
      set(cols) { this.$store.commit('tabs/setTabColumns', cols) }
    },
    defaultColumns: {
      get() { return this.$store.state.defaultColumns },
      set(value) { this.$store.commit('set', { name: 'defaultColumns', value }) },
    },
  },

  methods: { 

  },
}
</script>