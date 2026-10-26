/**
 * DataSource: runs the named queries of server/engine/queries.sql and the operations of the Go engine (server/engine).
 *  - HttpSource: GET/POST /api/q/<name> and /api/<op> on the Go server (website, desktop app)
 *  - NativeSource: the engine compiled into the Android / iOS app (gomobile), reached through the native bridge
 *    (dev-docs/native-bridge.md; tipitaka.app's): the same JSON answers
 */
import sqlText from '../../../server/engine/queries.sql?raw'
import { parseQueries, validateParams, type QueryParams } from '@shared/queries'
import { cacheKey, LruCache, readSsrData } from './cache'

export const QUERIES = parseQueries(sqlText)
export type QueryName = string

export class QueryError extends Error {
  constructor(message: string, public code: 'fts_syntax' | 'network' | 'bad_request' | 'timeout' | 'server' | 'not_ready') { super(message) }
}

export type OpParams = Record<string, string | number | boolean>

export interface DataSource {
  run<T>(name: QueryName, params: QueryParams): Promise<T[]>
  /** an engine operation (/api/<op>) */
  op<T>(op: string, params: OpParams): Promise<T>
}

/** an error answer of the server: {"error": "..."} or {"error": code, "message": ...} */
async function httpError(res: Response): Promise<QueryError> {
  let msg = `HTTP ${res.status}`
  try { msg = (await res.json()).error || msg } catch { /* not json */ }
  if (msg === 'fts_syntax') return new QueryError(msg, 'fts_syntax')
  return new QueryError(msg, res.status === 503 ? 'timeout' : res.status === 400 ? 'bad_request' : 'server')
}

export class HttpSource implements DataSource {
  /** apiHash: the cache key of the queries (the data); opsHash: of the engine ops (the data and the engine's version) */
  constructor(private apiHash: () => string, private fetchImpl: typeof fetch = (...a) => fetch(...a), private opsHash: () => string = apiHash) {}
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
    if (!res.ok) throw await httpError(res)
    return (await res.json()) as T[]
  }
  async op<T>(op: string, params: OpParams): Promise<T> {
    const qs = new URLSearchParams()
    for (const k of Object.keys(params).sort()) qs.set(k, String(params[k])) // sorted: one url (http cache) per request
    const hash = this.opsHash()
    if (hash) qs.set('v', hash)
    let url = `${import.meta.env.BASE_URL}api/${op}?${qs}`
    let init: RequestInit | undefined
    if (url.length > 1800) {
      url = `${import.meta.env.BASE_URL}api/${op}`
      init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }
    }
    let res: Response
    try { res = await this.fetchImpl(url, init) } catch (e) { throw new QueryError(`network error: ${(e as Error).message}`, 'network') }
    if (!res.ok) throw await httpError(res)
    return (await res.json()) as T
  }
}

// ---------------- Android / iOS bridge ----------------
/** the apps' bridge: requests are answered asynchronously by window.__tipitakaResolve(id, response) */
export class NativeSource implements DataSource {
  private pending = new Map<string, (r: string) => void>()
  private seq = 0
  constructor(private send: (id: string, request: string) => void) {
    window.__tipitakaResolve = (id, response) => {
      const fn = this.pending.get(id)
      this.pending.delete(id)
      fn?.(response)
    }
  }
  private call<T>(request: Record<string, unknown>): Promise<T> {
    const id = `q${++this.seq}`
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, raw => {
        let r: { ok?: T; error?: string; message?: string }
        try { r = JSON.parse(raw) } catch { return reject(new QueryError('invalid response', 'server')) }
        if (!r.error) return resolve(r.ok as T)
        const code = r.error === 'fts_syntax' || r.error === 'timeout' || r.error === 'bad_request' ? r.error : 'server'
        reject(new QueryError(code === 'fts_syntax' ? 'fts_syntax' : r.message ?? r.error, code))
      })
      try { this.send(id, JSON.stringify(request)) } catch (e) { this.pending.delete(id); reject(new QueryError(String(e), 'server')) }
    })
  }
  run<T>(name: string, params: QueryParams): Promise<T[]> { return this.call<T[]>({ query: name, ...params }) }
  op<T>(op: string, params: OpParams): Promise<T> { return this.call<T>({ op, ...params }) }
}

/** the native bridge of the apps: Android's @JavascriptInterface, iOS's message handler */
export function nativeSender(): ((id: string, request: string) => void) | null {
  if (typeof window === 'undefined') return null
  if (window.TipitakaNative) return (id, request) => window.TipitakaNative!.query(id, request)
  const ios = window.webkit?.messageHandlers?.tipitaka
  if (ios) return (id, request) => ios.postMessage({ id, request })
  return null
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
  private opCache = new LruCache<unknown>(300)
  private opInflight = new Map<string, Promise<unknown>>()
  /** an engine operation, cached like the queries */
  async op<T>(op: string, params: OpParams = {}): Promise<T> {
    const key = op + '|' + JSON.stringify(Object.keys(params).sort().map(k => [k, params[k]]))
    const hit = this.opCache.get(key)
    if (hit !== undefined) return hit as T
    let p = this.opInflight.get(key)
    if (!p) {
      p = this.source.op<unknown>(op, params).then(r => { this.opCache.set(key, r); return r })
        .finally(() => this.opInflight.delete(key))
      this.opInflight.set(key, p)
    }
    return p as Promise<T>
  }
}

export const isNativeApp = () => __IS_APP__ || nativeSender() !== null

function apiHashFromPage() {
  return document.querySelector('meta[name="tipitaka-api"]')?.getAttribute('content') || __BUILD_INFO__.api_hash || ''
}
/** the ops' cache key (server: opsHash); a page without it asks without one (cached for a while only) */
const opsHashFromPage = () => document.querySelector('meta[name="tipitaka-ops"]')?.getAttribute('content') || ''

let data: Data | null = null

export function getData(): Data {
  if (!data) {
    const send = nativeSender()
    const source = send ? new NativeSource(send) : new HttpSource(apiHashFromPage, undefined, opsHashFromPage)
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
