import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compileHelp } from '../../help'

const md = fs.readFileSync(fileURLToPath(new URL('./si.md', import.meta.url)), 'utf8')
const ids = (html: string) => [...html.matchAll(/<h\d id="([^"]+)"/g)].map(m => m[1])
const links = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1])

describe('user guide (web/src/help/si.md)', () => {
  const page = compileHelp(md)
  it('compiles: sections, icons', () => {
    expect(page.toc.map(s => s.id)).toEqual(['start', 'bar', 'tree', 'reading', 'paragraph', 'dictionary', 'commentary', 'audio',
      'search', 'bookmarks', 'places', 'settings', 'offline', 'feedback'])
    expect(page.html).toContain('<h2 id="search">')
    expect(page.html).toContain('class="help-icon"')
    expect(page.html).not.toMatch(/\{#|:[a-z-]+:(?![/\d])/) // every {#id} and :icon: replaced
  })
  it('links to sections and pages that exist', () => {
    for (const l of links(page.html)) {
      if (l.startsWith('#')) expect(ids(page.html)).toContain(l.slice(1))
      else if (l.startsWith('/')) expect(l).toMatch(/^\/(bookmarks|names|map|settings|abbreviations)?$/)
      else expect(l).toMatch(/^(https:\/\/|mailto:)/)
    }
  })
  it('throws on an unknown icon', () => {
    expect(() => compileHelp('tap :no-such-icon:')).toThrow(/no-such-icon/)
  })
})
