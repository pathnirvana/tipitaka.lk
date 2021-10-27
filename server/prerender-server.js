/**
 * This server is used to render pages for web crawlers and cache them locally
 * by default runs on port 3000
 * 
 * make a request to the server such as 
 * curl http://localhost:3000/render?url=https://tipitaka.lk/mn/sinh
 * 
 * 
 * prod run as follows (ubuntu)
 * make sure to npm install the prerender module first
 * pm2 start server/prerender-server.js
 * pm2 save (save after changing any process parameters)
 */

const prerender = require('prerender')
const server = prerender({
    // this will work only in ubuntu - comment out if running in windows
    chromeLocation: '/usr/bin/google-chrome-stable',
    chromeFlags: ['--headless', '--disable-gpu', '--remote-debugging-port=9222', '--hide-scrollbars'],
    pageLoadTimeout: 15 * 1000,
})
server.start()