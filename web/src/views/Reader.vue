<!-- the reading view: one TextTab per open tab (v2 Home.vue) -->
<template>
  <div>
    <TextTab v-for="(tab, i) in tabs.tabList" v-show="i === tabs.activeInd" :key="tab.uid" :tab="tab" />
    <button class="fixed bottom-4 right-4 z-20 rounded-full bg-surface2 p-2 shadow-lg" :class="{ 'bottom-[270px]': inlineDict.show, 'bottom-20': audio.controlsVisible && !inlineDict.show }"
      title="top" data-testid="scroll-top" @click="scrollTop"><IconTop /></button>
    <AudioControl />
    <InlineDict />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { useHead } from '@unhead/vue'
import { useEventListener } from '@vueuse/core'
import IconTop from '~icons/mdi/chevron-triple-up'
import TextTab from '@/components/TextTab.vue'
import AudioControl from '@/components/AudioControl.vue'
import InlineDict from '@/components/InlineDict.vue'
import { useTabs } from '@/stores/tabs'
import { useTree } from '@/stores/tree'
import { useAudio } from '@/stores/audio'
import { useInlineDict } from '@/stores/inlineDict'
import { removeBandi } from '@shared/beautify'

const tabs = useTabs(), tree = useTree(), audio = useAudio(), inlineDict = useInlineDict()
const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

// each tab keeps its own scroll position (the window scrolls, so it is saved per tab and restored on switching)
useEventListener(window, 'scroll', () => { if (tabs.activeTab) tabs.update(tabs.activeTab, { scrollY: window.scrollY }) }, { passive: true })
watch(() => tabs.activeTab, async t => {
  await nextTick() // after the v-show switch, so the page is tall enough for the position
  if (t && t === tabs.activeTab) window.scrollTo(0, t.scrollY)
}, { immediate: true })

// title "<sutta> < <collection root>" (v2 Home.vue metaInfo)
const rootName = computed(() => {
  const tab = tabs.activeTab
  if (!tab) return ''
  let root = tab.key.split('-')[0]
  if (root === 'atta') root = 'atta-' + tab.key.split('-')[1]
  return root !== tab.key ? root : ''
})
const rootItem = computed(() => (rootName.value ? tree.items.get(rootName.value) || tree.nodes.get(rootName.value) : undefined))
watch(rootName, r => { if (r && !rootItem.value) tree.getPath(tabs.activeKey) }, { immediate: true })
const title = computed(() => {
  const tab = tabs.activeTab
  if (!tab?.node) return 'Home'
  let t = tree.nameOf(tab.node, tab.language)
  if (rootItem.value) t += ' < ' + tree.nameOf(rootItem.value, tab.language)
  return removeBandi(t)
})
useHead({ title, meta: [{ property: 'og:title', content: title }] })

// the server rendered article (#ssr) is removed once the reader has rendered the text
watch(() => tabs.activeTab?.isLoaded || !!tabs.activeTab?.errorMessage, done => { if (done) document.getElementById('ssr')?.remove() }, { immediate: true })
</script>
