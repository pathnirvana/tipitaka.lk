<template>
  <v-sheet>
    
    <v-tabs v-model="activeKeyInd" show-arrows>
      <v-tab v-for="item in tabItems" :key="item.key">
        {{ item.pali }}
        <v-btn icon x-small fab color="error" class="ml-1 mr-n1" @click.stop="closeTab(item.key)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-tab>
    </v-tabs>

    <v-tabs-items :value="activeKeyInd" mandatory>
      <v-tab-item v-for="item in tabItems" :key="item.key">
        <v-sheet flat>
          <TextTab :itemKey="item.key"/>
        </v-sheet>
      </v-tab-item>
    </v-tabs-items>
    
    <v-btn fab small dark color="accent" fixed bottom right
      @click="$vuetify.goTo(0)">
        <v-icon>mdi-chevron-up</v-icon>
    </v-btn>
  </v-sheet>
</template>

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
    activeKeyInd: {
      get () { return this.openKeys.indexOf(this.activeKey) },
      set (ind) {
        //if (ind == undefined) return // tab-items set to mandatory so that ind will not be undefined
        const newKey = this.openKeys[ind]
        console.log(`change route from home to ${newKey}`)
        this.$store.dispatch('tree/setActiveKey', newKey)
      }
    },
    tabItems() {
      return this.openKeys.map(key => this.$store.state.tree.index[key])
    }
  },
  methods: {
    closeTab(key) {
      this.$store.commit('tree/closeKey', key)
    },
  },
  created() {
    
  }
}
</script>
