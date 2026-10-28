// Replaces the App Store screenshots of the editable version of a platform with release/store-screenshots
// (scripts/store-screenshots.mjs; tipitaka.app's script):  node scripts/asc-screenshots.mjs IOS|MAC_OS
// --flavor pitaka (first): pitaka.lk's iOS app (com.pitaka.lk) with release/store-screenshots-pitaka
// (screenshots are locked while a version waits for review or is in review)
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { api } from './asc.mjs'

const args = process.argv.slice(2)
const PITAKA = args[0] === '--flavor' && args[1] === 'pitaka'
if (args[0] === '--flavor') args.splice(0, 2)
const APP = PITAKA ? '1434955293' : '6615068500' // Sarala Sinhala Tripitaka (com.pitaka.lk) / Sinhala Tripitaka & Atuwa (lk.tipitaka.ios)
const DIR = join(dirname(fileURLToPath(import.meta.url)), `../release/store-screenshots${PITAKA ? '-pitaka' : ''}`)
const SETS = { IOS: [['APP_IPHONE_67', 'apple-iphone-6.9'], ['APP_IPAD_PRO_3GEN_129', 'apple-ipad-13']], MAC_OS: [['APP_DESKTOP', 'apple-mac']] }
const EDITABLE = ['PREPARE_FOR_SUBMISSION', 'REJECTED', 'DEVELOPER_REJECTED', 'METADATA_REJECTED']

const platform = args[0]
if (!SETS[platform]) throw new Error('usage: node scripts/asc-screenshots.mjs IOS|MAC_OS')
const versions = await api('GET', `/v1/apps/${APP}/appStoreVersions?filter[platform]=${platform}&fields[appStoreVersions]=versionString,appVersionState`)
const version = versions.data.find(v => EDITABLE.includes(v.attributes.appVersionState))
if (!version) throw new Error(`no editable ${platform} version: ${versions.data.map(v => `${v.attributes.versionString} ${v.attributes.appVersionState}`).join(', ')}`)
const LOCALE = PITAKA ? 'en-US' : 'en-GB' // the app's primary language
const loc = (await api('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data.find(l => l.attributes.locale === LOCALE)
if (!loc) throw new Error(`no ${LOCALE} localization of ${platform} ${version.attributes.versionString}`)
console.log(`${platform} ${version.attributes.versionString} (${version.attributes.appVersionState})`)

for (const [type, folder] of SETS[platform]) {
  const existing = await api('GET', `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?filter[screenshotDisplayType]=${type}`)
  const set = existing.data[0] ?? (await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: type },
    relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } } } })).data
  for (const s of (await api('GET', `/v1/appScreenshotSets/${set.id}/appScreenshots`)).data) await api('DELETE', `/v1/appScreenshots/${s.id}`)
  for (const fileName of readdirSync(join(DIR, folder)).filter(f => f.endsWith('.png')).sort()) {
    const bytes = readFileSync(join(DIR, folder, fileName))
    const shot = (await api('POST', '/v1/appScreenshots', { data: { type: 'appScreenshots', attributes: { fileName, fileSize: bytes.length },
      relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } } })).data
    for (const op of shot.attributes.uploadOperations) {
      const r = await fetch(op.url, { method: op.method, headers: Object.fromEntries(op.requestHeaders.map(h => [h.name, h.value])),
        body: bytes.subarray(op.offset, op.offset + op.length) })
      if (!r.ok) throw new Error(`upload ${fileName}: ${r.status}`)
    }
    await api('PATCH', `/v1/appScreenshots/${shot.id}`, { data: { type: 'appScreenshots', id: shot.id,
      attributes: { uploaded: true, sourceFileChecksum: createHash('md5').update(bytes).digest('hex') } } })
    console.log(' ', type, fileName)
  }
}
