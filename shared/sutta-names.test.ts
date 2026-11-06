import { describe, it, expect } from 'vitest'
import { sinhFold, romanFold, buildNameIndex, matchNames, type PopularSutta } from './sutta-names'
import popular from './popular-suttas.json'

const index = buildNameIndex(popular as PopularSutta[])
const keys = (q: string, candidates?: string[]) => matchNames(index, q, candidates).map(m => m.key)

describe('popular sutta names', () => {
  it('folds spellings and a trailing "sutta"', () => {
    expect(sinhFold('සිඟාලෝවාද සූත්‍රය')).toBe(sinhFold('සිගාලොවාද'))
    expect(sinhFold('ගිරිමානන්‍ද සුත්තං')).toBe('ගිරිමානන්ද')
    expect(romanFold('Sigālovāda Suttaṃ')).toBe(romanFold('sigalowada'))
    expect(romanFold('karaneeya meththa')).toBe(romanFold('karaniya metta'))
    expect(romanFold('dhammachakka')).toBe(romanFold('dhammacakka'))
  })
  it('finds suttas whose BJT title is not the common name', () => {
    expect(keys('සිඟාලෝවාද')).toEqual(['dn-3-8'])
    expect(keys('singalovada')).toEqual(['dn-3-8'])
    expect(keys('kalama')).toEqual(['an-3-2-2-5']) // the BJT title is only a number
    expect(keys('anattalakkhana')).toEqual(['sn-3-1-2-1-7']) // පඤ්චවග්ගිය සුත්තං
    expect(keys('damsakpawathum')).toEqual(['sn-5-12-2-1'])
  })
  it('orders by searches, and does not match a name inside another word', () => {
    expect(keys('metta').slice(0, 2)).toEqual(['kn-khp-9', 'kn-snp-1-8'])
    expect(keys('satipatthana')).not.toContain('ap-pat')
    expect(keys('සතිපට්ඨාන')).not.toContain('ap-pat')
    expect(keys('ka')).toEqual([])
    expect(keys('ර')).toEqual([])
  })
  it('every key is listed once and has names', () => {
    const k = (popular as PopularSutta[]).map(e => e.key)
    expect(new Set(k).size).toBe(k.length)
    for (const e of popular as PopularSutta[]) expect(e.si.length && e.ro.length, e.key).toBeTruthy()
  })
})
