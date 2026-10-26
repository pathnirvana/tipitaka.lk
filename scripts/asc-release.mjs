// App Store Connect release of the iOS and macOS apps (one record: Sinhala Tripitaka & Atuwa, lk.tipitaka.ios), with
// the API key of scripts/build-apple.sh (scripts/asc.mjs):
//   node scripts/asc-release.mjs listing IOS|MAC_OS [version]   the editable version (made, or renamed to version) and the
//                                                               texts of release/app-store/listing.md, categories, review contact
//   node scripts/asc-release.mjs build IOS|MAC_OS <build>        attach an uploaded build (scripts/build-apple.sh --upload) once processed
//   node scripts/asc-release.mjs submit IOS|MAC_OS               submit the version for review
// Screenshots: node scripts/asc-screenshots.mjs IOS|MAC_OS
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { api } from './asc.mjs'

const APP = '6615068500'
const LOCALE = 'en-GB' // the app's primary language
const EDITABLE = ['PREPARE_FOR_SUBMISSION', 'REJECTED', 'DEVELOPER_REJECTED', 'METADATA_REJECTED']
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const [cmd, platform, arg] = process.argv.slice(2)
if (!['listing', 'build', 'submit'].includes(cmd) || !['IOS', 'MAC_OS'].includes(platform)) {
  throw new Error('usage: node scripts/asc-release.mjs listing|build|submit IOS|MAC_OS [version|build]')
}

/** the fields of release/app-store/listing.md: "**Label** (n): text" lines and "**Label** (n):\n\ntext" blocks */
function listing() {
  const md = readFileSync(join(ROOT, 'release/app-store/listing.md'), 'utf8')
  const line = (label) => new RegExp(`\\*\\*${label}\\*\\* \\(\\d+\\): (.+)`).exec(md)?.[1].trim()
  const block = (label) => new RegExp(`\\*\\*${label}\\*\\* \\(\\d+\\):\\n\\n([\\s\\S]*?)(?=\\n\\*\\*|\\n- Support URL|\\n## )`).exec(md)?.[1].trim()
  const f = { name: line('Name'), subtitle: line('Subtitle'), promotionalText: block('Promotional text'), description: block('Description'),
    keywords: line('Keywords'), whatsNew: block("What's new") }
  for (const [k, v] of Object.entries(f)) if (!v) throw new Error(`listing.md: no ${k}`)
  return f
}

async function editableVersion() {
  const vs = await api('GET', `/v1/apps/${APP}/appStoreVersions?filter[platform]=${platform}&fields[appStoreVersions]=versionString,appVersionState&limit=20`)
  return { version: vs.data.find(v => EDITABLE.includes(v.attributes.appVersionState)), all: vs.data }
}

async function versionLocalization(versionId) {
  const locs = (await api('GET', `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`)).data
  const loc = locs.find(l => l.attributes.locale === LOCALE)
  if (loc) return loc
  return (await api('POST', '/v1/appStoreVersionLocalizations', { data: { type: 'appStoreVersionLocalizations', attributes: { locale: LOCALE },
    relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versionId } } } } })).data
}

