/** one footnote: "<number>. <content>" in the script of the page (web/src/components/FootnoteContent.ts; the names of
 * the manuscripts are shown as the footnote has them, without tipitaka.lk's Sinhala descriptions) */
import { defineComponent, h, type VNode } from 'vue'
import { parseFootnote, footnoteTokens, type FnToken } from '@shared/footnote'
import { beautifyText } from '@shared/beautify'
import { useSettings } from '@/stores/settings'

const CLASSES: Record<string, string> = { bold: 'rt-bold', underline: 'rt-underline', strike: 'rt-strike', highlight: 'rt-highlight', editorial: 'rt-editorial' }

export default defineComponent({
  name: 'Footnote',
  props: { text: { type: String, required: true } },
  setup(props) {
    const settings = useSettings()
    return () => {
      const { number, content } = parseFootnote(props.text)
      const render = (tokens: FnToken[]): (VNode | string)[] => tokens.flatMap((tk): (VNode | string)[] => {
        switch (tk.t) {
          case 'text': return [beautifyText(tk.v, 'pali', settings.letterOptions)]
          case 'abbr': return [beautifyText(tk.v, 'pali', settings.letterOptions)]
          case 'br': return [h('br')]
          case 'hr': return [h('hr')]
          case 'fnref': return [`{${tk.v}}`]
          default: return [h('span', { class: CLASSES[tk.t] }, render(tk.c as FnToken[]))]
        }
      })
      return h('span', { class: 'footnote' }, [h('span', { class: 'fn-number text-info pr-1' }, `${number}.`), ...render(footnoteTokens(content, []))])
    }
  },
})
