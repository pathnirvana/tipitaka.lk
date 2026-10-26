// App icons for the stores and the site, from the Buddha Jayanthi logo (scripts/assets/logo-1024.png: the yellow wheel with
// බුද්ධ ජයන්ති and TIPITAKA.LK, transparent outside the white disc). Shapes are drawn at 1024 px and scaled down with
// ImageMagick (sharper than the browser at small sizes). The favicon (web/public/static/images/favicon-96x96.png,
// the 2500 Buddha Jayanthi wheel) is kept as it is. (tipitaka.app scripts/make-icons.mjs)
//   node scripts/make-icons.mjs            -> server/packaging/icons/{mac,ios,android,windows,store}/…, the web icons and
//                                             og image in web/public/static/images, web/public/manifest.webmanifest
//   node scripts/make-icons.mjs --preview  -> server/packaging/icons/preview.png (all shapes, several sizes)
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'server/packaging/icons')
const WEB = join(ROOT, 'web/public/static/images')
const TMP = join(OUT, '.tmp')
const dataUri = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`
const LOGO = dataUri(join(ROOT, 'scripts/assets/logo-1024.png'), 'image/png')
const FONT_BOLD = dataUri(join(ROOT, 'web/src/assets/fonts/AbhayaUni-Bold.woff2'), 'font/woff2')
const FONT_REG = dataUri(join(ROOT, 'web/src/assets/fonts/AbhayaUni-Regular.woff2'), 'font/woff2')
const MAROON = '#7a2e14'

const defs = `
  <radialGradient id="bg" cx="30%" cy="45%" r="90%">
    <stop offset="0" stop-color="#a8461c"/><stop offset="0.5" stop-color="#7a2e14"/><stop offset="1" stop-color="#4f1a08"/>
  </radialGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#ffc766" stop-opacity="0.35"/><stop offset="1" stop-color="#ffc766" stop-opacity="0"/>
  </radialGradient>
  <filter id="lift" x="-20%" y="-20%" width="140%" height="140%">
    <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#2a0b02" flood-opacity="0.5"/>
  </filter>
  <filter id="tile" x="-10%" y="-10%" width="120%" height="125%">
    <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.3"/>
  </filter>`

/** the logo centred on 512,512 at a share of the 1024 canvas */
const logo = (share, filter = '') => {
  const s = 1024 * share, o = (1024 - s) / 2
  return `<image href="${LOGO}" x="${o}" y="${o}" width="${s}" height="${s}"${filter ? ` filter="url(#${filter})"` : ''}/>`
}

/**
 * shape: square (iOS, Play, maskable: white, the system rounds the corners), mac (Apple's macOS grid: an 824 tile on
 * 1024 with a shadow), round (the logo itself: Windows, Android legacy and round, web), foreground (Android adaptive,
 * inside the 66/108 safe zone), mono (Android themed icon: the letters and the rim).
 */
function svg(shape) {
  let body
  switch (shape) {
    case 'square': body = '<rect width="1024" height="1024" fill="#fff"/>' + logo(0.9); break
    case 'maskable': body = '<rect width="1024" height="1024" fill="#fff"/>' + logo(0.8); break // the 40% safe circle
    case 'mac': body = '<g filter="url(#tile)"><rect x="100" y="100" width="824" height="824" rx="185" fill="#fff"/></g>' + logo(0.74); break
    case 'round': body = logo(1); break
    case 'foreground': body = logo(0.62); break
    case 'mono': body = logo(0.62); break // made one colour in monochrome()
    default: throw new Error(shape)
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs>${defs}</defs>${body}</svg>`
}

