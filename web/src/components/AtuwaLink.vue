<!-- jump between a mula sutta and its atuwa (commentary) - v2 AtuwaLinkIcon.vue -->
<template>
  <template v-if="mirrorKey">
    <button v-if="listItem" class="menu-item" @click="open"><IconRedo class="mr-3" />{{ toAtuwa ? 'අටුවාව වෙත' : 'ත්‍රිපිටක මූල වෙත' }}</button>
    <button v-else class="icon-btn mr-1 align-middle text-[0.8em]" :title="toAtuwa ? 'අටුවාව වෙත' : 'ත්‍රිපිටක මූල වෙත'" data-testid="atuwa-link" @click.stop="open">
      <IconAtta v-if="toAtuwa" /><IconTitle v-else />
    </button>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import IconRedo from '~icons/mdi/redo'
import IconAtta from '~icons/mdi/white-balance-auto'
import IconTitle from '~icons/mdi/format-title'
import { useTabs } from '@/stores/tabs'

const props = defineProps<{ mirrorKey: string; language: 'pali' | 'sinh'; listItem?: boolean }>()
const emit = defineEmits<{ done: [] }>()
const toAtuwa = computed(() => props.mirrorKey.startsWith('atta-'))
function open() { useTabs().openTab({ key: props.mirrorKey, language: props.language }); emit('done') }
</script>
