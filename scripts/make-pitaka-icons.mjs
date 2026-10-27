// pitaka.lk's icons, favicon and og image, drawn here (no source image): the A4 logo - a cream disc in a gold ring on a
// deep maroon tile, සරල / සිංහල large and ත්‍රිපිටකය under it in AbhayaUni Bold. The favicon is ස in the disc; the og image
// and the Play feature graphic are the logo on cream with the dhamma wheel coming in from the side. Drawn at 1024 px and
// scaled down with ImageMagick like scripts/make-icons.mjs (tipitaka.lk's).
//   node scripts/make-pitaka-icons.mjs  -> server/packaging/icons-pitaka/{ios,android,store}/…, the web icons, favicon
//                                          and og image in web-pitaka/public/static/images, web-pitaka/public/manifest.webmanifest
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'server/packaging/icons-pitaka')
const WEB = join(ROOT, 'web-pitaka/public/static/images')
const TMP = join(OUT, '.tmp')
const dataUri = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`
const FONT_BOLD = dataUri(join(ROOT, 'web/src/assets/fonts/AbhayaUni-Bold.woff2'), 'font/woff2')
const FONT_REG = dataUri(join(ROOT, 'web/src/assets/fonts/AbhayaUni-Regular.woff2'), 'font/woff2')
const TILE = '#5a1e0a', RING = '#e2a535', DISC = '#fde3b0', INK = '#24140a', SUB = '#7a2e14', ORANGE = '#a8410f', CREAM = '#fbf1dc'
const style = `<style>@font-face { font-family: Abhaya; src: url(${FONT_BOLD}); font-weight: 700 }
  @font-face { font-family: Abhaya; src: url(${FONT_REG}); font-weight: 400 }</style>`

/** the dhamma wheel: rim, hub, 24 spokes */
function wheel(cx, cy, r, color, op = 1) {
  let s = `<g opacity="${op}" fill="none" stroke="${color}"><circle cx="${cx}" cy="${cy}" r="${r * 0.93}" stroke-width="${r * 0.1}"/>`
  s += `<circle cx="${cx}" cy="${cy}" r="${r * 0.14}" fill="${color}" stroke="none"/>`
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12
    s += `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(a) * r * 0.86}" y2="${cy + Math.sin(a) * r * 0.86}" stroke-width="${r * 0.035}" stroke-linecap="round"/>`
  }
  for (let i = 0; i < 24; i++) {
    const a = ((i + 0.5) * Math.PI) / 12
    s += `<circle cx="${cx + Math.cos(a) * r * 0.93}" cy="${cy + Math.sin(a) * r * 0.93}" r="${r * 0.04}" fill="${color}" stroke="none"/>`
  }
  return s + '</g>'
}
/** html in a foreignObject (Chromium shapes the Sinhala) centred in a w x h box */
const html = (inner, w = 1024, h = 1024, x = 0, y = 0) => `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml"
  style="width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:center">${inner}</div></foreignObject>`

