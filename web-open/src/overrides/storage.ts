/** replaces web/src/composables/storage.ts (vite.config.ts OVERRIDES): the same helpers, under open.tipitaka.lk's own keys */
const KEYS: Record<string, string> = { 'tipitaka.lk-settings-2': 'open.tipitaka.lk-settings-1' }
export const storageKey = (key: string) => KEYS[key] ?? key.replace(/^tipitaka\.lk-/, 'open.tipitaka.lk-')

export function loadJson<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(storageKey(key))
    return s ? (JSON.parse(s) as T) : null
  } catch { return null }
}
export function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(storageKey(key), JSON.stringify(value)) } catch { /* ignore */ }
}
