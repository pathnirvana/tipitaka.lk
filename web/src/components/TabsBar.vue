<!-- open suttas: scrollable tab strip with scroll buttons and a list of all tabs -->
<template>
  <div class="flex h-10 items-stretch border-t border-line" data-testid="tabs-bar">
    <button v-show="overflow" class="icon-btn shrink-0 rounded-none" title="scroll left" @click="scrollBy(-1)"><IconLeft /></button>
    <div ref="strip" class="no-scrollbar flex min-w-0 flex-1 items-end overflow-x-auto" :class="{ 'justify-center': !overflow }" role="tablist" @scroll="updateOverflow">
      <div v-for="(tab, i) in tabs.tabList" :key="tab.uid" role="tab" :aria-selected="i === tabs.activeInd" :title="names[i]"
        :class="['group flex max-w-[200px] shrink-0 cursor-pointer items-center whitespace-nowrap border-b-2 py-1.5 pl-3 pr-1', i === tabs.activeInd ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-fg']"
        data-testid="tab" @click="tabs.setActive(i)" @auxclick.prevent="$event.button === 1 && tabs.closeTab(i)">
        <span class="truncate">{{ names[i] }}</span>
        <button :class="['ml-1 rounded-full p-0.5 text-[12px] hover:bg-error hover:text-white', i === tabs.activeInd ? '' : 'opacity-0 group-hover:opacity-100 max-sm:opacity-60']"
          title="close" data-testid="tab-close" @click.stop="tabs.closeTab(i)"><IconClose /></button>
      </div>
    </div>
    <button v-show="overflow" class="icon-btn shrink-0 rounded-none" title="scroll right" @click="scrollBy(1)"><IconRight /></button>
    <div v-if="tabs.tabList.length > 1" class="relative shrink-0 border-l border-line">
      <button ref="listBtn" class="icon-btn h-full rounded-none px-2" :title="`ඇරි සූත්‍ර ${tabs.tabList.length}`" data-testid="tabs-list" @click="listOpen = !listOpen">
        <IconTabs /><span class="ml-0.5 text-xs">{{ tabs.tabList.length }}</span>
      </button>
      <Floating :open="listOpen" :anchor="listBtn ?? null" @close="listOpen = false">
        <div class="flex max-h-[70vh] min-w-[260px] flex-col" data-testid="tabs-list-menu">
          <div class="border-b border-line py-1">
            <button class="menu-item" data-testid="close-other-tabs" @click="tabs.closeOthers(tabs.activeInd); listOpen = false"><IconCloseBox class="mr-3" />අනෙක් සියල්ල වසන්න</button>
            <button class="menu-item" data-testid="close-all-tabs" @click="tabs.closeAll(); listOpen = false"><IconCloseAll class="mr-3" />සියල්ල වසන්න</button>
          </div>
          <div ref="listEl" class="overflow-y-auto py-1">
            <div v-for="(tab, i) in tabs.tabList" :key="tab.uid" :class="['menu-item cursor-pointer', { 'bg-surface2 text-primary': i === tabs.activeInd }]" :data-active="i === tabs.activeInd" data-testid="tabs-list-item" @click="tabs.setActive(i); listOpen = false">
              <span class="flex-1 truncate">{{ names[i] }}</span>
              <button class="ml-2 rounded-full p-0.5 hover:bg-error hover:text-white" title="close" @click.stop="tabs.closeTab(i)"><IconClose /></button>
            </div>
          </div>
        </div>
      </Floating>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import IconClose from '~icons/mdi/close'
import IconLeft from '~icons/mdi/chevron-left'
import IconRight from '~icons/mdi/chevron-right'
import IconTabs from '~icons/mdi/tab'
import IconCloseBox from '~icons/mdi/close-box-multiple-outline'
import IconCloseAll from '~icons/mdi/close-circle-multiple-outline'
import Floating from './Floating.vue'
import { useTabs } from '@/stores/tabs'
import { useTree } from '@/stores/tree'

const tabs = useTabs(), tree = useTree()
const names = computed(() => tabs.tabList.map(t => (t.node ? tree.nameOf(t.node) : t.key)))
const strip = ref<HTMLElement>(), listBtn = ref<HTMLElement>(), listEl = ref<HTMLElement>()
const overflow = ref(false), listOpen = ref(false)

function updateOverflow() { const el = strip.value; overflow.value = !!el && el.scrollWidth > el.clientWidth + 2 }
function scrollBy(dir: number) { strip.value?.scrollBy({ left: dir * strip.value.clientWidth * 0.7, behavior: 'smooth' }) }
async function revealActive() {
  await nextTick()
  updateOverflow()
  const el = strip.value?.querySelectorAll('[role="tab"]')[tabs.activeInd] as HTMLElement | undefined
  el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
watch(() => [tabs.activeInd, tabs.tabList.length], revealActive)
watch(listOpen, async o => { if (o) { await nextTick(); listEl.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }) } })
onMounted(() => { revealActive(); window.addEventListener('resize', updateOverflow) })
onBeforeUnmount(() => window.removeEventListener('resize', updateOverflow))
</script>
