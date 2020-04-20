import Vue from 'vue';
import Vuetify from 'vuetify/lib';
import { Touch } from 'vuetify/lib/directives';
import VueClipboard from 'vue-clipboard2';

Vue.use(Vuetify, {
    directives: {
      Touch
    }
});
Vue.use(VueClipboard);

export default new Vuetify({
    theme: {
        themes: {
            light: {
                primary: '#C63100',
                accent: '#EF5100',
            },
        },
        dark: false,
        options: {
            customProperties: true, // generates css variables to use in style blocks
        },
    },
});
