/**
 * Creates the small e2e/test corpus in e2e/fixtures/text from the real text files (pages truncated).
 * Run: npx tsx e2e/fixtures/make-fixtures.ts   (re-run only when the fixture set should change)
 */
import fs from 'node:fs'

const src = 'public/static/text', out = 'e2e/fixtures/text'
// file -> number of pages to keep (0 = all)
const files: Record<string, number> = {
  'dn-1': 30, 'an-1': 20, 'an-10': 20, 'kn-khp': 0, 'kn-dhp': 25, 'kn-thig': 20, 'ap-pat': 12,
  'atta-dn-1': 20, 'ap-kvu': 4, 'ap-kvu-8': 0, 'vp-prj': 6,
}
fs.mkdirSync(out, { recursive: true })
for (const [f, n] of Object.entries(files)) {
  const d = JSON.parse(fs.readFileSync(`${src}/${f}.json`, 'utf-8'))
  let pages = d.pages
  if (f === 'ap-kvu-8') { // keep up to the page with the <hr/>
    const hr = pages.findIndex((p: any) => JSON.stringify(p).includes('<hr/>'))
    pages = pages.slice(0, hr + 2)
  } else if (n) pages = pages.slice(0, n)
  fs.writeFileSync(`${out}/${f}.json`, JSON.stringify({ ...d, pages }, null, 4))
  console.log(f, pages.length, 'pages')
}
