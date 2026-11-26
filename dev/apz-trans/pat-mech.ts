/**
 * Paṭṭhāna: the entries that code can word exactly, so they are not sent to the model. Only the counting lists
 * ("හෙතුයා නව, ආරම්මණෙ තීණි …"): condition names in the locative with a number, base conditions ("හෙතුපච්චයා"), -පෙ-,
 * and the closing labels ("(දුමූලකං)", "(සංඛිත්තං)"). mech() returns undefined unless every word of the entry is one it knows.
 *   npx tsx dev/apz-trans/pat-mech.ts [file …]   coverage, and the words that stopped an entry
 */
import fs from 'node:fs'

const NAMES: Record<string, string> = { හෙතු: 'හේතු', ආරම්මණ: 'ආරම්මණ', අධිපති: 'අධිපති', අනන්තර: 'අනන්තර', සමනන්තර: 'සමනන්තර', සහජාත: 'සහජාත',
  අඤ්ඤමඤ්ඤ: 'අඤ්ඤමඤ්ඤ', නිස්සය: 'නිස්සය', උපනිස්සය: 'උපනිස්සය', පුරෙජාත: 'පුරේජාත', පච්ඡාජාත: 'පච්ඡාජාත', ආසෙවන: 'ආසේවන', කම්ම: 'කම්ම',
  විපාක: 'විපාක', ආහාර: 'ආහාර', ඉන්ද්රිය: 'ඉන්ද්‍රිය', ඣාන: 'ඣාන', මග්ග: 'මග්ග', සම්පයුත්ත: 'සම්පයුත්ත', විප්පයුත්ත: 'විප්පයුත්ත', අත්ථි: 'අත්ථි',
  නත්ථි: 'නත්ථි', විගත: 'විගත', අවිගත: 'අවිගත' }
/** the 24 condition names as pinned terms: "හෙතුපච්චය" -> "හේතු ප්‍රත්‍යය" */
export const NAME_PINS = Object.entries(NAMES).map(([p, s]) => [p + 'පච්චය', s + ' ප්‍රත්‍යය'])
const LOC = new Map(Object.keys(NAMES).map(p => [/[ුි]$/.test(p) ? p + 'යා' : p + 'ෙ', p]))
const N: Record<string, string> = { එකං: 'එකකි', ද්වෙ: 'දෙකකි', තීණි: 'තුනකි', චත්තාරි: 'හතරකි', පඤ්ච: 'පහකි', ඡ: 'හයකි', සත්ත: 'හතකි', අට්ඨ: 'අටකි',
  නව: 'නවයකි', දස: 'දහයකි', එකාදස: 'එකොළහකි', ද්වාදස: 'දොළහකි', බාරස: 'දොළහකි', තෙරස: 'දහතුනකි', චුද්දස: 'දාහතරකි', පණ්ණරස: 'පහළොවකි',
  පන්නරස: 'පහළොවකි', සොළස: 'දහසයකි', සත්තරස: 'දාහතකි', අට්ඨාරස: 'දහඅටකි', එකූනවීස: 'දහනවයකි', එකූනවීසති: 'දහනවයකි', වීස: 'විස්සකි', වීසති: 'විස්සකි',
  එකවීස: 'විසි එකකි', එකවීසති: 'විසි එකකි', බාවීස: 'විසි දෙකකි', තෙවීස: 'විසි තුනකි', තෙවීසති: 'විසි තුනකි', චතුවීසති: 'විසි හතරකි', පඤ්චවීස: 'විසි පහකි' }
const ROOTS: Record<string, string> = { එක: 'එකක්', දු: 'දෙකක්', ති: 'තුනක්', චතු: 'හතරක්', පඤ්ච: 'පහක්', ඡ: 'හයක්', සත්ත: 'හතක්', අට්ඨ: 'අටක්', නව: 'නවයක්',
  දස: 'දහයක්', එකාදස: 'එකොළහක්', ද්වාදස: 'දොළහක්', බාරස: 'දොළහක්', තෙරස: 'දහතුනක්', චුද්දස: 'දාහතරක්', පණ්ණරස: 'පහළොවක්', සොළස: 'දහසයක්',
  සත්තරස: 'දාහතක්', අට්ඨාරස: 'දහඅටක්', එකූනවීස: 'දහනවයක්', වීස: 'විස්සක්', එකවීස: 'විසි එකක්', බාවීස: 'විසි දෙකක්', තෙවීස: 'විසි තුනක්' }

