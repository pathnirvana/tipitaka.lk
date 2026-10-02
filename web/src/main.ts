import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import App from './App.vue'
import { makeRouter } from './router'
import './styles/main.css'

async function polyfills() { // old WebViews (Android 7 / iOS 12)
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
