import Vue from 'vue';
import Vuetify from 'vuetify/lib';

Vue.use(Vuetify);

export default new Vuetify({
    theme: {
        themes: {
            light: {
                primary: '#FF9800',
                accent: '#FF9100',
            },
        },
        dark: false,
    },
});
