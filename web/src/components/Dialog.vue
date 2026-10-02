<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="$emit('close')">
      <div class="max-h-[90vh] w-full overflow-auto rounded bg-surface p-4 text-fg shadow-xl" :style="{ maxWidth: width || '400px' }" role="dialog" aria-modal="true">
        <h2 v-if="title" class="mb-3 text-lg">{{ title }}</h2>
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{ open: boolean; title?: string; width?: string }>()
defineEmits<{ close: [] }>()
</script>
