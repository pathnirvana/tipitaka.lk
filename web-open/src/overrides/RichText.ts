/**
 * replaces web/src/components/RichText.ts (vite.config.ts OVERRIDES): the BJT markup as VNodes with the text in the
 * script of the page. The markup is parsed and the words are counted on the stored Sinhala text (footnote pointers,
 * search highlights and the word indexes of the audio timings refer to it), then each run is converted.
 */
import { defineComponent, h, type PropType, type VNode } from 'vue'
import { parseMarkup, type Token } from '@shared/markup'
import { markTerms } from '@shared/highlight'
import { beautifyText } from '@shared/beautify'
import type { FtsHighlight } from '@shared/fts-query'
import { WordIndexer, WORD_SPLIT } from '@shared/tokenize'
import { useSettings } from '@/stores/settings'
import { script, convertRun } from '../script'

const CLASSES: Record<string, string> = { bold: 'rt-bold', underline: 'rt-underline', strike: 'rt-strike', highlight: 'rt-highlight', editorial: 'rt-editorial' }

export default defineComponent({
  name: 'RichText',
  props: {
    text: { type: String, required: true },
    lang: { type: String as PropType<'pali' | 'sinh'>, required: true },
    terms: { type: Object as PropType<FtsHighlight | null>, default: null },
    wrapWords: { type: Boolean, default: false }, // tipitaka.lk's dictionary: not here
    hideFootnotes: { type: Boolean, default: false },
    /** wrap every word with data-w = its index in shared/tokenize (the word being chanted) */
    indexWords: { type: Boolean, default: false },
    glossWords: { type: Map as PropType<Map<number, { g: string; cls: string }> | null>, default: null },
  },
  setup(props) {
    const settings = useSettings()
    return () => {
      const raw = props.terms?.terms.length ? markTerms(props.text, props.terms) : props.text
      const indexer = props.indexWords ? new WordIndexer(props.text) : null
      let cap = true // Roman: the next letter starts the paragraph or a sentence
      const conv = (v: string): string => {
        if (script === 'sinh' || props.lang !== 'pali') return beautifyText(v, props.lang, settings.letterOptions)
        const r = convertRun(v, script, cap)
        cap = r.capNext
        return r.text
      }
      const renderText = (v: string): (VNode | string)[] => {
        if (!indexer) return [conv(v)]
        // [non-word, word, non-word, ...] of the Sinhala text: the words keep their index, each piece is converted
        return v.split(WORD_SPLIT).map((part, i) => {
          if (!(i % 2)) return part && conv(part)
          const w = indexer.next(part)
          return h('span', { class: /^\d+$/.test(part) ? 'wn' : 'w', ...(w >= 0 ? { 'data-w': w } : {}) }, conv(part))
        }).filter(p => p !== '')
      }
      const render = (tokens: Token[]): (VNode | string)[] => tokens.flatMap((tk): (VNode | string)[] => {
        switch (tk.t) {
          case 'text': return renderText(tk.v)
          case 'br': cap = true; return [h('br')]
          case 'hr': return [h('hr')]
          case 'fnref': return props.hideFootnotes ? [] : [h('span', { class: 'fn-pointer', 'data-fn': tk.v }, tk.v)]
          default: return [h('span', { class: CLASSES[tk.t] }, render(tk.c))]
        }
      })
      return render(parseMarkup(raw))
    }
  },
})
