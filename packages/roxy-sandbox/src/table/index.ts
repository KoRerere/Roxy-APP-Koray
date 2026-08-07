/**
 * `@roxybrowser/sandbox/table` — 表格持久化（CSV 文件存储，内存态 + 异步落盘）。
 *
 * 用法：脚本在沙箱里 `new Table(name)`，再 `await` 各操作。
 * ```ts
 * import { Table } from '@roxybrowser/sandbox/table'
 *
 * const rec = new Table('yanghao-record')            // 异步载入内存（缺失则建文件）
 * await rec.append({ account: 'a1', action: 'like', at: Date.now() })  // 写内存 + 异步落盘
 * const rows = await rec.all<{ account: string, action: string }>()    // 从内存读
 * const one  = await rec.find(r => r.account === 'a1')                  // 内存查找
 * ```
 *
 * 语义（内存态 + 异步）：
 * - 构造时**异步**开始加载：文件不存在就创建（空文件），存在就把全部行读入内存。
 *   `new` 立即返回，首个方法调用会 await 加载完成（ready 门闩）。
 * - `append` 先改内存再**异步**整表落盘；`all` / `find` 从内存读（仍 await 就绪）。
 * - 所有方法都是**异步**的（返回 Promise，需 await）。
 *
 * 实现与安全：
 * - CSV 逻辑 + 文件读写**全部在本包完成**（用 `node:fs/promises`）。本模块由 sandbox
 *   运行时在**宿主侧加载并注入**，故这里的 `fs` 是真实 fs（脚本自己 `import fs` 拿到的是
 *   release 下的惰性 fs）。
 * - 宿主只需经 `__setStorageDir(dir)` 指定存放目录；`name` 不允许路径穿越（`..`）。
 *
 * 表面积刻意极小：`append` / `all` / `find` / `clear`。
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative } from 'node:path'

/** 一条记录（一行）：扁平的键值对。 */
export type TableRecord = Record<string, unknown>
export type TableChangeAction = 'create' | 'append' | 'clear'

export interface TableChangeEvent {
  type: 'table'
  action: TableChangeAction
  name: string
  path: string
  rowCount?: number
}

// ── 宿主注入的存放目录（模块私有）──
let baseDir: string | undefined
let changeReporter: ((event: TableChangeEvent) => void) | undefined

/**
 * 宿主专用：指定所有表的存放目录（通常是本次运行的 outputDir）。
 * **不是给脚本调用的**——脚本用 `new Table()`。未设置时构造会抛出清晰错误。
 */
export function __setStorageDir(dir: string): void {
  baseDir = dir
}

export function __setChangeReporter(reporter?: (event: TableChangeEvent) => void): void {
  changeReporter = reporter
}

/** 把逻辑文件名解析为目录内的绝对路径，并阻止路径穿越。 */
function resolvePath(fileName: string): string {
  if (!baseDir) {
    throw new Error(
      '[@roxybrowser/sandbox/table] 存储目录未设置：宿主需先调用 __setStorageDir(dir)。'
      + '（该模块需由 sandbox 运行时装配，无法脱离宿主直接运行。）',
    )
  }
  const abs = join(baseDir, fileName)
  const rel = relative(baseDir, abs)
  if (rel.startsWith('..') || isAbsolute(rel))
    throw new Error(`[@roxybrowser/sandbox/table] 非法 name（不允许路径穿越）：${fileName}`)
  return abs
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV 编解码（RFC4180 风格）
// ─────────────────────────────────────────────────────────────────────────────

function csvEscape(value: unknown): string {
  if (value === null || value === undefined)
    return ''
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function serializeRows(headers: string[], records: TableRecord[]): string {
  return records
    .map(rec => headers.map(h => csvEscape(rec[h])).join(','))
    .join('\n')
}

/** 解析 CSV 文本为 { headers, rows }，支持带引号的字段（含逗号/换行/双引号转义）。 */
function parseCsv(text: string): { headers: string[], rows: TableRecord[] } {
  const cells: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else { inQuotes = false }
      }
      else { field += ch }
    }
    else if (ch === '"') { inQuotes = true }
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n')
        i++
      row.push(field); field = ''
      cells.push(row); row = []
    }
    else { field += ch }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    cells.push(row)
  }
  const nonEmpty = cells.filter(r => !(r.length === 1 && r[0] === ''))
  if (nonEmpty.length === 0)
    return { headers: [], rows: [] }
  const headers = nonEmpty[0]
  const rows = nonEmpty.slice(1).map((r) => {
    const obj: TableRecord = {}
    headers.forEach((h, idx) => { obj[h] = r[idx] ?? '' })
    return obj
  })
  return { headers, rows }
}

