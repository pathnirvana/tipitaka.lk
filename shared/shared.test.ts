import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { beautifyText } from './beautify'
import { parseMarkup, tokensToHtml, tokensToPlain, stripForCopy } from './markup'
import { normalizeForSearch, extractWords, normalizeTitle } from './normalize'
import { buildMatch, ftsInputError, FTS_MESSAGES, termMatches } from './fts-query'
import { parseFootnote, findAbbreviations, footnoteTokens } from './footnote'
import { dictWordList, wordInputError } from './dict-words'
import { parseEIndStr, parseFtsOptions, ftsLink, entryLink, bookmarkKey } from './routes'
import { parseQueries, renderSql, validateParams } from './queries'
import { getBJTImageSrc } from './scanned-pages'

const goldens = (f: string) => JSON.parse(fs.readFileSync(`e2e/legacy/goldens/${f}`, 'utf-8'))

describe('beautifyText (legacy parity)', () => {
  it('matches all legacy golden outputs', () => {
    const samples = goldens('beautify.json') as { lang: 'pali' | 'sinh'; text: string; out: Record<string, string> }[]
    expect(samples.length).toBeGreaterThan(1000)
    let n = 0
    for (const s of samples) for (const [k, v] of Object.entries(s.out)) {
      expect(beautifyText(s.text, s.lang, { bandiLetters: k[0] === '1', specialLetters: k[1] === '1' })).toBe(v)
      n++
    }
    expect(n).toBe(samples.length * 4)
  })
})

describe('parseMarkup', () => {
  it('matches golden vectors (shared with Go)', () => {
    for (const c of JSON.parse(fs.readFileSync('shared/markup-cases.json', 'utf-8'))) expect(tokensToHtml(parseMarkup(c.input)), c.input).toBe(c.html)
  })
  it('A12 pipe in text is plain text', () => {
    expect(tokensToPlain(parseMarkup('a | b ℗ c'))).toBe('a | b ℗ c')
  })
  it('A13 bold across a new line', () => {
    expect(parseMarkup('**a\nb**')).toEqual([{ t: 'bold', c: [{ t: 'text', v: 'a' }, { t: 'br' }, { t: 'text', v: 'b' }] }])
  })
  it('nested footnote ref inside bold', () => {
    expect(parseMarkup('**x{1}**')).toEqual([{ t: 'bold', c: [{ t: 'text', v: 'x' }, { t: 'fnref', v: '1' }] }])
  })
  it('hides fn refs when asked and plain text drops them', () => {
    expect(tokensToHtml(parseMarkup('a{1}b'), { hideFnRefs: true })).toBe('ab')
    expect(tokensToPlain(parseMarkup('**a**{1} $$b$$'))).toBe('a b')
  })
  it('copy content strips like v2', () => {
    expect(stripForCopy('**a**{1} __b__ $$c$$')).toBe('a b $$c$$')
  })
})

describe('normalizeForSearch', () => {
  it('removes markup, zwj and footnote refs and splits on punctuation', () => {
    expect(normalizeForSearch('**බ්‍රහ්මජාල**{1}, “සුත්තං”.')).toBe('බ්රහ්මජාල සුත්තං')
    expect(normalizeForSearch('a{12}b c–d')).toBe('ab c d')
    expect(normalizeForSearch('ABC 123')).toBe('abc 123')
  })
  it('keeps raw offsets', () => {
    const raw = '**එවං** මෙ{1}'
    const w = extractWords(raw)
    expect(w.map(x => raw.slice(x.start, x.end))).toEqual(['එවං', 'මෙ'])
  })
  it('title normalisation (A32)', () => { expect(normalizeTitle('සූත්‍ර')).toBe('සූත්ර') })
})

