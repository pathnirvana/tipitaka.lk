/**
 * Word tokenizer for the Pāḷi↔Sinhala alignments and word-level audio timings (tokenizer "v1").
 * Stored alignments refer to words by their index in tokenize(raw text), so this must stay byte-for-byte stable;
 * the alignment pipeline (DPD-sinhala scripts/align/sections.ts) uses the identical rule.
 *
 *   a word = a run of Sinhala-script letters (with ZWJ), where bold/underline markers inside the run keep it one word
 *            (**ඉසිපතනාරාම**යෙහි is one word), or a run of digits; footnote pointers {n} are not words.
 */
export const TOKENIZER_VERSION = 'v1'
export interface WordTok { t: string; s: number; e: number } // word text (no ZWJ or markup), start/end offsets in the raw text

const WORD = /\{[^}\n]+\}|[඀-෿‍]+(?:(?:\*\*|__)[඀-෿‍]+)*|\d+/g
export function tokenize(raw: string): WordTok[] {
  const out: WordTok[] = []
  for (const m of (raw || '').matchAll(WORD)) {
    if (m[0].startsWith('{')) continue // footnote pointer (same rule as the markup parser)
    if (!m[0].replace(/\u200d/g, '')) continue // a stray ZWJ is not a word
    out.push({ t: m[0].replace(/‍|\*\*|__/g, ''), s: m.index!, e: m.index! + m[0].length })
  }
  return out
}

/** splits one rendered text run into [non-word, word, non-word, …]; odd indexes are words (Sinhala-script runs or digit runs) */
export const WORD_SPLIT = /([඀-෿‍]*[඀-෿][඀-෿‍]*|\d+)/ // at least one letter: a lone ZWJ is not a word

/** comparison form: rendering may add ZWJ/ZWNJ (bandi letters) and write ේ/ෝ as ෙ/ො */
const norm = (w: string) => w.replace(/[‌‍]/g, '').replace(/ේ/g, 'ෙ').replace(/ෝ/g, 'ො')

/**
 * Gives each rendered word piece its token index, walking the pieces in reading order.
 * Markup can split a token into several pieces (bold half-words, search highlights); they all get the same index.
 * Returns -1 when a piece does not continue the expected token (the caller then renders it without an index).
 */
export class WordIndexer {
  private toks: string[]
  private k = 0
  private used = 0 // characters of toks[k] already matched
  constructor(raw: string) { this.toks = tokenize(raw).map(t => norm(t.t)) }
  next(piece: string): number {
    const p = norm(piece)
    if (!p) return -1
    // a piece may start a new token after an unfinished one (e.g. a token split by ~~ in the renderer only)
    for (let tries = 0; tries < 2 && this.k < this.toks.length; tries++) {
      const rest = this.toks[this.k].slice(this.used)
      if (rest.startsWith(p)) {
        const idx = this.k
        this.used += p.length
        if (this.used >= this.toks[this.k].length) { this.k++; this.used = 0 }
        return idx
      }
      if (this.used === 0) break
      this.k++; this.used = 0
    }
    return -1
  }
  /** true when every token was matched by a piece (used by tests) */
  get complete() { return this.k >= this.toks.length }
}
