/**
 * server for handling fts and other db queries
 * keep the logic here to a minimum since any logic here may need to be implemented in Java for android
 * also serve static files for offline apps
 * 
 * tipitaka.lk server - prod run as follows (ubuntu)
 * export NODE_SERVER_MODE=production
 * pm2 start server/server.js --name tipitaka-lk-server
 * pm2 save (save after changing any process parameters)
 * 
 * run on offline desktop apps - compile to executable
 * npx pkg -t win-x64,win-x86,macos,linux --out-path dist_desktop server/server.js
 * 
 * get a copy of the required pre built native modules - sqlite3
 * ./node_modules/.bin/node-pre-gyp install --directory=./node_modules/sqlite3 --target_platform=linux win32 or darwin --target_arch=ia32 or x64
 * downloaded to ./node_modules/sqlite3/lib/binding
 * 
 * The above two steps are performed for all 4 targets in dev/create-releases.ps1 script
 */

const path = require('path')
const fs = require('fs')
const colors = require('colors');
const fastify = require('fastify')({
    logger: false,
})

if (process.env.NODE_SERVER_MODE == 'production') { // not needed for desktop apps
    // cors not needed for POST queries with devServer.proxy setting in vue.config.js
    fastify.register(require('fastify-cors'), {
        origin: true, 
        methods: ['GET'], // only needed for the version check
    })
    fastify.use(require('prerender-node')
        .set('prerenderServiceUrl', 'http://localhost:3000/')
        .set('prerenderToken', 'YOUR_TOKEN')
        .blacklisted('^/tipitaka-query'))
}

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

const SqliteDB = require('./sql-query.js');
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

const fastifyStatic = require('fastify-static')
fastify.register(fastifyStatic, {
    root: path.join(dirname, 'dist'),
})

// needed to serve index.html when url is not found (same as nginx try_files)
fastify.setNotFoundHandler(async (request, reply) => {
    let indexHtml = fs.readFileSync(path.join(dirname, 'dist/index.html'), 'utf-8')
    reply.type('text/html').code(200).send(indexHtml)
})

// check availability of local scanned pages and register routes to handle them
const bjtParams = getBjtParams()
if (bjtParams) {
    fastify.register(fastifyStatic, {
        root: bjtParams.split('|')[0], // absolute path to books folder
        prefix: '/bjt-scanned-pages/',
        decorateReply: false, // only the first register can have this
    })
}
fastify.get('/tipitaka-query/bjt-params', async (request, reply) => {
    reply.type('text/plain').code(200)
    return bjtParams ? '/bjt-scanned-pages|jpg' : ''
})

fastify.get('/tipitaka-query/version', async (request, reply) => { // check version
    reply.type('text/plain').code(200)
    return '1.0' // update when a new version is available for downloading
})

// in prod proxy-pass is used - so localhost would be sufficient
const host = 'localhost', port = 8400
const address = `${host}:${port}`
startServer()


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

function getBjtParams() { // only supports bjt_newbooks/jpg
    let pathsToCheck = []
    if (process.platform == 'win32') { // check C:/ and D:/ locations
        pathsToCheck = ['C', 'D', 'E'].map(d => d + ':/Pictures/bjt_newbooks/10/DN1_Page_001.jpg')
    } else if (process.platform == 'linux') {
        pathsToCheck = ['/Pictures/bjt_newbooks/10/DN1_Page_001.jpg']
    }
    for (loc of pathsToCheck) {
        console.log(`Checking for local bjt scanned pages: ${loc}`)
        if (fs.existsSync(loc)) {
            const match = /(\S+?)\/10\/DN1_Page_001\.(\S+)/.exec(loc)
            if (match) return match[1] + '|' + match[2]
        }
    }
    console.log(colors.red(`Could not find scanned pages in local drive.`))
    return ''
}