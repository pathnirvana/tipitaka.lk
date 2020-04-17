import Vue from 'vue';
import Vuetify from 'vuetify/lib';
import { Touch } from 'vuetify/lib/directives';

Vue.use(Vuetify, {
    directives: {
      Touch
    }
});

export default new Vuetify({
    theme: {
        themes: {
            light: {
                primary: '#E65100',
                accent: '#FF9100',
            },
        },
        dark: false,
    },
});