/** Google Play feature graphic (1024x500); with w, h the same design centred on a larger canvas (og:image) */
function featureGraphic(w = 1024, h = 500) {
  const k = w / 1024, dy = (h - 500 * k) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${defs}
    <style>@font-face { font-family: Abhaya; src: url(${FONT_BOLD}); font-weight: 700 }
      @font-face { font-family: Abhaya; src: url(${FONT_REG}); font-weight: 400 }
      text { font-family: Abhaya, serif }</style></defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/><g transform="translate(0 ${dy}) scale(${k})">
    <circle cx="240" cy="250" r="235" fill="url(#glow)"/>
    <image href="${LOGO}" x="65" y="75" width="350" height="350" filter="url(#lift)"/>
    <text x="470" y="200" font-size="58" font-weight="700" fill="#fbe7b4">බුද්ධ ජයන්ති</text>
    <text x="470" y="272" font-size="58" font-weight="700" fill="#fbe7b4">ත්‍රිපිටකය</text>
    <text x="472" y="335" font-size="27" fill="#f3d9c6" opacity="0.95">පාළි පෙළ · සිංහල පරිවර්තනය · අටුවාව</text>
    <text x="472" y="377" font-size="27" fill="#f3d9c6" opacity="0.95">සජ්ඣායනා · ශබ්දකෝෂ · සෙවුම</text>
    <text x="472" y="430" font-size="25" font-weight="700" fill="#f4c35a" letter-spacing="1">tipitaka.lk</text></g></svg>`
}

let page
async function render(svgText, w, h, file, opaque = false, bg = '#ffffff') {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svgText}</body></html>`)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(50)
  mkdirSync(dirname(file), { recursive: true })
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } })
  if (opaque) execFileSync('magick', [file, '-background', bg, '-alpha', 'remove', '-alpha', 'off', file])
}

/** every shape once at 1024 */
const master = {}
async function masters() {
  mkdirSync(TMP, { recursive: true })
  for (const shape of ['square', 'maskable', 'mac', 'round', 'foreground', 'mono']) {
    master[shape] = join(TMP, `${shape}.png`)
    await render(svg(shape), 1024, 1024, master[shape])
  }
  monochrome(master.mono)
}
/** Android themed icon: white where the logo has its letters (darker than the yellow wheel) and its rim */
function monochrome(file) {
  const letters = join(TMP, 'letters.png')
  execFileSync('magick', [file, '-background', 'white', '-alpha', 'remove', '-colorspace', 'gray', '-threshold', '62%', '-negate', letters])
  const r = 1024 * 0.62 / 2
  execFileSync('magick', ['-size', '1024x1024', 'xc:black', '-fill', 'none', '-stroke', 'white', '-strokewidth', String(Math.round(r * 0.07)),
    '-draw', `circle 512,512 512,${Math.round(512 - r * 0.965)}`, letters, '-compose', 'lighten', '-composite',
    '-background', 'white', '-alpha', 'shape', file])
}
/** a shape at a size (ImageMagick Lanczos from the 1024 master); opaque: flattened on bg */
function icon(shape, px, file, opaque = false, bg = '#ffffff') {
  mkdirSync(dirname(file), { recursive: true })
  const args = [master[shape], '-filter', 'Lanczos', '-resize', `${px}x${px}`]
  if (opaque) args.push('-background', bg, '-alpha', 'remove', '-alpha', 'off')
  execFileSync('magick', [...args, '-strip', file])
}

const browser = await chromium.launch()
page = await browser.newPage()

if (process.argv.includes('--preview')) {
  await masters()
  const shapes = ['mac', 'square', 'maskable', 'round', 'foreground', 'mono']
  const rows = []
  for (const s of shapes) {
    const files = [512, 128, 64, 32, 16].map(px => { const f = join(TMP, `p-${s}-${px}.png`); icon(s, px, f); return f })
    const row = join(TMP, `row-${s}.png`)
    execFileSync('magick', [...files, '-background', '#9aa7b4', '-gravity', 'west', '-splice', '16x0', '-gravity', 'south', '+append', row])
    rows.push(row)
  }
  const fg = join(TMP, 'feature.png'); await render(featureGraphic(), 1024, 500, fg, true)
  mkdirSync(OUT, { recursive: true })
  execFileSync('magick', [...rows, fg, '-background', '#9aa7b4', '-gravity', 'north', '-splice', '0x16', '-gravity', 'west', '-append', join(OUT, 'preview.png')])
  execFileSync('magick', [join(OUT, 'preview.png'), '-background', '#9aa7b4', '-alpha', 'remove', join(OUT, 'preview.png')])
  rmSync(TMP, { recursive: true, force: true })
  console.log('wrote', join(OUT, 'preview.png'))
  await browser.close()
  process.exit(0)
}

rmSync(OUT, { recursive: true, force: true })
await masters()

