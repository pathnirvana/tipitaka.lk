<template>
  <v-card>
    
    <v-tabs v-model="activeKeyInd" background-color="primary" dark>
      <v-tab v-for="item in tabItems" :key="item.key">
        {{ item.pali }}
      </v-tab>
    </v-tabs>

    <v-tabs-items v-model="activeKeyInd">
      <v-tab-item v-for="item in tabItems" :key="item.key">
        <v-sheet flat>
          <TextTab :item="item"/>
        </v-sheet>
      </v-tab-item>
    </v-tabs-items>

  </v-card>
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
    tab: null,
  }),
  computed: {
    ...mapState('tree', ['activeKey', 'openKeys']),
    activeKeyInd: {
      get () { return this.openKeys.indexOf(this.activeKey) },
      set (ind) {
        const newKey = this.openKeys[ind]
        console.log(`change route from home to ${newKey}`)
        this.$store.commit('tree/setActiveKey', newKey)
        this.$router.push('/' + newKey)
      }
    },
    tabItems() {
      return this.openKeys.map(key => this.$store.state.tree.index[key])
    }
  },
  methods: {
  },
  created() {
    
  }
}
</script>
