/**
 * This server is used to render pages for web crawlers and cache them locally
 * by default runs on port 3000
 * 
 * make a request to the server such as 
 * curl http://localhost:3000/render?url=https://tipitaka.lk/mn/sinh
 * 
 * middleware prerender-node has to be setup on the fastify server to get the rendered page from prerender
 * when the request is from a webserver
 * 
 * prod run as follows (ubuntu)
 * pm2 start prerender-server.js
 * pm2 save (save after changing any process parameters)
 */

const prerender = require('prerender')
const server = prerender({
    // this will work only in ubuntu - comment out if running in windows
    chromeLocation: '/usr/bin/chromium-browser',
})
server.start()