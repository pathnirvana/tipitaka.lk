<!-- the reading view: the open sutta (one at a time) in the reading mode, the audio bar and the dictionary pane
     (web/src/views/Reader.vue without tabs and columns) -->
<template>
  <div>
    <Text v-for="(tab, i) in tabs.tabList" v-show="i === tabs.activeInd" :key="tab.uid" :tab="tab" />
    <button class="fixed z-20 rounded-full bg-surface2 p-2 shadow-lg" :style="{ right: `${contentRight + 16}px`, bottom: `${dictBottom + (audio.controlsVisible ? 80 : 16)}px` }"
      title="top" data-testid="scroll-top" @click="scrollTop"><IconTop /></button>
    <AudioControl />
    <InlineDict />
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useHead } from '@unhead/vue'
import IconTop from '~icons/mdi/chevron-triple-up'
import Text from '@p/components/Text.vue'
import AudioControl from '@/components/AudioControl.vue'
import InlineDict from '@/components/InlineDict.vue'
import { useTabs } from '@/stores/tabs'
import { useTree } from '@/stores/tree'
import { useAudio } from '@/stores/audio'
import { useInlineDict } from '@/stores/inlineDict'
import { useHistory } from '@/stores/history'
import { useLayout } from '@/composables/layout'
import { removeBandi } from '@shared/beautify'

const tabs = useTabs(), tree = useTree(), audio = useAudio(), inlineDict = useInlineDict(), history = useHistory()
const { contentRight, dictBottom } = useLayout()

// the pane's paragraph (the setting tab) follows the open sutta
watch(() => [tabs.activeTab?.uid, tabs.activeTab?.node?.file] as const, () => {
  const t = tabs.activeTab
  if (t?.node) inlineDict.follow({ file: t.node.file, page: t.eInd[0], entry: t.eInd[1], key: t.key })
})
// the reading history (the bookmarks page)
watch(() => [tabs.activeTab?.key, !!tabs.activeTab?.node] as const, ([key, found]) => {
  if (key && found) history.visit(key, tabs.activeTab!.language)
}, { immediate: true })

const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

// title "<sutta> < <collection root>" in Sinhala (web/src/views/Reader.vue)
const rootItem = computed(() => {
  const key = tabs.activeTab?.key
  const root = key?.split('-')[0]
  return root && root !== key ? tree.items.get(root) || tree.nodes.get(root) : undefined
})
watch(() => tabs.activeKey, k => { if (k && !rootItem.value) tree.getPath(k) }, { immediate: true })
const title = computed(() => {
  const tab = tabs.activeTab
  if (!tab?.node) return 'Home'
  let t = tree.nameOf(tab.node, 'sinh')
  if (rootItem.value) t += ' < ' + tree.nameOf(rootItem.value, 'sinh')
  return removeBandi(t)
})
useHead({ title, meta: [{ property: 'og:title', content: title }] })

// the server rendered article (#ssr) is removed once the text is shown
watch(() => tabs.activeTab?.isLoaded || !!tabs.activeTab?.errorMessage, done => { if (done) document.getElementById('ssr')?.remove() }, { immediate: true })
</script>
