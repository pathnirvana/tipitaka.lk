/**
 * Pāḷi↔Sinhala word alignments (store format bjt-align/1, see dev/alignments/README.md).
 * Word numbers are indexes into tokenize() of shared/tokenize.ts (tokenizer v1) on the raw entry text.
 *
 *   links "0>0 | 1>2,3 | 2-3>4 ~p"   groups of Pāḷi words > the Sinhala words that render them; ~p a phrase, ~i a free rendering
 *   pu    "4,9"                       Pāḷi words left untranslated
 *   sa    "1,5"                       Sinhala words added by the translator
 */
export type AlignKind = 'w' | 'p' | 'i'
export interface AlignGroup { p: number[]; s: number[]; kind: AlignKind }

/** "1,3-5" -> [1,3,4,5]; null when malformed */
export function parseNums(s: string): number[] | null {
  const out: number[] = []
  for (const x of s.split(',').map(v => v.trim()).filter(Boolean)) {
    const m = x.match(/^(\d+)(?:-(\d+))?$/)
    if (!m) return null
    const a = +m[1], b = m[2] ? +m[2] : a
    if (b < a || b - a > 500) return null
    for (let i = a; i <= b; i++) out.push(i)
  }
  return out
}

/** the links string -> groups; null when malformed */
export function parseLinks(links: string): AlignGroup[] | null {
  const out: AlignGroup[] = []
  for (const part of links.split('|').map(v => v.trim()).filter(Boolean)) {
    const m = part.match(/^([\d,\- ]*)>([\d,\- ]*?)\s*(?:~([pi]))?$/)
    if (!m) return null
    const p = parseNums(m[1]), s = parseNums(m[2])
    if (!p || !s) return null
    out.push({ p, s, kind: (m[3] as AlignKind) || 'w' })
  }
  return out
}

/** one entry's alignment, indexed for lookups from either side */
export class EntryAlign {
  readonly groups: AlignGroup[]
  readonly pu: Set<number>
  readonly sa: Set<number>
  private byLang: { pali: Map<number, AlignGroup[]>; sinh: Map<number, AlignGroup[]> } = { pali: new Map(), sinh: new Map() }
  constructor(links: string, pu: string, sa: string) {
    this.groups = parseLinks(links) || []
    this.pu = new Set(parseNums(pu) || [])
    this.sa = new Set(parseNums(sa) || [])
    for (const g of this.groups) {
      for (const i of g.p) this.byLang.pali.set(i, [...(this.byLang.pali.get(i) || []), g])
      for (const i of g.s) this.byLang.sinh.set(i, [...(this.byLang.sinh.get(i) || []), g])
    }
  }
  /** the words linked with word w of lang: its own side (the whole group) and the other side */
  linked(lang: 'pali' | 'sinh', w: number): { pali: number[]; sinh: number[] } {
    const pali = new Set<number>(), sinh = new Set<number>()
    for (const g of this.byLang[lang].get(w) || []) { g.p.forEach(i => pali.add(i)); g.s.forEach(i => sinh.add(i)) }
    return { pali: [...pali], sinh: [...sinh] }
  }
}
