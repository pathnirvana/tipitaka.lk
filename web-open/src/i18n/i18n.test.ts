import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// every string of the interface (the literal first argument of t(...), and the labels given to t() as data) has a
// translation in every language: in tipitaka.app's <lang>.json or in this site's open.<lang>.json
const SRC = 'web-open/src', DIR = `${SRC}/i18n`
const LANGS = ['si', 'my', 'th', 'kh', 'hi', 'ch']
const CALL = [/\bt\(\s*'((?:[^'\\]|\\.)*)'/g, /\b(?:label|title): '((?:[^'\\]|\\.)*)'/g]
// ThemePicker NAMES
const DATA = ['Light', 'Sepia', 'Green', 'Dark', 'Auto']

function uiStrings(): string[] {
  const out = new Set<string>(DATA)
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f)
      if (fs.statSync(p).isDirectory()) walk(p)
      else if (/\.(vue|ts)$/.test(f) && !f.endsWith('.test.ts')) {
        const s = fs.readFileSync(p, 'utf8')
        for (const re of CALL) for (const m of s.matchAll(re)) out.add(m[1].replace(/\\(['"\\])/g, '$1'))
      }
    }
  }
  walk(SRC)
  return [...out].filter(Boolean).sort()
}
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as Record<string, string>
const placeholders = (s: string) => (s.match(/\{\d\}/g) ?? []).sort().join()

describe('interface translations', () => {
  const strings = uiStrings()
  it('finds the strings', () => { expect(strings.length).toBeGreaterThan(60) })
  for (const lang of LANGS) it(`${lang}: every string translated, placeholders kept`, () => {
    const tr = { ...read(`${lang}.json`), ...read(`open.${lang}.json`) }
    expect(strings.filter(k => !tr[k])).toEqual([])
    expect(strings.filter(k => placeholders(k) !== placeholders(tr[k]))).toEqual([])
    // open.<lang>.json holds only what tipitaka.app's file does not
    expect(Object.keys(read(`open.${lang}.json`)).filter(k => k in read(`${lang}.json`))).toEqual([])
  })
})
