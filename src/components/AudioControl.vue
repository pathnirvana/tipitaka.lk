<template>
    <v-sheet>
      <v-card tile>
        <v-progress-linear :value="progessPercentage" class="my-0" height="3"></v-progress-linear>
      </v-card>
      <v-toolbar dense flat>
        
        <div class="text">{{ getActiveLabel.text }}</div>
        
        <v-spacer></v-spacer>
        
        <template v-if="mdAndUp"><!--show only in bigger screens -->
          
        </template>
        
        <v-btn icon @click="navigateToActive"><v-icon>mdi-chevron-double-up</v-icon></v-btn>
        <v-menu offset-y top>
            <template v-slot:activator="{ on, attrs }">
                <v-btn icon v-on="on" v-bind="attrs">
                    <v-icon>mdi-cog</v-icon>
                </v-btn>
            </template>
            <v-list dense>
                <v-list-item>
                    <v-list-item-icon><v-icon>mdi-play-speed</v-icon></v-list-item-icon>
                    <v-list-item-content>
                        <v-slider v-model="rate" :step="0.05" :min="0.75" :max="2" 
                            persistent-hint :hint="`සජ්ඣායනා වේගය ${rate}x`" style="width: 150px">
                        </v-slider>
                    </v-list-item-content>
                </v-list-item>
                <v-divider></v-divider>
                <v-list-item>
                    <v-list-item-icon><v-icon>mdi-arrow-expand-vertical</v-icon></v-list-item-icon>
                    <v-list-item-content>
                        <v-slider v-model="silence" :step="0.2" :min="0" :max="1" 
                            persistent-hint :hint="'පරිච්ඡේද අතර නිහැඬියාව තත්පර ' + silence" style="width: 150px">
                        </v-slider>
                    </v-list-item-content>
                </v-list-item>
                <v-divider></v-divider>
                <v-list-item disabled>
                    <v-list-item-icon><v-icon>mdi-download</v-icon></v-list-item-icon>
                    <v-list-item-title>බාගත කරගන්න</v-list-item-title>
                </v-list-item>
            </v-list>
        </v-menu>

        
        <v-btn icon @click="$store.dispatch('audio/moveParagraph', -1)"><v-icon>mdi-rewind</v-icon></v-btn>
        <v-btn icon @click="$store.commit('audio/togglePlay')">
            <v-icon v-if="isPlaying" color="primary">mdi-pause</v-icon>
            <v-icon v-else>mdi-play</v-icon>
        </v-btn>
        <v-btn icon @click="$store.dispatch('audio/moveParagraph', 1)"><v-icon>mdi-fast-forward</v-icon></v-btn>
        <v-btn icon @click="showAudio = false, $store.commit('audio/pauseAudio')" color="error">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>
    </v-sheet>
</template>

<style scoped>
.text { text-overflow: ellipsis; overflow: hidden;}
</style>

<script lang="js">
import { mapState, mapGetters } from 'vuex'
import Vue from 'vue'

export default {
    name: 'AudioControl',
    props: {
        entry: Object, // entry or fts result with fieldsNeeded props
        isListItem: Boolean,
    },

    computed: {
        ...mapState('audio', ['audioControls', 'playbackRate', 'isPlaying', 'currentTime', 'duration', 'silenceGap']),
        ...mapGetters('audio', ['getActiveEntry', 'getActiveLabel']),

        progessPercentage() { return this.duration ? this.currentTime / this.duration * 100 : 0 },
        showAudio: {
            get() { return this.audioControls },
            set(val) { this.$store.commit('audio/setAudioControls', val) },
        },
        mdAndUp() { return this.$vuetify.breakpoint.mdAndUp },
        smAndUp() { return this.$vuetify.breakpoint.smAndUp },
        rate: {
            get() { return this.playbackRate },
            set(rate) { this.$store.commit('audio/setPlaybackRate', rate) },
        },
        silence: {
            get() { return this.silenceGap },
            set(silence) { this.$store.commit('audio/setSilenceGap', silence) },
        },
        entryText() { // check textParts function in TextTab.vue for formatting that needs to be removed
            let text = this.getActiveEntry.text.replace(/[↴\n]/g, ' ') // new lines
            text = text.replace(/\{.+?\}/g, '') // footnotes
            text = text.replace(/\d+[\.,]?/g, '') // numbers followed by punctuation
            return text.replace(/[#\*\$_~]/g, '') // formatting marks
        },
    },

    methods: {
        navigateToActive() { // active tab replaced by active entry
            const oldParams = this.$store.getters['tabs/getActiveTab'], // get language
                { key, eInd } = this.getActiveEntry
            this.$store.dispatch('tabs/replaceAndSetActive', {...oldParams, key, eInd })
            Vue.nextTick(() => this.$vuetify.goTo(0, {duration: 500})) // settimeout also works
        }
    },
}
</script>
