<template>
    <v-btn icon x-small color="info" v-clipboard:copy="'https://tipitaka.lk' + link"
        v-clipboard:success="() => $store.commit('setSnackbar', { type: 'link-copied' })">
        <v-icon small>mdi-share-variant</v-icon>
    </v-btn>
</template>

<script>
export default {
    name: 'ShareLinkIcon',
    props: ['link'],
}
</script>