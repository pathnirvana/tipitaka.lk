/**
 * The DPD grammar abbreviations in Sinhala ("noun fem instr sg" -> "නාම · ඉත්ථිලිඞ්ග · කරණ විභක්ති · ඒකවචන").
 * The terms are those of පාලිභාෂාවතරණය 1 (https://pitaka.lk/books/palibhashavatharanaya-1/): genders (3.html), cases
 * and numbers (4.html), persons and tenses (6, 7, 9, 11.html), imperative (12), particles (13), absolutive (14),
 * adjectives and pronouns (16), present participle (17), numerals (18), adverbs (19), passive (21), past participle
 * (22), causative (23), suffixes (24), all three genders (25.html: තුන්ලිඟු). Terms the book does not have are the
 * usual ones of Pali grammar (the tense names of Bālāvatāra, සමාස, සන්ධි, උපසර්ග ...).
 */

const CASE = ' විභක්ති'
export const GRAMMAR_SI: Record<string, string> = {
  // parts of speech
  noun: 'නාම', adj: 'විශේෂණ', pron: 'සර්වනාම', verb: 'ක්‍රියා', ind: 'නිපාත', adv: 'ක්‍රියාවිශේෂණ', prep: 'නිපාත',
  prefix: 'උපසර්ග', suffix: 'ප්‍රත්‍යය', root: 'ධාතු', sandhi: 'සන්ධි', idiom: 'යෙදුම', letter: 'අක්ෂර',
  interr: 'ප්‍රශ්නාර්ථ', card: 'සංඛ්‍යා', ordin: 'පූරණ සංඛ්‍යා', cs: 'විකරණ', ve: 'ක්‍රියා විභක්ති',
  // genders, numbers
  masc: 'පුල්ලිඞ්ග', fem: 'ඉත්ථිලිඞ්ග', nt: 'නපුංසකලිඞ්ග', x: 'තුන්ලිඟු',
  sg: 'ඒකවචන', pl: 'බහුවචන', dual: 'ද්විවචන',
  // cases (the book's names; the instrumental is its කරණ)
  nom: 'ප්‍රථමා' + CASE, acc: 'කර්ම' + CASE, instr: 'කරණ' + CASE, dat: 'සම්ප්‍රදාන' + CASE, abl: 'අවධි' + CASE,
  gen: 'සම්බන්ධ' + CASE, loc: 'ආධාර' + CASE, voc: 'ආලපන' + CASE,
  // persons (Pali's first person is the English third)
  '1st': 'උත්තම පුරිස', '2nd': 'මජ්ඣිම පුරිස', '3rd': 'පඨම පුරිස',
  // tenses and moods
  pr: 'වර්තමාන', aor: 'අතීත', fut: 'අනාගත', imp: 'විධි', opt: 'සත්තමී', cond: 'කාලාතිපත්ති', perf: 'පරොක්ඛා', imperf: 'හීයත්තනී',
  // voices
  act: 'කර්තෘකාරක', pass: 'කර්මකාරක', reflx: 'අත්තනෝපද', caus: 'කාරිත', deno: 'නාම ධාතු', desid: 'ඉච්ඡාර්ථ', intens: 'පුනරුක්ත',
  // participles and verbal nouns
  pp: 'අතීත කිතක', prp: 'මිශ්‍ර ක්‍රියා', ptp: 'කිච්ච කිතක', abs: 'පූර්ව ක්‍රියා', ger: 'පූර්ව ක්‍රියා', inf: 'තුමන්ත',
  // derivation and other notes
  comp: 'සමාස', abstr: 'භාව නාම', agent: 'කර්තෘ නාම', compar: 'අධිකතර', superl: 'අධිකතම', dimin: 'අල්පාර්ථ',
  excl: 'විස්මයාර්ථ', emph: 'අවධාරණ', onom: 'අනුකරණ', derog: 'නින්දාර්ථ', patr: 'ගොත්‍ර නාම', abbrev: 'කෙටි රූපය',
  irreg: 'අක්‍රමවත්', form: 'රූපය', vb: 'ක්‍රියා', group: 'ගණය', conjugation: 'වරනැගීම', comps: 'සමාසවල',
  or: 'හෝ', '&': 'සහ',
}
/**
 * the short forms of the analysis line ("නාම න ප්‍රථමා ඒ.ව."; the full names on hover / tap): the genders as the book's
 * key (25.html) and Buddhadatta's dictionary write them (පු ඉ න 3), the book's නි. ක්‍රි. වි. පූ. ක්‍රි., the cases
 * without "විභක්ති"
 */
