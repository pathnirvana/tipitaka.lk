/** one footnote: "<number>. <content>" with abbreviation links in pali footnotes (v2 Footnote.vue) */
import { defineComponent, h, type PropType, type VNode } from 'vue'
import { parseFootnote, findAbbreviations, footnoteTokens, type FnToken } from '@shared/footnote'
import { beautifyText } from '@shared/beautify'
import { useSettings } from '@/stores/settings'
import { useAbbreviations } from '@/stores/abbreviations'

const CLASSES: Record<string, string> = { bold: 'rt-bold', underline: 'rt-underline', strike: 'rt-strike', highlight: 'rt-highlight', editorial: 'rt-editorial' }

export default defineComponent({
  name: 'FootnoteContent',
  props: {
    text: { type: String, required: true },
    lang: { type: String as PropType<'pali' | 'sinh'>, required: true },
  },
  setup(props) {
    const settings = useSettings(), abbr = useAbbreviations()
    return () => {
      const { number, content } = parseFootnote(props.text)
      const abbrs = props.lang === 'pali' && content ? findAbbreviations(content, abbr.keys) : []
      const render = (tokens: FnToken[]): (VNode | string)[] => tokens.flatMap((tk): (VNode | string)[] => {
        switch (tk.t) {
          case 'text': return [beautifyText(tk.v, props.lang, settings.letterOptions)]
          case 'abbr': return [h('span', { class: 'fn-abbr', 'data-abbr': tk.v, title: abbr.describe(tk.v) }, tk.v)]
          case 'br': return [h('br')]
          case 'hr': return [h('hr')]
          case 'fnref': return [`{${tk.v}}`]
          default: return [h('span', { class: CLASSES[tk.t] }, render(tk.c as FnToken[]))]
        }
      })
      return h('span', { class: 'footnote' }, [h('span', { class: 'fn-number text-info pr-1' }, `${number}.`), ...render(footnoteTokens(content, abbrs))])
    }
  },
})