const LABELS: Record<string, string> = { සුද්ධ: 'සුද්ධ වාරය', සුද්ධං: 'සුද්ධ වාරය', අවිපාක: 'විපාක ප්‍රත්‍යය රහිත', අවිපාකං: 'විපාක ප්‍රත්‍යය රහිත', සවිපාක: 'විපාක ප්‍රත්‍යය සහිත', සවිපාකං: 'විපාක ප්‍රත්‍යය සහිත' }

/** a word of a list: [kind, Sinhala]; undefined when it is not a word of a counting list */
function word(w: string): [string, string] | undefined {
  if (w === '-පෙ-') return ['pe', '-පෙ-']
  if (N[w]) return ['num', N[w]]
  if (w === 'සබ්බත්ථ') return ['all', 'සෑම තැන ම']
  // (the negative: න or නො before the name, also joined as in නාරම්මණෙ)
  let neg = false, x = w
  const m = w.match(/^(?:නො|න)(.+)$/)
  for (const c of [w, m?.[1], w.startsWith('නා') ? 'ආ' + w.slice(2) : undefined, w.startsWith('නා') ? 'අ' + w.slice(2) : undefined]) {
    if (!c) continue
    const base = c.endsWith('පච්චයා') ? c.slice(0, -6) : undefined
    if (LOC.has(c) || (base && NAMES[base])) { neg = c !== w; x = c; break }
  }
  const not = neg ? ' නොවන ප්‍රත්‍යය' : ''
  if (LOC.has(x)) return ['loc', `${NAMES[LOC.get(x)!]} ප්‍රත්‍යය${not}ෙහි`]
  if (x.endsWith('පච්චයා') && NAMES[x.slice(0, -6)]) return ['base', `${NAMES[x.slice(0, -6)]} ප්‍රත්‍යය${not}`]
  // (a combination: bare names, the last one closed by "න්ති", then its number)
  if (NAMES[w]) return ['name', NAMES[w]]
  if (w.endsWith('න්ති') && NAMES[w.slice(0, -4)]) return ['nameEnd', NAMES[w.slice(0, -4)]]
  return undefined
}