describe('buildMatch', () => {
  const o = { exactWord: 0, matchPhrase: 0, wordDistance: 10 }
  it('single word prefix / exact', () => {
    expect(buildMatch('භික්ඛවෙ', o)).toMatchObject({ ok: true, match: 'භික්ඛවෙ*' })
    expect(buildMatch('භික්ඛවෙ', { ...o, exactWord: 1 })).toMatchObject({ ok: true, match: 'භික්ඛවෙ' })
  })
  it('zwj and dots are removed', () => {
    expect(buildMatch('බ්‍රහ්මජාල.', o)).toMatchObject({ ok: true, match: 'බ්රහ්මජාල*' })
  })
  it('phrase and near', () => {
    expect(buildMatch('එවං මෙ සුතං', { ...o, exactWord: 1, matchPhrase: 1 })).toMatchObject({ match: '"එවං මෙ සුතං"' })
    expect(buildMatch('එවං සුතං', { ...o, wordDistance: 5 })).toMatchObject({ match: 'එවං* NEAR/5 සුතං*' })
  })
  it('advanced: OR, AND -> implicit, caret, prefix', () => {
    expect(buildMatch('කුසල OR අකුසල', o)).toMatchObject({ ok: true, match: 'කුසල OR අකුසල' })
    expect(buildMatch('කුසල AND අකුසල', o)).toMatchObject({ ok: true, match: 'කුසල අකුසල' })
    expect(buildMatch('^එවං පඨම*', o)).toMatchObject({ ok: true, match: '^එවං පඨම*' })
  })
  it('rejects NOT, parentheses and bad operators', () => {
    expect(buildMatch('කුසල NOT අකුසල', o)).toEqual({ ok: false, error: FTS_MESSAGES.unsupported })
    expect(buildMatch('(කුසල)', o)).toEqual({ ok: false, error: FTS_MESSAGES.unsupported })
    expect(buildMatch('OR කුසල', o)).toEqual({ ok: false, error: FTS_MESSAGES.invalid })
    expect(buildMatch('කුසල OR', o)).toEqual({ ok: false, error: FTS_MESSAGES.invalid })
  })
  it('input rules', () => {
    expect(ftsInputError('')).toBe(FTS_MESSAGES.empty)
    expect(ftsInputError('ක')).toBe(FTS_MESSAGES.short)
    expect(ftsInputError('dhamma')).toBe(FTS_MESSAGES.latin)
    expect(ftsInputError("ධම්ම'")).toBe(FTS_MESSAGES.chars)
  })
  it('single letter prefix terms are searched exactly', () => {
    expect(buildMatch('ච සුතං', o)).toMatchObject({ match: 'ච NEAR/10 සුතං*' })
  })
  it('termMatches', () => {
    expect(termMatches('සුතං', [{ text: 'සුත', prefix: true }])).toBe(true)
    expect(termMatches('සුතං', [{ text: 'සුත', prefix: false }])).toBe(false)
  })
})

describe('footnotes', () => {
  it('parses number and content', () => {
    expect(parseFootnote('1. සරණත්තයං – මඡසං')).toEqual({ number: '1', content: ' සරණත්තයං – මඡසං' })
    expect(parseFootnote('*. x\ny')).toEqual({ number: '*', content: ' x\ny' })
    expect(parseFootnote('bad')).toEqual({ number: '', content: '' })
  })
  it('finds abbreviations and splits tokens (regex chars escaped)', () => {
    const known = new Set(['මඡසං', 'PTS', 'සී.(?)'])
    expect(findAbbreviations('a – මඡසං, PTS; b – සී.(?)', known)).toEqual(['මඡසං', 'PTS', 'සී.(?)'])
    const tk = footnoteTokens('a – **මඡසං**, PTS', ['මඡසං', 'PTS'])
    expect(JSON.stringify(tk)).toContain('{"t":"abbr","v":"PTS"}')
    expect(JSON.stringify(tk)).toContain('{"t":"bold","c":[{"t":"abbr","v":"මඡසං"}]}')
  })
})

describe('dictWordList', () => {
  it('matches legacy goldens for sinhala input', () => {
    for (const g of goldens('dict.json') as { input: string; words: string[] }[]) {
      if (/[a-z]/i.test(g.input)) continue // singlish lists changed with singlish-search 1.2.x
      expect(dictWordList(g.input), g.input).toEqual(g.words)
    }
  })
  it('singlish', () => { expect(dictWordList('dhamma')).toContain('ධම්ම') })
  it('input rules', () => {
    expect(wordInputError('a b')).not.toBe('')
    expect(wordInputError("ධම්'")).not.toBe('')
    expect(wordInputError('ධම්ම')).toBe('')
  })
})

