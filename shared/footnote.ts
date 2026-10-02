/** Footnote parsing (v2 TextTab.vue processFootnote / bjt Entry.vue). */
import { parseMarkup, type Token } from './markup'

export interface ParsedFootnote { number: string; content: string }

export function parseFootnote(text: string): ParsedFootnote {
  const m = /^([^\s\.\{\}]+)[\.\s]([\s\S]+)$/.exec(text)
  return m ? { number: m[1], content: m[2] } : { number: '', content: '' }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** abbreviations used in a pali footnote: "variant – ABBR, ABBR; variant2 – ABBR" */
export function findAbbreviations(content: string, known: Set<string>): string[] {
  return content.split(';').map(v => v.split('–')).filter(p => p.length > 1)
    .flatMap(p => p[1].split(',')).map(a => a.trim()).filter(a => known.has(a))
}

export type FnToken = Token | { t: 'abbr'; v: string }

/** footnote content tokens with abbreviation tokens split out of the text tokens */
export function footnoteTokens(content: string, abbrs: string[]): FnToken[] {
  const tokens = parseMarkup(content)
  if (!abbrs.length) return tokens
  const re = new RegExp(`(${[...new Set(abbrs)].map(escapeRe).join('|')})`, 'g')
  const split = (tks: Token[]): FnToken[] => tks.flatMap((tk): FnToken[] => {
    if (tk.t === 'text') {
      return tk.v.split(re).filter(Boolean).map((part, i, arr) =>
        abbrs.includes(part) ? { t: 'abbr', v: part } : { t: 'text', v: part })
    }
    if ('c' in tk) return [{ ...tk, c: split(tk.c) as Token[] }]
    return [tk]
  })
  return split(tokens)
}
