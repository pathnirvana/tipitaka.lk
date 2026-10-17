import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { sha1 } from './sha1'

describe('sha1', () => {
  it('matches node crypto on edge lengths and real sinhala text', () => {
    const j = JSON.parse(fs.readFileSync('e2e/fixtures/text/dn-1.json', 'utf-8'))
    const samples = ['', 'a', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), ...j.pages.slice(0, 3).flatMap((p: { pali: { entries: { text: string }[] } }) => p.pali.entries.map(e => e.text))]
    for (const s of samples) expect(sha1(s)).toBe(crypto.createHash('sha1').update(s).digest('hex'))
  })
})
