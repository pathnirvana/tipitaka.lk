/**
 * The user guide (tipitaka.app's): web/src/help/si.md is compiled to HTML at build time (a vite plugin, no Markdown
 * parser in the app). Besides Markdown:
 *  - `## Title {#id}`: the anchor of a section (links to the guide can point to them: /help#search)
 *  - `:name:` is the Material Design icon of that name (https://pictogrammers.com/library/mdi/), the one the app
 *    shows (~icons/mdi/<name>)
 *  - links: `/settings` is a page of the app, `#search` a section of the guide
 */
import fs from 'node:fs'
import { Marked, type Tokens } from 'marked'
import type { Plugin } from 'vite'

export interface HelpPage { html: string; toc: { id: string; title: string }[] }

const mdi = JSON.parse(fs.readFileSync(new URL('../node_modules/@iconify-json/mdi/icons.json', import.meta.url), 'utf8')) as
  { icons: Record<string, { body: string }>; aliases?: Record<string, { parent: string }> }

function icon(name: string): string {
  const body = (mdi.icons[name] ?? mdi.icons[mdi.aliases?.[name]?.parent ?? ''])?.body
  if (!body) throw new Error(`help: no mdi icon :${name}:`)
  return `<svg class="help-icon" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">${body}</svg>`
}

const ID = /\s*\{#([a-z0-9-]+)\}\s*$/

export function compileHelp(md: string): HelpPage {
  const toc: HelpPage['toc'] = []
  const marked = new Marked({
    walkTokens(t) {
      if (t.type !== 'heading') return
      const h = t as Tokens.Heading & { id?: string }
      const m = ID.exec(h.text)
      if (!m) return
      h.id = m[1]
      h.text = h.text.replace(ID, '')
      const last = h.tokens[h.tokens.length - 1] as Tokens.Text | undefined
      if (last && 'text' in last) last.text = last.text.replace(ID, '')
      if (h.depth === 2) toc.push({ id: m[1], title: h.text.replace(/:[a-z][a-z0-9-]*:/g, '').trim() })
    },
    renderer: {
      heading(t) {
        const id = (t as Tokens.Heading & { id?: string }).id
        return `<h${t.depth}${id ? ` id="${id}"` : ''}>${this.parser.parseInline(t.tokens)}</h${t.depth}>\n`
      },
    },
  })
  const html = (marked.parse(md.replace(/<!--[\s\S]*?-->/g, ''), { async: false }) as string).replace(/:([a-z][a-z0-9-]*):/g, (_, n: string) => icon(n))
  return { html, toc }
}

/** import page from './help/si.md' -> HelpPage */
export function helpMarkdown(): Plugin {
  return {
    name: 'help-markdown',
    transform(code, id) {
      if (!id.endsWith('.md')) return null
      return { code: `export default ${JSON.stringify(compileHelp(code))}`, map: null }
    },
  }
}
