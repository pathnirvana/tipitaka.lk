import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import App from './App.vue'
import { makeRouter } from './router'
import '@/styles/main.css'
import './styles/pitaka.css'

// small DOM polyfills for old WebViews (web/src/main.ts)
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

polyfills().finally(() => {
  const app = createApp(App)
  app.use(createPinia())
  app.use(makeRouter())
  app.use(createHead())
  app.mount('#app')
})
