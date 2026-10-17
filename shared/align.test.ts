import { describe, it, expect } from 'vitest'
import { parseLinks, parseNums, EntryAlign } from './align'

describe('alignment links', () => {
  it('parses groups, ranges and kinds', () => {
    expect(parseNums('1,3-5')).toEqual([1, 3, 4, 5])
    expect(parseLinks('0>0 | 1>2,3 | 2-3>4 ~p | 5>6 ~i')).toEqual([
      { p: [0], s: [0], kind: 'w' }, { p: [1], s: [2, 3], kind: 'w' }, { p: [2, 3], s: [4], kind: 'p' }, { p: [5], s: [6], kind: 'i' }])
  })
  it('rejects malformed links', () => {
    expect(parseLinks('0>0 | x')).toBeNull()
    expect(parseNums('3-1')).toBeNull()
  })
  it('finds the linked words from either side', () => {
    const a = new EntryAlign('0>0 | 1,2>3 ~p | 3>1,2', '4', '5')
    expect(a.linked('pali', 2)).toEqual({ pali: [1, 2], sinh: [3] })
    expect(a.linked('sinh', 2)).toEqual({ pali: [3], sinh: [1, 2] })
    expect(a.linked('pali', 4)).toEqual({ pali: [], sinh: [] })
    expect([...a.pu, ...a.sa]).toEqual([4, 5])
  })
})
