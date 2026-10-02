/** search hit highlighting and snippets built from the raw text (the FTS index is contentless) */
import { extractWords } from './normalize'
import { termMatches, type FtsTerm } from './fts-query'
import { parseMarkup, tokensToPlain } from './markup'

/** wraps words matching the terms with ##..## (rendered as highlight by parseMarkup) */
export function markTerms(raw: string, terms: FtsTerm[]): string {
  if (!terms.length) return raw
  const hits = extractWords(raw).filter(w => termMatches(w.w, terms) && !/[*_~$#]/.test(raw.slice(w.start, w.end)))
  let out = raw
  for (let i = hits.length - 1; i >= 0; i--) {
    const { start, end } = hits[i]
    out = out.slice(0, start) + '##' + out.slice(start, end) + '##' + out.slice(end)
  }
  return out
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * snippet html around the first hit, in the v2 bookmark format: hits in <sr>..</sr>, cut points as <b>…</b>
 * numMatches is the number of words matching the terms
 */
export function buildSnippet(raw: string, terms: FtsTerm[], maxWords = 40): { html: string; numMatches: number; words: string[] } {
  const plain = tokensToPlain(parseMarkup(raw)).replace(/\n/g, ' ')
  const words = extractWords(plain)
  const hitIdx = words.map((w, i) => (termMatches(w.w, terms) ? i : -1)).filter(i => i >= 0)
  const first = hitIdx.length ? hitIdx[0] : 0
  const from = Math.max(0, first - Math.floor(maxWords / 3)), to = Math.min(words.length, from + maxWords)
  const start = from > 0 ? words[from].start : 0, end = to < words.length ? words[to - 1].end : plain.length
  const hitSet = new Set(hitIdx.filter(i => i >= from && i < to))
  let html = from > 0 ? '<b>…</b>' : ''
  let pos = start
  for (let i = from; i < to; i++) {
    if (!hitSet.has(i)) continue
    html += esc(plain.slice(pos, words[i].start)) + '<sr>' + esc(plain.slice(words[i].start, words[i].end)) + '</sr>'
    pos = words[i].end
  }
  html += esc(plain.slice(pos, end)) + (to < words.length ? '<b>…</b>' : '')
  const matched = [...new Set(hitIdx.map(i => plain.slice(words[i].start, words[i].end)))]
  return { html, numMatches: hitIdx.length, words: matched }
}