export const GRAMMAR_SHORT: Record<string, string> = {
  adj: 'විශේ.', pron: 'සර්ව.', verb: 'ක්‍රි.', ind: 'නි.', adv: 'ක්‍රි. වි.', prep: 'නි.', interr: 'ප්‍රශ්න.', ordin: 'පූරණ',
  masc: 'පු', fem: 'ඉ', nt: 'න', x: '3', sg: 'ඒ.ව.', pl: 'බ.ව.', dual: 'ද්වි.ව.',
  nom: 'ප්‍රථමා', acc: 'කර්ම', instr: 'කරණ', dat: 'සම්ප්‍රදාන', abl: 'අවධි', gen: 'සම්බන්ධ', loc: 'ආධාර', voc: 'ආලපන',
  '1st': 'උත්තම', '2nd': 'මජ්ඣිම', '3rd': 'පඨම',
  pp: 'අතීත කිතක', prp: 'මිශ්‍ර ක්‍රි.', ptp: 'කිච්ච කිතක', abs: 'පූ. ක්‍රි.', ger: 'පූ. ක්‍රි.', reflx: 'අත්තනෝ.',
}
/** the short form of a part of speech or grammar code (the full name when it has none) */
export const shortSi = (code: string) => GRAMMAR_SHORT[code] ?? GRAMMAR_SI[code] ?? code

/** English words of DPD's grammar notes without a Sinhala name here: kept as they are (not read as Pali) */
const KEEP = new Set(['app', 'sk'])

/** a list of abbreviations: "noun fem instr sg", "masc pl" (an unknown word is Pali: in Sinhala letters); short: the
 * short forms */
export function codesSi(codes: string, pali: (roman: string) => string, sep = ' · ', short = false): string {
  return codes.split(/\s+/).filter(t => t && t !== 'of' && t !== 'from')
    .map(t => (short ? GRAMMAR_SHORT[t] : undefined) ?? GRAMMAR_SI[t] ?? (KEEP.has(t) || /^[\d.+]+$/.test(t) ? t : pali(t))).join(sep)
}

/** the part of speech chip of a DPD headword */
export const posSi = (pos: string) => GRAMMAR_SI[pos] ?? pos

/**
 * the grammar note of a DPD headword: comma separated parts like "masc", "comp of X", "pp of na karoti",
 * "from X", "in comps", "atta group" -> Sinhala, the Pali words in Sinhala letters
 */
export function grammarSi(note: string, pali: (roman: string) => string): string {
  return note.split(/,\s*/).filter(Boolean).map(part => {
    const si = partSi(part, pali)
    // a few notes have typos (DPD: "relfx", "ofX"): English letters read as Pali - the note as it is
    return /[a-zA-Z]/.test(si.replace(/\b(app|sk)\b/g, '')) ? part : si
  }).join(', ')
}
function partSi(part: string, pali: (roman: string) => string): string {
  let m: RegExpExecArray | null
  if (part === 'in comps') return 'සමාසවල'
  // the last "of": "prp of pass of X" is the present participle of the passive of X
  if ((m = /^(.*)\s+of\s+(.+)$/.exec(part)) || (m = /^()of\s+(.+)$/.exec(part))) return `${pali(m[2])} හි ${codesSi(m[1], pali, ' ')}`.trim()
  if ((m = /^(.*?)\s*\bfrom\s+(.+)$/.exec(part))) return [codesSi(m[1], pali, ' '), `${pali(m[2])} යන්නෙන්`].filter(Boolean).join(', ')
  if ((m = /^(\S+) group$/.exec(part))) return `${pali(m[1])} ගණය`
  return codesSi(part, pali, ' ')
}

/** the cases a word takes: "+acc or +dat" -> "+කර්ම විභක්ති හෝ +සම්ප්‍රදාන විභක්ති" */
export const plusCaseSi = (s: string) => s.replace(/\+?([a-z&]+|&)/g, (all, w: string) => (GRAMMAR_SI[w] ? all.replace(w, GRAMMAR_SI[w]) : all))
