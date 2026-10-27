/** tipitaka.lk's Tailwind setup (web/tailwind.config.cjs) over this app and the web/src components it uses */
const lk = require('../web/tailwind.config.cjs')
module.exports = { ...lk, content: [__dirname + '/index.html', __dirname + '/src/**/*.{vue,ts}', __dirname + '/../web/src/**/*.{vue,ts}'] }
