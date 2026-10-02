<template>
  <button class="icon-btn align-middle text-[0.8em] text-info" title="link එකක් ලබාගන්න" data-testid="share" @click.stop="copy">
    <IconShare />
  </button>
</template>

<script setup lang="ts">
import IconShare from '~icons/mdi/share-variant'
import { fullLink } from '@shared/routes'
import { copyText } from '@/composables/clipboard'
import { useUi } from '@/stores/ui'

const props = defineProps<{ link: string }>()
const ui = useUi()
async function copy() { if (await copyText(fullLink(props.link))) ui.notifyType('link-copied') }
</script>
