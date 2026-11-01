// Drives the installed Windows app through its webview's DevTools port (.github/workflows/windows.yml): each page must
// show its content; a screenshot of each goes to <out>/.
//   node scripts/windows-smoke.mjs lk|pitaka <out>
import fs from 'node:fs'

const [flavor = 'lk', out = 'shots'] = process.argv.slice(2)
const base = flavor === 'pitaka' ? '/main' : ''
const PAGES = [ // [name, path, selector, text the element has]
  ['start', null, flavor === 'pitaka' ? '[data-testid="welcome"]' : '#app', flavor === 'pitaka' ? 'සරල සිංහල ත්‍රිපිටකය' : ''],
  ['sutta', '/dn-1-1', flavor === 'pitaka' ? '[data-lang="sinh"]' : '.entry-text.heading', flavor === 'pitaka' ? 'භාග්‍යවතුන්' : 'බ්‍රහ්මජාල'],
  ['search', '/fts/බ්‍රහ්මජාල', '[data-testid="fts-item"]', ''],
  ['dictionary', '/dict/ධම්ම', '[data-testid="dict-match"]', ''],
  ['title', '/title/brahmajala', '[data-testid="title-result"][data-key="dn-1-1"]', ''],
]
const sleep = ms => new Promise(r => setTimeout(r, ms))
fs.mkdirSync(out, { recursive: true })

async function page() { // the app's page target, once the window is up
  for (let i = 0; i < 90; i++) {
    try {
      const t = (await (await fetch('http://127.0.0.1:9222/json')).json()).find(t => t.type === 'page')
      if (t) return t
    } catch {}
    await sleep(1000)
  }
  throw new Error('no webview with a DevTools port after 90 s: the app did not start (or WebView2 is missing)')
}

const target = await page()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map(), errors = []
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '))
}
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq
  pending.set(id, m => m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result))
  ws.send(JSON.stringify({ id, method, params }))
})
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value
await send('Runtime.enable')
await send('Page.enable')

let failed = 0
for (const [name, path, sel, text] of PAGES) {
  const t0 = Date.now()
  if (path) await send('Page.navigate', { url: (await evaluate('location.origin')) + base + path })
  let ok = false
  while (!ok && Date.now() - t0 < 30000) {
    ok = await evaluate(`[...document.querySelectorAll(${JSON.stringify(sel)})].some(e => e.innerText.trim() && e.innerText.includes(${JSON.stringify(text)}))`).catch(() => false)
    if (!ok) await sleep(500)
  }
  await sleep(500) // fonts and images
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(`${out}/${name}.png`, Buffer.from(data, 'base64'))
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${await evaluate('location.pathname')} ${JSON.stringify(await evaluate('document.title'))} ${Date.now() - t0} ms`)
  if (!ok) failed++
}
if (errors.length) console.log('console errors:\n  ' + errors.join('\n  '))
ws.close()
process.exit(failed ? 1 : 0)
