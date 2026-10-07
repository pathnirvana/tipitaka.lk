/**
 * npm run build:data [-- --text-dir public/static/text] [--out db] [--fixture] [--update-baseline]
 * Builds db/text.db + db/build-info.json + db/build-report.md and the static web data files.
 * The text JSON files are only read.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'
import { loadCorpus } from './corpus'
import { buildTree, dfsOrder, type TreeTuple } from './tree'
import { validateCorpus, toBaseline, newWarnings, type Baseline } from './validate'
import { mapEntriesToNodes, legacyHeadingMapping } from './entry-nodes'
import { writeDb, SCHEMA_VERSION } from './write-db'
import { writeSitemap, writeFixtureDict } from './emit'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const opt = (name: string, def: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def }

const fixture = flag('--fixture')
const textDir = opt('--text-dir', fixture ? 'e2e/fixtures/text' : 'public/static/text')
const outDir = opt('--out', fixture ? 'e2e/fixtures/db' : 'db')
const baselineFile = 'build/validation-baseline.json'

function dbVersion(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0')
  return parseInt(`${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}`)
}

function main() {
  const t0 = Date.now()
  const corpus = loadCorpus(textDir)
  console.log(`loaded ${corpus.files.length} files from ${textDir} in ${Date.now() - t0} ms`)

  const report: string[] = [`# Build report`, '', `- text dir: ${textDir}`, `- files: ${corpus.files.length}`, `- content hash: ${corpus.contentHash}`]
  const v = validateCorpus(corpus.files, corpus.names)
  const treeRes = buildTree(corpus.files)
  if (fixture) { // a partial corpus leaves some base tree placeholders empty - drop them
    for (const [k, val] of treeRes.tree) if (!val.length) treeRes.tree.delete(k)
    treeRes.errors = treeRes.errors.filter(e => !e.startsWith('tree placeholder'))
  }
  const errors = [...v.errors.map(e => `${e.file} ${e.where} [${e.code}] ${e.msg}`), ...treeRes.errors]
  if (errors.length) {
    console.error(`\n${errors.length} VALIDATION ERRORS:\n` + errors.slice(0, 100).join('\n'))
    process.exit(1)
  }
  if (!fixture) {
    if (flag('--update-baseline') || !fs.existsSync(baselineFile)) {
      fs.writeFileSync(baselineFile, JSON.stringify(toBaseline(v.warnings), null, 1) + '\n')
      console.log(`wrote validation baseline ${baselineFile}`)
    } else {
      const fresh = newWarnings(v.warnings, JSON.parse(fs.readFileSync(baselineFile, 'utf-8')) as Baseline)
      if (fresh.length) {
        console.error(`\nNEW VALIDATION WARNINGS (fix the text or run with --update-baseline):\n` + fresh.join('\n'))
        for (const w of v.warnings) if (fresh.some(f => f.startsWith(`${w.file}|${w.code}:`))) console.error(`  ${w.file} ${w.where} [${w.code}] ${w.msg}`)
        process.exit(1)
      }
    }
  }

  const tree = treeRes.tree as Map<string, TreeTuple>
  const order = dfsOrder(tree)
  const entryNodes = mapEntriesToNodes(corpus.files, tree, order)

  // report: warnings + differences with the v2 heading-count key mapping (A14)
  report.push(`- tree nodes: ${tree.size}`, '', `## Validation warnings (${v.warnings.length})`, '')
  const byCode: Record<string, number> = {}
  for (const w of v.warnings) byCode[w.code] = (byCode[w.code] || 0) + 1
  for (const [c, n] of Object.entries(byCode)) report.push(`- ${c}: ${n}`)
  report.push('', '<details><summary>all warnings</summary>', '', ...v.warnings.map(w => `- ${w.file} ${w.where} [${w.code}] ${w.msg}`), '', '</details>', '')
  report.push('## Entry → sutta key mapping differences vs v2 heading counting (A14)', '')
  for (const f of corpus.files) {
    const legacy = legacyHeadingMapping(f, order), mine = entryNodes.get(f.filename)!
    let diff = 0
    legacy.forEach((pg, pi) => pg.forEach((k, ei) => { if (k && k !== (mine[pi][ei] >= 0 ? order[mine[pi][ei]] : '')) diff++ }))
    if (diff) report.push(`- ${f.filename}: ${diff} entries`)
  }

  fs.mkdirSync(outDir, { recursive: true })
  const queriesSql = fs.readFileSync('server/queries.sql', 'utf-8')
  const apiHash = crypto.createHash('sha256').update(`${corpus.contentHash}|${SCHEMA_VERSION}|${queriesSql}`).digest('hex').slice(0, 16)
  let gitCommit = ''
  try { gitCommit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { /* not a git checkout */ }
  const meta: Record<string, string> = {
    schema_version: SCHEMA_VERSION, content_hash: corpus.contentHash, api_hash: apiHash,
    db_version: String(dbVersion()), git_commit: gitCommit, built_at: new Date().toISOString(),
  }
  const dbFile = path.join(outDir, 'text.db')
  const t1 = Date.now()
  writeDb(dbFile, { corpus, tree, order, entryNodes, meta })
  const size = fs.statSync(dbFile).size
  console.log(`wrote ${dbFile} (${(size / 1e6).toFixed(1)} MB) in ${((Date.now() - t1) / 1000).toFixed(1)} s`)
  report.splice(5, 0, `- db: ${dbFile} ${(size / 1e6).toFixed(1)} MB, api_hash ${apiHash}, db_version ${meta.db_version}`)
  fs.writeFileSync(path.join(outDir, 'build-info.json'), JSON.stringify({ api_hash: apiHash, db_version: parseInt(meta.db_version), content_hash: corpus.contentHash, schema_version: SCHEMA_VERSION }, null, 1) + '\n')
  fs.writeFileSync(path.join(outDir, 'build-report.md'), report.join('\n') + '\n')

  if (fixture) writeFixtureDict(path.join(outDir, 'dict.db'))
  // static data used by the web app (also needed by the e2e tests which only build the fixture dbs)
  const dataOut = 'web/public/static/data'
  fs.mkdirSync(dataOut, { recursive: true })
  for (const f of ['footnote-abbreviations.json', 'file-map.json']) fs.copyFileSync(path.join('public/static/data', f), path.join(dataOut, f))
  if (!fixture) writeSitemap(order, 'web/public/static/sitemap.txt')
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s. ${v.warnings.length} warnings - see ${outDir}/build-report.md`)
}
main()
