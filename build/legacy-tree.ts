/**
 * Runs the UNMODIFIED v2 dev/build-tree.js against a text folder and returns its tree (used by parity tests).
 * The script's output path is redirected in memory; nothing is written to disk.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

export function runLegacyBuildTree(textDir: string): Record<string, unknown> {
  const scriptPath = path.resolve('dev/build-tree.js')
  let src = fs.readFileSync(scriptPath, 'utf-8')
  src = src.replace(/const dataInputFolder = [^\r\n]*/, 'const dataInputFolder = __textDir + "/"')
  if (!src.includes("__textDir")) throw new Error("could not redirect dev/build-tree.js input folder")
  let output = ''
  const require = createRequire(scriptPath)
  const fakeFs = { ...fs, writeFileSync: (_p: string, data: string) => { output = data } }
  const req = (m: string) => (m === 'fs' ? fakeFs : require(m))
  const quiet = { log: () => {}, error: () => {} }
  new Function('require', '__dirname', '__textDir', 'console', src)(req, path.dirname(scriptPath), path.resolve(textDir), quiet)
  return JSON.parse(output)
}
