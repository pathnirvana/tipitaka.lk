<template>
  <div class="animate-pulse space-y-3 p-3" data-testid="skeleton" aria-busy="true">
    <div v-for="i in lines" :key="i" class="h-4 rounded bg-surface2" :style="{ width: `${60 + ((i * 37) % 40)}%` }" />
  </div>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ lines?: number }>(), { lines: 6 })
</script>
