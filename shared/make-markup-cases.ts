/** Generates shared/markup-cases.json (golden vectors shared by TS and Go tests). Run: npx tsx shared/make-markup-cases.ts */
import fs from 'node:fs'
import { parseMarkup, tokensToHtml } from './markup'

const manual = [
  'plain text', '**bold**', 'a **b** c', '__u__', '~~s~~', '$$editorial$$', '##hl##', 'line1\nline2', 'a↴b',
  'word{1} next', '{*}', '{a}', '**bold{1}**', '**a\nb**', '**unbalanced', 'a ** b', '****', 'x|y℗z', '<hr/>', 'a<hr />b',
  'stray </b> tag', '<b>x</b>', '&gt; &lt; &amp; &quot;', '<script>alert(1)</script>', '{}', '{x\ny}', '**a __b__ c**',
  '$$**මාතිකා**$$', '**[සාවත්ථිනිදානං]**', 'උබ්බිලාවිතත්තං{1} කරණීයං.', '1. එවං මෙ සුතං', '"quoted" & <tag>',
  '**a** **b**', '__**x**__', 'a\n\nb', '\tx', 'ස්‍රී', '{එම}', '{12}x', '~~a~~ __b__ **c** $$d$$ ##e##',
]
const corpus = ['dn-1', 'atta-sn-5', 'ap-kvu-8', 'atta-kn-dhp-19', 'vp-cv-5', 'atta-mn-1', 'anya-vm-12'].flatMap(f => {
  const d = JSON.parse(fs.readFileSync(`public/static/text/${f}.json`, 'utf-8'))
  const all = d.pages.flatMap((p: any) => [...p.pali.entries, ...p.sinh.entries, ...p.pali.footnotes]).map((e: any) => e.text as string)
  const tricky = all.filter(t => /[<&|]|\*\*[^*]*\n|\{[^}]{2,}\}/.test(t)).slice(0, 4)
  return [...tricky, all[3], all[10]].filter(Boolean)
})
const cases = [...new Set([...manual, ...corpus])].map(input => ({ input, html: tokensToHtml(parseMarkup(input)) }))
fs.writeFileSync('shared/markup-cases.json', JSON.stringify(cases, null, 1))
console.log(cases.length, 'cases')