function uniqueKeys(records: TableRecord[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const rec of records) {
    for (const k of Object.keys(rec)) {
      if (!seen.has(k)) { seen.add(k); out.push(k) }
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────

/** 沙箱内可实例化的表格（内存态 + 异步落盘）。表头/行/路径保存在 `#` 私有字段中。 */
export class Table {
  readonly #name: string
  readonly #path: string
  #headers: string[] = []
  #rows: TableRecord[] = []
  readonly #ready: Promise<void>

  /** @param name 表逻辑名（对应存放目录下的 `<name>.csv`）。构造即异步载入内存。 */
  constructor(name: string) {
    if (!name)
      throw new Error('[@roxybrowser/sandbox/table] name 必填')
    this.#name = name
    this.#path = resolvePath(`${name}.csv`)
    this.#ready = this.#init()
  }

  /** 载入内存：文件存在则解析入内存；不存在则创建空文件。 */
  async #init(): Promise<void> {
    try {
      const { headers, rows } = parseCsv(await readFile(this.#path, 'utf-8'))
      this.#headers = headers
      this.#rows = rows
    }
    catch (err: any) {
      if (err?.code === 'ENOENT') {
        await mkdir(dirname(this.#path), { recursive: true })
        await writeFile(this.#path, '', 'utf-8')
        this.#report('create')
      }
      else {
        throw err
      }
    }
  }

  async #persist(): Promise<void> {
    const content = this.#headers.length === 0
      ? ''
      : `${this.#headers.join(',')}\n${serializeRows(this.#headers, this.#rows)}\n`
    await writeFile(this.#path, content, 'utf-8')
  }

  #report(action: TableChangeAction, rowCount?: number): void {
    changeReporter?.({
      type: 'table',
      action,
      name: this.#name,
      path: this.#path,
      ...(rowCount === undefined ? {} : { rowCount }),
    })
  }

  /** 表逻辑名。 */
  get name(): string {
    return this.#name
  }

  /**
   * 追加一行或多行（先写内存，再异步整表落盘）。
   * 首次写入时以记录的键作为表头；后续按已有表头对齐（缺失列留空）。
   */
  async append(record: TableRecord | TableRecord[]): Promise<void> {
    await this.#ready
    const records = Array.isArray(record) ? record : [record]
    if (records.length === 0)
      return
    if (this.#headers.length === 0)
      this.#headers = uniqueKeys(records)
    this.#rows.push(...records)
    await this.#persist()
    this.#report('append', records.length)
  }

  /** 读取全部行（内存快照副本）。 */
  async all<T extends TableRecord = TableRecord>(): Promise<T[]> {
    await this.#ready
    return [...this.#rows] as T[]
  }

  /** 在内存中查找第一条满足条件的行；无匹配返回 undefined。 */
  async find<T extends TableRecord = TableRecord>(
    predicate: (row: T, index: number) => boolean,
  ): Promise<T | undefined> {
    await this.#ready
    return (this.#rows as T[]).find(predicate)
  }

  /** 清空表（内存 + 磁盘）。 */
  async clear(): Promise<void> {
    await this.#ready
    this.#headers = []
    this.#rows = []
    await this.#persist()
    this.#report('clear')
  }
}
