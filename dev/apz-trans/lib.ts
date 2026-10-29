/**
 * Shared parts of the sin_apz QA / translation runs (dev/apz-trans): packets of consecutive BJT entries with their three
 * sources (Pāḷi, BJT Sinhala, aṭṭhakathā from db/text.db's entry_link and gloss) plus APZ, and the model runners:
 * Claude through headless `claude -p` (the user's plan, no API key) and Gemini over REST (GEMINI_API_KEY, billed).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import Database from 'better-sqlite3'
import { TYPES } from '../../shared/constants'
import { tokenize } from '../../shared/tokenize'
import { convert } from '@pnfo/pali-converter'

export const DIR = 'dev/apz-trans'
export const OUT = path.join(DIR, 'out')
export const TSV = path.join(DIR, 'glossary.tsv')
const TEXT_DIR = 'public/static/text'
const APZ_DIR = 'public/static/text-apz'

export interface Entry {
  key: string // "<file> <page_idx>:<entry_idx>"
  file: string; page: number; entry: number; id: number
  type: string; pali: string; bjt: string
  apz?: string; ai?: boolean // the current sin_apz and its ai flag
}
export interface Atta { key: string; pali: string; sinh: string }
export interface Packet {
  id: string; mode: 'translate' | 'qa'
  entries: Entry[]
  glosses: Record<string, string[]> // entry key -> "mula words ⇒ explanation"
  atta: Atta[]
  prev: { key: string; si: string }[]
  terms?: string[] // the glossary rows of the terms in these entries
}
export interface Item { i: number; si: string; verdict?: string; errors?: { kind: string; note: string }[] }
export interface Result {
  packet: string; runner: string; model: string; items: Item[]
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number; costUsd: number; ms: number }
}

const clip = (s: string, n: number) => s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + ' …' : s

export function openDb() { return new Database('db/text.db', { readonly: true }) }

const apzCache = new Map<string, { pages: { entries: string[]; ai?: number[] }[] } | null>()
function apzFile(file: string) {
  if (!apzCache.has(file)) {
    const f = path.join(APZ_DIR, file + '.json')
    apzCache.set(file, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf-8')) : null)
  }
  return apzCache.get(file)!
}

/** the entries of a file from..to (page_idx:entry_idx, inclusive), in order */
export function entries(db: Database.Database, file: string, from: string, to: string): Entry[] {
  const [fp, fe] = from.split(':').map(Number), [tp, te] = to.split(':').map(Number)
  const rows = db.prepare(`SELECT e.id, e.page_idx, e.entry_idx, e.p_type, e.p_text, e.s_text FROM entry e JOIN file f ON f.id = e.file_id
    WHERE f.name = ? AND (e.page_idx * 10000 + e.entry_idx) BETWEEN ? AND ? ORDER BY e.page_idx, e.entry_idx`)
    .all(file, fp * 10000 + fe, tp * 10000 + te) as { id: number; page_idx: number; entry_idx: number; p_type: number; p_text: string; s_text: string | null }[]
  const apz = apzFile(file)
  return rows.map(r => {
    const pg = apz?.pages[r.page_idx]
    return {
      key: `${file} ${r.page_idx}:${r.entry_idx}`, file, page: r.page_idx, entry: r.entry_idx, id: r.id,
      type: TYPES[r.p_type], pali: r.p_text, bjt: r.s_text ?? '',
      ...(pg ? { apz: pg.entries[r.entry_idx], ai: !!pg.ai?.includes(r.entry_idx) } : {}),
    }
  })
}

const wordsCache = new Map<number, string[]>()
function words(db: Database.Database, id: number) {
  if (!wordsCache.has(id)) wordsCache.set(id, tokenize((db.prepare('SELECT p_text FROM entry WHERE id = ?').pluck().get(id) as string) ?? '').map(w => w.t))
  return wordsCache.get(id)!
}

/**
 * A packet of consecutive entries with their aṭṭhakathā: the word glosses of each entry and the linked atta
 * paragraphs that explain the most of them (with BJT's Sinhala of the atta), up to attaBudget Pāḷi chars.
 */
