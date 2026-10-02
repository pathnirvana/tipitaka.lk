/**
 * DataSource: runs the named queries of server/queries.sql.
 *  - HttpSource: GET/POST /api/q/<name> on the Go server (website, desktop app)
 *  - AndroidSource: the offline apps' JS bridge (window.Android.runSqliteQuery) with params inlined as literals
 */
import sqlText from '../../../server/queries.sql?raw'
import { parseQueries, renderSql, validateParams, type QueryParams } from '@shared/queries'
import { cacheKey, LruCache, readSsrData } from './cache'

export const QUERIES = parseQueries(sqlText)
export type QueryName = string

export class QueryError extends Error {
  constructor(message: string, public code: 'fts_syntax' | 'network' | 'bad_request' | 'timeout' | 'server' | 'not_ready') { super(message) }
}

export interface DataSource {
  run<T>(name: QueryName, params: QueryParams): Promise<T[]>
}

export class HttpSource implements DataSource {
  constructor(private apiHash: () => string, private fetchImpl: typeof fetch = (...a) => fetch(...a)) {}
  async run<T>(name: string, params: QueryParams): Promise<T[]> {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) qs.set(k, String(v))
    const hash = this.apiHash()
    if (hash) qs.set('v', hash)
    let url = `${import.meta.env.BASE_URL}api/q/${name}?${qs}`
    let init: RequestInit | undefined
    if (url.length > 1800) {
      url = `${import.meta.env.BASE_URL}api/q/${name}`
      init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }
    }
    let res: Response
    try { res = await this.fetchImpl(url, init) } catch (e) { throw new QueryError(`network error: ${(e as Error).message}`, 'network') }
    if (!res.ok) {
      let msg = `HTTP ${res.status}`
      try { msg = (await res.json()).error || msg } catch { /* not json */ }
      if (msg === 'fts_syntax') throw new QueryError(msg, 'fts_syntax')
      throw new QueryError(msg, res.status === 503 ? 'timeout' : res.status === 400 ? 'bad_request' : 'server')
    }
    return (await res.json()) as T[]
  }
}

// ---------------- Android / iOS bridge ----------------
let asyncCounter = 0
/** port of v2 callAndroidAsync - the resolvers are installed BEFORE calling native (fixes a race in v2) */
export function callAndroidAsync(funcName: string, params: unknown): Promise<string> {
  const bridge = window.Android
  if (!bridge) return Promise.reject(new QueryError('native bridge not available', 'not_ready'))
  const rand = `asyncJava_${Date.now() % 1000000}${asyncCounter++}` as `asyncJava_${number}`
  return new Promise((resolve, reject) => {
    window[rand] = {
      resolve, reject,
      callback: (isSuccess: boolean) => {
        const dataOrErr = bridge.runAsyncResult(rand)
        delete window[rand]
        if (isSuccess) resolve(dataOrErr)
        else reject(new Error(dataOrErr))
      },
    }
    bridge.runAsync(rand, funcName, JSON.stringify(params))
  })
}

export class AndroidSource implements DataSource {
  private ready: Promise<void> | null = null
  constructor(private dbVersions: Record<string, number>, private onBusy: (busy: boolean) => void = () => {}) {}
  open(): Promise<void> {
    if (!this.ready) {
      this.onBusy(true)
      this.ready = callAndroidAsync('openDbs', this.dbVersions).then(() => undefined)
        .finally(() => this.onBusy(false))
      this.ready.catch(() => { this.ready = null }) // allow a retry
    }
    return this.ready
  }
  async run<T>(name: string, params: QueryParams): Promise<T[]> {
    await this.open() // every query waits for the db copy (native throws before openDbs completes)
    const q = QUERIES.get(name)!
    try {
      const json = await callAndroidAsync('runSqliteQuery', { type: q.db, sql: renderSql(q, params) })
      return JSON.parse(json) as T[]
    } catch (e) {
      const msg = String((e as Error).message || e)
      if (/malformed MATCH|fts/i.test(msg)) throw new QueryError('fts_syntax', 'fts_syntax')
      throw new QueryError(msg, 'server')
    }
  }
}

// ---------------- cached front door used by the app ----------------
export class Data {
  private cache = new LruCache<unknown[]>(400)
  private inflight = new Map<string, Promise<unknown[]>>()
  constructor(public source: DataSource, prefill: Record<string, unknown[]> = {}) {
    for (const [k, v] of Object.entries(prefill)) this.cache.set(k, v)
  }
  async query<T>(name: QueryName, params: QueryParams = {}): Promise<T[]> {
    const q = QUERIES.get(name)
    if (!q) throw new QueryError(`unknown query ${name}`, 'bad_request')
    const err = validateParams(q, params)
    if (err) throw new QueryError(`${name}: ${err}`, 'bad_request')
    const key = cacheKey(name, params)
    const hit = this.cache.get(key)
    if (hit) return hit as T[]
    let p = this.inflight.get(key)
    if (!p) {
      p = this.source.run<unknown>(name, params).then(rows => { this.cache.set(key, rows); return rows })
        .finally(() => this.inflight.delete(key))
      this.inflight.set(key, p)
    }
    return p as Promise<T[]>
  }
}

export const isNativeApp = () => __IS_APP__ || typeof window.Android !== 'undefined'

function apiHashFromPage() {
  return document.querySelector('meta[name="tipitaka-api"]')?.getAttribute('content') || __BUILD_INFO__.api_hash || ''
}

let data: Data | null = null
let busyListener: (busy: boolean) => void = () => {}
export const onNativeBusy = (fn: (busy: boolean) => void) => { busyListener = fn }

export function getData(): Data {
  if (!data) {
    const source = isNativeApp()
      ? new AndroidSource({ text: __BUILD_INFO__.db_version, dict: 2 }, b => busyListener(b))
      : new HttpSource(apiHashFromPage)
    data = new Data(source, readSsrData())
  }
  return data
}
export const setData = (d: Data) => { data = d } // tests

/** static json files (works on file:// in the WebView where fetch does not) */
export function getStatic<T>(path: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.onload = () => { try { resolve(JSON.parse(xhr.responseText)) } catch (e) { reject(e) } }
    xhr.onerror = () => reject(new Error(`Request to file ${path} failed`))
    xhr.open('GET', import.meta.env.BASE_URL + path)
    xhr.send(null)
  })
}
