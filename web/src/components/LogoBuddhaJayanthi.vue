<!-- the 2500 Buddha Jayanthi logo of the Lanka Bauddha Mandalaya (the printed Tipitaka series), redrawn: the wheel in a
     cogged rim, the lettering around it in Abhaya Uni with touching (bandi) letters. One colour (currentColor), so it
     takes the theme's colours. The lettering is placed letter by letter (a consonant with its vowel signs): on a
     textPath browsers rotate each glyph on its own, which pulls Sinhala letters apart. -->
<template>
  <svg viewBox="0 0 500 500" role="img" aria-label="2500 බුද්ධ ජයන්ති - ලංකා බෞද්ධ මණ්ඩලය" class="block">
    <path :d="rim" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" />
    <g fill="currentColor">
      <path v-for="(d, i) in spokes" :key="i" :d="d" />
    </g>
    <circle :cx="C" :cy="C" r="24" fill="none" stroke="currentColor" stroke-width="5.5" />
    <!-- the middles of the letters on one circle: both lines the same distance from the wheel -->
    <g fill="currentColor" :font-size="SIZE" font-family="sinhala, serif" text-anchor="middle">
      <text v-for="(l, i) in letters" :key="i" :x="C" :y="l.y" :transform="`rotate(${l.deg} ${C} ${C})`">{{ l.text }}</text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { beautifyText } from '@shared/beautify'

const C = 250, R = 150, BUMPS = 22, BUMP = 10, SPOKES = 24, SIZE = 50, GAP = 1
/** the circle of the middles of the letters' bodies (ක: without vowel signs above or below) */
const TEXT_R = 193
const BANDI = { bandiLetters: true, specialLetters: false }
/** the top line reads clockwise over the wheel, the bottom one under it with the letters' tops towards the wheel */
const LINES = [beautifyText('2500 බුද්ධ ජයන්ති', 'pali', BANDI), beautifyText('ලංකා බෞද්ධ මණ්ඩලය', 'pali', BANDI)]

const pt = (r: number, a: number) => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`
/** the rim: a circle with round cogs outside it */
const rim = (() => {
  const step = (2 * Math.PI) / BUMPS, half = Math.asin(BUMP / R)
  let d = `M ${pt(R, -half)}`
  for (let i = 0; i < BUMPS; i++) {
    const a = i * step
    d += ` A ${BUMP} ${BUMP} 0 1 1 ${pt(R, a + half)}` // the cog, out and back
    d += ` A ${R} ${R} 0 0 1 ${pt(R, a + step - half)}` // the rim to the next cog
  }
  return d + ' Z'
})()
/** the spokes: wedges, narrow at the hub, wide at the rim */
const spokes = Array.from({ length: SPOKES }, (_, i) => {
  const a = (i * 2 * Math.PI) / SPOKES - Math.PI / 2, inner = 0.075, outer = 0.1
  return `M ${pt(50, a - inner)} L ${pt(128, a - outer)} L ${pt(128, a + outer)} L ${pt(50, a + inner)} Z`
})

/** a letter: a base (consonant, vowel, digit, space) with the signs after it (vowel signs, al-lakuna, anusvara);
 * touching letters (consonant ZWJ al-lakuna consonant) stay together */
const MARK = '[\\u0D81-\\u0D83\\u0DCA-\\u0DDF\\u200D]', BASE = '[^\\u0D81-\\u0D83\\u0DCA-\\u0DDF\\u200D]'
const LETTER = new RegExp(`(?:${BASE}\\u200D\\u0DCA)*${BASE}${MARK}*`, 'g')
const split = (s: string) => s.match(LETTER) || []
/** letter widths at SIZE in the font, and the middle of a letter's body above the baseline (measured once the font has
 * loaded; until then estimates) */
const width = ref<(t: string) => number>(t => (t === ' ' ? SIZE * 0.3 : SIZE * 0.55))
const bodyMid = ref(SIZE * 0.25)
onMounted(async () => {
  try {
    await document.fonts?.ready
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return
    ctx.font = `${SIZE}px sinhala, serif`
    width.value = t => ctx.measureText(t).width
    const k = ctx.measureText('ක')
    if (k.actualBoundingBoxAscent) bodyMid.value = (k.actualBoundingBoxAscent - k.actualBoundingBoxDescent) / 2
  } catch { /* the estimate */ }
})
const letters = computed(() => LINES.flatMap((line, li) => {
  const ls = split(line), ws = ls.map(t => width.value(t) + GAP)
  const total = ws.reduce((a, b) => a + b, 0)
  let s = -total / 2
  return ls.map((text, i) => {
    const mid = s + ws[i] / 2
    s += ws[i]
    const deg = ((mid / TEXT_R) * 180) / Math.PI
    // both lines upright: the baseline is bodyMid below the circle at the top, bodyMid below it at the bottom
    return li === 0 ? { text, y: C - TEXT_R + bodyMid.value, deg } : { text, y: C + TEXT_R + bodyMid.value, deg: -deg }
  }).filter(l => l.text !== ' ')
}))
</script>
