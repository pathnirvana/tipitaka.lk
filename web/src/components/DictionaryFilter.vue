<template>
  <button :class="['btn my-2', { 'border-primary text-primary': limited }]" data-testid="dict-filter" @click="open = true">
    <IconBook class="mr-2" />{{ limited ? 'සොයන ශබ්දකෝෂ සීමා වී ඇත' : 'සොයන ශබ්දකෝෂ සීමා කිරීම' }}
  </button>
  <Dialog :open="open" title="ශබ්දකෝෂ තෝරන්න" width="360px" @close="open = false">
    <p class="mb-2 text-sm text-muted">ඔබගේ සෙවුම පහත ශබ්දකෝෂ වලට පමණක් සීමා වනු ඇත.</p>
    <div v-for="g in groups" :key="g.label" class="mb-2">
      <div class="font-bold">{{ g.label }}</div>
      <label v-for="name in g.names" :key="name" class="block pl-4 text-sm">
        <input type="checkbox" :checked="search.selectedDictionaries.includes(name)" :data-testid="`dict-${dictionaryInfo[name][1]}`" @change="toggle(name)"> {{ name }}
      </label>
    </div>
    <div class="flex justify-end"><button class="btn" @click="open = false">වසන්න</button></div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import IconBook from '~icons/mdi/book-open-page-variant'
import Dialog from './Dialog.vue'
import { dictionaryInfo } from '@shared/constants'
import { useSearch } from '@/stores/search'

const search = useSearch()
const open = ref(false)
const all = Object.keys(dictionaryInfo)
const groups = [{ label: 'සිංහල', names: all.filter(n => dictionaryInfo[n][0] === 'si') }, { label: 'English', names: all.filter(n => dictionaryInfo[n][0] === 'en') }]
const limited = computed(() => search.selectedDictionaries.length < all.length)
function toggle(name: string) {
  const s = search.selectedDictionaries
  search.selectedDictionaries = s.includes(name) ? s.filter(x => x !== name) : all.filter(n => n === name || s.includes(n))
}
</script>
