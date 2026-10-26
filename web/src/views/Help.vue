<!-- /help: the user guide (web/src/help/si.md, compiled at build time by web/help.ts; tipitaka.app's Help.vue) -->
<template>
  <div class="mx-auto max-w-3xl px-4 pb-20 pt-5 leading-relaxed" :style="{ fontSize: settings.fontPx }" data-testid="help">
    <h1 class="mb-3 text-[1.4em] text-primary">භාවිතා කරන ආකාරය</h1>
    <nav class="mb-6 flex flex-wrap" aria-label="පටුන" data-testid="help-toc">
      <a v-for="s in page.toc" :key="s.id" :href="`#${s.id}`" class="mb-1.5 mr-1.5 rounded-full border border-line bg-surface px-3 py-0.5 text-[0.85em] hover:border-primary hover:text-primary"
        @click.prevent="goTo(s.id)">{{ s.title }}</a>
    </nav>
    <!-- eslint-disable-next-line vue/no-v-html -- our own Markdown, compiled at build time -->
    <article ref="article" class="help" v-html="page.html" @click="onClick" />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import page from '@/help/si.md'
import { useSettings } from '@/stores/settings'
import { APP_BAR } from '@/composables/layout'

useHead({ title: 'භාවිතා කරන ආකාරය / Help' })
const route = useRoute(), router = useRouter(), settings = useSettings()
const article = ref<HTMLElement | null>(null)

function goTo(id: string, smooth = true) {
  const el = article.value?.querySelector(`[id="${id}"]`)
  if (!el) return
  // below the app bar (no scroll-margin: Chrome 53)
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - APP_BAR - 12, behavior: smooth ? 'smooth' : 'auto' })
  if (route.hash !== `#${id}`) router.replace({ hash: `#${id}` })
}
// the section of the url (/help#search): the layout still moves for a moment after loading (the fonts, the server
// rendered page going away), so the section is placed again a few times - unless the reader scrolls first
onMounted(async () => {
  await nextTick()
  const id = route.hash.slice(1)
  if (!id) return
  let moved = false
  const stop = () => { moved = true }
  for (const e of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.addEventListener(e, stop, { once: true, passive: true })
  try { await document.fonts?.ready } catch { /* no font loading api */ }
  for (const ms of [0, 150, 400, 800]) {
    await new Promise(r => setTimeout(r, ms))
    if (moved || route.hash.slice(1) !== id) break
    goTo(id, false)
  }
})
watch(() => route.hash, h => { if (h) goTo(h.slice(1)) })

/** links of the guide: /<page> is a page of the app, #<id> a section */
function onClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest('a')
  const href = a?.getAttribute('href')
  if (!href || /^[a-z]+:/i.test(href)) return
  e.preventDefault()
  if (href.startsWith('#')) goTo(href.slice(1))
  else router.push(href)
}
</script>

<style>
.help h2 { margin: 2.25rem 0 0.75rem; font-size: 1.25em; color: var(--c-primary); }
.help h2:first-child { margin-top: 0; }
.help h3 { margin: 1.5rem 0 0.5rem; font-size: 1.05em; }
.help p, .help ul, .help ol, .help table { margin: 0.5rem 0; }
.help ul { list-style: disc; padding-left: 1.25rem; }
.help ol { list-style: decimal; padding-left: 1.25rem; }
.help li { margin: 0.3rem 0; }
.help a { color: var(--c-info); text-decoration: underline; }
.help strong { font-weight: 700; }
.help table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
.help th, .help td { border: 1px solid var(--c-line); padding: 0.375rem 0.5rem; text-align: left; vertical-align: top; }
.help th { background: var(--c-surface2); }
/* the icons of the buttons, as small keys */
.help .help-icon { display: inline-block; box-sizing: content-box; width: 1em; height: 1em; padding: 0.125em; margin: 0 0.1em; vertical-align: -0.3em;
  border: 1px solid var(--c-line); border-radius: 0.375em; background: var(--c-surface); color: var(--c-info); }
</style>
