/**
 * Captures golden outputs from the LEGACY (v2) system so the v3 rewrite can be compared against it.
 * Run once against the legacy Go server (server/server -no-open -root-path ..) on port 8400:
 *   node e2e/legacy/capture.mjs
 * The SQL builders below are copied verbatim (logic-wise) from src/views/FTS.vue, src/store/search.js
 * and src/views/TSearch.vue of the v2 app.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { beautifyText } from './text-convert.mjs'

const require = createRequire(import.meta.url)
const { isSinglishQuery, getPossibleMatches } = require('@pnfo/singlish-search')

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const outDir = path.join(root, 'e2e/legacy/goldens')
const server = process.env.LEGACY_SERVER || 'http://localhost:8400'

const allFilterKeys = ["vp-prj","vp-pct","vp-mv","vp-cv","vp-pv","dn-1","dn-2","dn-3","mn-1","mn-2","mn-3","sn-1","sn-2","sn-3","sn-4","sn-5",
"an-1","an-2","an-3","an-4","an-5","an-6","an-7","an-8","an-9","an-10","an-11","kn-khp","kn-dhp","kn-ud","kn-iti","kn-snp",
"kn-vv","kn-pv","kn-thag","kn-thig","kn-mn","kn-nc","kn-jat","kn-ps","kn-ap","kn-bv","kn-cp","kn-nett","kn-petk","ap-dhs","ap-vbh","ap-kvu",
"ap-dhk","ap-pug","ap-yam","ap-pat","atta-vp","atta-dn","atta-mn","atta-sn","atta-an","atta-kn","atta-ap","anya"]
const dictShort = ['BUS', 'MS', 'BUE', 'ND', 'PTS', 'PN', 'VRI', 'CR']

async function sql(dbname, query) {
  const res = await fetch(server + '/sql-query', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dbname, query }) })
  const data = await res.json()
  if (!res.ok) throw new Error(`${dbname}: ${JSON.stringify(data)} for ${query}`)
  return data || []
}

// ---------- FTS (src/views/FTS.vue) ----------
function ftsSql({ input, exactWord = 0, matchPhrase = 0, wordDistance = 10, keys = allFilterKeys, columns = [0, 1] }) {
  const searchInput = input.trim().replace(/[‍\.,]/g, '').replace(/\s+/g, ' ')
  const isAdvancedMode = /AND|OR|NOT|[\*\^\(\)]/.test(searchInput)
  let clause
  if (isAdvancedMode) clause = searchInput
  else {
    let words = searchInput.split(' ')
    if (!exactWord) words = words.map(w => w + '*')
    clause = words[0]
    if (words.length > 1) clause = matchPhrase ? `"${words.join(' ')}"` : words.join(` NEAR/${wordDistance} `)
  }
  const clauses = []
  if (keys.length && keys.length < allFilterKeys.length) clauses.push('(' + keys.map(key => `filename LIKE '${key}%'`).join(' OR ') + ')')
  if (columns.length < 2) clauses.push(`language = '${columns[0] == 1 ? 'sinh' : 'pali'}'`)
  const filterClause = clauses.join(' AND ')
  const highlightFunc = "snippet(tipitaka, '<sr>', '</sr>', '<b>…</b>', 5, 64)"
  return `SELECT filename, eind, language, type, ${highlightFunc} AS htext,
      length(text) AS textlength, offsets(tipitaka) as offsets FROM tipitaka
      WHERE text MATCH '${clause}' ${filterClause ? (' AND ' + filterClause) : ''}
      ORDER BY length(offsets(tipitaka))/length(text) DESC LIMIT 100;`
}
// same query but without the LIMIT, to get the complete match set (for recall comparison)
function ftsAllSql(opts) {
  return ftsSql(opts).replace(/SELECT [\s\S]*? FROM tipitaka/, 'SELECT filename, eind, language FROM tipitaka')
    .replace(/ORDER BY[\s\S]*$/, ';')
}

// ---------- Dictionary (src/store/search.js) ----------
function dictWordList(input) {
  const query = input.toLowerCase().replace(/[‍\.,:\?\(\)“”‘’]/g, '')
  let words = isSinglishQuery(query) ? getPossibleMatches(query) : []
  if (!words.length) words = [query]
  const stripEnd = words.map(w => w.replace(/[්-ෟංඃ]+$/g, ''))
  const addVowel = !isSinglishQuery(query) ? ['ා', 'ි', 'ී', 'ු', 'ූ', 'ෙ', 'ො'].map(v => stripEnd[0] + v) : []
  return [...words, ...stripEnd, ...addVowel].filter((w, i, ar) => ar.indexOf(w) == i)
}
function pageDictSql(input, dicts = dictShort) {
  const wordsList = dictWordList(input), dictFilter = `dict IN ('${dicts.join("', '")}')`
  const likePrefixQuery = (wordsList.length > 100) ? '' :
    `UNION
      SELECT word, COUNT(dict) AS num, 'like' AS meaning FROM dictionary
        WHERE (word LIKE '${wordsList.join("_%' OR word LIKE '")}_%') AND ${dictFilter}
        GROUP BY word`
  return `SELECT word, dict, meaning FROM dictionary
        WHERE word IN ('${wordsList.join("','")}') AND (${dictFilter} OR dict = 'BR')
      ${likePrefixQuery} ORDER BY word LIMIT 50;`
}
function inlineDictSql(word, dicts = dictShort) {
  return `SELECT word, dict, meaning FROM dictionary
    WHERE word IN ('${dictWordList(word).join("','")}') AND dict IN ('${[...dicts, 'BR'].join("','")}')
    ORDER BY word LIMIT 50;`
}

// ---------- Title search (src/views/TSearch.vue + src/store/tree.js) ----------
function loadTree() {
  const jTree = JSON.parse(fs.readFileSync(path.join(root, 'public/static/data/tree.json'), 'utf-8'))
  const index = { root: { children: [] } }
  Object.keys(jTree).forEach(key => {
    const [pali, sinh, level, eInd, parent, filename] = jTree[key]
    index[key] = { pali, sinh, level, eInd, parent, filename, key, children: [] }
    index[parent].children.push(key)
  })
  const childInd = key => parseInt(key.split('-').splice(-1)[0])
  const childrenSort = (a, b) => { let ac, bc; if (isNaN(ac = childInd(a.key)) || isNaN(bc = childInd(b.key))) return 0; return ac - bc }
  const genTree = (key) => { const t = { key }; if (index[key].children.length) t.children = index[key].children.map(genTree).sort(childrenSort); return t }
  const orderedKeys = []
  const addOrder = (t) => { orderedKeys.push(t.key); (t.children || []).forEach(addOrder) }
  index.root.children.map(genTree).forEach(addOrder)
  return { index, orderedKeys }
}
function titleSearch({ index, orderedKeys }, input, { keys = allFilterKeys, columns = [0, 1] } = {}) {
  const query = input.toLowerCase().replace(/‍/g, '')
  let words = isSinglishQuery(query) ? getPossibleMatches(query) : []
  if (!words.length) words = [query]
  const results = []
  const queryReg = new RegExp(words.join('|'), 'i')
  const inFilter = (key) => keys.some(fKey => key.startsWith(fKey))
  for (let i = 0; i < orderedKeys.length && results.length < 100; i++) {
    const { key, pali, sinh } = index[orderedKeys[i]]
    const matchPali = queryReg.test(pali) && columns.indexOf(0) >= 0
    const match = matchPali || (queryReg.test(sinh) && columns.indexOf(1) >= 0)
    if (match && inFilter(key)) results.push({ key, language: matchPali ? 'pali' : 'sinh' })
  }
  return results
}

// ---------- inputs ----------
const ftsCases = [
  { input: 'භික්ඛවෙ' }, { input: 'භික්ඛවෙ', exactWord: 1 }, { input: 'බුද්ධ' }, { input: 'නිබ්බාන' },
  { input: 'සාරිපුත්ත' }, { input: 'ආනන්ද', exactWord: 1 }, { input: 'අනත්තා' }, { input: 'වේදනාව' },
  { input: 'නිවන', exactWord: 1 }, { input: 'මහණෙනි', columns: [1] }, { input: 'භික්ඛවෙ', columns: [0] },
  { input: 'බ්‍රහ්මජාල' }, { input: 'බ්රහ්මජාල' }, { input: 'සීලක්ඛන්ධ' }, { input: 'තථාගත', keys: ['dn-1'] },
  { input: 'තථාගත', keys: ['an-1'] }, { input: 'තථාගත', keys: ['an-10'] }, { input: 'ධම්ම', keys: ['kn-dhp'] },
  { input: 'අප්පමාද', keys: ['kn-dhp', 'atta-kn'] }, { input: 'එවං මෙ සුතං', matchPhrase: 1, exactWord: 1 },
  { input: 'එවං සුතං', matchPhrase: 0, wordDistance: 5 }, { input: 'එවං සුතං', matchPhrase: 0, wordDistance: 1 },
  { input: 'සබ්බෙ සඞ්ඛාරා', matchPhrase: 1 }, { input: 'කාම රාග', wordDistance: 3 }, { input: 'කුසල OR අකුසල' },
  { input: 'කුසල AND අකුසල' }, { input: 'පඨම*' }, { input: 'පට්ඨාන', keys: ['ap-pat'] }, { input: 'මාතිකා', keys: ['ap-dhs'] },
  { input: 'ථෙරගාථා', keys: ['kn-thag'] }, { input: 'අට්ඨකථා', keys: ['atta-dn', 'atta-mn'] }, { input: 'විනය', keys: ['vp-prj', 'vp-pct'] },
  { input: 'පාරාජික' }, { input: 'සඞ්ඝාදිසෙස', exactWord: 1 }, { input: 'මහාවග්ග' }, { input: 'උපාසක', columns: [1] },
  { input: 'දුක්ඛ' }, { input: 'සමාධි', keys: ['sn-5'] }, { input: 'ඣාන', keys: ['mn-1', 'mn-2', 'mn-3'] }, { input: 'අනිච්ච', columns: [0] },
]
const dictCases = ['dhamma', 'buddha', 'bhikkhu', 'nibbana', 'kamma', 'sila', 'abhikkanta', 'dham', 'citta', 'sati',
  'ධම්ම', 'බුද්ධ', 'භික්ඛු', 'නිබ්බාන', 'කම්ම', 'සීල', 'චිත්ත', 'සති', 'පඤ්ඤා', 'සමාධි', 'වේදනා', 'සඤ්ඤා', 'රූප',
  'අනත්ත', 'අනිච්ච', 'දුක්ඛ', 'මග්ග', 'ඵල', 'ධම්මා', 'භගවා', 'තථාගත', 'සුත්ත', 'විනය', 'අභිධම්ම', 'පාරාජික',
  'xyzq', 'ධම්', 'කුසල', 'ආනන්ද', 'සාරිපුත්ත']
const titleCases = ['බ්රහ්මජාල', 'brahmajala', 'සූත්‍ර', 'සූත්ර', 'වග්ග', 'වර්ගය', 'mettā', 'metta', 'ධම්මචක්ක', 'dhammacakka',
  'සතිපට්ඨාන', 'satipatthana', 'ආනාපාන', 'anapana', 'පරාභව', 'parabhava', 'මඞ්ගල', 'mangala', 'රතන', 'ratana',
  'කරණීය', 'jataka', 'ජාතක', 'වණ්ණනා', 'නිදාන', 'පාරාජික', 'parajika', 'ථෙරගාථා', 'මහා', 'චූළ']

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  // FTS
  const fts = []
  for (const c of ftsCases) {
    let rows, all, error = null
    try { rows = await sql('fts.db', ftsSql(c)); all = await sql('fts.db', ftsAllSql(c)) }
    catch (e) { error = e.message; rows = []; all = [] }
    fts.push({ case: c, error, top: rows.map(r => `${r.filename}:${r.eind}:${r.language}`),
      all: all.map(r => `${r.filename}:${r.eind}:${r.language}`) })
  }
  fs.writeFileSync(path.join(outDir, 'fts.json'), JSON.stringify(fts, null, 1))
  // Dictionary
  const dict = []
  for (const input of dictCases) {
    const words = dictWordList(input)
    const page = await sql('dict.db', pageDictSql(input))
    const inline = await sql('dict.db', inlineDictSql(input))
    dict.push({ input, words, page, inline })
  }
  fs.writeFileSync(path.join(outDir, 'dict.json'), JSON.stringify(dict, null, 1))
  // Title
  const tree = loadTree()
  const title = titleCases.map(input => ({ input, results: titleSearch(tree, input) }))
  title.push({ input: 'සුත්ත', filter: { keys: ['an-1'] }, results: titleSearch(tree, 'සුත්ත', { keys: ['an-1'] }) })
  title.push({ input: 'වග්ග', filter: { columns: [1] }, results: titleSearch(tree, 'වග්ග', { columns: [1] }) })
  fs.writeFileSync(path.join(outDir, 'title.json'), JSON.stringify(title, null, 1))
  fs.writeFileSync(path.join(outDir, 'ordered-keys.json'), JSON.stringify(tree.orderedKeys))
  // beautifyText on sampled entries (deterministic sampling)
  const textDir = path.join(root, 'public/static/text')
  const files = fs.readdirSync(textDir).filter(f => f.endsWith('.json')).sort()
  const samples = []
  let seed = 12345
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  for (const f of files.filter((_, i) => i % 7 == 0)) {
    const d = JSON.parse(fs.readFileSync(path.join(textDir, f), 'utf-8'))
    for (let k = 0; k < 50; k++) {
      const p = d.pages[Math.floor(rand() * d.pages.length)]
      const lang = rand() < 0.5 ? 'pali' : 'sinh'
      const es = p[lang].entries
      if (!es.length) continue
      const text = es[Math.floor(rand() * es.length)].text
      const out = {}
      for (const bandiLetters of [false, true]) for (const specialLetters of [false, true])
        out[`${+bandiLetters}${+specialLetters}`] = beautifyText(text, lang, { bandiLetters, specialLetters })
      samples.push({ lang, text, out })
    }
  }
  fs.writeFileSync(path.join(outDir, 'beautify.json'), JSON.stringify(samples))
  console.log(`fts ${fts.length} (errors ${fts.filter(f => f.error).length}), dict ${dict.length}, title ${title.length}, beautify ${samples.length}`)
}
main().catch(e => { console.error(e); process.exit(1) })
