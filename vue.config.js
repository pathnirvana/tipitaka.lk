module.exports = {
  css: {
    //extract: false,
  },
  parallel: 4,
  devServer: {
    proxy: 'http://localhost:5555',
  },
  "transpileDependencies": [
    "vuetify"
  ],
  configureWebpack: {
    devtool: 'source-map'
  },
  publicPath: '', // uncomment for android app
}