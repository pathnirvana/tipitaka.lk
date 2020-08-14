// use version in the UI of the webapp
process.env.VUE_APP_VERSION = require('./package.json').version

module.exports = {
  css: {
    //extract: false,
  },
  parallel: 4,
  devServer: {
    port: 8081, // with hot reloading
    proxy: 'http://localhost:8400', // server js for tipitaka-queries
  },
  "transpileDependencies": [
    "vuetify"
  ],
  configureWebpack: {
    devtool: 'source-map'
  },
  //publicPath: '', // uncomment for android app
}