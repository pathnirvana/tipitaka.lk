<!-- small popover positioned next to an anchor element (footnotes, menus, tooltips) -->
<template>
  <Teleport to="body">
    <div v-if="open && anchor" ref="box" class="fixed z-50 max-w-[min(90vw,420px)] rounded border border-line bg-surface p-2 text-fg shadow-lg"
      :style="style" role="dialog" @mouseleave="$emit('leave')">
      <slot />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'

const props = defineProps<{ open: boolean; anchor: HTMLElement | null; placement?: 'bottom' | 'top' }>()
const emit = defineEmits<{ close: []; leave: [] }>()
const box = ref<HTMLElement>()
const style = ref<Record<string, string>>({ left: '0px', top: '0px', visibility: 'hidden' })

function position() {
  if (!props.anchor || !box.value) return
  const a = props.anchor.getBoundingClientRect(), b = box.value.getBoundingClientRect()
  const vw = window.innerWidth, vh = window.innerHeight
  let top = props.placement === 'top' ? a.top - b.height - 4 : a.bottom + 4
  if (top + b.height > vh - 4) top = Math.max(4, a.top - b.height - 4)
  if (top < 4) top = Math.min(vh - b.height - 4, a.bottom + 4)
  const left = Math.max(4, Math.min(a.left, vw - b.width - 4))
  style.value = { left: `${left}px`, top: `${top}px`, visibility: 'visible' }
}
function onDocClick(e: Event) {
  const t = e.target as Node
  if (box.value?.contains(t) || props.anchor?.contains(t)) return
  emit('close')
}
const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('close') }
const onScroll = () => position()

// listeners are only attached while open (many components can hold a closed Floating)
function detach() {
  document.removeEventListener('click', onDocClick, true)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
}
watch(() => [props.open, props.anchor], async ([open]) => {
  detach()
  if (open) {
    style.value = { ...style.value, visibility: 'hidden' }
    await nextTick()
    position()
    setTimeout(() => { if (props.open) document.addEventListener('click', onDocClick, true) })
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
  }
}, { immediate: true })
onBeforeUnmount(detach)
</script>
