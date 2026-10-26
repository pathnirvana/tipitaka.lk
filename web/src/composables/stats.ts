/**
 * Anonymous usage counts of the website (server/stats.go, shown at /stats; tipitaka.app's, with the visitor's
 * device). A visit counts from the visitor's first tap, click, wheel or key (crawlers that run the app never do): then
 * one beacon says whether the visitor is new and whether this is their first visit of the day / week / month (the
 * server sums these into unique visitors, no visitor id is needed), with the device: its operating system and whether
 * it is a phone, tablet or desktop. When the page is hidden a second one has the pages opened, the searches made (only
 * the last query of a search typed letter by letter), the app's requests to the server, the features used without a
 * request (countFeature) and the words tapped in texts.
 * No cookies or ids; not in the apps, not for test automation (e2e sets window.__tipitakaStatsTest to test it).
 */
import type { Router } from 'vue-router'
import { getData, isNativeApp, type DataSource } from '@/data/source'
import { toSinh } from '@/data/dictionary'
import { loadJson, saveJson } from './storage'

const LAST_VISIT = 'tipitaka.lk-last-visit' // the UTC day of the last counted visit
/** the search pages and the route param of their query */
const SEARCHES: Record<string, string> = { title: 'term', fts: 'words', dict: 'word' }
const INTERACTIONS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] // not scroll: the app scrolls by itself
const CRAWLER = /bot\b|bot\/|crawl|spider|slurp|headless|lighthouse|inspectiontool|preview|facebookexternalhit|mediapartners|yandex|baidu|bytespider|petal|semrush|ahrefs|phantomjs|prerender/i

/** the parts of a route used here */
interface Loc { name?: string | symbol | null; path: string; params?: Record<string, unknown> }

export interface Visit { new: boolean; day: boolean; week: boolean; month: boolean; os: string; form: string }

/** the Monday of the (UTC) week of a YYYY-MM-DD day, as the server groups weeks */
export function weekOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/** the visit's flags from the day of the last visit ('' none) */
export function visitFlags(last: string, today: string, isNew: boolean): Pick<Visit, 'new' | 'day' | 'week' | 'month'> {
  return { new: isNew, day: last !== today, week: !last || weekOf(last) !== weekOf(today), month: last.slice(0, 7) !== today.slice(0, 7) }
}

/** the visitor's device: operating system and kind (iPads ask for the desktop site as a Mac: told by their touch screen) */
export function deviceOf(ua: string, touchPoints: number): Pick<Visit, 'os' | 'form'> {
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)
  if (ipad) return { os: 'ios', form: 'tablet' }
  if (/iPhone|iPod/.test(ua)) return { os: 'ios', form: 'phone' }
  if (/Android/.test(ua)) return { os: 'android', form: /Mobile/.test(ua) ? 'phone' : 'tablet' }
  if (/CrOS/.test(ua)) return { os: 'chromeos', form: 'desktop' }
  if (/Windows/.test(ua)) return { os: 'windows', form: 'desktop' }
  if (/Macintosh|Mac OS X/.test(ua)) return { os: 'mac', form: 'desktop' }
  if (/Linux|X11/.test(ua)) return { os: 'linux', form: 'desktop' }
  return { os: 'other', form: /Mobi/.test(ua) ? 'phone' : 'desktop' }
}

/** counts of one page load, sent when the page is hidden */
export class Tally {
  pages: Record<string, number> = {}
  terms: [string, string][] = []
  ops: Record<string, number> = {}
  features: Record<string, number> = {}
  words: string[] = []
  private typing: [string, string] | null = null // the search being typed

  route(to: Loc, from?: Loc) {
    const name = String(to.name ?? '')
    if (!name || (from && from.path === to.path)) return // only the hash or query changed
    const param = SEARCHES[name]
    const q = param ? String(to.params?.[param] ?? '').trim() : ''
    if (q) {
      const t = this.typing
      if (t && t[0] === name && (q.startsWith(t[1]) || t[1].startsWith(q))) this.typing = [name, q] // still typing
      else { this.done(); this.typing = [name, q] }
    } else this.done()
    if (!from || from.name !== to.name || !param) this.pages[name] = (this.pages[name] ?? 0) + 1
  }

