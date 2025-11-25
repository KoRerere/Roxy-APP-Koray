import { DatabaseSync, StatementSync } from 'node:sqlite'
import { dirname } from 'node:path'
import { mkdir } from 'node:fs/promises'
import { fileExists } from './file'

/**
 * SQLite 数据库选项
 */
export interface SQLiteOptions {
  /** 是否只读模式，默认 false */
  readonly?: boolean
  /** 是否创建目录（如果不存在），默认 true */
  createDir?: boolean
  /** 超时时间（毫秒），默认 undefined */
  timeout?: number
}

/**
 * SQLite 查询结果类型
 */
export type QueryResult<T = any> = {
  rows: T[]
  changes: number | bigint
  lastInsertRowid: number | bigint | null
}

/**
 * SQLite 数据库封装类
 *
 * 基于 Node.js 原生 node:sqlite 模块的 DatabaseSync 类封装
 * 提供 Promise-based 异步 API，便于在 Electron 主进程中使用
 *
 * @example
 * ```typescript
 * const db = new SQLiteDB('./data/app.db')
 * await db.init()
 *
 * // 创建表
 * await db.exec(`
 *   CREATE TABLE IF NOT EXISTS users (
 *     id INTEGER PRIMARY KEY AUTOINCREMENT,
 *     name TEXT NOT NULL,
 *     email TEXT UNIQUE
 *   )
 * `)
 *
 * // 插入数据
 * const result = await db.run('INSERT INTO users (name, email) VALUES (?, ?)', ['John', 'john@example.com'])
 * console.log('Insert ID:', result.lastInsertRowid)
 *
 * // 查询数据
 * const users = await db.query('SELECT * FROM users WHERE name = ?', ['John'])
 *
 * // 查询单行
 * const user = await db.queryFirst('SELECT * FROM users WHERE id = ?', [1])
 *
 * // 关闭连接
 * await db.close()
 * ```
 */
export class SQLiteDB {
  private db: DatabaseSync | null = null
  private dbPath: string
  private options: SQLiteOptions

  /**
   * 创建 SQLite 数据库实例
   * @param dbPath 数据库文件路径（使用 ':memory:' 创建内存数据库）
   * @param options 数据库选项
   */
  constructor(dbPath: string, options: SQLiteOptions = {}) {
    this.dbPath = dbPath
    this.options = {
      createDir: true,
      readonly: false,
      ...options,
    }
  }

