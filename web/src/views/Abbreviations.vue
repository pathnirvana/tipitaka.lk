<template>
  <div class="p-3">
    <div class="banner mb-3 border-info">සියලුම පොත් වල අඩංගු කෙටි යෙදුම් වල එකතුවක් පහත දක්වා ඇත.</div>
    <table v-if="abbr.loaded" class="w-full text-left" data-testid="abbreviations">
      <thead><tr class="border-b border-line"><th class="p-2 font-normal">කෙටි යෙදුම</th><th class="p-2 font-normal">අර්ථ විස්තරය</th><th class="p-2 font-normal">යෙදුනු වාර ගණන</th></tr></thead>
      <tbody>
        <tr v-for="([desc, count], key) in abbr.map" :key="key" class="border-b border-line">
          <td class="p-2 text-info">{{ key }}</td><td class="p-2">{{ desc }}</td><td class="p-2">{{ count }}</td>
        </tr>
      </tbody>
    </table>
    <Skeleton v-else />
  </div>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue'
import Skeleton from '@/components/Skeleton.vue'
import { useAbbreviations } from '@/stores/abbreviations'
useHead({ title: 'කෙටි යෙදුම් - Abbreviations' })
const abbr = useAbbreviations()
abbr.init()
</script>