// macOS: the .iconset for iconutil (-> AppIcon.icns)
for (const s of [16, 32, 128, 256, 512]) {
  icon('mac', s, join(OUT, `mac/AppIcon.iconset/icon_${s}x${s}.png`))
  icon('mac', s * 2, join(OUT, `mac/AppIcon.iconset/icon_${s}x${s}@2x.png`))
}
if (process.platform === 'darwin') execFileSync('iconutil', ['-c', 'icns', join(OUT, 'mac/AppIcon.iconset'), '-o', join(OUT, 'mac/AppIcon.icns')])
// iOS: one 1024 icon, opaque, square (the system rounds the corners)
icon('square', 1024, join(OUT, 'ios/AppIcon-1024.png'), true)

// Android (copy android/ into app/src/main/res): legacy (API 24-25), round, adaptive layers (API 26+), themed (API 33+)
const dpi = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, k] of Object.entries(dpi)) {
  icon('round', 48 * k, join(OUT, `android/mipmap-${d}/ic_launcher.png`))
  icon('round', 48 * k, join(OUT, `android/mipmap-${d}/ic_launcher_round.png`))
  icon('foreground', 108 * k, join(OUT, `android/mipmap-${d}/ic_launcher_foreground.png`))
  icon('mono', 108 * k, join(OUT, `android/mipmap-${d}/ic_launcher_monochrome.png`))
}
mkdirSync(join(OUT, 'android/mipmap-anydpi-v26'), { recursive: true })
for (const name of ['ic_launcher', 'ic_launcher_round']) {
  writeFileSync(join(OUT, `android/mipmap-anydpi-v26/${name}.xml`), `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`)
}
mkdirSync(join(OUT, 'android/values'), { recursive: true })
writeFileSync(join(OUT, 'android/values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFFFFF</color>
</resources>
`)
icon('square', 512, join(OUT, 'store/play-store-512.png'), true)
await render(featureGraphic(), 1024, 500, join(OUT, 'store/play-feature-graphic.png'), true, MAROON)

// Windows (MSIX: AppxManifest.xml names the plain files) and the .ico of the exe
icon('round', 44, join(OUT, 'windows/Square44x44Logo.png'))
icon('round', 150, join(OUT, 'windows/Square150x150Logo.png'))
icon('round', 50, join(OUT, 'windows/StoreLogo.png'))
const icoSizes = [16, 24, 32, 48, 64, 256]
for (const s of icoSizes) icon('round', s, join(OUT, `windows/ico/${s}.png`))
execFileSync('magick', icoSizes.map(s => join(OUT, `windows/ico/${s}.png`)).concat(join(OUT, 'windows/app.ico')))
rmSync(join(OUT, 'windows/ico'), { recursive: true })
icon('round', 300, join(OUT, 'store/microsoft-store-300.png'))
icon('square', 1080, join(OUT, 'store/microsoft-box-art-1080.png'), true) // Store listing: 1:1 box art

// web: home screen icons (manifest), apple-touch-icon (opaque: iOS shows transparency as black), og:image
icon('square', 180, join(WEB, 'apple-touch-icon.png'), true)
icon('round', 192, join(WEB, 'icon-192.png'))
icon('round', 512, join(WEB, 'icon-512.png'))
icon('maskable', 512, join(WEB, 'icon-maskable-512.png'), true)
await render(featureGraphic(1200, 630), 1200, 630, join(WEB, 'og.png'), true, MAROON)
writeFileSync(join(ROOT, 'web/public/manifest.webmanifest'), JSON.stringify({
  name: 'බුද්ධ ජයන්ති ත්‍රිපිටකය',
  short_name: 'ත්‍රිපිටකය',
  description: 'බුද්ධ ජයන්ති ත්‍රිපිටකය – පාළි පෙළ, සිංහල පරිවර්තනය, අටුවාව, සජ්ඣායනා සහ ශබ්දකෝෂ',
  lang: 'si',
  icons: [
    { src: 'static/images/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'static/images/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'static/images/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  start_url: './',
  display: 'standalone',
  background_color: '#fbf8f3',
  theme_color: MAROON,
}, null, 2) + '\n')

rmSync(TMP, { recursive: true, force: true })
await browser.close()
console.log('wrote', OUT, 'and', WEB)
