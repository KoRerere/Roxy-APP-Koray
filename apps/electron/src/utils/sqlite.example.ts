/**
 * SQLite 封装模块使用示例
 *
 * 基于 Node.js 原生 node:sqlite 模块的 DatabaseSync 类
 * 参考文档: https://nodejs.org/api/sqlite.html
 */

import { SQLiteDB, createSQLiteDB } from './sqlite'
import { appConfig } from '/@/constants'

// ============================================================================
// 示例 1: 基本使用
// ============================================================================

export async function example1() {
  // 创建数据库实例
  const db = new SQLiteDB(`${appConfig.sessionDir}/data/example.db`)

  // 初始化连接（会自动创建目录）
  await db.init()

  try {
    // 创建表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        age INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 插入数据
    const insertResult = await db.run(
      'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
      ['John Doe', 'john@example.com', 30]
    )
    console.log('Insert ID:', insertResult.lastInsertRowid)

    // 查询所有数据
    const users = await db.query('SELECT * FROM users')
    console.log('All users:', users)

    // 查询单行
    const user = await db.queryFirst('SELECT * FROM users WHERE id = ?', [1])
    console.log('User:', user)

    // 查询单个值
    const count = await db.queryValue<number>('SELECT COUNT(*) FROM users')
    console.log('User count:', count)

    // 更新数据
    await db.run('UPDATE users SET age = ? WHERE id = ?', [31, 1])

    // 删除数据
    await db.run('DELETE FROM users WHERE id = ?', [1])
  } finally {
    // 关闭连接
    await db.close()
  }
}

// ============================================================================
// 示例 2: 使用便捷函数
// ============================================================================

async function example2() {
  // 使用便捷函数创建并初始化数据库
  const db = await createSQLiteDB('./data/example2.db')

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL,
        stock INTEGER DEFAULT 0
      )
    `)

    // 批量插入
    const products = [
      ['Product A', 19.99, 100],
      ['Product B', 29.99, 50],
      ['Product C', 39.99, 25],
    ]

    for (const [name, price, stock] of products) {
      await db.run('INSERT INTO products (name, price, stock) VALUES (?, ?, ?)', [name, price, stock])
    }

    // 查询价格大于 20 的产品
    const expensiveProducts = await db.query(
      'SELECT * FROM products WHERE price > ? ORDER BY price DESC',
      [20]
    )
    console.log('Expensive products:', expensiveProducts)
  } finally {
    await db.close()
  }
}

// ============================================================================
// 示例 3: 使用事务
// ============================================================================

async function example3() {
  const db = await createSQLiteDB('./data/example3.db')

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        balance REAL DEFAULT 0
      )
    `)

    // 插入测试数据
    await db.run('INSERT INTO accounts (name, balance) VALUES (?, ?)', ['Alice', 1000])
    await db.run('INSERT INTO accounts (name, balance) VALUES (?, ?)', ['Bob', 500])

    // 使用事务进行转账
    await db.transaction(async (db) => {
      // 从 Alice 账户扣除 200
      await db.run('UPDATE accounts SET balance = balance - ? WHERE name = ?', [200, 'Alice'])

      // 检查余额是否足够
      const aliceBalance = await db.queryValue<number>('SELECT balance FROM accounts WHERE name = ?', ['Alice'])
      if (aliceBalance! < 0) {
        throw new Error('Insufficient balance')
      }

      // 向 Bob 账户增加 200
      await db.run('UPDATE accounts SET balance = balance + ? WHERE name = ?', [200, 'Bob'])
    })

    // 查询最终余额
    const alice = await db.queryFirst('SELECT * FROM accounts WHERE name = ?', ['Alice'])
    const bob = await db.queryFirst('SELECT * FROM accounts WHERE name = ?', ['Bob'])
    console.log('Alice balance:', alice)
    console.log('Bob balance:', bob)
  } finally {
    await db.close()
  }
}

// ============================================================================
// 示例 4: 使用 Prepared Statement 进行批量操作
// ============================================================================

