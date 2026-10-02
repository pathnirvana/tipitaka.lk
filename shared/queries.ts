/**
 * Parser for server/queries.sql - the single list of SQL statements the app may run.
 * Must behave exactly like server/queries.go (tested on both sides with server/queries.samples.json).
 */
export type ParamType = 'str' | 'int'
export interface NamedQuery {
  name: string
  db: 'text' | 'dict'
  params: Record<string, ParamType>
  maxRows: number
  sql: string
}
export type QueryParams = Record<string, string | number>

export const MAX_STR_PARAM = 64 * 1024
const PARAM_RE = /:([a-z_][a-z0-9_]*)/gi

export function parseQueries(text: string): Map<string, NamedQuery> {
  const queries = new Map<string, NamedQuery>()
  const blocks = text.split(/^(?=-- name:)/m).filter(b => b.startsWith('-- name:'))
  for (const block of blocks) {
    const lines = block.split('\n')
    const header: Record<string, string> = {}
    let i = 0
    for (; i < lines.length; i++) {
      const m = /^-- (name|db|params|max_rows):\s*(.*)$/.exec(lines[i])
      if (!m) break
      header[m[1]] = m[2].trim()
    }
    const sql = lines.slice(i).join('\n').trim().replace(/;\s*$/, '')
    const name = header.name
    if (!name || queries.has(name)) throw new Error(`queries.sql: missing or duplicate name '${name}'`)
    if (header.db !== 'text' && header.db !== 'dict') throw new Error(`queries.sql ${name}: bad db '${header.db}'`)
    const params: Record<string, ParamType> = {}
    for (const p of (header.params || '').split(/\s+/).filter(Boolean)) {
      const [pn, pt] = p.split(':')
      if (pt !== 'str' && pt !== 'int') throw new Error(`queries.sql ${name}: bad param type ${p}`)
      params[pn] = pt
    }
    const used = new Set([...sql.matchAll(PARAM_RE)].map(m => m[1]))
    for (const u of used) if (!params[u]) throw new Error(`queries.sql ${name}: undeclared param :${u}`)
    for (const p of Object.keys(params)) if (!used.has(p)) throw new Error(`queries.sql ${name}: unused param ${p}`)
    if (!sql || sql.includes(';')) throw new Error(`queries.sql ${name}: empty sql or multiple statements`)
    const maxRows = parseInt(header.max_rows || '1000')
    queries.set(name, { name, db: header.db, params, maxRows, sql })
  }
  return queries
}

/** validates params, returns an error message or '' */
export function validateParams(q: NamedQuery, params: QueryParams): string {
  for (const [pn, pt] of Object.entries(q.params)) {
    const v = params[pn]
    if (v === undefined || v === null) return `missing param ${pn}`
    if (pt === 'int' && !(typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= 2 ** 31 - 1)) return `param ${pn} must be an int32`
    if (pt === 'str' && (typeof v !== 'string' || v.length > MAX_STR_PARAM || v.includes('\0'))) return `param ${pn} must be a string`
  }
  return ''
}

const sqlLiteral = (v: string | number) => (typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`)

/** SQL with params inlined as literals - for the Android/iOS bridge which can not bind params */
export function renderSql(q: NamedQuery, params: QueryParams): string {
  const err = validateParams(q, params)
  if (err) throw new Error(`${q.name}: ${err}`)
  return q.sql.replace(PARAM_RE, (_, pn: string) => sqlLiteral(params[pn]))
}
