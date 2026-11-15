// The legacy (old browser) JavaScript must parse in the oldest browsers we target (web/vite.config.ts: Chrome 53 =
// Android 7's WebView, Safari 10 / iOS 15 in the apps): Babel transpiles the syntax but not regular expressions, so a
// newer regex feature in a dependency (lookbehind (?<=…), named groups, the s/u/v/d flags…) ships as is - and the whole
// chunk then fails to parse: a blank screen (pali-converter's lookbehind on iOS 15 - 16.3, 2026-11).
//   node scripts/check-js.mjs [dir…]   default: the app builds and the legacy chunks of the site builds
import { parse } from 'acorn'
import fs from 'node:fs'
import path from 'node:path'

const dirs = process.argv.slice(2)
const all = dirs.length ? dirs : ['web/dist-app', 'web-pitaka/dist-app', 'web/dist', 'web-pitaka/dist'].filter(d => fs.existsSync(d))
let bad = 0, n = 0
for (const dir of all) {
  const assets = path.join(dir, 'assets')
  for (const f of fs.readdirSync(assets).filter(f => f.endsWith('.js'))) {
    // the site's modern chunks (ES modules) are only loaded by the browsers that have them
    if (!dir.endsWith('dist-app') && !f.includes('-legacy')) continue
    const src = fs.readFileSync(path.join(assets, f), 'utf8')
    n++
    try { parse(src, { ecmaVersion: 2015, sourceType: 'script' }) }
    catch (e) {
      bad++
      console.error(`${path.join(assets, f)}: ${e.message}\n  …${src.slice(Math.max(0, e.pos - 60), e.pos + 60)}…`)
    }
  }
}
if (!n) { console.error('check-js: no built JavaScript found'); process.exit(1) }
if (bad) { console.error(`\n${bad} file(s) with syntax newer than ES2015`); process.exit(1) }
console.log(`check-js: ${n} files parse as ES2015`)
