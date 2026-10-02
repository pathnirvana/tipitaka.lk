import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'

// Vuetify 2 breakpoints (the v2 behaviour depends on them)
const { width, height } = useWindowSize()
export const viewport = { width, height }
export const smAndUp = computed(() => width.value >= 600)
export const mdAndUp = computed(() => width.value >= 960)
export const smAndDown = computed(() => width.value < 960)
