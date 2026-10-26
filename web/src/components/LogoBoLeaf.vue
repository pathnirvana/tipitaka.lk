<!-- Sri Lanka Tipitaka Project: a bo leaf (heart shaped, with the long drip tip) over the project's name, in the theme's colours -->
<template>
  <svg viewBox="0 0 500 500" role="img" aria-label="Sri Lanka Tipitaka Project" class="block">
    <defs>
      <clipPath id="bo-leaf"><path :d="LEAF" /></clipPath>
    </defs>
    <g transform="translate(115 6) scale(1.35)">
      <path d="M 100 46 C 99 34 101 22 106 8" fill="none" stroke="var(--c-success)" stroke-width="5" stroke-linecap="round" />
      <path :d="LEAF" fill="var(--c-success)" fill-opacity="0.16" />
      <g clip-path="url(#bo-leaf)" fill="none" stroke="var(--c-success)" stroke-linecap="round">
        <path d="M 100 48 C 100 120 100 190 100 262" stroke-width="3.5" />
        <path v-for="(v, i) in VEINS" :key="i" :d="v" stroke-width="2.4" stroke-opacity="0.75" />
      </g>
      <path :d="LEAF" fill="none" stroke="var(--c-success)" stroke-width="5" stroke-linejoin="round" />
    </g>
    <g fill="currentColor" font-family="sinhala, serif" text-anchor="middle" font-weight="700">
      <text x="250" y="420" font-size="40">Sri Lanka</text>
      <text x="250" y="468" font-size="40">Tipitaka Project</text>
    </g>
  </svg>
</template>

<script setup lang="ts">
/** the leaf, its stalk at the top (100, 46), the tip at the bottom (100, 262) */
const LEAF = 'M 100 48 C 120 18 186 22 191 80 C 195 128 156 166 126 196 C 114 208 106 226 100 262 C 94 226 86 208 74 196 C 44 166 5 128 9 80 C 14 22 80 18 100 48 Z'
/** the side veins: from the midrib out and up towards the edge, both sides */
const VEINS = [70, 98, 126, 154, 182, 208].flatMap(y => {
  const reach = 100 - Math.max(0, y - 110) * 0.55
  return [`M 100 ${y} Q ${100 + reach * 0.35} ${y - 6} ${100 + reach} ${y - 52}`, `M 100 ${y} Q ${100 - reach * 0.35} ${y - 6} ${100 - reach} ${y - 52}`]
})
</script>
