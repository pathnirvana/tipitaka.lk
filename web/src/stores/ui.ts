import { defineStore } from 'pinia'
import { ref } from 'vue'
import { mdAndUp } from '@/composables/breakpoints'

export const snackbarMessages = {
  'link-copied': 'සබැඳිය පිටපත් විය. ඔබට අවශ්‍ය තැනක අලවන්න.',
  'content-copied': 'ඡේදයේ අන්තර්ගතය පිටපත් විය. අවශ්‍ය තැනක අලවන්න.',
} as const

export const useUi = defineStore('ui', () => {
  const snackbar = ref({ show: false, message: '', timeout: 2000 })
  let timer: ReturnType<typeof setTimeout> | undefined
  function notify(message: string, timeout = 2000) {
    snackbar.value = { show: true, message, timeout }
    clearTimeout(timer)
    timer = setTimeout(() => { snackbar.value.show = false }, timeout)
  }
  const notifyType = (type: keyof typeof snackbarMessages) => notify(snackbarMessages[type])
  const showTree = ref(typeof window !== 'undefined' && window.innerWidth >= 1000) // v2 drawer mobile-breakpoint 1000
  const showPanel = ref(false) // right hand side panel
  const nativeBusy = ref(false)
  return { snackbar, notify, notifyType, showTree, showPanel, nativeBusy, mdAndUp }
})
