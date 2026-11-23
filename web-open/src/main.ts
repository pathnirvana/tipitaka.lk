import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import App from './App.vue'
import { makeRouter } from './router'
import { urlScript, pathIn, script, rememberScript } from './script'
import '@/styles/main.css'
import './styles/open.css'

// small DOM polyfills for old browsers (web/src/main.ts)
if (!Element.prototype.getAttributeNames) {
  Element.prototype.getAttributeNames = function (this: Element) { return Array.prototype.map.call(this.attributes, (a: Attr) => a.name) as string[] }
}

async function polyfills() {
  const tasks: Promise<unknown>[] = []
  if (!('IntersectionObserver' in window)) tasks.push(import('intersection-observer'))
  if (!('ResizeObserver' in window)) {
    tasks.push(import('@juggle/resize-observer').then(m => { (window as unknown as { ResizeObserver: unknown }).ResizeObserver = m.ResizeObserver }))
  }
  await Promise.all(tasks)
}

if (!urlScript()) {
  // a url without the script (/, /dn-1-1): the same page in the reader's script
  location.replace(pathIn(script))
} else {
  rememberScript()
  document.documentElement.setAttribute('data-script', script) // the fonts (styles/open.css)
  polyfills().finally(() => {
    const app = createApp(App)
    app.use(createPinia())
    app.use(makeRouter())
    app.use(createHead())
    app.mount('#app')
  })
}
