<!-- pali / both / sinhala column toggle (v2 TabColumnSelector.vue) -->
<template>
  <div class="inline-flex overflow-hidden rounded-full border border-line text-sm" role="group">
    <button v-for="o in options" :key="o.value" :class="['px-3 py-1.5', modelValue === o.value ? 'bg-primary text-white' : 'hover:bg-surface2']"
      :aria-pressed="modelValue === o.value" :data-testid="`columns-${o.value}`" @click="$emit('update:modelValue', o.value)">
      <IconColumns v-if="o.value === 2" class="inline" title="පාළි සිංහල දෙකම" /><span v-else>{{ o.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import IconColumns from '~icons/mdi/view-column'

defineProps<{ modelValue: number }>()
defineEmits<{ 'update:modelValue': [v: 0 | 1 | 2] }>()
// "both" is always offered - on small screens it is only used when chosen explicitly (see tabs.tabColumns)
const options = [{ value: 0 as const, label: 'පාළි' }, { value: 2 as const, label: '' }, { value: 1 as const, label: 'සිංහල' }]
</script>
