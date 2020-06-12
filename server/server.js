/**
 * server for handling fts and other db queries
 * also serve static files for offline apps
 */
const path = require('path')
const fastify = require('fastify')({
    logger: true
})
fastify.register(require('fastify-cors'), { 
    origin: true, 
})
const SqliteDB = require('./sql-query.js')
const ftsDbFilename = path.join(__dirname, 'fts.db')
const ftsDb = new SqliteDB(ftsDbFilename, true)

const ftsOpts = {
    schema: {
      body: {
        type: 'string',
        sql: 'string'
      }
    }
  }
fastify.post('/tipitaka-query/fts', async (request, reply) => {
    reply.type('application/json').code(200)
    console.log(request.body)
    const rows = await ftsDb.loadAll(request.body.sql)
    return rows
})

fastify.listen(5555, (err, address) => {
    if (err) throw err
    fastify.log.info(`server listening on ${address}`)
})