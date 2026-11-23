<template>
  <div class="mx-auto max-w-3xl p-4" lang="en">
    <h1 class="mb-2 text-xl">{{ SITE_NAME }}</h1>
    <p class="mb-3">
      The Pali Tipitaka of the Buddha Jayanti Tripitaka Series, the edition printed in Sri Lanka in Sinhala script,
      shown here in the script you read: {{ current.name }}<template v-if="current.native !== current.name"> ({{ current.native }})</template>.
      Choose another script in the settings at the top right, and a text from the contents.
    </p>
    <p class="mb-4 text-muted">
      The text is that of <a class="text-primary underline" href="https://tipitaka.lk">tipitaka.lk</a>, where it is read together with its
      Sinhala translation. Proofreading against the printed books is still in progress: please report errors to
      pathnirvana@gmail.com.
    </p>
    <ul class="grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="welcome-roots">
      <li v-for="r in roots" :key="r.key">
        <RouterLink :to="'/' + r.key" class="block rounded-lg border border-line bg-surface px-3 py-2 hover:border-primary hover:bg-surface2">{{ tree.nameOf(r, 'pali') }}</RouterLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useTree } from '@/stores/tree'
import { SCRIPTS } from '@shared/scripts'
import { SITE_NAME } from '@o/site'
import { script } from '@o/script'

const tree = useTree()
const current = SCRIPTS.find(s => s.code === script)!
const roots = computed(() => tree.children.get(0) ?? [])
onMounted(() => tree.loadChildren(0))
</script>
