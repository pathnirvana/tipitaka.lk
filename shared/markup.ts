/**
 * Parser for the inline markup used in the BJT text JSON files.
 *   **bold**  __underline__  ~~strike~~  $$editorial$$  {fn}  \n or ↴ (line break)  <hr/>
 *   ##highlight## is only inserted at runtime (search hits).
 * Unlike the v2 regex renderer this supports nesting, markers spanning new lines, and never treats
 * text as HTML (`|`, `℗`, `<`, `&` are plain text; `&gt; &lt; &amp;` are decoded; `<b>`/`</b>` dropped).
 * Unbalanced markers are rendered literally.
 */
export type ContainerKind = 'bold' | 'underline' | 'strike' | 'highlight' | 'editorial'
export type Token =
  | { t: 'text'; v: string }
  | { t: 'br' }
  | { t: 'hr' }
  | { t: 'fnref'; v: string }
  | { t: ContainerKind; c: Token[] }

const PAIRS: Record<string, ContainerKind> = { '**': 'bold', __: 'underline', '~~': 'strike', '##': 'highlight', $$: 'editorial' }
const ENTITIES: Record<string, string> = { '&gt;': '>', '&lt;': '<', '&amp;': '&' }

function parseRange(s: string, start: number, end: number): Token[] {
  const tokens: Token[] = []
  let buf = ''
  const flush = () => { if (buf) { tokens.push({ t: 'text', v: buf }); buf = '' } }
  let i = start
  while (i < end) {
    const two = s.substr(i, 2)
    const kind = PAIRS[two]
    if (kind) {
      const close = s.indexOf(two, i + 2)
      if (close >= 0 && close + 2 <= end) {
        flush()
        tokens.push({ t: kind, c: parseRange(s, i + 2, close) })
        i = close + 2
      } else {
        buf += two // unbalanced - literal
        i += 2
      }
      continue
    }
    const ch = s[i]
    if (ch === '{') {
      const close = s.indexOf('}', i + 1)
      if (close > i + 1 && close < end && !s.slice(i + 1, close).includes('\n')) {
        flush()
        tokens.push({ t: 'fnref', v: s.slice(i + 1, close) })
        i = close + 1
        continue
      }
    } else if (ch === '\n' || ch === '↴') {
      flush()
      tokens.push({ t: 'br' })
      i++
      continue
    } else if (ch === '<') {
      const m = /^<(\/?)(hr|b)\s*\/?>/i.exec(s.slice(i, Math.min(end, i + 8)))
      if (m) {
        if (m[2].toLowerCase() === 'hr') { flush(); tokens.push({ t: 'hr' }) }
        i += m[0].length // <b> and </b> are dropped
        continue
      }
    } else if (ch === '&') {
      const ent = s.slice(i, i + 5).match(/^&(gt|lt|amp);/)
      if (ent) { buf += ENTITIES[ent[0]]; i += ent[0].length; continue }
    }
    buf += ch
    i++
  }
  flush()
  return tokens
}

export function parseMarkup(text: string): Token[] {
  return parseRange(text || '', 0, (text || '').length)
}

/** plain text (no markup, no footnote refs, line breaks as \n) */
export function tokensToPlain(tokens: Token[], { keepFnRefs = false } = {}): string {
  let out = ''
  for (const tk of tokens) {
    if (tk.t === 'text') out += tk.v
    else if (tk.t === 'br') out += '\n'
    else if (tk.t === 'fnref') { if (keepFnRefs) out += `{${tk.v}}` }
    else if (tk.t === 'hr') out += '\n'
    else out += tokensToPlain(tk.c, { keepFnRefs })
  }
  return out
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const TAGS: Record<ContainerKind, [string, string]> = {
  bold: ['<b>', '</b>'], underline: ['<u>', '</u>'], strike: ['<s>', '</s>'],
  highlight: ['<mark>', '</mark>'], editorial: ['<span class="editorial">', '</span>'],
}
/**
 * Canonical HTML rendering. Used by tests and must match server/markup.go exactly
 * (shared/markup-cases.json holds the golden vectors for both).
 */
export function tokensToHtml(tokens: Token[], { hideFnRefs = false } = {}): string {
  let out = ''
  for (const tk of tokens) {
    if (tk.t === 'text') out += escapeHtml(tk.v)
    else if (tk.t === 'br') out += '<br>'
    else if (tk.t === 'hr') out += '<hr>'
    else if (tk.t === 'fnref') { if (!hideFnRefs) out += `<sup class="fn">${escapeHtml(tk.v)}</sup>` }
    else out += TAGS[tk.t][0] + tokensToHtml(tk.c, { hideFnRefs }) + TAGS[tk.t][1]
  }
  return out
}

/** v2 "copy paragraph" behaviour: remove bold, underline and footnote pointers (TextEntry.vue contentToCopy) */
export const stripForCopy = (text: string) => text.replace(/\*\*|__|\{\S+?\}/g, '')
