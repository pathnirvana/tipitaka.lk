<template>
  <div class="mx-auto max-w-3xl p-6 text-center" lang="en" data-testid="not-found">
    <h1 class="mb-2 text-xl">{{ t('Page not found') }}</h1>
    <p class="mb-4 text-muted">{{ t('This page does not exist.') }}</p>
    <RouterLink to="/" class="btn-primary">{{ t('Home') }}</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { t } from '@o/i18n'
useHead({ title: () => t('Page not found') })
</script>