export const stops = new Map<string, number>()
export function mech(pali: string): string | undefined {
  let t = pali.replace(/\{[^}]*\}/g, '').replace(/‍/g, '').trim()
  const lead = t.match(/^[\d\s.–-]+\.\s*/)?.[0] ?? ''
  t = t.slice(lead.length).replace(/-\s*පෙ\s*-/g, ' -පෙ- ')
    .replace(/(^|\s)(න|නො)\s+(?=[අ-ෆ])/g, '$1$2')                                 // "න ආරම්මණෙ" -> "නආරම්මණෙ"
    .replace(/([අ-෿])\s+පච්චයා/g, '$1පච්චයා')                                  // "අත්ථි පච්චයා"
  // labels in brackets, in place
  const labels: string[] = []
  let ok = true
  t = t.replace(/\(([^()]*)\)/g, (_, s: string) => {
    const k = s.replace(/[.\s]/g, '')
    const si = k === 'සංඛිත්තං' ? 'කෙටි කරන ලදී' : k === 'සබ්බමූලකං' ? 'සියලු ප්‍රත්‍යය මූල ඇති වාරය' : k.endsWith('මූලකං') && ROOTS[k.slice(0, -'මූලකං'.length)] ? `ප්‍රත්‍යය ${ROOTS[k.slice(0, -'මූලකං'.length)]} මූල ඇති වාරය` : LABELS[k] ? LABELS[k] : undefined
    if (!si) ok = false
    labels.push(`(${si})`); return ` @L${labels.length - 1} `
  })
  if (!ok) return undefined
  t = t.replace(/(^|[\s,.])සංඛිත්තං(?=[\s,.]|$)/g, (_, a: string) => { labels.push('(කෙටි කරන ලදී)'); return `${a} @L${labels.length - 1} ` })
  const ws = t.split(/[\s,.:;]+/).filter(Boolean)
  // parts: a group of base conditions, an item (name and number), a label, -පෙ-
  const out: { kind: string; si: string }[] = []
  let nums = 0, pend = false, bases: string[] = [], names: string[] = []
  const flush = () => { if (bases.length) { out.push({ kind: 'base', si: bases.join(', ') + ' මූල කොට' }); bases = [] } }
  for (const w of ws) {
    const L = w.match(/^@L(\d+)$/)
    const k = L ? (['label', labels[+L[1]]] as [string, string]) : word(w)
    if (!k) { stops.set(w, (stops.get(w) ?? 0) + 1); return undefined }
    if (k[0] === 'num') { if (!pend) return undefined; out[out.length - 1].si += ' ' + k[1]; pend = false; nums++; continue }
    if (pend) return undefined                                                  // a name with no number after it
    if (k[0] === 'name') { if (bases.length) return undefined; names.push(k[1]); continue }
    if (k[0] === 'nameEnd') { out.push({ kind: 'item', si: [...names, k[1]].join(', ') + ' යන ප්‍රත්‍යයන් එක් වූ කල' }); names = []; pend = true; continue }
    if (names.length) return undefined
    if (k[0] === 'base') { bases.push(k[1]); continue }
    if (k[0] === 'pe' && bases.length) { bases[bases.length - 1] += ' -පෙ-'; continue }
    flush()
    out.push({ kind: k[0] === 'loc' || k[0] === 'all' ? 'item' : k[0], si: k[1] }); pend = k[0] === 'loc' || k[0] === 'all'
  }
  if (pend || !nums || bases.length || names.length) return undefined
  // (more than one group of base conditions: the first may be the tail of the sentence before, so the model words it)
  if (out.filter(o => o.kind === 'base').length > 1) return undefined
  // a base group opens a sentence; items are joined by commas; a label follows a full stop
  let s = ''
  out.forEach((o, i) => {
    const prev = out[i - 1]
    s += i === 0 ? o.si : o.kind === 'label' ? (prev.kind === 'label' ? ' ' : '. ') + o.si : o.kind === 'base' ? (prev.kind === 'label' ? ' ' : '. ') + o.si
      : o.kind === 'pe' ? ' -පෙ-' : (prev.kind === 'label' || prev.kind === 'pe' ? ' ' : ', ') + o.si
  })
  s = s.replace(/ -පෙ-, /g, ' -පෙ- ')
  if (!/\)$/.test(s)) s += /,\s*$/.test(pali.replace(/\[[^\]]*\]|\{[^}]*\}/g, '')) ? ',' : '.'
  return lead + s
}

if (process.argv[1]?.endsWith('pat-mech.ts')) {
  const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync('public/static/text').filter(f => /^ap-pat.*\.json$/.test(f)).map(f => f.slice(0, -5))
  let n = 0, c = 0, all = 0
  const shown: string[] = []
  for (const f of files) for (const p of JSON.parse(fs.readFileSync(`public/static/text/${f}.json`, 'utf-8')).pages) for (const e of p.pali.entries) {
    all += e.text.length
    const s = e.type === 'paragraph' ? mech(e.text) : undefined
    if (s) { n++; c += e.text.length; if (shown.length < 6 && n % 97 === 1) shown.push(`P: ${e.text}\nS: ${s}`) }
  }
  console.log([...stops].sort((a, b) => b[1] - a[1]).slice(0, 50).map(x => x.join(' ')).join(', '))
  console.log(`${n} entries, ${c} of ${all} chars (${(c / all * 100).toFixed(1)}%)\n` + shown.join('\n'))
}