/** the logo on the 1024 canvas, scaled by k about the centre: the disc and ring, the three lines (mono: all white, no fill) */
function logo(k = 1, mono = false) {
  const ink = mono ? '#fff' : INK, sub = mono ? '#fff' : SUB
  return `<g transform="translate(${512 * (1 - k)} ${512 * (1 - k)}) scale(${k})">
    <circle cx="512" cy="512" r="453" fill="${mono ? 'none' : DISC}" stroke="${mono ? '#fff' : RING}" stroke-width="34"/>
    ${html(`<div style="font:700 270px/0.92 Abhaya;color:${ink};margin-top:-40px">සරල</div>
      <div style="font:700 270px/0.92 Abhaya;color:${ink};margin-top:5px">සිංහල</div>
      <div style="font:700 112px/1 Abhaya;color:${sub};margin-top:30px">ත්‍රිපිටකය</div>`)}</g>`
}
const svg = (body, w = 1024, h = 1024) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${style}</defs>${body}</svg>`

/**
 * square: the tile (iOS, Play: the system rounds the corners), maskable: the logo inside the 40% safe circle, round: the
 * disc alone (web, Android legacy), foreground: Android adaptive inside the 66/108 safe zone (the tile colour is the
 * background layer), mono: Android themed icon
 */
function shape(name) {
  switch (name) {
    case 'square': return svg(`<rect width="1024" height="1024" fill="${TILE}"/>${logo()}`)
    case 'maskable': return svg(`<rect width="1024" height="1024" fill="${TILE}"/>${logo(0.84)}`)
    case 'round': return svg(logo(1004 / 940))
    case 'foreground': return svg(logo(0.64))
    case 'mono': return svg(logo(0.64, true))
    default: throw new Error(name)
  }
}

/** the favicon: ස in the disc; dy moves the letter so that its ink is centred */
const favicon = (dy = 0, letterOnly = false) => svg(`${letterOnly ? '' : `<circle cx="512" cy="512" r="500" fill="${ORANGE}"/><circle cx="512" cy="512" r="425" fill="${DISC}"/>`}
  ${html(`<div style="font:700 760px/1 Abhaya;color:${INK};transform:translateY(${dy}px)">ස</div>`)}`)

/** the og image (1200x630) and, centred on its own canvas, the Play feature graphic (1024x500) */
function share(w = 1200, h = 630) {
  const k = Math.min(w / 1200, h / 630), dx = (w - 1200 * k) / 2, dy = (h - 630 * k) / 2
  return svg(`<rect width="${w}" height="${h}" fill="${CREAM}"/><g transform="translate(${dx} ${dy}) scale(${k})">
    ${wheel(1080, 560, 360, '#d79a2b', 0.2)}
    <g transform="translate(70 110) scale(0.40)">${logo()}</g>
    ${html(`<div style="align-self:stretch;color:#4f1a08"><div style="font:700 76px/1.15 Abhaya">සරල සිංහල</div><div style="font:700 76px/1.15 Abhaya">ත්‍රිපිටකය</div>
      <div style="font:400 31px/1.45 Abhaya;margin-top:22px;color:${SUB}">බුද්ධ ජයන්ති පාළි පෙළ සහ<br/>සැමට තේරෙන සරල සිංහල පරිවර්තනය</div>
      <div style="font:700 31px/1 Abhaya;margin-top:26px;letter-spacing:1px;color:#b8460f">pitaka.lk</div></div>`, 640, 630, 540, 0)}</g>`, w, h)
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
/** a 1024 master at a size (ImageMagick Lanczos); opaque: flattened on bg */
function icon(master, px, file, opaque = false, bg = '#ffffff') {
  mkdirSync(dirname(file), { recursive: true })
  const args = [master, '-filter', 'Lanczos', '-resize', `${px}x${px}`]
  if (opaque) args.push('-background', bg, '-alpha', 'remove', '-alpha', 'off')
  execFileSync('magick', [...args, '-strip', file])
}

const browser = await chromium.launch()
page = await browser.newPage()
rmSync(OUT, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
const master = {}
for (const s of ['square', 'maskable', 'round', 'foreground', 'mono']) await render(shape(s), 1024, 1024, master[s] = join(TMP, `${s}.png`))

// the favicon letter: its ink box (ImageMagick's trim) centred on the disc
const letter = join(TMP, 'letter.png')
await render(favicon(0, true), 1024, 1024, letter)
const [, , inkH, , inkY] = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(execFileSync('magick', [letter, '-format', '%@', 'info:']).toString().trim()).map(Number)
const fav = join(TMP, 'favicon.png')
await render(favicon(Math.round(512 - (inkY + inkH / 2))), 1024, 1024, fav)

// iOS: one 1024 icon, opaque (the system rounds the corners)
icon(master.square, 1024, join(OUT, 'ios/AppIcon-1024.png'), true, TILE)
// Android (copy android/ into app/src/main/res): legacy and round, adaptive layers (API 26+), themed (API 33+)
const dpi = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
for (const [d, k] of Object.entries(dpi)) {
  icon(master.round, 48 * k, join(OUT, `android/mipmap-${d}/ic_launcher.png`))
  icon(master.round, 48 * k, join(OUT, `android/mipmap-${d}/ic_launcher_round.png`))
  icon(master.foreground, 108 * k, join(OUT, `android/mipmap-${d}/ic_launcher_foreground.png`))
  icon(master.mono, 108 * k, join(OUT, `android/mipmap-${d}/ic_launcher_monochrome.png`))
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
    <color name="ic_launcher_background">${TILE.toUpperCase()}</color>
</resources>
`)
icon(master.square, 512, join(OUT, 'store/play-store-512.png'), true, TILE)
await render(share(1024, 500), 1024, 500, join(OUT, 'store/play-feature-graphic.png'), true, CREAM)

// web: home screen icons (manifest), apple-touch-icon (opaque: iOS shows transparency as black), favicon, og:image
rmSync(WEB, { recursive: true, force: true })
icon(master.square, 180, join(WEB, 'apple-touch-icon.png'), true, TILE)
icon(master.round, 192, join(WEB, 'icon-192.png'))
icon(master.round, 512, join(WEB, 'icon-512.png'))
icon(master.maskable, 512, join(WEB, 'icon-maskable-512.png'), true, TILE)
icon(fav, 96, join(WEB, 'favicon-96x96.png'))
await render(share(), 1200, 630, join(WEB, 'og.png'), true, CREAM)
writeFileSync(join(ROOT, 'web-pitaka/public/manifest.webmanifest'), JSON.stringify({
  name: 'සරල සිංහල ත්‍රිපිටකය',
  short_name: 'සරල ත්‍රිපිටකය',
  description: 'සරල සිංහල ත්‍රිපිටකය – පාළි පාඨය සමඟ සරල සිංහල පරිවර්තනය, සජ්ඣායනා සහ ශබ්දකෝෂ',
  lang: 'si',
  icons: [
    { src: 'static/images/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'static/images/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'static/images/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  start_url: './',
  display: 'standalone',
  background_color: '#fbf8f3',
  theme_color: ORANGE,
}, null, 2) + '\n')

rmSync(TMP, { recursive: true, force: true })
await browser.close()
console.log('wrote', OUT, 'and', WEB)
