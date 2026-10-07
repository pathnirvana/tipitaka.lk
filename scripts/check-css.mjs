/** fails when the built CSS uses features the target browsers (old Android WebViews / iOS 12) lack */
import fs from 'node:fs'
import postcss from 'postcss'
import doiuse from 'doiuse'

const browsers = ['chrome >= 53', 'safari >= 10', 'ios >= 10', 'firefox >= 52']
// features that degrade gracefully (cosmetic) and are accepted
const ignore = ['css-touch-action', 'css-overscroll-behavior', 'css-text-indent', 'css-text-align-last', 'css-selection',
  'css-scrollbar', 'text-decoration', 'css-resize', 'css-appearance', 'css-sticky', 'css-unset-value', 'css-initial-value',
  'outline', 'css-font-rendering-controls', 'font-unicode-range', 'css-filters', 'css-nesting', 'css-cascade-layers', 'css-touch-action',
  'css-overflow', 'css-text-orientation', 'css3-tabsize', 'variable-fonts', 'font-family-system-ui', 'extended-system-fonts',
  'css-not-sel-list' /* tailwind space-x uses :not([hidden]) with a single argument */,
  'css-placeholder', 'mdn-text-decoration-shorthand', 'css-focus-within', 'css-focus-visible' /* cosmetic: placeholder colour, underline colour, search box focus border */, 'css-boxdecorationbreak', 'css-backdrop-filter', 'mdn-text-decoration-line', 'mdn-text-decoration-color']
const dir = process.argv[2] || 'web/dist/assets'
const problems = []
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.css'))) {
  const onFeatureUsage = u => {
    const css = String(u.usage)
    if (u.feature === 'css-math-functions' && !/(^|[^x])(min|max|clamp)\(/.test(css.replace(/minmax\(/g, ''))) return // grid minmax() is fine
    if (u.feature === 'css-matches-pseudo' && /:where\(/.test(css) && !/:is\(/.test(css)) return // tailwind preflight :where() rules are dropped harmlessly
    problems.push(`${f}: [${u.feature}] ${u.featureData.title} - ${css.slice(0, 120)}`)
  }
  await postcss([doiuse({ browsers, ignore, onFeatureUsage })])
    .process(fs.readFileSync(`${dir}/${f}`, 'utf-8'), { from: f })
}
// flex gap needs Chrome 84 and doiuse can not see it in utility classes - the source must not use gap-* (use space-x/y-*)
const gapUses = []
const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = `${d}/${f.name}`; if (f.isDirectory()) walk(p); else if (/\.(vue|ts|css)$/.test(f.name)) fs.readFileSync(p, 'utf-8').split('\n').forEach((l, i) => { if (/(^|[\s"'`])gap-[\w[]/.test(l) || /@apply[^;]*\sgap-/.test(l)) gapUses.push(`${p}:${i + 1}: flex gap (use space-x/y-*)`) }) } }
walk('web/src')
problems.push(...gapUses)
const unique = [...new Set(problems.map(p => p.replace(/<css input>:\d+:\d+: /, '')))]
if (unique.length) { console.error(unique.join('\n')); process.exit(1) }
console.log('css ok for', browsers.join(', '))
