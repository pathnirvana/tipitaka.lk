// Store screenshots: eight features of tipitaka.lk, each with a Sinhala caption on the brand colour, rendered from the web
// build by the Go server on the full dbs (the apps show the same UI) at the sizes of each store, tablets and desktops in
// landscape. Scans and recitations come from their public servers, so this needs the internet. (tipitaka.app
// scripts/store-screenshots.mjs)
//   npm run build:web && npm run build:server && node scripts/store-screenshots.mjs [output…]
//   -> release/store-screenshots/<output>/<n>-<scene>.png
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'release/store-screenshots')
const PORT = 8419, BASE = `http://127.0.0.1:${PORT}`
const FONTS = pathToFileURL(join(ROOT, 'web/src/assets/fonts')).href

/** store image sizes; css: the width of the screen the app is shown at (phone, tablet or desktop layout) */
const OUTPUTS = {
  'play-phone': { w: 1080, h: 1920, css: 390 },
  'play-tablet-7': { w: 1920, h: 1200, css: 1280 },
  'play-tablet-10': { w: 2560, h: 1600, css: 1280 },
  'apple-iphone-6.9': { w: 1320, h: 2868, css: 400 },
  'apple-ipad-13': { w: 2752, h: 2064, css: 1280 },
  'apple-mac': { w: 2880, h: 1800, css: 1440, desktop: true },
  'microsoft-windows': { w: 3200, h: 1800, css: 1600, desktop: true },
}

const SCENES = [
  { id: 'translation', title: 'පාළි පෙළ සහ සිංහල පරිවර්තනය', phoneTitle: 'සිංහල පරිවර්තනය සමඟ', sub: 'සම්පූර්ණ බුද්ධ ජයන්ති ත්‍රිපිටකය – ඡේදයෙන් ඡේදයට එක පෙළට' },
  { id: 'audio', title: 'සජ්ඣායනාවට සවන් දෙන්න', sub: 'සජ්ඣායනා කරන තැන පෙළෙහි ඉස්මතු වේ' },
  { id: 'dictionary', title: 'වචනයක් තට්ටු කර තේරුම බලන්න', desktopTitle: 'වචනයක් ක්ලික් කර තේරුම බලන්න', sub: 'පාළි-සිංහල සහ පාළි-ඉංග්‍රීසි ශබ්දකෝෂ, DPD ව්‍යාකරණ සමඟ' },
  { id: 'commentary', title: 'අටුවාව මූල පෙළ අසලින්', sub: 'යටින් ඉරි ඇඳි වචනයක අටුවා විවරණය එසැණින්' },
  { id: 'scans', title: 'මුල් පොතේ පිටු', sub: 'බුද්ධ ජයන්ති මුද්‍රිත පොතේ ස්කෑන් කළ පිටු සමඟ සසඳන්න' },
  { id: 'search', title: 'මුළු ත්‍රිපිටකයම සොයන්න', sub: 'සූත්‍ර නාම, අන්තර්ගතය සහ ශබ්දකෝෂ – සිංහල හෝ singlish අකුරෙන්' },
  { id: 'map', title: 'බුදුරජාණන් වහන්සේ වැඩ සිටි තැන්', sub: 'සූත්‍රවල ස්ථාන, පුද්ගලයන් සහ චාරිකා සිතියමක' },
  { id: 'themes', title: 'ඔබ කැමති වර්ණයෙන් කියවන්න', sub: 'ආලෝකමත්, sepia, කොළ සහ අඳුරු – අකුරු ප්‍රමාණය ද ඔබට ගැලපෙන ලෙස' },
]

