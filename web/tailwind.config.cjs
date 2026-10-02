/** Tailwind 3.4 (v4 needs Safari 16.4+/Chrome 111+ which old WebViews lack). Colours are CSS variables (src/styles/main.css). */
const v = (name) => `var(--c-${name})`
module.exports = {
  content: [__dirname + '/index.html', __dirname + '/src/**/*.{vue,ts}'],
  darkMode: 'class',
  theme: {
    // same breakpoints as Vuetify 2 (the v2 app logic depends on smAndUp/mdAndUp)
    screens: { sm: '600px', md: '960px', lg: '1264px', xl: '1904px' },
    extend: {
      colors: {
        primary: v('primary'), accent: v('accent'), info: v('info'), success: v('success'), error: v('error'),
        warning: v('warning'), highlight: v('highlight'), star: v('star'), bg: v('bg'), surface: v('surface'),
        surface2: v('surface2'), fg: v('fg'), muted: v('muted'), line: v('line'),
      },
      fontFamily: { sinhala: ['sinhala', 'serif'], heading: ['heading2', 'sinhala', 'serif'] },
    },
  },
  // opacity utilities emit rgb(r g b / a) and css variables that old WebViews do not support
  corePlugins: { backgroundOpacity: false, textOpacity: false, borderOpacity: false, divideOpacity: false, placeholderOpacity: false, ringOpacity: false },
}
