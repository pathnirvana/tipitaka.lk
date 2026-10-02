/**
 * Bandi akuru / conjunct letter rendering. Port of src/text-convert.mjs (v2) — output must stay identical
 * (verified against e2e/legacy/goldens/beautify.json).
 */
export interface LetterOptions { bandiLetters: boolean; specialLetters: boolean }

const commonConjuncts = [['ක', 'ව'], ['ත', 'ථ'], ['ත', 'ව'], ['න', 'ථ'], ['න', 'ද'], ['න', 'ධ']]
  .map(([a, b]) => [new RegExp(a + '්' + b, 'g'), a + '්‍' + b] as const)
const paliConjuncts = [['ඤ', 'ච'], ['ඤ', 'ජ'], ['ඤ', 'ඡ'], ['ට', 'ඨ'], ['ණ', 'ඩ'], ['ද', 'ධ'], ['ද', 'ව']]
  .map(([a, b]) => [new RegExp(a + '්' + b, 'g'), a + '්‍' + b] as const)

function addBandiLetters(text: string) {
  text = text.replace(/‌/g, '') // remove 200c char that appears in tipitaka.org text
  text = text.replace(/([ක-ෆ])්([ක-ෆ])/g, '$1‍්$2') // adding a zwj between consonants
  text = text.replace(/([ක-ෆ])්([ක-ෆ])/g, '$1‍්$2') // twice to handle consecutive hal
  text = text.replace(/ේ/g, 'ෙ') // ee => e
  text = text.replace(/ෝ/g, 'ො') // oo => o
  return text
}
const addRakarYansa = (text: string) => text.replace(/්([යර])/g, '්‍$1')

export function beautifyText(text: string, lang: 'pali' | 'sinh', opts: LetterOptions): string {
  if (lang === 'sinh') return text // sinhala text already has the needed zwj
  text = addRakarYansa(text)
  for (const [re, rep] of commonConjuncts) text = text.replace(re, rep)
  if (opts.specialLetters) for (const [re, rep] of paliConjuncts) text = text.replace(re, rep)
  if (opts.bandiLetters) text = addBandiLetters(text)
  return text
}

/** used for search snippets/highlights: sinhala text in the search index lacks zwj */
export function beautifyFTSText(text: string, lang: 'pali' | 'sinh', opts: LetterOptions): string {
  if (lang !== 'sinh') return beautifyText(text, lang, opts)
  return addRakarYansa(text)
}

/** remove the bandi zwj (used for page titles) */
export const removeBandi = (text: string) => text.replace(/([ක-ෆ])‍්([ක-ෆ])/g, '$1්$2')
