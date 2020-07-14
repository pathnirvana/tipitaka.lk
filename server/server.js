/**
 * server for handling fts and other db queries
 * keep the logic here to a minimum since any logic here may need to be implemented in Java for android
 * also serve static files for offline apps
 * 
 * tipitaka.lk server - prod run as follows (ubuntu)
 * pm2 start server.js --name tipitaka-lk-server
 * pm2 save (save after changing any process parameters)
 * 
 * run on offline desktop apps - compile to executable
 * rm tipitaka-lk.exe; npx pkg -t win --output tipitaka-lk.exe server/server.js
 * npx pkg -t macos --output tipitaka-lk-mac server/server.js
 * npx pkg -t linux --output tipitaka-lk-linux server/server.js
 * 
 * get a copy of the required pre built native modules - sqlite3
 * ./node_modules/.bin/node-pre-gyp install --directory=./node_modules/sqlite3 --target_platform=linux win32 or darwin
 * downloaded to ./node_modules/sqlite3/lib/binding
 */

const path = require('path')
const fs = require('fs')
const colors = require('colors');
const fastify = require('fastify')({
    logger: false
})
// cors not needed with devServer.proxy setting in vue.config.js
// fastify.register(require('fastify-cors'), {
//     origin: true, 
// })
// TODO prerender is not needed for the desktop app
fastify.use(require('prerender-node')
    .set('prerenderServiceUrl', 'http://localhost:3000/')
    .set('prerenderToken', 'YOUR_TOKEN')
    .blacklisted('^/tipitaka-query'))

// we need to find the dist and server directories
const checkDirList = [process.cwd(), path.dirname(process.execPath), path.dirname(process.argv[1]), __dirname]
function checkDir(dir, ind) {
    console.log(`Testing directory ${ind}:${dir}`);
    if (fs.existsSync(path.join(dir, 'dist/index.html'))) {
        console.log(`Found dist/index.html in ${ind}:${dir}`);
        return true;
    }
    return false;
}
const dirname = checkDirList.find(checkDir);
console.log(colors.yellow(`Serving static files from ${dirname}`));

const SqliteDB = require('./sql-query.js')
const ftsDb = new SqliteDB(path.join(dirname, 'server/fts.db'), false)
const dictDb = new SqliteDB(path.join(dirname, 'server/dict.db'), false)

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

// const isElectron = process.argv[2] == 'electron' // pass this in from the background.js in electron
// if (isElectron) {
//     console.log(`server running in electron mode only tipitaka-queries are handled`)
// } else {
    fastify.register(require('fastify-static'), {
        root: path.join(dirname, 'dist'),
    })

    // needed to serve index.html when url is not found (same as nginx try_files)
    fastify.setNotFoundHandler(async (request, reply) => {
        let indexHtml = fs.readFileSync(path.join(dirname, 'dist/index.html'), 'utf-8')
        reply.type('text/html').code(200).send(indexHtml)
    })
// }

// in prod proxy-pass is used - so localhost would be sufficient
const host = 'localhost', port = 8400
const address = `${host}:${port}`

async function startServer() {
    try {
        await fastify.listen(port, host)
        console.log(`server listening on ${address}`)
    } catch(err) {
        console.log('Error starting server:', err)
    }

    // opens the browser with the local url
    console.log(`Running on OS Platform ${process.platform}`);
    console.log(colors.green(`Open the following address in your browser (Chrome/Firefox/Edge etc)`))
    console.log(colors.green(`========================\n http://${address}/ \n========================`))
    if (process.platform == 'win32' || process.platform == 'darwin') { // in linux this results in an error
        const open = require('open')
        await open(`http://${address}/`)  // uncomment when building offline apps
    }
}

startServer()