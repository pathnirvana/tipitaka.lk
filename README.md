# Tipitaka.lk - Buddha Jayanthi Tripitaka and Atuwa

This webapp is built with Vue and Vuetify. It is designed to run in either

* Website/SPA on https://tipitaka.lk
* Offline Android app
* Offline Desktop app (Windows/Mac/Linux)
   
## Run Production Website
* `npm run build` and deply to webserver
* use PM2 to run `server/server.js` on the webserver
* use nginx `proxy_pass` directive to pass requests from tipitaka.lk to `localhost:8400`

### Compiles and hot-reloads for development
```
node server/server.js
npm run serve
```

## For Android App
* Uncomment the public path in `vue.config.js` and build
* Place the built files in asset directory in an Android webview app

## For Desktop App
* Follow the instructions on `server/server.js` to build a binary using `pkg`.
* Make a zip file containing the above binary, `node_sqlite3.node`, `dist` and `server` folders

Please check the LICENSE file if you wish to extract any content from the website for redistribution.