export function packet(db: Database.Database, id: string, mode: Packet['mode'], es: Entry[], opts: { attaBudget?: number; prev?: { key: string; si: string }[]; terms?: string[] } = {}): Packet {
  const budget = opts.attaBudget ?? 4000
  const glosses: Record<string, string[]> = {}
  const score = new Map<number, number>() // atta entry id -> how much of this packet it explains
  const gq = db.prepare('SELECT * FROM gloss WHERE m_entry = ? ORDER BY m_w')
  const lq = db.prepare('SELECT atta, src FROM entry_link WHERE mula = ?')
  for (const e of es) {
    const mw = words(db, e.id), lines = new Set<string>()
    for (const g of gq.all(e.id) as Record<string, number>[]) {
      const aw = words(db, g.a_entry)
      const def = g.x_entry === g.a_entry ? aw.slice(g.a_w, g.x_w + 1) : aw.slice(g.a_w, g.a_w + 40)
      const m = mw.slice(g.m_w, g.m_eentry === e.id ? g.m_ew + 1 : mw.length).join(' ')
      if (lines.size < 30) lines.add(`${m} ⇒ ${clip(def.join(' '), 300)}`)
      score.set(g.a_entry, (score.get(g.a_entry) ?? 0) + 2)
    }
    if (lines.size) glosses[e.key] = [...lines]
    const links = lq.all(e.id) as { atta: number; src: number }[]
    if (links.length <= 40) for (const l of links) score.set(l.atta, (score.get(l.atta) ?? 0) + (l.src === 1 ? 1 : 0.5)) // (a whole preamble linked: no signal)
  }
  const aq = db.prepare(`SELECT f.name, e.page_idx, e.entry_idx, e.p_text, e.s_text FROM entry e JOIN file f ON f.id = e.file_id WHERE e.id = ?`)
  const atta: (Atta & { order: number })[] = []
  let used = 0
  for (const [aid] of [...score].sort((a, b) => b[1] - a[1])) {
    const a = aq.get(aid) as { name: string; page_idx: number; entry_idx: number; p_text: string; s_text: string | null }
    const p = clip(a.p_text, 1500)
    if (used + p.length > budget) continue
    used += p.length
    atta.push({ key: `${a.name} ${a.page_idx}:${a.entry_idx}`, pali: p, sinh: clip(a.s_text ?? '', 1800), order: aid })
  }
  atta.sort((a, b) => a.order - b.order)
  return { id, mode, entries: es, glosses, atta: atta.map(({ order, ...a }) => a), prev: opts.prev ?? [], ...(opts.terms?.length ? { terms: opts.terms } : {}) }
}

const noFn = (s: string) => s.replace(/\{[^}]*\}/g, '')

/** the packet as the model reads it */
export function render(p: Packet, extra?: (e: Entry, i: number) => string | undefined): string {
  const out: string[] = []
  if (p.terms?.length) out.push('# TERMS (the glossary: use these renderings unless the commentary requires another)', ...p.terms, '')
  if (p.prev.length) out.push('# PREV (already translated, for consistency)', ...p.prev.map(x => `[${x.key}] ${x.si}`), '')
  if (p.atta.length) {
    out.push('# ATTA paragraphs')
    for (const a of p.atta) out.push(`[${a.key}]`, `P: ${noFn(a.pali)}`, ...(a.sinh ? [`S: ${noFn(a.sinh)}`] : []), '')
  }
  out.push('# ENTRIES')
  p.entries.forEach((e, i) => {
    out.push(`## i=${i + 1} (${e.type}) [${e.key}]`, `PALI: ${noFn(e.pali)}`, `BJT: ${noFn(e.bjt) || '(none)'}`)
    if (p.mode === 'qa') out.push(`APZ${e.ai ? ' (AI fill-in)' : ''}: ${e.apz || '(empty)'}`)
    for (const g of p.glosses[e.key] ?? []) out.push(`gloss: ${g}`)
    const x = extra?.(e, i)
    if (x) out.push(x)
    out.push('')
  })
  return out.join('\n')
}

export const STYLE = fs.readFileSync(path.join(DIR, 'prompt.md'), 'utf-8')

export const TASK = {
  translate: `## Task
Translate every entry under # ENTRIES into Sinhala following the rules above. Return {"items": [{"i", "si"}]}: one item per
entry, same i numbers, in order. "si" is the Sinhala text of that entry only.`,
  qa: `## Task: quality check of APZ
Each entry has the current Sinhala (APZ) to check against the PALI, BJT and ATTA. For each entry decide:
- "ok": APZ is correct and complete. Return "si" as "" (the APZ stays as it is).
- "fixed": APZ is mostly right. Correct its errors (meaning wrong against the Pāḷi or the commentary, wrong numbers or names,
  missing or extra clauses, edition differences from the BJT Pāḷi, typos and digitisation errors) and lightly polish awkward
  or archaic wording. Keep most of its sentences.
- "retranslated": APZ is empty, a copy of the Pāḷi, wrong throughout, or belongs to another entry. Translate the entry anew.
List every change in "errors" as {"kind", "note"}. kind is one of: meaning, omission, addition, number, name, edition, typo,
style, alignment. The note is short, in English, and quotes the words concerned.
Return {"items": [{"i", "verdict", "si", "errors"}]}: one item per entry, same i numbers, in order.`,
  review: `## Task: review a draft translation
Each entry has a DRAFT Sinhala translation made by another model from the same sources. Check it against the PALI, BJT and
ATTA, and against the rules above. Return the corrected translation:
- "ok": the draft is right. Return it unchanged in "si".
- "fixed": you corrected it. Keep the draft's wording where it is right.
List every change in "errors" as {"kind", "note"}. kind is one of: meaning, omission, addition, number, name, style, peyyala,
pali-left. The note is short, in English, and quotes the words concerned.
Return {"items": [{"i", "verdict", "si", "errors"}]}: one item per entry, same i numbers, in order.`,
}

