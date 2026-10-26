<!-- modal dialog: a header with the title and a close button, the body scrolls, the #footer slot stays at the bottom -->
<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="$emit('close')">
      <div class="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-xl border border-line bg-surface text-fg shadow-2xl" :style="{ maxWidth: width || '400px' }" role="dialog" aria-modal="true"
        :aria-label="title">
        <div v-if="title" class="flex shrink-0 items-center py-2 pl-4 pr-2">
          <h2 class="flex-1 text-lg text-primary">{{ title }}</h2>
          <button class="icon-btn text-muted" title="close" data-testid="dialog-close" @click="$emit('close')"><IconClose /></button>
        </div>
        <div :class="['min-h-0 flex-1 overflow-auto overscroll-contain px-4 pb-4', title ? '' : 'pt-4']">
          <slot />
        </div>
        <div v-if="$slots.footer" class="flex shrink-0 items-center border-t border-line bg-surface2 px-4 py-2.5">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import IconClose from '~icons/mdi/close'

const props = defineProps<{ open: boolean; title?: string; width?: string }>()
const emit = defineEmits<{ close: [] }>()
useEventListener(document, 'keydown', (e: KeyboardEvent) => { if (e.key === 'Escape' && props.open && props.title) emit('close') })
</script>
