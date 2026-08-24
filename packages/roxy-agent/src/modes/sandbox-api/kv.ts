/**
 * `@roxybrowser/sandbox/kv` — 键值持久化（JSON 文件存储，内存态 + 异步落盘）。与 `/table` 并列。
 *
 * 用法：脚本在沙箱里 `new KV(name)`，再 `await` 各操作。
 * ```ts
 * import { KV } from '@roxybrowser/sandbox/kv'
 *
 * const state = new KV('yanghao-state')       // 异步载入内存（缺失则建文件）
 * await state.set('a1:lastRun', Date.now())   // 写内存 + 异步落盘
 * const last = await state.get<number>('a1:lastRun')  // 从内存读
 * ```
 *
 * 语义（内存态 + 异步）：
 * - 构造时**异步**开始加载：文件不存在就创建（`{}`），存在就把全部键值读入内存。
 *   `new` 立即返回，首个方法调用会 await 加载完成（ready 门闩）。
 * - `set` / `delete` / `clear` 先改内存再**异步**落盘；`get` / `has` / `keys` / `all` 从内存读。
 * - 所有方法都是**异步**的（返回 Promise，需 await）。
 *
 * 实现与安全（同 `/table`）：
 * - JSON 序列化 + 文件读写**全部在本包完成**（用 `node:fs/promises`）。本模块由 sandbox
 *   运行时在**宿主侧加载并注入**，故这里的 `fs` 是真实 fs。
 * - 宿主通过 `createKvApi({ storageDir })` 创建本次运行的 API；`name` 不允许路径穿越。
 *
 * 表面积刻意极小：`get` / `set` / `has` / `delete` / `keys` / `all` / `clear`。
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { toSafeStorageFileName } from './storageName'

export type KVChangeAction = 'create' | 'set' | 'delete' | 'clear'

export interface KVChangeEvent {
  type: 'kv'
  action: KVChangeAction
  name: string
  path: string
  key?: string
}

export interface KvApiOptions {
  storageDir: string
  onChange?: (event: KVChangeEvent) => void
}

interface KvRuntime {
  storageDir: string
  onChange?: (event: KVChangeEvent) => void
}

function resolvePath(fileName: string, runtime: KvRuntime): string {
  const abs = join(runtime.storageDir, fileName)
  const rel = relative(runtime.storageDir, abs)
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`[@roxybrowser/sandbox/kv] 非法 name（不允许路径穿越）：${fileName}`)
  }
  return abs
}

function parseKv(text: string): Record<string, unknown> {
  if (!text || text.trim() === '') {
    return {}
  }
  try {
    const parsed = JSON.parse(text)
    return (parsed && typeof parsed === 'object') ? parsed as Record<string, unknown> : {}
  }
  catch {
    return {}
  }
}

/** 沙箱内可实例化的键值存储（内存态 + 异步落盘）。数据/路径保存在 `#` 私有字段中。 */
export class KV {
  readonly #runtime: KvRuntime
  readonly #name: string
  readonly #path: string
  #data: Record<string, unknown> = {}
  readonly #ready: Promise<void>

  /** @param name KV 命名空间逻辑名（对应存放目录下的 `<name>.kv.json`）。构造即异步载入内存。 */
  constructor(name: string, runtime: KvRuntime) {
    if (!name) {
      throw new Error('[@roxybrowser/sandbox/kv] name 必填')
    }
    this.#runtime = runtime
    this.#name = name
    this.#path = resolvePath(toSafeStorageFileName(name, '.kv.json'), runtime)
    this.#ready = this.#init()
  }

  /** 载入内存：文件存在则解析入内存；不存在则创建 `{}`。 */
  async #init(): Promise<void> {
    try {
      this.#data = parseKv(await readFile(this.#path, 'utf-8'))
    }
    catch (err: any) {
      if (err?.code === 'ENOENT') {
        await mkdir(dirname(this.#path), { recursive: true })
        await writeFile(this.#path, '{}', 'utf-8')
        this.#report('create')
      }
      else {
        throw err
      }
    }
  }

  async #persist(): Promise<void> {
    await writeFile(this.#path, JSON.stringify(this.#data), 'utf-8')
  }

  #report(action: KVChangeAction, key?: string): void {
    this.#runtime.onChange?.({
      type: 'kv',
      action,
      name: this.#name,
      path: this.#path,
      ...(key === undefined ? {} : { key }),
    })
  }

  /** KV 命名空间逻辑名。 */
  get name(): string {
    return this.#name
  }

  /** 读取一个键；不存在返回 undefined（从内存读）。 */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    await this.#ready
    return (key in this.#data ? this.#data[key] : undefined) as T | undefined
  }

  /** 写入一个键（值需可 JSON 序列化）：先写内存，再异步落盘。 */
  async set(key: string, value: unknown): Promise<void> {
    await this.#ready
    this.#data[key] = value
    await this.#persist()
    this.#report('set', key)
  }

  /** 键是否存在（内存）。 */
  async has(key: string): Promise<boolean> {
    await this.#ready
    return key in this.#data
  }

  /** 删除一个键（内存 + 磁盘）；返回删除前是否存在。 */
  async delete(key: string): Promise<boolean> {
    await this.#ready
    const existed = key in this.#data
    if (existed) {
      delete this.#data[key]
      await this.#persist()
      this.#report('delete', key)
    }
    return existed
  }

  /** 所有键（内存）。 */
  async keys(): Promise<string[]> {
    await this.#ready
    return Object.keys(this.#data)
  }

  /** 整个键值快照（内存副本）。 */
  async all<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<T> {
    await this.#ready
    return { ...this.#data } as T
  }

  /** 清空整个命名空间（内存 + 磁盘）。 */
  async clear(): Promise<void> {
    await this.#ready
    this.#data = {}
    await this.#persist()
    this.#report('clear')
  }
}

/** Create the key-value API bound to one sandbox output directory. */
export function createKvApi(options: KvApiOptions): { KV: new (name: string) => KV } {
  const runtime: KvRuntime = {
    storageDir: options.storageDir,
    onChange: options.onChange,
  }
  return {
    KV: class SandboxKv extends KV {
      constructor(name: string) {
        super(name, runtime)
      }
    },
  }
}
