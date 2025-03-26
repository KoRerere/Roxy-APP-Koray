import { DatabaseSync } from "node:sqlite";

export class NodeStorage implements Storage {
  private static _storage: NodeStorage
  private static get storage() {
    if (!this._storage) {
      NodeStorage._storage = new NodeStorage()
    }

    return NodeStorage._storage
  }

  private db: DatabaseSync
  private tableName: string

  length: number

  private constructor(location?: string, tableName?: string) {
    this.tableName = tableName ?? `__nodeStorage_${Date.now()}`
    this.db = new DatabaseSync(location ?? ':memory:')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName}(
        key TEXT PRIMARY KEY,
        value TEXT
      ) STRICT
    `)
    this.length = 0
  }

  private reLength() {
    this.length = this.db.prepare(`SELECT COUNT(*) FROM ${this.tableName}`).get()?.["COUNT(*)"] ?? 0
  }

  clear(): void {
    this.db.exec(`DELETE FROM ${this.tableName}`)
    this.length = 0
  }
  getItem(key: string): string | null {
    return this.db.prepare(
      `SELECT value FROM ${this.tableName} WHERE key=?`
    ).get(key)?.value
  }
  key(index: number): string | null {
    return this.db.prepare(
      `SELECT value FROM ${this.tableName} WHERE rowid=?`
    ).get(index + 1)?.value
  }
  removeItem(key: string): void {
    this.db.prepare(
      `DELETE FROM ${this.tableName} where key=?`
    ).run(key)
  }
  setItem(key: string, value: string): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO ${this.tableName} (key, value) VALUES (?, ?)`
    ).run(key, value)
    this.reLength()
  }
  static get length() {
    return NodeStorage.storage.length
  }
  static clear() {
    return NodeStorage.storage.clear()
  }
  static getItem(key: string) {
    return NodeStorage.storage.getItem(key)
  }
  static key(index: number) {
    return NodeStorage.storage.key(index)
  }
  static removeItem(key: string) {
    return NodeStorage.storage.removeItem(key)
  }
  static setItem(key: string, value: string) {
    return NodeStorage.storage.setItem(key, value)
  }

  static __fork(location: string, tableName?: string) {
    return new NodeStorage(location, tableName)
  }
}


// import { NodeStorage as _ } from "./libs/storage.js";

// const NodeStorage = _.__fork('data.sqlite', 'wtf')

// console.log(NodeStorage.getItem('name'))

// NodeStorage.setItem('name', 'Mowtwo')

// NodeStorage.setItem('age', '21')

// console.log(NodeStorage.getItem('name'))
// console.log(NodeStorage.getItem('age'))

// console.log(NodeStorage.length)

// NodeStorage.removeItem('age')

// console.log(NodeStorage.length)

// console.log(NodeStorage.key(0))

// NodeStorage.setItem('age', '26')

// console.log(NodeStorage.getItem('age'))

// console.log(NodeStorage.length)
