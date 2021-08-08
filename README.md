# Tipitaka.lk - Buddha Jayanthi Tripitaka and Atuwa

This webapp is built with Vue and Vuetify. It is designed to run in either

* Website/SPA on https://tipitaka.lk
* Offline Android app
* Offline Desktop app (Windows/Mac/Linux)
   
## Run Production Website
* `npm run build` and deploy `dist` directory to webserver
* export NODE_SERVER_MODE=production and run PM2 as below
* use PM2 to run `server/server.js` as `tipitaka-lk-server` on the webserver
* use nginx `proxy_pass` directive to pass requests from tipitaka.lk to `localhost:8400`

### Compiles and hot-reloads for development
```
node server/server.js
npm run serve
```

### Update Prod Website when text changes
* copy the changed text files in the `dist` dir to prod server
* run `fts-populate.js` and copy the `fts.db` to server
* PM2 restart the `tipitaka-lk-server` to use the new db file

## For Android App
* Uncomment the public path in `vue.config.js` and build
* Place the built files in asset directory in an Android webview app

## For Desktop App
* Follow the instructions on `server/server.js` to build a binary using `pkg`.
* Make a zip file containing the above binary, `node_sqlite3.node`, `dist` and `server` folders

**Please check the LICENSE file if you wish to extract any content from the website for redistribution.**