  /** a request to the server: a named query or an engine op (repeats are answered by the app's cache, not seen here) */
  op(op: string, params: Record<string, unknown>) {
    if (op === 'meta.info') return
    this.ops[op] = (this.ops[op] ?? 0) + 1
    if (op === 'lookup' && typeof params.w === 'string' && this.words.length < 50) this.words.push(toSinh(params.w)) // a word tapped in a text
  }

  feature(name: string) { this.features[name] = (this.features[name] ?? 0) + 1 }

  private done() {
    if (this.typing) this.terms.push(this.typing)
    this.typing = null
  }

  /** the counts so far (null: nothing new), cleared */
  take(): Partial<Pick<Tally, 'pages' | 'terms' | 'ops' | 'features' | 'words'>> | null {
    this.done()
    const out = { ...(Object.keys(this.pages).length && { pages: this.pages }), ...(this.terms.length && { terms: this.terms }),
      ...(Object.keys(this.ops).length && { ops: this.ops }), ...(Object.keys(this.features).length && { features: this.features }),
      ...(this.words.length && { words: this.words }) }
    this.pages = {}
    this.terms = []
    this.ops = {}
    this.features = {}
    this.words = []
    return Object.keys(out).length ? out : null
  }
}

let tally: Tally | null = null
/** a feature used without a request to the server (recitation, scans, reading alongside, link, copy, star) */
export function countFeature(name: 'audio' | 'scan' | 'alongside' | 'share' | 'copy' | 'star') { tally?.feature(name) }

/** a person's browser (no crawler user agent) that keeps localStorage: its visits are counted once */
export function isPersonsBrowser(ua: string, storage: Pick<Storage, 'setItem' | 'getItem' | 'removeItem'> | null): boolean {
  if (CRAWLER.test(ua)) return false
  try {
    if (!storage) return false
    storage.setItem('tipitaka.lk-probe', '1')
    const kept = storage.getItem('tipitaka.lk-probe') === '1'
    storage.removeItem('tipitaka.lk-probe')
    return kept
  } catch {
    return false
  }
}

function send(body: unknown) {
  try { navigator.sendBeacon?.(`${import.meta.env.BASE_URL}api/beacon`, JSON.stringify(body)) } catch { /* no beacon */ }
}

/** the website only (App.vue): counts this visit, the router's pages and the app's requests */
export function startStats(router: Router) {
  if (typeof window === 'undefined' || isNativeApp()) return
  const test = !!(window as { __tipitakaStatsTest?: boolean }).__tipitakaStatsTest // e2e: act as a person's browser
  if (navigator.webdriver && !test) return
  let storage: Storage | null = null
  try { storage = window.localStorage } catch { /* blocked */ }
  if (!isPersonsBrowser(test ? '' : navigator.userAgent, storage)) return

  const t = tally = new Tally()
  const data = getData(), source = data.source
  const counted: DataSource = {
    run: (name, params) => { t.op(name, params); return source.run(name, params) },
    op: (op, params) => { t.op(op, params); return source.op(op, params) },
  }
  data.source = counted
  t.route(router.currentRoute.value) // the first page, when the router was ready before this (else it has no name yet)
  router.afterEach((to, from) => t.route(to, from.matched.length ? from : undefined))

  let visited = false
  const today = new Date().toISOString().slice(0, 10)
  const last = loadJson<string>(LAST_VISIT) || ''
  const flags = visitFlags(last, today, !last)
  const interacted = () => {
    if (visited) return
    visited = true
    for (const e of INTERACTIONS) window.removeEventListener(e, interacted, true)
    send({ visit: { ...flags, ...deviceOf(navigator.userAgent, navigator.maxTouchPoints || 0) } })
    saveJson(LAST_VISIT, today)
  }
  for (const e of INTERACTIONS) window.addEventListener(e, interacted, { capture: true, passive: true })
  const flush = () => { const c = t.take(); if (c && visited) send(c) } // no interaction: not counted at all
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
  window.addEventListener('pagehide', flush)
}
