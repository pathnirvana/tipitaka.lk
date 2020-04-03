<template>
  <v-card>
    
    <v-tabs v-model="tab" background-color="primary" dark>
      <v-tab v-for="item in tabItems" :key="item.key">
        {{ item.name }}
      </v-tab>
    </v-tabs>

    <v-tabs-items v-model="tab">
      <v-tab-item v-for="item in tabItems" :key="item.key">
        <v-sheet flat>
          <TextTab :filename="item.key"/>
        </v-sheet>
      </v-tab-item>
    </v-tabs-items>

  </v-card>
</template>

<script>
// @ is an alias to /src
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
    tabItems() {
      return this.$store.state.tree.activeKeys.map(key => ({ key, name: 'name ' + key, content: 'tab ' + key } ))
    }
  },
  methods: {
    loadText() {
      
    }
  },
}
</script>
