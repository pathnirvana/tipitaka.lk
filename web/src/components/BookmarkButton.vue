<template>
  <button v-if="listItem" class="menu-item" @click="toggle">
    <IconStar v-if="starred" class="mr-3 text-star" /><IconStarOutline v-else class="mr-3" />
    {{ starred ? 'තරුව ඉවත් කරන්න' : 'තරුවක් යොදන්න' }}
  </button>
  <button v-else class="icon-btn align-middle text-[0.8em]" :title="starred ? 'තරුව ඉවත් කරන්න' : 'තරුවක් යොදන්න'" :aria-pressed="starred" data-testid="bookmark" @click.stop="toggle">
    <IconStar v-if="starred" class="text-star" /><IconStarOutline v-else />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import IconStar from '~icons/mdi/star'
import IconStarOutline from '~icons/mdi/star-outline'
import { useBookmarks, type Bookmark } from '@/stores/bookmarks'

const props = defineProps<{ bookmark: Bookmark; listItem?: boolean }>()
const emit = defineEmits<{ done: [] }>()
const store = useBookmarks()
const starred = computed(() => store.isStarred(props.bookmark))
function toggle() { store.toggle(props.bookmark); emit('done') }
</script>
