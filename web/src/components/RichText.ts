/**
 * Renders BJT markup tokens as VNodes (never v-html). Text is beautified (bandi letters) per the settings.
 * Pali words are wrapped in <span class="w"> for the inline dictionary when wrapWords is set.
 */
import { defineComponent, h, type PropType, type VNode } from 'vue'
import { parseMarkup, type Token } from '@shared/markup'
import { markTerms } from '@shared/highlight'
import { beautifyText } from '@shared/beautify'
import type { FtsTerm } from '@shared/fts-query'
import { useSettings } from '@/stores/settings'

const CLASSES: Record<string, string> = { bold: 'rt-bold', underline: 'rt-underline', strike: 'rt-strike', highlight: 'rt-highlight', editorial: 'rt-editorial' }
const WORD_RE = /([඀-෿‍]+)/

export default defineComponent({
  name: 'RichText',
  props: {
    text: { type: String, required: true },
    lang: { type: String as PropType<'pali' | 'sinh'>, required: true },
    terms: { type: Array as PropType<FtsTerm[] | null>, default: null },
    wrapWords: { type: Boolean, default: false },
    hideFootnotes: { type: Boolean, default: false },
  },
  setup(props) {
    const settings = useSettings()
    return () => {
      const raw = props.terms?.length ? markTerms(props.text, props.terms) : props.text
      const opts = settings.letterOptions
      const renderText = (v: string): (VNode | string)[] => {
        const t = beautifyText(v, props.lang, opts)
        if (!props.wrapWords) return [t]
        // split() with a capture group alternates [non-word, word, non-word, ...] so odd indexes are words
        return t.split(WORD_RE).map((part, i) => (i % 2 ? h('span', { class: 'w' }, part) : part)).filter(p => p !== '')
      }
      const render = (tokens: Token[]): (VNode | string)[] => tokens.flatMap((tk): (VNode | string)[] => {
        switch (tk.t) {
          case 'text': return renderText(tk.v)
          case 'br': return [h('br')]
          case 'hr': return [h('hr')]
          case 'fnref': return props.hideFootnotes ? [] : [h('span', { class: 'fn-pointer', 'data-fn': tk.v }, tk.v)]
          default: return [h('span', { class: CLASSES[tk.t] }, render(tk.c))]
        }
      })
      return render(parseMarkup(raw))
    }
  },
})