const ITEM_PROPS = {
  i: { type: 'integer' }, si: { type: 'string' }, verdict: { type: 'string' },
  errors: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string' }, note: { type: 'string' } }, required: ['kind', 'note'] } },
}
export const SCHEMA = (withVerdict: boolean) => ({
  type: 'object', required: ['items'],
  properties: { items: { type: 'array', items: { type: 'object', properties: withVerdict ? ITEM_PROPS : { i: ITEM_PROPS.i, si: ITEM_PROPS.si },
    required: withVerdict ? ['i', 'verdict', 'si', 'errors'] : ['i', 'si'] } } },
})

function claudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN
  const ext = path.join(os.homedir(), '.vscode/extensions')
  const v = fs.readdirSync(ext).filter(d => d.startsWith('anthropic.claude-code-')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop()
  if (!v) throw new Error('claude not found: set CLAUDE_BIN')
  return path.join(ext, v, 'resources/native-binary/claude')
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * One headless Claude Code call on the user's plan: no tools, no settings, MCP, CLAUDE.md or memory (it runs in an
 * empty directory), structured JSON out. On a usage limit it waits for the reset and tries again.
 */
export async function claude(model: string, system: string, user: string, schema: object, effort = process.env.APZ_EFFORT ?? 'medium'):
  Promise<{ out: { items: Item[] }; usage: Result['usage'] }> {
  const cwd = path.join(os.tmpdir(), 'apz-trans-cwd')
  fs.mkdirSync(cwd, { recursive: true })
  const args = ['-p', '--model', model, '--effort', effort, '--tools', '', '--strict-mcp-config', '--disable-slash-commands',
    '--no-session-persistence', '--setting-sources', '', '--system-prompt', system, '--json-schema', JSON.stringify(schema), '--output-format', 'json']
  for (let attempt = 0; ; attempt++) {
    const t0 = Date.now()
    const { code, stdout, stderr } = await new Promise<{ code: number; stdout: string; stderr: string }>((res, rej) => {
      const p = spawn(claudeBin(), args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = '', stderr = ''
      p.stdout.on('data', d => stdout += d); p.stderr.on('data', d => stderr += d)
      p.on('error', rej); p.on('close', code => res({ code: code ?? 1, stdout, stderr }))
      p.stdin.end(user)
    })
    let d: Record<string, any> | undefined
    try { d = JSON.parse(stdout) } catch { /* not json: an error */ }
    const msg = String(d?.result ?? stderr ?? stdout)
    if (d && !d.is_error && d.structured_output) {
      const u = d.usage
      return { out: d.structured_output, usage: { input: u.input_tokens, output: u.output_tokens, cacheRead: u.cache_read_input_tokens,
        cacheWrite: u.cache_creation_input_tokens, costUsd: d.total_cost_usd, ms: Date.now() - t0 } }
    }
    if (/usage limit|rate.?limit|overloaded|5-hour|weekly limit/i.test(msg) && attempt < 50) {
      const reset = Number(msg.match(/\|(\d{10})\b/)?.[1]) * 1000
      const wait = reset > Date.now() ? reset - Date.now() + 60_000 : 15 * 60_000
      console.error(`claude: ${msg.slice(0, 200)} - waiting ${Math.round(wait / 60000)} min`)
      await sleep(wait); continue
    }
    // (also when the VS Code extension updates under a run: the old binary is killed, claudeBin() finds the new one)
    if (attempt < 5) { console.error(`claude failed (${code}): ${msg.slice(0, 300)} - retrying`); await sleep(30_000 * (attempt + 1)); continue }
    throw new Error(`claude failed (${code}): ${msg.slice(0, 500)}`)
  }
}

function geminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY
  const env = fs.readFileSync(path.resolve('../misc-ai/PTS/.env'), 'utf-8')
  const k = env.match(/^GEMINI_API_KEY\s*=\s*["']?([^"'\s]+)/m)?.[1]
  if (!k) throw new Error('GEMINI_API_KEY is not set')
  return k
}

/** gemini-4-argon prices per 1M tokens (input, output) for the cost estimate - set GEMINI_PRICE="in,out" if they differ */
const [GIN, GOUT] = (process.env.GEMINI_PRICE ?? '2,12').split(',').map(Number)

/** one Gemini call over REST (as dev/names-si/translate.ts) with the same JSON schema */
export async function gemini(model: string, system: string, user: string, schema: object): Promise<{ out: { items: Item[] }; usage: Result['usage'] }> {
  const toGemini = (s: any): any => s.type === 'object'
    ? { type: 'OBJECT', properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGemini(v)])), required: s.required }
    : s.type === 'array' ? { type: 'ARRAY', items: toGemini(s.items) } : { type: s.type.toUpperCase() }
  for (let attempt = 0; ; attempt++) {
    const t0 = Date.now()
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': geminiKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: toGemini(schema) } }),
    })
    if (res.ok) {
      const d = await res.json() as { candidates?: { content: { parts: { text?: string; thought?: boolean }[] } }[]; usageMetadata?: Record<string, number> }
      const text = d.candidates?.[0]?.content.parts.filter(p => !p.thought).map(p => p.text ?? '').join('') ?? ''
      const u = d.usageMetadata ?? {}
      const input = u.promptTokenCount ?? 0, output = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0)
      return { out: JSON.parse(text), usage: { input, output, cacheRead: u.cachedContentTokenCount ?? 0, cacheWrite: 0,
        costUsd: (input * GIN + output * GOUT) / 1e6, ms: Date.now() - t0 } }
    }
    if (attempt >= 4 || ![429, 500, 503].includes(res.status)) throw new Error(`gemini ${res.status} ${(await res.text()).slice(0, 500)}`)
    await sleep(10_000 * (attempt + 1))
  }
}