async function example4() {
  const db = await createSQLiteDB('./data/example4.db')

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 准备语句
    const stmt = await db.prepare('INSERT INTO logs (level, message) VALUES (?, ?)')

    try {
      // 批量插入
      const logs = [
        ['info', 'Application started'],
        ['warning', 'Low memory warning'],
        ['error', 'Failed to connect to server'],
        ['info', 'User logged in'],
      ]

      for (const [level, message] of logs) {
        stmt.run(level, message)
      }
      // StatementSync 不需要手动 finalize，由垃圾回收器管理
    } finally {
      // StatementSync 会自动释放
    }

    // 查询所有日志
    const allLogs = await db.query('SELECT * FROM logs ORDER BY timestamp DESC')
    console.log('All logs:', allLogs)
  } finally {
    await db.close()
  }
}

// ============================================================================
// 示例 5: 表操作和元数据查询
// ============================================================================

async function example5() {
  const db = await createSQLiteDB('./data/example5.db')

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 检查表是否存在
    const exists = await db.tableExists('settings')
    console.log('Table exists:', exists)

    // 获取表的列名
    const columns = await db.getTableColumns('settings')
    console.log('Table columns:', columns)

    // 检查数据库状态
    console.log('Is open:', db.isOpen)
    console.log('Is transaction:', db.isTransaction)

    // 插入设置
    await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['theme', 'dark'])
    await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['language', 'en'])

    // 查询所有设置
    const settings = await db.query('SELECT * FROM settings')
    console.log('Settings:', settings)
  } finally {
    await db.close()
  }
}

// ============================================================================
// 示例 6: 内存数据库
// ============================================================================

async function example6() {
  // 使用 ':memory:' 创建内存数据库
  const db = await createSQLiteDB(':memory:')

  try {
    await db.exec(`
      CREATE TABLE temp_data (
        id INTEGER PRIMARY KEY,
        value TEXT
      )
    `)

    await db.run('INSERT INTO temp_data (value) VALUES (?)', ['Temporary data'])

    const data = await db.query('SELECT * FROM temp_data')
    console.log('Memory database data:', data)
  } finally {
    await db.close()
  }
}

// ============================================================================
// 示例 7: 只读模式
// ============================================================================

async function example7() {
  // 先创建一个数据库
  const writeDb = await createSQLiteDB('./data/readonly.db')
  await writeDb.exec('CREATE TABLE IF NOT EXISTS data (id INTEGER PRIMARY KEY, value TEXT)')
  await writeDb.run('INSERT INTO data (value) VALUES (?)', ['Read-only test'])
  await writeDb.close()

  // 以只读模式打开
  const readDb = await createSQLiteDB('./data/readonly.db', { readonly: true })

  try {
    const data = await readDb.query('SELECT * FROM data')
    console.log('Read-only data:', data)

    // 尝试写入会失败
    try {
      await readDb.run('INSERT INTO data (value) VALUES (?)', ['Should fail'])
    } catch (error) {
      console.log('Expected error:', error)
    }
  } finally {
    await readDb.close()
  }
}

// ============================================================================
// 示例 8: 在实际项目中使用（结合 appConfig）
// ============================================================================

export async function initAppDatabase() {
  // 使用应用配置中的路径
  const dbPath = `${appConfig.sessionDir}/app.db`
  const db = await createSQLiteDB(dbPath)

  try {
    // 创建应用需要的表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT,
        visit_count INTEGER DEFAULT 1,
        last_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 创建索引
    await db.exec('CREATE INDEX IF NOT EXISTS idx_history_url ON history(url)')
    await db.exec('CREATE INDEX IF NOT EXISTS idx_history_last_visit ON history(last_visit)')

    return db
  } catch (error) {
    await db.close()
    throw error
  }
}

// ============================================================================
// 示例 9: 类型安全的查询
// ============================================================================

interface User {
  id: number
  name: string
  email: string
  age: number
  created_at: string
}

async function example9() {
  const db = await createSQLiteDB('./data/example9.db')

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        age INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 类型安全的查询
    const users = await db.query<User>('SELECT * FROM users WHERE age > ?', [18])
    console.log('Adult users:', users)

    // 类型安全的单行查询
    const user = await db.queryFirst<User>('SELECT * FROM users WHERE id = ?', [1])
    if (user) {
      console.log('User name:', user.name)
      console.log('User email:', user.email)
    }
  } finally {
    await db.close()
  }
}