if (cmd === 'listing') {
  const want = arg || JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version.replace(/\.0$/, '')
  const f = listing()
  let { version, all } = await editableVersion()
  if (!version) {
    version = (await api('POST', '/v1/appStoreVersions', { data: { type: 'appStoreVersions', attributes: { platform, versionString: want },
      relationships: { app: { data: { type: 'apps', id: APP } } } } })).data
    console.log(`made ${platform} ${want}`)
  } else if (version.attributes.versionString !== want) {
    await api('PATCH', `/v1/appStoreVersions/${version.id}`, { data: { type: 'appStoreVersions', id: version.id, attributes: { versionString: want } } })
    console.log(`${platform} ${version.attributes.versionString} -> ${want}`)
  }
  await api('PATCH', `/v1/appStoreVersions/${version.id}`, { data: { type: 'appStoreVersions', id: version.id,
    attributes: { copyright: `${new Date().getFullYear()} Path Nirvana Foundation`, releaseType: 'AFTER_APPROVAL' } } })
  // the first version of a platform has no "what's new"
  const first = !all.some(v => v.id !== version.id)
  const loc = await versionLocalization(version.id)
  await api('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, { data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: {
    description: f.description, keywords: f.keywords, promotionalText: f.promotionalText, supportUrl: 'https://tipitaka.lk', marketingUrl: 'https://tipitaka.lk',
    ...(first ? {} : { whatsNew: f.whatsNew }) } } })
  // app info (shared by the platforms): name, subtitle, privacy policy, categories
  const infos = (await api('GET', `/v1/apps/${APP}/appInfos`)).data
  const info = infos.find(i => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED'].includes(i.attributes.appStoreState ?? i.attributes.state)) ?? infos[0]
  const infoLoc = (await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`)).data.find(l => l.attributes.locale === LOCALE)
  await api('PATCH', `/v1/appInfoLocalizations/${infoLoc.id}`, { data: { type: 'appInfoLocalizations', id: infoLoc.id, attributes: {
    name: f.name, subtitle: f.subtitle, privacyPolicyUrl: 'https://github.com/pathnirvana/tipitaka.lk/blob/master/PRIVACY.md' } } })
  await api('PATCH', `/v1/appInfos/${info.id}`, { data: { type: 'appInfos', id: info.id, relationships: {
    primaryCategory: { data: { type: 'appCategories', id: 'REFERENCE' } }, secondaryCategory: { data: { type: 'appCategories', id: 'BOOKS' } } } } })
  // App Review: the notes; the contact (name, email, phone) as on the earlier versions
  const notes = 'No account or sign-in. The texts, search and dictionaries are bundled; the recitations stream from '
    + 'sajjha.sgp1.cdn.digitaloceanspaces.com and the scanned book pages load from pitaka.lk. This version replaces the earlier app with a new '
    + 'one (the same texts, with the commentaries linked to the text, dictionaries and recitations).'
  const detailOf = async (vid) => (await api('GET', `/v1/appStoreVersions/${vid}/appStoreReviewDetail`).catch(() => ({ data: null }))).data
  const rd = await detailOf(version.id)
  let contact = {}
  if (!rd?.attributes.contactPhone) { // a new version or platform: the contact of the latest version that has one (this
    // app's, else tipitaka.app's, 6824157493: the same developer)
    const all2 = [...(await api('GET', `/v1/apps/${APP}/appStoreVersions?fields[appStoreVersions]=versionString&limit=20`)).data,
      ...(await api('GET', '/v1/apps/6824157493/appStoreVersions?fields[appStoreVersions]=versionString&limit=5')).data]
    for (const v of all2) {
      const d = v.id !== version.id ? await detailOf(v.id) : null
      if (d?.attributes.contactPhone) { const c = d.attributes; contact = { contactFirstName: c.contactFirstName, contactLastName: c.contactLastName, contactEmail: c.contactEmail, contactPhone: c.contactPhone }; break }
    }
  }
  const attributes = { notes, demoAccountRequired: false, ...contact }
  if (rd) await api('PATCH', `/v1/appStoreReviewDetails/${rd.id}`, { data: { type: 'appStoreReviewDetails', id: rd.id, attributes } })
  else await api('POST', '/v1/appStoreReviewDetails', { data: { type: 'appStoreReviewDetails', attributes,
    relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } })
  console.log(`${platform} ${want}: listing, categories and review details set`)
}

if (cmd === 'build') {
  if (!arg) throw new Error('the build number (CFBundleVersion) is needed')
  const { version } = await editableVersion()
  if (!version) throw new Error(`no editable ${platform} version`)
  const p = platform === 'MAC_OS' ? 'MAC_OS' : 'IOS'
  for (let i = 0; ; i++) { // processing takes a few minutes after the upload
    const b = (await api('GET', `/v1/builds?filter[app]=${APP}&filter[version]=${arg}&filter[preReleaseVersion.platform]=${p}&fields[builds]=version,processingState`)).data[0]
    if (b?.attributes.processingState === 'VALID') {
      await api('PATCH', `/v1/appStoreVersions/${version.id}/relationships/build`, { data: { type: 'builds', id: b.id } })
      console.log(`${platform} ${version.attributes.versionString}: build ${arg} attached`)
      break
    }
    if (b && b.attributes.processingState !== 'PROCESSING') throw new Error(`build ${arg}: ${b.attributes.processingState}`)
    if (i > 60) throw new Error(`build ${arg} not processed after 30 minutes`)
    console.log(`build ${arg}: ${b ? b.attributes.processingState : 'not there yet'} …`)
    await new Promise(r => setTimeout(r, 30000))
  }
}

if (cmd === 'submit') {
  const { version } = await editableVersion()
  if (!version) throw new Error(`no editable ${platform} version`)
  // an open submission of the platform (a failed earlier try) is reused
  const open = (await api('GET', `/v1/reviewSubmissions?filter[app]=${APP}&filter[platform]=${platform}&filter[state]=READY_FOR_REVIEW`)).data[0]
  const sub = open ?? (await api('POST', '/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform },
    relationships: { app: { data: { type: 'apps', id: APP } } } } })).data
  const items = (await api('GET', `/v1/reviewSubmissions/${sub.id}/items`)).data
  if (!items.length) await api('POST', '/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems', relationships: {
    reviewSubmission: { data: { type: 'reviewSubmissions', id: sub.id } }, appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } } } })
  await api('PATCH', `/v1/reviewSubmissions/${sub.id}`, { data: { type: 'reviewSubmissions', id: sub.id, attributes: { submitted: true } } })
  console.log(`${platform} ${version.attributes.versionString} submitted for review`)
}
