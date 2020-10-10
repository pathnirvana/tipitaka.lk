<template>
    <v-btn icon x-small color="info" v-clipboard:copy="fullLink"
        v-clipboard:success="() => $store.commit('setSnackbar', { type: 'link-copied' })">
        <v-icon small>mdi-share-variant</v-icon>
    </v-btn>
</template>

<script>
export default {
    name: 'ShareLinkIcon',
    props: ['link'],
    computed: {
        fullLink() {
            return this.link.startsWith('http') ? this.link : 'https://tipitaka.lk' + this.link
        }
    }
}
</script>