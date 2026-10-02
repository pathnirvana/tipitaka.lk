/** see sqlite-compat.sh */
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import Database from 'better-sqlite3'
import { parseQueries, renderSql } from '../shared/queries'
import { buildMatch } from '../shared/fts-query'

const old = process.env.SQLITE_OLD!
const queries = parseQueries(fs.readFileSync('server/queries.sql', 'utf-8'))
const samples = JSON.parse(fs.readFileSync('server/queries.samples.json', 'utf-8')) as Record<string, Record<string, string | number>[]>
const dbFiles = { text: 'e2e/fixtures/db/text.db', dict: 'e2e/fixtures/db/dict.db' }
const modern = { text: new Database(dbFiles.text, { readonly: true }), dict: new Database(dbFiles.dict, { readonly: true }) }

let failures = 0
function check(label: string, db: 'text' | 'dict', sql: string, expectedRows: number) {
  try {
    const out = execFileSync(old, ['-bail', '-list', '-separator', '\t', dbFiles[db]], { input: sql + ';\n', stdio: ['pipe', 'pipe', 'pipe'] }).toString()
    const rows = out ? out.replace(/\n$/, '').split('\n').length : 0
    // multi line text values make the line count larger than the row count - only flag fewer rows
    if (rows < expectedRows) { failures++; console.error(`FAIL ${label}: 3.9.2 returned ${rows} lines, modern ${expectedRows} rows`) }
    else console.log(`ok   ${label} (${expectedRows} rows)`)
  } catch (e) {
    failures++
    console.error(`FAIL ${label}: ${(e as { stderr?: Buffer }).stderr?.toString() || e}`)
  }
}

for (const [name, q] of queries) {
  for (const params of samples[name] || []) {
    const expected = (modern[q.db].prepare(q.sql).all(params) as unknown[]).length
    check(`${name} ${JSON.stringify(params)}`, q.db, renderSql(q, params), expected)
  }
}
const ftsCases = ['එවං', 'එවං මෙ', 'සුත', 'කුසල OR අකුසල', 'කුසල AND අකුසල', '^එවං', 'පඨම*', 'බ්‍රහ්මජාල']
for (const input of ftsCases) for (const [exactWord, matchPhrase] of [[0, 0], [1, 1]]) {
  const m = buildMatch(input, { exactWord, matchPhrase, wordDistance: 10 })
  if (!m.ok) throw new Error(m.error)
  const q = queries.get('fts.candidates')!
  const params = { q: m.match, lang: 2, groups: '', limit: 2000 }
  const expected = (modern.text.prepare(q.sql).all(params) as unknown[]).length
  check(`fts '${m.match}'`, 'text', renderSql(q, params), expected)
}
if (failures) { console.error(`${failures} failures`); process.exit(1) }
console.log('all queries work on SQLite 3.9.2 (Android API 24 equivalent)')
