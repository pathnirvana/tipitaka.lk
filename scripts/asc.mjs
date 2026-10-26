// A small App Store Connect API client (the API key of scripts/build-apple.sh; ASC_* override it):
//   node scripts/asc.mjs GET '/v1/apps/6824157493/appStoreVersions'
//   node scripts/asc.mjs PATCH /v1/... '{"data": …}'
// or import { api } from './asc.mjs' in a script.
import { createPrivateKey, createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const KEY_ID = process.env.ASC_KEY_ID || 'CNJQZ82QCH'
const ISSUER = process.env.ASC_ISSUER_ID || '177929b9-56d5-4755-88a7-b8a4a017d089'
const KEY_PATH = process.env.ASC_KEY_PATH || '/Volumes/2TB/Android/AuthKey_CNJQZ82QCH.p8'

const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url')
function token() {
  const now = Math.floor(Date.now() / 1000)
  const head = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }), body = b64({ iss: ISSUER, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })
  const sig = createSign('SHA256').update(`${head}.${body}`).sign({ key: createPrivateKey(readFileSync(KEY_PATH)), dsaEncoding: 'ieee-p1363' })
  return `${head}.${body}.${sig.toString('base64url')}`
}

export async function api(method, path, body) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + path, {
    method, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  const json = text ? JSON.parse(text) : {}
  if (!r.ok) throw Object.assign(new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(json.errors ?? json).slice(0, 1500)}`), { status: r.status })
  return json
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [method, path, body] = process.argv.slice(2)
  api(method, path, body ? JSON.parse(body) : undefined).then(j => console.log(JSON.stringify(j, null, 1)), e => { console.error(e.message); process.exit(1) })
}
