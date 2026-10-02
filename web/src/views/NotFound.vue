<template>
  <div class="mx-auto max-w-xl p-6 text-center" data-testid="not-found">
    <h1 class="mb-2 text-xl">පිටුව හමු නොවීය</h1>
    <p class="mb-4 text-muted">The page you are looking for does not exist.</p>
    <RouterLink to="/" class="btn-primary">මුල් පිටුවට</RouterLink>
  </div>
</template>
<script setup lang="ts">
import { useHead } from '@unhead/vue'
useHead({ title: 'Not found' })
</script>
