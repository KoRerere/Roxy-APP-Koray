import type {
  GetOperation,
  Item,
  ListNamespacesOperation,
  Operation,
  PutOperation,
  SearchItem,
  SearchOperation,
} from '@langchain/langgraph-checkpoint'
/**
 * SQLite-backed BaseStore implementation using Node.js built-in node:sqlite.
 * Persists agent long-term memory across restarts.
 *
 * Requires Node.js >= 22.5.0 for node:sqlite support.
 */
import { BaseStore } from '@langchain/langgraph-checkpoint'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

function nsKey(namespace: string[]): string {
  return namespace.join(':')
}

function parseNs(ns: string): string[] {
  return ns ? ns.split(':') : []
}

function compareValues(a: unknown, b: unknown): boolean {
  if (a === b)
    return true
  if (a == null || b == null)
    return false
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>
    if (aObj.$eq !== undefined)
      return compareValues(aObj.$eq, b)
    if (bObj.$eq !== undefined)
      return compareValues(a, bObj.$eq)
    if (aObj.$ne !== undefined)
      return !compareValues(aObj.$ne, b)
    if (aObj.$gt !== undefined && typeof b === 'number')
      return (b as number) > (aObj.$gt as number)
    if (aObj.$gte !== undefined && typeof b === 'number')
      return (b as number) >= (aObj.$gte as number)
    if (aObj.$lt !== undefined && typeof b === 'number')
      return (b as number) < (aObj.$lt as number)
    if (aObj.$lte !== undefined && typeof b === 'number')
      return (b as number) <= (aObj.$lte as number)
  }
  return false
}

function matchesFilter(item: Item, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, value]) =>
    compareValues(value, (item.value as Record<string, unknown>)[key]),
  )
}

export class SqliteStore extends BaseStore {
  private db: DatabaseSync
  private initDone = false

  constructor(dbPath: string) {
    super()
    const path = dbPath
    const dir = join(path, '..')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    this.db = new DatabaseSync(path)
    this.ensureTable()
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS store (
        ns TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (ns, key)
      );
      CREATE INDEX IF NOT EXISTS idx_store_ns ON store(ns);
    `)
  }

  override start(): void {
    if (!this.initDone) {
      this.initDone = true
    }
  }

  override stop(): void {
    this.db.close()
  }

  override async batch<Op extends readonly Operation[]>(
    operations: Op,
  ): Promise<{ [K in keyof Op]: Op[K] extends PutOperation ? void : Op[K] extends SearchOperation ? SearchItem[] : Op[K] extends GetOperation ? Item | null : Op[K] extends ListNamespacesOperation ? string[][] : never }> {
    const results: unknown[] = []

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i]

      if ('key' in op && 'namespace' in op && !('value' in op)) {
        const getOp = op as GetOperation
        const ns = nsKey(getOp.namespace)
        const row = this.db.prepare('SELECT value, created_at, updated_at FROM store WHERE ns = ? AND key = ?').get(ns, getOp.key) as { value: string, created_at: string, updated_at: string } | undefined
        if (!row) {
          results.push(null)
        }
        else {
          const value = JSON.parse(row.value) as Record<string, unknown>
          results.push({
            key: getOp.key,
            namespace: getOp.namespace,
            value,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          })
        }
      }
      else if ('value' in op) {
        const putOp = op as PutOperation
        const ns = nsKey(putOp.namespace)
        if (putOp.value === null) {
          this.db.prepare('DELETE FROM store WHERE ns = ? AND key = ?').run(ns, putOp.key)
        }
        else {
          const now = new Date().toISOString()
          const valueStr = JSON.stringify(putOp.value)
          this.db.prepare(
            `INSERT INTO store (ns, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(ns, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          ).run(ns, putOp.key, valueStr, now, now)
        }
        results.push(undefined)
      }
      else if ('namespacePrefix' in op) {
        const searchOp = op as SearchOperation
        const prefix = nsKey(searchOp.namespacePrefix)
        interface Row { ns: string, key: string, value: string, created_at: string, updated_at: string }
        const rows: Row[] = !prefix
          ? (this.db.prepare('SELECT ns, key, value, created_at, updated_at FROM store').all() as Row[])
          : (this.db.prepare('SELECT ns, key, value, created_at, updated_at FROM store WHERE ns = ? OR ns LIKE ?').all(prefix, `${prefix}:%`) as Row[])

        let items: SearchItem[] = rows.map((row) => {
          const value = JSON.parse(row.value) as Record<string, unknown>
          return {
            key: row.key,
            namespace: parseNs(row.ns),
            value,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            score: undefined,
          }
        })

        if (searchOp.filter) {
          items = items.filter(item => matchesFilter(item, searchOp.filter!))
        }
        const offset = searchOp.offset ?? 0
        const limit = searchOp.limit ?? 10
        items = items.slice(offset, offset + limit)
        results.push(items)
      }
      else if ('matchConditions' in op) {
        const listOp = op as ListNamespacesOperation
        const rows = this.db.prepare('SELECT DISTINCT ns FROM store').all() as Array<{ ns: string }>
        let namespaces = rows.map(r => parseNs(r.ns))

        if (listOp.matchConditions && listOp.matchConditions.length > 0) {
          namespaces = namespaces.filter(ns =>
            listOp.matchConditions!.every((cond) => {
              if (cond.matchType === 'prefix') {
                if (cond.path.length > ns.length)
                  return false
                return cond.path.every((p, i) => p === '*' || ns[i] === p)
              }
              if (cond.matchType === 'suffix') {
                if (cond.path.length > ns.length)
                  return false
                return cond.path.every((p, i) => p === '*' || ns[ns.length - cond.path.length + i] === p)
              }
              return false
            }),
          )
        }
        if (listOp.maxDepth !== undefined) {
          namespaces = Array.from(new Set(namespaces.map(ns => ns.slice(0, listOp.maxDepth).join(':')))).map(s => s.split(':').filter(Boolean))
        }
        namespaces.sort((a, b) => a.join(':').localeCompare(b.join(':')))
        const offset = listOp.offset ?? 0
        const limit = listOp.limit ?? 100
        results.push(namespaces.slice(offset, offset + limit))
      }
      else {
        results.push(null)
      }
    }

    return results as { [K in keyof Op]: Op[K] extends PutOperation ? void : Op[K] extends SearchOperation ? SearchItem[] : Op[K] extends GetOperation ? Item | null : Op[K] extends ListNamespacesOperation ? string[][] : never }
  }
}
