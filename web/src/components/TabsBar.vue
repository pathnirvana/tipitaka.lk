<template>
  <div class="flex h-10 items-end justify-center overflow-x-auto border-t border-line" role="tablist" data-testid="tabs-bar">
    <div v-for="(tab, i) in tabs.tabList" :key="tab.uid" role="tab" :aria-selected="i === tabs.activeInd"
      :class="['flex shrink-0 cursor-pointer items-center whitespace-nowrap border-b-2 px-3 py-1.5 text-sm', i === tabs.activeInd ? 'border-primary text-primary' : 'border-transparent text-muted']"
      data-testid="tab" @click="tabs.setActive(i)">
      {{ names[i] }}
      <button class="ml-1 rounded-full bg-error p-0.5 text-[10px] text-white" title="close" data-testid="tab-close" @click.stop="tabs.closeTab(i)"><IconClose /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import IconClose from '~icons/mdi/close'
import { useTabs } from '@/stores/tabs'
import { useTree } from '@/stores/tree'

const tabs = useTabs(), tree = useTree()
const names = computed(() => tabs.tabList.map(t => (t.node ? tree.nameOf(t.node) : t.key)))
</script>
