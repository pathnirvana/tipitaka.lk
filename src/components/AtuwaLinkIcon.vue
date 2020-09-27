<template>
    <span v-if="hasTarget">
        <v-list-item v-if="isListItem" @click="openTarget">
            <v-list-item-icon><v-icon dense>mdi-redo</v-icon></v-list-item-icon>
            <v-list-item-title>{{ isAtuwa ? 'අටුවාව වෙත' : 'ත්‍රිපිටක මූල වෙත' }}</v-list-item-title>
        </v-list-item>

        <v-btn v-else icon x-small @click="openTarget" class="mr-2">
            <v-icon v-if="isAtuwa">mdi-white-balance-auto</v-icon>
            <v-icon v-else small>mdi-format-title</v-icon>
        </v-btn>
    </span>
</template>

<script>
import { mapState, mapGetters } from 'vuex'

export default {
    name: 'AtuwaLinkIcon',
    props: {
        entry: Object, // entry or fts result with fieldsNeeded props
        isListItem: Boolean,
    },

    computed: {
        ...mapGetters('tree', ['getKey']),
        hasTarget() {
            // if (!this.isAtuwa)
            return !!this.getKey(this.targetKey)
            // todo if atuwa need to check starting digits
        },
        isAtuwa() { // is navigate to atta
            return !this.entry.key.startsWith('atta-') 
        },
        targetKey() { // add or remove 'atta-' from key
            return (this.isAtuwa) ? 'atta-' + this.entry.key : this.entry.key.slice(5)
        },
    },

    methods: {
        openTarget() {
            this.$store.dispatch('tabs/openAndSetActive', { key: this.targetKey, language: this.entry.language })
        }
    },
}
</script>