  /**
   * 初始化数据库连接
   * 注意：DatabaseSync 是同步的，这里使用 Promise 包装以便在异步上下文中使用
   */
  async init(): Promise<void> {
    // 确保目录存在
    if (this.options.createDir && !this.options.readonly && this.dbPath !== ':memory:') {
      const dir = dirname(this.dbPath)
      const exists = await fileExists(dir)
      if (!exists) {
        await mkdir(dir, { recursive: true })
      }
    }

    // 使用 Promise 包装同步操作，避免阻塞事件循环
    const { promise, resolve, reject } = Promise.withResolvers<void>()

    try {
      // DatabaseSync 构造函数是同步的，但我们需要在异步上下文中执行
      // 使用 setImmediate 确保不阻塞事件循环
      setImmediate(() => {
        try {
          const dbOptions: any = {}
          if (this.options.readonly) {
            dbOptions.mode = 'readonly'
          }
          if (this.options.timeout !== undefined) {
            dbOptions.timeout = this.options.timeout
          }

          this.db = new DatabaseSync(this.dbPath, dbOptions)
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    } catch (error) {
      reject(error)
    }

    return promise
  }

  /**
   * 执行 SQL 语句（不返回结果）
   * @param sql SQL 语句
   * @param params 参数数组
   * @returns 执行结果
   */
  async run(sql: string, params: any[] = []): Promise<QueryResult> {
    this.ensureConnected()

    const { promise, resolve, reject } = Promise.withResolvers<QueryResult>()

    try {
      setImmediate(() => {
        try {
          const stmt = this.db!.prepare(sql)
          const result = stmt.run(...params)
          // StatementSync 不需要手动 finalize，由垃圾回收器管理
          resolve({
            rows: [],
            changes: result.changes,
            lastInsertRowid: (result.lastInsertRowid ?? null) as number | bigint | null,
          })
        } catch (error) {
          reject(error)
        }
      })
    } catch (error) {
      reject(error)
    }

    return promise
  }

  /**
   * 执行 SQL 查询
   * @param sql SQL 查询语句
   * @param params 参数数组
   * @returns 查询结果数组
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    this.ensureConnected()

    const { promise, resolve, reject } = Promise.withResolvers<T[]>()

    try {
      setImmediate(() => {
        try {
          const stmt = this.db!.prepare(sql)
          const rows = stmt.all(...params) as T[]
          // StatementSync 不需要手动 finalize，由垃圾回收器管理
          resolve(rows)
        } catch (error) {
          reject(error)
        }
      })
    } catch (error) {
      reject(error)
    }

    return promise
  }

  /**
   * 查询第一行数据
   * @param sql SQL 查询语句
   * @param params 参数数组
   * @returns 第一行数据或 null
   */
  async queryFirst<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    this.ensureConnected()

    const { promise, resolve, reject } = Promise.withResolvers<T | null>()

    try {
      setImmediate(() => {
        try {
          const stmt = this.db!.prepare(sql)
          const row = stmt.get(...params)
          // StatementSync 不需要手动 finalize，由垃圾回收器管理
          resolve((row as T) || null)
        } catch (error) {
          reject(error)
        }
      })
    } catch (error) {
      reject(error)
    }

    return promise
  }

  /**
   * 查询单个值
   * @param sql SQL 查询语句
   * @param params 参数数组
   * @returns 单个值或 null
   */
  async queryValue<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    this.ensureConnected()

    const { promise, resolve, reject } = Promise.withResolvers<T | null>()

    try {
      setImmediate(() => {
        try {
          const stmt = this.db!.prepare(sql)
          const row = stmt.get(...params)
          // StatementSync 不需要手动 finalize，由垃圾回收器管理
          if (!row) {
            resolve(null)
            return
          }
          // 返回第一列的值
          const keys = Object.keys(row)
          resolve((row[keys[0]] as T) || null)
        } catch (error) {
          reject(error)
        }
      })
    } catch (error) {
      reject(error)
    }

    return promise
  }

  /**
   * 执行多条 SQL 语句（用于创建表等）
   * @param sql SQL 语句（可以包含多条，用分号分隔）
   * @returns Promise
   */
  async exec(sql: string): Promise<void> {
    this.ensureConnected()

    const { promise, resolve, reject } = Promise.withResolvers<void>()

    try {
      setImmediate(() => {
        try {
          this.db!.exec(sql)
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    } catch (error) {
      reject(error)
    }

    return promise
  }

  /**
   * 开始事务
   * @returns Promise
   */
  async beginTransaction(): Promise<void> {
    return this.exec('BEGIN TRANSACTION')
  }

  /**
   * 提交事务
   * @returns Promise
   */
  async commit(): Promise<void> {
    return this.exec('COMMIT')
  }

  /**
   * 回滚事务
   * @returns Promise
   */
  async rollback(): Promise<void> {
    return this.exec('ROLLBACK')
  }

  /**
   * 执行事务
   * @param callback 事务回调函数
   * @returns 回调函数的返回值
   */
  async transaction<T>(callback: (db: SQLiteDB) => Promise<T>): Promise<T> {
    await this.beginTransaction()
    try {
      const result = await callback(this)
      await this.commit()
      return result
    } catch (error) {
      await this.rollback()
      throw error
    }
  }

  /**
   * 准备 SQL 语句（用于批量操作）
   * @param sql SQL 语句
   * @returns 准备好的语句
   */
  async prepare(sql: string): Promise<StatementSync> {
    this.ensureConnected()

    const { promise, resolve, reject } = Promise.withResolvers<StatementSync>()

    try {
      setImmediate(() => {
        try {
          const stmt = this.db!.prepare(sql)
          resolve(stmt)
        } catch (error) {
          reject(error)
        }
      })
    } catch (error) {
      reject(error)
    }

    return promise
  }

  /**
   * 检查表是否存在
   * @param tableName 表名
   * @returns 是否存在
   */
  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.queryValue<number>(
      "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
      [tableName]
    )
    return (result || 0) > 0
  }

  /**
   * 获取表的所有列名
   * @param tableName 表名
   * @returns 列名数组
   */
  async getTableColumns(tableName: string): Promise<string[]> {
    const columns = await this.query<{ name: string }>(
      `PRAGMA table_info(${tableName})`
    )
    return columns.map(col => col.name)
  }

  /**
   * 关闭数据库连接
   * @returns Promise
   */
  async close(): Promise<void> {
    if (this.db) {
      const { promise, resolve, reject } = Promise.withResolvers<void>()

      try {
        setImmediate(() => {
          try {
            this.db!.close()
            this.db = null
            resolve()
          } catch (error) {
            reject(error)
          }
        })
      } catch (error) {
        reject(error)
      }

      return promise
    }
  }

  /**
   * 检查数据库是否已连接
   */
  private ensureConnected(): void {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
    if (!this.db.isOpen) {
      throw new Error('Database is not open.')
    }
  }

  /**
   * 获取原生数据库实例（用于高级操作）
   * @returns 原生数据库实例
   */
  getNativeDB(): DatabaseSync {
    this.ensureConnected()
    return this.db!
  }

  /**
   * 检查数据库是否打开
   */
  get isOpen(): boolean {
    return this.db?.isOpen || false
  }

  /**
   * 检查是否在事务中
   */
  get isTransaction(): boolean {
    return this.db?.isTransaction || false
  }
}

/**
 * 创建 SQLite 数据库实例的便捷函数
 * @param dbPath 数据库文件路径
 * @param options 初始化选项
 * @returns SQLite 数据库实例
 */
export async function createSQLiteDB(
  dbPath: string,
  options?: SQLiteOptions
): Promise<SQLiteDB> {
  const db = new SQLiteDB(dbPath, options)
  await db.init()
  return db
}

