/** test helpers: a DataSource running the named queries on the fixture dbs with better-sqlite3 */
import Database from 'better-sqlite3'
import { QUERIES, type DataSource } from './data/source'
import type { QueryParams } from '@shared/queries'

export class LocalSource implements DataSource {
  calls: { name: string; params: QueryParams }[] = []
  private dbs = { text: new Database('e2e/fixtures/db/text.db', { readonly: true }), dict: new Database('e2e/fixtures/db/dict.db', { readonly: true }) }
  async run<T>(name: string, params: QueryParams): Promise<T[]> {
    this.calls.push({ name, params })
    const q = QUERIES.get(name)!
    return this.dbs[q.db].prepare(q.sql).all(params) as T[]
  }
}
