/**
 * server for handling fts and other db queries
 * keep the logic here to a minimum since any logic here may need to be implemented in Java for android
 * also serve static files for offline apps
 * 
 * prod run as follows (ubuntu)
 * pm2 start server.js --name tipitaka-lk-server
 * pm2 save (save after changing any process parameters)
 */
const path = require('path')
const fastify = require('fastify')({
    logger: true
})
fastify.register(require('fastify-cors'), { 
    origin: true, 
})
const SqliteDB = require('./sql-query.js')
const ftsDb = new SqliteDB(path.join(__dirname, 'fts.db'), false)
const dictDb = new SqliteDB(path.join(__dirname, 'dict-all.db'), false)

fastify.post('/tipitaka-query/fts', async (request, reply) => { // hit fts db
    reply.type('application/json').code(200)
    console.log(request.body)
    const rows = await ftsDb.loadAll(request.body.sql)
    return rows
})

fastify.post('/tipitaka-query/dict', async (request, reply) => { // hit dict db
    reply.type('application/json').code(200)
    console.log(request.body)
    const rows = await dictDb.loadAll(request.body.sql)
    return rows
})

// in dev environment 0.0.0.0 listens to requests from all LAN devices
// in prod proxy-pass is used - so 127.0.0.1 would be sufficient
fastify.listen(5555, '0.0.0.0', (err, address) => {
    if (err) throw err
    fastify.log.info(`server listening on ${address}`)
})