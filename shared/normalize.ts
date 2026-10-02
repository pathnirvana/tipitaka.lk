/**
 * Text normalisation for full text search. The SAME function is used when building the FTS index
 * (build/) and for the user's query terms (web/), so they always agree.
 */
const ZWJ = '‍', ZWNJ = '‌'
const REMOVED = new Set(['*', '_', '~', '$', ZWJ, ZWNJ]) // removed without leaving a space
const WORD_CHAR = /[඀-෿a-z0-9]/

export interface WordPos { w: string; start: number; end: number } // [start, end) offsets in the raw text

/** split raw (markup) text into normalised words keeping their raw offsets */
export function extractWords(raw: string): WordPos[] {
  const words: WordPos[] = []
  let cur = '', curStart = -1, curEnd = -1
  const push = () => { if (cur) words.push({ w: cur, start: curStart, end: curEnd }); cur = ''; curStart = -1 }
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (c === '{') { // footnote pointer {1} {*} {a} - removed without a space
      const close = raw.indexOf('}', i + 1)
      if (close > i && close - i - 1 <= 4) { i = close; continue }
    }
    if (REMOVED.has(c)) continue
    const lc = c.toLowerCase()
    if (WORD_CHAR.test(lc)) {
      if (curStart < 0) curStart = i
      cur += lc
      curEnd = i + 1
    } else push()
  }
  push()
  return words
}

export function normalizeForSearch(raw: string): string {
  return extractWords(raw).map(w => w.w).join(' ')
}

/** for title search: names are compared without zwj/zwnj (fixes v2 bug where the query had zwj stripped but names not) */
export function normalizeTitle(text: string): string {
  return text.replace(/[‌‍]/g, '').toLowerCase()
}
