/**
 * The pāḷi script of the page. It is the first part of the url (/thai/dn-1-1) and the base of the router, so the
 * paths of web/src ('/dn-1-1') stay as they are; choosing another script loads the same page under its url.
 * The text is stored in Sinhala script (tipitaka.lk's text.db) and converted on display (@pnfo/pali-converter, the
 * converter of tipitaka.app); Sinhala is shown as tipitaka.lk shows it.
 */
import { convert } from '@pnfo/pali-converter'
import { DEFAULT_SCRIPT, isScriptCode } from '@shared/scripts'

const SCRIPT_KEY = 'open.tipitaka.lk-script-1'

export function urlScript(pathname = location.pathname): string | null {
  const s = pathname.split('/')[1]
  return isScriptCode(s) ? s : null
}
export function savedScript(): string {
  try {
    const s = localStorage.getItem(SCRIPT_KEY) ?? undefined
    return isScriptCode(s) ? s : DEFAULT_SCRIPT
  } catch { return DEFAULT_SCRIPT }
}
/** the path of the current page in a script */
export function pathIn(script: string, loc: Pick<Location, 'pathname' | 'search' | 'hash'> = location): string {
  const rest = urlScript(loc.pathname) ? loc.pathname.slice(5) : loc.pathname
  return `/${script}${rest || '/'}${loc.search}${loc.hash}`
}

/** the script of this page load */
export const script = typeof location === 'undefined' ? DEFAULT_SCRIPT : urlScript() ?? savedScript()

export function switchScript(to: string) {
  if (!isScriptCode(to) || to === script) return
  try { localStorage.setItem(SCRIPT_KEY, to) } catch { /* ignore */ }
  location.assign(pathIn(to))
}
export function rememberScript() {
  try { localStorage.setItem(SCRIPT_KEY, script) } catch { /* ignore */ }
}

const cache = new Map<string, string>()
/** Sinhala script pāḷi in a script */
export function convertTo(text: string, to: string): string {
  if (to === 'sinh' || !text) return text
  const k = to + '\u0000' + text
  const hit = cache.get(k)
  if (hit !== undefined) return hit
  const v = convert(text, to, 'sinh')
  if (cache.size > 20000) cache.clear()
  cache.set(k, v)
  return v
}

/**
 * One run of a paragraph (the text between two markup tokens) in a script. The converter capitalises Roman text at the
 * start of a line and of a sentence; a run is not a line, so the caller says whether its first letter starts one (cap),
 * and learns whether the next run does.
 */
export function convertRun(text: string, to: string, cap: boolean): { text: string; capNext: boolean } {
  if (to !== 'latn') return { text: convertTo(text, to), capNext: false }
  if (!text.trim()) return { text, capNext: cap }
  let v = convertTo('⁠' + text, to).replace('⁠', '') // the mark takes the place of the first letter of the line
  if (cap) v = v.replace(/\S/, c => c.toUpperCase()) // as the converter: the first character, a letter or not
  return { text: v, capNext: /[.?]\s+$|[“‘]$/.test(v) }
}
