import { ref } from 'vue'
import { DEFAULT_BJT_PARAMS } from '@shared/scanned-pages'
import { isNativeApp } from '@/data/source'

/** where scanned BJT pages are loaded from: pitaka.lk, or local scans of the desktop app's server (-bjt-path) */
export const bjtParams = ref(DEFAULT_BJT_PARAMS)
let started = false
export function initBjtParams() {
  if (started) return
  started = true
  if (isNativeApp()) return // the apps: pitaka.lk
  fetch(import.meta.env.BASE_URL + 'tipitaka-query/bjt-params').then(r => (r.ok ? r.text() : '')).then(p => { if (p) bjtParams.value = p }).catch(() => {})
}
