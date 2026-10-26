import { describe, expect, it } from 'vitest'
import { codesSi, grammarSi, plusCaseSi, posSi, shortSi } from './grammar'
import { toSinh } from '@/data/dictionary'

describe('DPD grammar in Sinhala (පාලිභාෂාවතරණය)', () => {
  it('the analysis of a form', () => {
    expect(codesSi('fem instr sg', toSinh)).toBe('ඉත්ථිලිඞ්ග · කරණ විභක්ති · ඒකවචන')
    expect(codesSi('pr 3rd pl', toSinh)).toBe('වර්තමාන · පඨම පුරිස · බහුවචන')
    expect(codesSi('masc nom sg', toSinh)).toBe('පුල්ලිඞ්ග · ප්‍රථමා විභක්ති · ඒකවචන')
    expect(posSi('noun')).toBe('නාම')
    expect(posSi('prp')).toBe('මිශ්‍ර ක්‍රියා')
    expect(posSi('unknown-pos')).toBe('unknown-pos')
    expect(codesSi('fem instr sg', toSinh, ' ', true)).toBe('ඉ කරණ ඒ.ව.') // the short forms
    expect(codesSi('pr 3rd pl', toSinh, ' ', true)).toBe('වර්තමාන පඨම බ.ව.')
    expect([shortSi('nt'), shortSi('noun'), shortSi('adj')]).toEqual(['න', 'නාම', 'විශේ.'])
  })
  it('the grammar notes of headwords: codes, "of" and "from" with the Pali words in Sinhala letters', () => {
    expect(grammarSi('masc, comp', toSinh)).toBe('පුල්ලිඞ්ග, සමාස')
    expect(grammarSi('pp of karoti', toSinh)).toBe('කරොති හි අතීත කිතක')
    expect(grammarSi('fem, abstr from vajati', toSinh)).toBe('ඉත්ථිලිඞ්ග, භාව නාම, වජති යන්නෙන්')
    expect(grammarSi('adj, from missa', toSinh)).toBe('විශේෂණ, මිස්ස යන්නෙන්')
    expect(grammarSi('pp of na karoti, in comps', toSinh)).toBe('න කරොති හි අතීත කිතක, සමාසවල')
    expect(grammarSi('ind, adv, abl sg of ādi', toSinh)).toBe('නිපාත, ක්‍රියාවිශේෂණ, ආදි හි අවධි විභක්ති ඒකවචන')
    expect(grammarSi('masc, mano group, from na jaras', toSinh)).toBe('පුල්ලිඞ්ග, මනො ගණය, න ජරස් යන්නෙන්')
    expect(grammarSi('card, x pl', toSinh)).toBe('සංඛ්‍යා, තුන්ලිඟු බහුවචන')
    expect(grammarSi('adj, app of ājānāti', toSinh)).toBe('විශේෂණ, ආජානාති හි app') // unknown English kept
    expect(grammarSi('prp of pass of anuyuñjati', toSinh)).toBe('අනුයුඤ්ජති හි මිශ්‍ර ක්‍රියා කර්මකාරක')
    expect(grammarSi('pp of', toSinh)).toBe('අතීත කිතක') // unfinished in DPD
    expect(grammarSi('fut, relfx 1st of asati', toSinh)).toBe('අනාගත, relfx 1st of asati') // a typo in DPD: as it is
  })
  it('the cases a word takes', () => {
    expect(plusCaseSi('+acc or +dat')).toBe('+කර්ම විභක්ති හෝ +සම්ප්‍රදාන විභක්ති')
    expect(plusCaseSi('+acc & +instr')).toBe('+කර්ම විභක්ති සහ +කරණ විභක්ති')
  })
})
