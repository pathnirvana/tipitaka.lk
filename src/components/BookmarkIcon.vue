<template>
    <v-list-item v-if="isListItem" @click="toggleStarred">
        <v-list-item-icon>
            <v-icon v-if="isStarred" color="star">mdi-star</v-icon>
            <v-icon v-else>mdi-star-outline</v-icon>
        </v-list-item-icon>
        <v-list-item-title>{{ isStarred ? 'තරුව ඉවත්කරන්න' : 'තරුවක් යොදන්න' }} </v-list-item-title>
    </v-list-item>

    <v-btn v-else icon x-small @click="toggleStarred">
        <v-icon v-if="isStarred" color="star">mdi-star</v-icon>
        <v-icon v-else small>mdi-star-outline</v-icon>
    </v-btn>
</template>

<script lang="js">
import { mapState } from 'vuex'
import { entryToKeyStr } from '@/constants.js'
// either text or hText must be present for non-heading type
const fieldsNeeded = ['key', 'language', 'eInd', 'type', 'text', 'hText'] 

export default {
    name: 'BookmarkIcon',
    props: {
        entry: Object, // entry or fts result with fieldsNeeded props
        isListItem: Boolean,
    },

    computed: {
        ...mapState('search', ['bookmarks']),
        isStarred() {
            return !!this.bookmarks[this.bookmarkKey]
        },
        starredColor() {
            return '' // TODO depend on dark mode
        },
        bookmarkKey() {
            return entryToKeyStr(this.bookmarkObject)
        },
        bookmarkObject() {
            const obj = {}
            fieldsNeeded.forEach(f => obj[f] = this.entry[f] || null)
            return obj
        },
    },

    methods: {
        toggleStarred() {
            this.$store.commit('search/toggleBookmark', { key: this.bookmarkKey, obj: this.bookmarkObject })
        },
    },
}
</script>