/** the same shuffle every time for a packet: A is opus when the id hashes even */
export const opusIsA = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 2 === 0

const base = (lemma: string) => lemma.replace(/\s+\d+(\.\d+)?$/, '')

/** the DPD lemma bases of a Pāḷi word in Sinhala script (several for homonyms) */
export function lemmaOf(dict: Database.Database) {
  const q = dict.prepare('SELECT headwords FROM dpd_lookup WHERE word = ?').pluck()
  const h = dict.prepare('SELECT lemma, pos, meaning FROM dpd_head WHERE id = ?')
  const cache = new Map<string, { base: string; pos: string; meaning: string }[]>()
  return (w: string) => {
    const r = convert(w, 'latn', 'sinh').toLowerCase()
    if (!cache.has(r)) {
      const ids = JSON.parse((q.get(r) as string | undefined) || '[]') as number[]
      cache.set(r, ids.map(id => h.get(id) as { lemma: string; pos: string; meaning: string } | undefined).filter(x => !!x)
        .map(x => ({ base: base(x!.lemma), pos: x!.pos, meaning: x!.meaning })))
    }
    return cache.get(r)!
  }
}

export interface GlossRow { pali: string; roman: string; si: string; note: string; freq: number; status: string }
export function readGlossary(): Map<string, GlossRow> {
  if (!fs.existsSync(TSV)) return new Map()
  return new Map(fs.readFileSync(TSV, 'utf-8').split('\n').slice(1).filter(Boolean).map(l => {
    const [pali, roman, si, note, freq, status] = l.split('\t')
    return [roman, { pali, roman, si, note, freq: Number(freq), status }]
  }))
}

let gloss: { lemmas: ReturnType<typeof lemmaOf>; rows: Map<string, GlossRow> } | undefined
/** the glossary rows (with one of these statuses) of the terms that occur in the entries, as "pali → si (note)" */
export function termsFor(es: Entry[], statuses = ['ok']): string[] {
  gloss ??= { lemmas: lemmaOf(new Database('db/dict.db', { readonly: true })), rows: readGlossary() }
  const out = new Map<string, string>()
  for (const e of es) for (const { t } of tokenize(e.pali)) for (const l of gloss.lemmas(t)) {
    const r = gloss.rows.get(l.base)
    if (r && statuses.includes(r.status)) out.set(r.roman, `${r.pali} → ${r.si}${r.note ? ` (${r.note})` : ''}`)
  }
  return [...out.values()]
}

export const readJsonl = <T>(f: string): T[] => fs.existsSync(f) ? fs.readFileSync(f, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []
export const appendJsonl = (f: string, x: unknown) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.appendFileSync(f, JSON.stringify(x) + '\n') }

/** the BJT text file (for checks that need the raw entries) */
export const textFile = (file: string) => JSON.parse(fs.readFileSync(path.join(TEXT_DIR, file + '.json'), 'utf-8'))
