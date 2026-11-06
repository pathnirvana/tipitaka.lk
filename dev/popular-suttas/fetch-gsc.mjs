/**
 * Search Console queries (and the page each landed on) for the last 16 months, with the service account key in
 * ../api-keys. The exports are not committed (they are large and change daily).
 *
 * usage: node dev/popular-suttas/fetch-gsc.mjs sites
 *        node dev/popular-suttas/fetch-gsc.mjs queries sc-domain:pitaka.lk <out.json>
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
const key = JSON.parse(fs.readFileSync(new URL('../../../api-keys/api-project-cloudocr-searchconsole.json', import.meta.url), 'utf8'))
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
async function token() {
  const now = Math.floor(Date.now() / 1000)
  const head = b64({ alg: 'RS256', typ: 'JWT' })
  const claim = b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: key.token_uri, iat: now, exp: now + 3600 })
  const sig = crypto.sign('RSA-SHA256', Buffer.from(head + '.' + claim), key.private_key).toString('base64url')
  const r = await fetch(key.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${head}.${claim}.${sig}` })
  return (await r.json()).access_token
}
const tok = await token()
const api = (p, body) => fetch('https://www.googleapis.com/webmasters/v3/' + p, { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: body && JSON.stringify(body) }).then(r => r.json())
const [cmd, site] = process.argv.slice(2)
if (cmd === 'sites') console.log(JSON.stringify(await api('sites'), null, 1))
if (cmd === 'queries') {
  // all queries (and the page they landed on) for the last 16 months, paged
  const end = new Date().toISOString().slice(0, 10), start = new Date(Date.now() - 486 * 864e5).toISOString().slice(0, 10)
  const rows = []
  for (let startRow = 0; ; startRow += 25000) {
    const r = await api(`sites/${encodeURIComponent(site)}/searchAnalytics/query`, { startDate: start, endDate: end, dimensions: ['query', 'page'], rowLimit: 25000, startRow })
    if (r.error) { console.error(r.error); break }
    rows.push(...(r.rows || [])); console.error(site, startRow, (r.rows || []).length)
    if (!r.rows || r.rows.length < 25000) break
  }
  fs.writeFileSync(process.argv[4], JSON.stringify(rows))
}