let browser
async function appPage(css, cssH, { theme = 'light', fontSize = 0 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: css, height: cssH }, deviceScaleFactor: 3, isMobile: css < 600, hasTouch: css < 600 })
  await ctx.addInitScript(s => localStorage.setItem('tipitaka.lk-settings-2', JSON.stringify(s)),
    { theme, fontSize, panelPinned: false, defaultColumns: 2, tabView: 'tabs', autoHideSearchBar: false })
  // the recitation timings: the CDN allows only the tipitaka.lk origin
  await ctx.route(/^https:\/\/sajjha\.sgp1\.cdn\.digitaloceanspaces\.com\/.*\.(json|txt)$/, async r => {
    const res = await r.fetch()
    await r.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': '*' } })
  })
  return ctx.newPage()
}
async function open(page, path) {
  await page.goto(BASE + encodeURI(path), { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
}
const entries = (page, lang) => page.locator(`[data-testid="text-tab"]:visible .entry[data-lang="${lang}"]`)
/** clicks a word of the pali text (the first one that contains w) and waits for the pane */
async function clickWord(page, w) {
  await entries(page, 'pali').locator('.w', { hasText: w }).first().click()
  await page.getByTestId('inline-dict').waitFor()
  await page.waitForTimeout(1000)
}
/** opens the menu of a paragraph that has one (hover first: the button shows on hover) */
async function paragraphMenu(page, nth = 0) {
  const cell = entries(page, 'pali').filter({ has: page.getByTestId('entry-options') }).nth(nth)
  await cell.scrollIntoViewIfNeeded()
  await cell.hover()
  await cell.getByTestId('entry-options').click()
}
const shot = async (page, file) => { await page.screenshot({ path: file }); await page.context().close(); return file }

/** the app screen(s) of a scene: an image file, or [{file}] for the themes composite */
async function render(scene, css, cssH, dir) {
  const wide = css >= 1000
  const file = join(dir, `${scene.id}.png`)
  switch (scene.id) {
    case 'translation': {
      const p = await appPage(css, cssH)
      await open(p, wide ? '/mn-1-1-1' : '/mn-1-1-1/sinh')
      return shot(p, file)
    }
    case 'audio': {
      const p = await appPage(css, cssH)
      await open(p, wide ? '/dn-1-1' : '/dn-1-1/pali')
      await paragraphMenu(p, 1)
      await p.locator('.menu-item', { hasText: 'අසන්න' }).click()
      await p.getByTestId('audio-control').waitFor()
      await p.locator('.entry-text.audio-playing').first().waitFor()
      await p.waitForTimeout(9000) // the progress bar moves on, playing (the chanted paragraph is marked)
      await p.mouse.move(1, cssH / 2)
      await p.waitForTimeout(500)
      return shot(p, file)
    }
    case 'dictionary': {
      const p = await appPage(css, cssH)
      await open(p, wide ? '/dn-1-1' : '/dn-1-1/pali')
      await clickWord(p, 'භගවා')
      return shot(p, file)
    }
    case 'commentary': {
      const p = await appPage(css, cssH)
      await open(p, wide ? '/dn-1-1' : '/dn-1-1/pali')
      await p.locator('[data-testid="text-tab"]:visible [data-lang="pali"] .gl').nth(2).click()
      await p.getByTestId('dict-tab-atta').click()
      await p.waitForTimeout(800)
      if (wide) { // mūla and aṭṭhakathā side by side, the gloss in the pane
        await p.getByTestId('gloss-item').first().getByTestId('gloss-alongside').click()
        await p.getByTestId('column').nth(1).waitFor()
        await p.waitForTimeout(1500)
      }
      await p.mouse.move(1, cssH / 2)
      return shot(p, file)
    }
    case 'scans': {
      const p = await appPage(css, cssH)
      await open(p, wide ? '/dn-2' : '/dn-2/pali')
      await p.getByTestId('page-number').first().click()
      await p.getByTestId('scan-img').first().waitFor()
      await p.waitForLoadState('networkidle')
      await p.waitForFunction(() => [...document.querySelectorAll('[data-testid=scan-img]')].slice(0, 2).every(i => i.complete && i.naturalWidth))
      await p.waitForTimeout(800)
      return shot(p, file)
    }
    case 'search': {
      const p = await appPage(css, cssH)
      await open(p, '/fts/නිබ්බානං')
      await p.waitForTimeout(800)
      return shot(p, file)
    }
    case 'map': {
      const p = await appPage(css, cssH)
      await open(p, '/map?journey=mahaparinibbana')
      await p.waitForTimeout(2500) // the tiles
      return shot(p, file)
    }
    case 'themes': { // the same page in three themes, a third of the screen each
      const parts = []
      for (const theme of ['light', 'sepia', 'dark']) {
        const p = await appPage(css, cssH, { theme })
        await open(p, wide ? '/kn-dhp-1' : '/kn-dhp-1/sinh')
        parts.push({ file: await shot(p, join(dir, `themes-${theme}.png`)) })
      }
      return parts
    }
  }
}

/** the caption band, the side margins and the corner radius of the screen (which runs off the bottom by the radius) */
function frameBox(o) {
  const portrait = o.h > o.w
  return { portrait, band: Math.round(o.h * (portrait ? 0.2 : 0.16)), mx: Math.round(o.w * (portrait ? 0.07 : 0.06)), radius: Math.round(o.w * (portrait ? 0.035 : 0.012)) }
}

function frameHtml(o, scene, img) {
  const { portrait, band, mx, radius } = frameBox(o)
  const title = Math.round(portrait ? o.w * 0.066 : o.h * 0.054), sub = Math.round(title * 0.5)
  const boxW = o.w - 2 * mx, boxH = o.h - band
  const body = typeof img === 'string' ? `<img class="screen" src="${pathToFileURL(img).href}">`
    : `<div class="screen split">${img.map(c => `<div><img src="${pathToFileURL(c.file).href}"></div>`).join('')}</div>`
  const heading = (o.desktop && scene.desktopTitle) || (portrait && scene.phoneTitle) || scene.title
  return `<!doctype html><html lang="si"><head><meta charset="utf-8"><style>
    @font-face { font-family: Abhaya; src: url('${FONTS}/AbhayaUni-Bold.woff2'); font-weight: 700 }
    @font-face { font-family: Abhaya; src: url('${FONTS}/AbhayaUni-Regular.woff2'); font-weight: 400 }
    html, body { margin: 0; width: ${o.w}px; height: ${o.h}px; overflow: hidden }
    body { background: radial-gradient(ellipse at 50% 0%, #a8461c 0%, #7a2e14 45%, #4f1a08 100%); font-family: Abhaya, serif; position: relative }
    .caption { position: absolute; left: 0; right: 0; top: 0; height: ${band}px; display: flex; flex-direction: column; align-items: center;
      justify-content: center; text-align: center; padding: 0 ${mx}px; box-sizing: border-box }
    h1 { margin: 0; font-size: ${title}px; font-weight: 700; color: #fbe7b4; line-height: 1.25 }
    p { margin: ${Math.round(sub * 0.6)}px 0 0; font-size: ${sub}px; color: #f3d9c6; line-height: 1.4 }
    .screen { position: absolute; left: ${mx}px; top: ${band}px; width: ${boxW}px; height: ${boxH + radius}px; object-fit: cover;
      object-position: top; border-radius: ${radius}px; box-shadow: 0 ${radius}px ${radius * 3}px rgba(0,0,0,.45); background: #fbf8f3 }
    .split { display: flex; overflow: hidden }
    .split > div { flex: 1; overflow: hidden } .split img { width: 300%; height: auto; display: block }
    .split > div:nth-child(2) img { margin-left: -100% } .split > div:nth-child(3) img { margin-left: -200% }
  </style></head><body><div class="caption"><h1>${heading}</h1><p>${scene.sub}</p></div>${body}</body></html>`
}

const args = process.argv.slice(2)
const onlyScenes = args.filter(a => a.startsWith('--scene=')).map(a => a.slice(8))
const want = args.filter(a => !a.startsWith('--')).length ? args.filter(a => !a.startsWith('--')) : Object.keys(OUTPUTS)
const server = spawn(join(ROOT, 'server/bin/tipitaka_lk'), ['-no-open', '-listen', `127.0.0.1:${PORT}`, '-root-path', '.', '-db-dir', 'db'], { cwd: ROOT, stdio: 'ignore' })
try {
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + '/api/health')).ok) break } catch { /* starting */ } await new Promise(r => setTimeout(r, 200)) }
  browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
  for (const name of want) {
    const o = OUTPUTS[name], dir = join(OUT, name), raw = join(OUT, '.raw', name)
    if (!onlyScenes.length) rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true }); mkdirSync(raw, { recursive: true })
    const { mx, band, radius } = frameBox(o)
    const cssH = Math.round(o.css * (o.h - band + radius) / (o.w - 2 * mx)) // the screen fills the frame below the caption, uncropped
    for (const [n, scene] of SCENES.entries()) {
      if (onlyScenes.length && !onlyScenes.includes(scene.id)) continue
      const img = await render(scene, o.css, cssH, raw)
      const html = join(raw, `${scene.id}.html`); writeFileSync(html, frameHtml(o, scene, img))
      const page = await browser.newPage({ viewport: { width: o.w, height: o.h } })
      await page.goto(pathToFileURL(html).href); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(200)
      await page.screenshot({ path: join(dir, `${n + 1}-${scene.id}.png`) }); await page.close()
    }
    console.log('wrote', dir)
  }
} finally {
  await browser?.close()
  server.kill()
}
