import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { tokenize, WordIndexer, WORD_SPLIT } from './tokenize'
import { parseMarkup, type Token } from './markup'
import { beautifyText } from './beautify'

/** the same traversal RichText does: text runs in reading order, beautified, split into words */
function renderedIndexes(raw: string, lang: 'pali' | 'sinh', opts: { bandiLetters: boolean; specialLetters: boolean }) {
  const ix = new WordIndexer(raw), out: { piece: string; w: number }[] = []
  const walk = (tokens: Token[]) => {
    for (const tk of tokens) {
      if (tk.t === 'text') beautifyText(tk.v, lang, opts).split(WORD_SPLIT).forEach((part, i) => { if (i % 2) out.push({ piece: part, w: ix.next(part) }) })
      else if ('c' in tk) walk(tk.c)
    }
  }
  walk(parseMarkup(raw))
  return { out, complete: ix.complete }
}

describe('tokenize (v1)', () => {
  it('keeps a word whole across bold/underline markup, counts digits, skips footnote pointers', () => {
    expect(tokenize('3853. **බාරාණසියං** විහරති **ඉසිපතනාරාම**යෙහි{1}').map(t => t.t))
      .toEqual(['3853', 'බාරාණසියං', 'විහරති', 'ඉසිපතනාරාමයෙහි'])
  })
  it('gives offsets into the raw text', () => {
    const raw = 'අ **බ**ක', t = tokenize(raw)
    expect(t.map(x => raw.slice(x.s, x.e))).toEqual(['අ', 'බ**ක']) // a word starts at its first letter; inner markers are part of it
  })
})

describe('rendered words carry their token index', () => {
  it('bold-split words get one index on both pieces', () => {
    const { out, complete } = renderedIndexes('**ඉසිපතනාරාම**යෙහි වසති', 'sinh', { bandiLetters: false, specialLetters: false })
    expect(out.map(o => o.w)).toEqual([0, 0, 1])
    expect(complete).toBe(true)
  })
  it('matches every word of real BJT pages, with all letter settings', () => {
    let pieces = 0, unmatched = 0, entries = 0
    // FULL=1 checks every book (npm run test:full); the default run samples four books from different collections
    const files = process.env.FULL ? fs.readdirSync('public/static/text').filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)) : ['dn-1', 'kn-snp', 'ap-vbh', 'vp-prj']
    for (const f of files) {
      const j = JSON.parse(fs.readFileSync(`public/static/text/${f}.json`, 'utf-8'))
      for (const page of process.env.FULL ? j.pages : j.pages.slice(0, 40)) for (const lang of ['pali', 'sinh'] as const) for (const e of page[lang].entries) {
        for (const opts of [{ bandiLetters: true, specialLetters: true }, { bandiLetters: false, specialLetters: false }]) {
          const { out, complete } = renderedIndexes(e.text, lang, opts)
          pieces += out.length; unmatched += out.filter(o => o.w < 0).length; entries++
          expect(complete, `${f} ${lang}: ${e.text.slice(0, 80)}`).toBe(true)
        }
      }
    }
    expect(entries).toBeGreaterThan(1000)
    expect(unmatched, `${unmatched} of ${pieces} pieces unmatched`).toBe(0)
  })
})