describe('routes', () => {
  it('eInd + fts options + links', () => {
    expect(parseEIndStr('12-3')).toEqual([12, 3])
    expect(parseEIndStr('12')).toBeNull()
    expect(parseFtsOptions('1-0-5')).toEqual({ exactWord: 1, matchPhrase: 0, wordDistance: 5 })
    expect(parseFtsOptions(undefined)).toEqual({ exactWord: 0, matchPhrase: 0, wordDistance: 10 })
    expect(ftsLink('a b', { exactWord: 0, matchPhrase: 1, wordDistance: 10 })).toBe('/fts/a%20b/0-1-10')
    expect(entryLink('dn-1-1', [0, 4], 'pali', true)).toBe('https://tipitaka.lk/dn-1-1/pali')
    expect(entryLink('dn-1-1', [0, 6], 'sinh', false)).toBe('https://tipitaka.lk/dn-1-1/0-6/sinh')
    expect(bookmarkKey('dn-1-1', [0, 6], 'sinh')).toBe('dn-1-1:0-6:sinh')
  })
})

describe('scanned pages', () => {
  it('builds image urls', () => {
    expect(getBJTImageSrc('', 1, 2)).toBe('https://pitaka.lk/bjt/newbooks/1/VP01_Page_025.jpg')
    expect(getBJTImageSrc('/bjt-scanned-pages|jpg', 10, 1)).toBe('/bjt-scanned-pages/10/DN1_Page_' + ('00' + (bjtOffset(10) + 1)).slice(-3) + '.jpg')
    expect(getBJTImageSrc('', 999, 1)).toBe('')
  })
})
import { bjtBooksInfo } from './scanned-pages'
const bjtOffset = (b: number) => bjtBooksInfo[b].pageNumOffset

describe('queries.sql parser', () => {
  const q = parseQueries(`-- name: a.b\n-- db: text\n-- params: x:str n:int\n-- max_rows: 5\nSELECT :x AS x, :n AS n, :x AS y;\n\n-- name: c\n-- db: dict\nSELECT 1;`)
  it('parses headers', () => {
    expect([...q.keys()]).toEqual(['a.b', 'c'])
    expect(q.get('a.b')).toMatchObject({ db: 'text', params: { x: 'str', n: 'int' }, maxRows: 5 })
  })
  it('renders literals safely', () => {
    expect(renderSql(q.get('a.b')!, { x: "it's", n: 3 })).toBe("SELECT 'it''s' AS x, 3 AS n, 'it''s' AS y")
    expect(() => renderSql(q.get('a.b')!, { x: 'a', n: 1.5 })).toThrow()
    expect(() => renderSql(q.get('a.b')!, { x: 'a', n: '1' as unknown as number })).toThrow()
    expect(validateParams(q.get('a.b')!, { x: 'a' })).toMatch(/missing/)
  })
  it('rejects undeclared / unused params and multiple statements', () => {
    expect(() => parseQueries('-- name: z\n-- db: text\nSELECT :y')).toThrow(/undeclared/)
    expect(() => parseQueries('-- name: z\n-- db: text\n-- params: y:int\nSELECT 1')).toThrow(/unused/)
    expect(() => parseQueries('-- name: z\n-- db: text\nSELECT 1; SELECT 2')).toThrow(/multiple/)
  })
})

import { markTerms, buildSnippet } from './highlight'
describe('highlight', () => {
  const terms = [{ text: 'සුත', prefix: true }]
  it('marks matching words in raw text', () => {
    expect(markTerms('එවං මෙ **සුතං** සුත්තං{1} x', terms)).toBe('එවං මෙ **##සුතං##** ##සුත්තං##{1} x')
    expect(markTerms('බ්‍රහ්ම', [{ text: 'බ්රහ්ම', prefix: false }])).toBe('##බ්‍රහ්ම##')
  })
  it('builds snippets in the v2 <sr> format', () => {
    const s = buildSnippet('a b c **සුතං** d', terms)
    expect(s.html).toBe('a b c <sr>සුතං</sr> d')
    expect(s.numMatches).toBe(1)
    const long = Array.from({ length: 100 }, (_, i) => `w${i}`).join(' ') + ' සුතං ' + Array.from({ length: 100 }, (_, i) => `x${i}`).join(' ')
    const s2 = buildSnippet(long, terms)
    expect(s2.html.startsWith('<b>…</b>')).toBe(true)
    expect(s2.html.endsWith('<b>…</b>')).toBe(true)
    expect(s2.html).toContain('<sr>සුතං</sr>')
  })
})
