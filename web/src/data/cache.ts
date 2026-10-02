import type { QueryParams } from '@shared/queries'

/** must match server/ssr.go cacheKey(): name|JSON(params with sorted keys) */
export function cacheKey(name: string, params: QueryParams): string {
  const sorted: QueryParams = {}
  for (const k of Object.keys(params).sort()) sorted[k] = params[k]
  return `${name}|${JSON.stringify(sorted)}`
}

/** small LRU cache of query results */
export class LruCache<V> {
  private map = new Map<string, V>()
  constructor(private max = 300) {}
  get(k: string): V | undefined {
    const v = this.map.get(k)
    if (v !== undefined) { this.map.delete(k); this.map.set(k, v) }
    return v
  }
  set(k: string, v: V) {
    this.map.delete(k)
    this.map.set(k, v)
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string)
  }
  clear() { this.map.clear() }
}

/** query results embedded by the server in <script id="ssr-data"> (see server/ssr.go) */
export function readSsrData(): Record<string, unknown[]> {
  if (typeof document === 'undefined') return {}
  const el = document.getElementById('ssr-data')
  if (!el?.textContent) return {}
  try { return JSON.parse(el.textContent) } catch { return {} }
}
