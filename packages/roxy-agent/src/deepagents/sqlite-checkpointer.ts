/**
 * SQLite 版 LangGraph Checkpoint 持久化。
 *
 * 体积说明：LangGraph 每个图步骤都会 put 一次「完整状态」(channel_values)，不是增量；
 * 因此一次对话若有 N 步，就会写入 N 份完整快照 + N 份 writes，若不剪枝，单次对话可增长数十～上百 MB。
 * 使用方式：在对话流结束后调用 pruneThreadCheckpoints(threadId, 1) 只保留最新 1 个 checkpoint。
 */
import type { RunnableConfig } from '@langchain/core/runnables'
import type { Checkpoint, CheckpointListOptions, CheckpointMetadata, CheckpointTuple, PendingWrite, SerializerProtocol } from '@langchain/langgraph-checkpoint'
import {
  BaseCheckpointSaver,

  copyCheckpoint,
  maxChannelVersion,
  TASKS,
} from '@langchain/langgraph-checkpoint'
import { HumanMessage } from 'langchain'
import { Buffer } from 'node:buffer'
import { DatabaseSync } from 'node:sqlite'

type DatabaseType = InstanceType<typeof DatabaseSync>
type Statement = ReturnType<DatabaseType['prepare']>

interface CheckpointRow {
  checkpoint: string
  metadata: string
  parent_checkpoint_id?: string
  thread_id: string
  checkpoint_id: string
  checkpoint_ns?: string
  type?: string
  pending_writes: string
}

interface PendingWriteColumn {
  task_id: string
  channel: string
  type: string
  value: string
}

interface PendingSendColumn {
  type: string
  value: string
}

// In the `SqliteSaver.list` method, we need to sanitize the `options.filter` argument to ensure it only contains keys
// that are part of the `CheckpointMetadata` type. The lines below ensure that we get compile-time errors if the list
// of keys that we use is out of sync with the `CheckpointMetadata` type.
const checkpointMetadataKeys = ['source', 'step', 'parents'] as const

type CheckKeys<T, K extends readonly (keyof T)[]> = [K[number]] extends [
  keyof T,
]
  ? [keyof T] extends [K[number]]
      ? K
      : never
  : never

function validateKeys<T, K extends readonly (keyof T)[]>(
  keys: CheckKeys<T, K>,
): K {
  return keys
}

// If this line fails to compile, the list of keys that we use in the `SqliteSaver.list` method is out of sync with the
// `CheckpointMetadata` type. In that case, just update `checkpointMetadataKeys` to contain all the keys in
// `CheckpointMetadata`
const validCheckpointMetadataKeys = validateKeys<
  CheckpointMetadata,
  typeof checkpointMetadataKeys
>(checkpointMetadataKeys)

/** node:sqlite rejects undefined; convert to null. BLOB values must be Buffer/Uint8Array. */
function toBindValue(v: unknown): string | number | bigint | Buffer | Uint8Array | null {
  if (v === undefined)
    return null
  if (v === null)
    return null
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint')
    return v
  if (Buffer.isBuffer(v) || v instanceof Uint8Array)
    return v
  if (typeof v === 'object' && v !== null && ArrayBuffer.isView(v))
    return v as Uint8Array
  return String(v)
}

function getMessageType(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null)
    return undefined

  const message = value as {
    type?: unknown
    _getType?: () => unknown
    getType?: () => unknown
  }

  if (typeof message.type === 'string')
    return message.type

  try {
    const type = message._getType?.() ?? message.getType?.()
    return typeof type === 'string' ? type : undefined
  }
  catch {
    return undefined
  }
}

function normalizeSummaryMessage(value: unknown): unknown {
  if (value instanceof HumanMessage)
    return value

  if (getMessageType(value) !== 'human')
    return value

  const message = value as {
    content?: unknown
    id?: string
    name?: string
    additional_kwargs?: Record<string, unknown>
    response_metadata?: Record<string, unknown>
  }

  return new HumanMessage({
    content: message.content as never,
    id: message.id,
    name: message.name,
    additional_kwargs: message.additional_kwargs ?? {},
    response_metadata: message.response_metadata ?? {},
  })
}

function normalizeSummarizationEventContainer(value: unknown): void {
  if (typeof value !== 'object' || value === null)
    return

  const container = value as {
    _summarizationEvent?: {
      summaryMessage?: unknown
    }
  }

  normalizeSummarizationEvent(container._summarizationEvent)
}

function normalizeSummarizationEvent(value: unknown): void {
  if (typeof value !== 'object' || value === null)
    return

  const event = value as {
    summaryMessage?: unknown
  }

  if (event.summaryMessage)
    event.summaryMessage = normalizeSummaryMessage(event.summaryMessage)
}

function normalizeCheckpointSummarizationState(checkpoint: Checkpoint): Checkpoint {
  normalizeSummarizationEventContainer(
    (checkpoint as { channel_values?: Record<string, unknown> }).channel_values,
  )
  return checkpoint
}

function normalizePendingWriteValue(channel: string, value: unknown): unknown {
  if (channel === '_summarizationEvent')
    normalizeSummarizationEvent(value)
  else
    normalizeSummarizationEventContainer(value)

  return value
}

function prepareSql(db: DatabaseType, checkpointId: boolean) {
  const sql = `
  SELECT
    thread_id,
    checkpoint_ns,
    checkpoint_id,
    parent_checkpoint_id,
    type,
    checkpoint,
    metadata,
    (
      SELECT
        json_group_array(
          json_object(
            'task_id', pw.task_id,
            'channel', pw.channel,
            'type', pw.type,
            'value', CAST(pw.value AS TEXT)
          )
        )
      FROM writes as pw
      WHERE pw.thread_id = checkpoints.thread_id
        AND pw.checkpoint_ns = checkpoints.checkpoint_ns
        AND pw.checkpoint_id = checkpoints.checkpoint_id
    ) as pending_writes,
    (
      SELECT
        json_group_array(
          json_object(
            'type', ps.type,
            'value', CAST(ps.value AS TEXT)
          )
        )
      FROM writes as ps
      WHERE ps.thread_id = checkpoints.thread_id
        AND ps.checkpoint_ns = checkpoints.checkpoint_ns
        AND ps.checkpoint_id = checkpoints.parent_checkpoint_id
        AND ps.channel = '${TASKS}'
      ORDER BY ps.idx
    ) as pending_sends
  FROM checkpoints
  WHERE thread_id = ? AND checkpoint_ns = ? ${
    checkpointId
      ? 'AND checkpoint_id = ?'
      : 'ORDER BY checkpoint_id DESC LIMIT 1'
  }`

  return db.prepare(sql)
}

export class SqliteSaver extends BaseCheckpointSaver {
  db: DatabaseType

  protected isSetup: boolean

  protected withoutCheckpoint!: Statement
  protected withCheckpoint!: Statement

  /**
   * 预编译的固定 SQL 语句，在 setup() 时初始化，避免每次调用重复 prepare
   */
  protected putStmt!: Statement
  protected putWriteStmt!: Statement
  protected deleteCheckpointsStmt!: Statement
  protected deleteWritesStmt!: Statement
  protected pruneWritesStmt!: Statement
  protected pruneCheckpointsStmt!: Statement
  protected migratePendingSendsStmt!: Statement
  /** 清理某 thread 最新 checkpoint 的 pending writes（中止后收尾用） */
  protected clearPendingWritesStmt!: Statement

  /** 静态实例缓存：同一路径复用同一个 SqliteSaver，避免重复打开连接造成泄漏 */
  static instances = new Map<string, SqliteSaver>()

  constructor(db: DatabaseType, serde?: SerializerProtocol) {
    super(serde)
    this.db = db
    this.isSetup = false
  }

  static fromConnString(connStringOrLocalPath: string): SqliteSaver {
    let instance = SqliteSaver.instances.get(connStringOrLocalPath)
    if (!instance) {
      instance = new SqliteSaver(new DatabaseSync(connStringOrLocalPath))
      SqliteSaver.instances.set(connStringOrLocalPath, instance)
    }
    return instance
  }

  protected setup(): void {
    if (this.isSetup) {
      return
    }

    this.db.exec('PRAGMA journal_mode=WAL')
    // 提高缓存与临时表在内存，减轻大库时读盘
    this.db.exec('PRAGMA cache_size = -64000') // 约 64MB 页缓存
    this.db.exec('PRAGMA temp_store = MEMORY')
    this.db.exec(`
CREATE TABLE IF NOT EXISTS checkpoints (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL,
  parent_checkpoint_id TEXT,
  type TEXT,
  checkpoint BLOB,
  metadata BLOB,
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);`)
    this.db.exec(`
CREATE TABLE IF NOT EXISTS writes (
  thread_id TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  channel TEXT NOT NULL,
  type TEXT,
  value BLOB,
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);`)
    // 加速 getTuple/list 中 pending_sends 子查询：按 channel 过滤时避免全 checkpoint 的 writes 扫描
    this.db.exec(`
CREATE INDEX IF NOT EXISTS idx_writes_channel
  ON writes (thread_id, checkpoint_ns, checkpoint_id, channel);`)

    this.withoutCheckpoint = prepareSql(this.db, false)
    this.withCheckpoint = prepareSql(this.db, true)

    // 预编译所有固定 SQL，避免每次调用时重复 prepare
    this.putStmt = this.db.prepare(
      `INSERT OR REPLACE INTO checkpoints (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    this.putWriteStmt = this.db.prepare(`
      INSERT OR REPLACE INTO writes
      (thread_id, checkpoint_ns, checkpoint_id, task_id, idx, channel, type, value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    this.deleteCheckpointsStmt = this.db.prepare(`DELETE FROM checkpoints WHERE thread_id = ?`)
    this.deleteWritesStmt = this.db.prepare(`DELETE FROM writes WHERE thread_id = ?`)
    // 剪枝：保留最新 N 个，删除其余（用 NOT IN 子查询，单条 SQL 完成，无需动态拼 IN 子句）
    this.pruneWritesStmt = this.db.prepare(`
      DELETE FROM writes
      WHERE thread_id = ? AND checkpoint_ns = ''
      AND checkpoint_id NOT IN (
        SELECT checkpoint_id FROM checkpoints
        WHERE thread_id = ? AND checkpoint_ns = ''
        ORDER BY checkpoint_id DESC LIMIT ?
      )
    `)
    this.pruneCheckpointsStmt = this.db.prepare(`
      DELETE FROM checkpoints
      WHERE thread_id = ? AND checkpoint_ns = ''
      AND checkpoint_id NOT IN (
        SELECT checkpoint_id FROM checkpoints
        WHERE thread_id = ? AND checkpoint_ns = ''
        ORDER BY checkpoint_id DESC LIMIT ?
      )
    `)
    this.migratePendingSendsStmt = this.db.prepare(`
      SELECT
        checkpoint_id,
        json_group_array(
          json_object(
            'type', ps.type,
            'value', CAST(ps.value AS TEXT)
          )
        ) as pending_sends
      FROM writes as ps
      WHERE ps.thread_id = ?
        AND ps.checkpoint_id = ?
        AND ps.channel = '${TASKS}'
      ORDER BY ps.idx
    `)

    // 清理某 thread 最新 checkpoint 的 pending writes：用于用户主动中止会话后把中途
    // pending 状态收尾为完成态（next 置空），保留 channel_values（messages 历史），
    // 避免下次新消息被 runChatStream 开头的 null 恢复分支吞掉而继续旧路线。
    this.clearPendingWritesStmt = this.db.prepare(`
      DELETE FROM writes
      WHERE thread_id = ? AND checkpoint_ns = ''
        AND checkpoint_id = (
          SELECT checkpoint_id FROM checkpoints
          WHERE thread_id = ? AND checkpoint_ns = ''
          ORDER BY checkpoint_id DESC LIMIT 1
        )
    `)

    this.isSetup = true
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    this.setup()
    const {
      thread_id,
      checkpoint_ns = '',
      checkpoint_id,
    } = config.configurable ?? {}

    if (!thread_id) {
      throw new Error('Missing thread_id field in config.configurable.')
    }

    const args = [toBindValue(thread_id), toBindValue(checkpoint_ns)]
    if (checkpoint_id)
      args.push(toBindValue(checkpoint_id))

    const stm = checkpoint_id ? this.withCheckpoint : this.withoutCheckpoint
    const row = stm.get(...args) as CheckpointRow | undefined
    if (row === undefined)
      return undefined

    let finalConfig = config

    if (!checkpoint_id) {
      finalConfig = {
        configurable: {
          thread_id: row.thread_id,
          checkpoint_ns,
          checkpoint_id: row.checkpoint_id,
        },
      }
    }

    if (
      finalConfig.configurable?.thread_id === undefined
      || finalConfig.configurable?.checkpoint_id === undefined
    ) {
      throw new Error('Missing thread_id or checkpoint_id')
    }

    const pendingWrites = await Promise.all(
      (JSON.parse(row.pending_writes) as PendingWriteColumn[]).map(
        async (write) => {
          const value = await this.serde.loadsTyped(
            write.type ?? 'json',
            write.value ?? '',
          )

          return [
            write.task_id,
            write.channel,
            normalizePendingWriteValue(write.channel, value),
          ] as [string, string, unknown]
        },
      ),
    )

    const checkpoint = normalizeCheckpointSummarizationState(
      (await this.serde.loadsTyped(
        row.type ?? 'json',
        row.checkpoint,
      )) as Checkpoint,
    )

    if (checkpoint.v < 4 && row.parent_checkpoint_id != null) {
      await this.migratePendingSends(
        checkpoint,
        row.thread_id,
        row.parent_checkpoint_id,
      )
    }

    return {
      checkpoint,
      config: finalConfig,
      metadata: (await this.serde.loadsTyped(
        row.type ?? 'json',
        row.metadata,
      )) as CheckpointMetadata,
      parentConfig: row.parent_checkpoint_id
        ? {
            configurable: {
              thread_id: row.thread_id,
              checkpoint_ns,
              checkpoint_id: row.parent_checkpoint_id,
            },
          }
        : undefined,
      pendingWrites,
    }
  }

  async* list(
    config: RunnableConfig,
    options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    const { limit, before, filter } = options ?? {}
    this.setup()
    const thread_id = config.configurable?.thread_id
    const checkpoint_ns = config.configurable?.checkpoint_ns
    let sql = `
      SELECT
        thread_id,
        checkpoint_ns,
        checkpoint_id,
        parent_checkpoint_id,
        type,
        checkpoint,
        metadata,
        (
          SELECT
            json_group_array(
              json_object(
                'task_id', pw.task_id,
                'channel', pw.channel,
                'type', pw.type,
                'value', CAST(pw.value AS TEXT)
              )
            )
          FROM writes as pw
          WHERE pw.thread_id = checkpoints.thread_id
            AND pw.checkpoint_ns = checkpoints.checkpoint_ns
            AND pw.checkpoint_id = checkpoints.checkpoint_id
        ) as pending_writes,
        (
          SELECT
            json_group_array(
              json_object(
                'type', ps.type,
                'value', CAST(ps.value AS TEXT)
              )
            )
          FROM writes as ps
          WHERE ps.thread_id = checkpoints.thread_id
            AND ps.checkpoint_ns = checkpoints.checkpoint_ns
            AND ps.checkpoint_id = checkpoints.parent_checkpoint_id
            AND ps.channel = '${TASKS}'
          ORDER BY ps.idx
        ) as pending_sends
      FROM checkpoints\n`

    const whereClause: string[] = []

    if (thread_id) {
      whereClause.push('thread_id = ?')
    }

    if (checkpoint_ns !== undefined && checkpoint_ns !== null) {
      whereClause.push('checkpoint_ns = ?')
    }

    if (before?.configurable?.checkpoint_id !== undefined) {
      whereClause.push('checkpoint_id < ?')
    }

    const sanitizedFilter = Object.fromEntries(
      Object.entries(filter ?? {}).filter(
        ([key, value]) =>
          value !== undefined
          && validCheckpointMetadataKeys.includes(key as keyof CheckpointMetadata),
      ),
    )

    whereClause.push(
      ...Object.entries(sanitizedFilter).map(
        ([key]) => `json_extract(CAST(metadata AS TEXT), '$.${key}') = ?`,
      ),
    )

    if (whereClause.length > 0) {
      sql += `WHERE\n  ${whereClause.join(' AND\n  ')}\n`
    }

    sql += '\nORDER BY checkpoint_id DESC'

    if (limit) {
      sql += ` LIMIT ${Number.parseInt(limit as any, 10)}`
    }

    const args = [
      thread_id,
      checkpoint_ns,
      before?.configurable?.checkpoint_id,
      ...Object.values(sanitizedFilter).map(value => JSON.stringify(value)),
    ].filter(value => value !== undefined && value !== null)

    const rows = this.db.prepare(sql).all(...args) as unknown as CheckpointRow[]

    if (rows) {
      for (const row of rows) {
        const pendingWrites = await Promise.all(
          (JSON.parse(row.pending_writes) as PendingWriteColumn[]).map(
            async (write) => {
              const value = await this.serde.loadsTyped(
                write.type ?? 'json',
                write.value ?? '',
              )

              return [
                write.task_id,
                write.channel,
                normalizePendingWriteValue(write.channel, value),
              ] as [string, string, unknown]
            },
          ),
        )

        const checkpoint = normalizeCheckpointSummarizationState(
          (await this.serde.loadsTyped(
            row.type ?? 'json',
            row.checkpoint,
          )) as Checkpoint,
        )

        if (checkpoint.v < 4 && row.parent_checkpoint_id != null) {
          await this.migratePendingSends(
            checkpoint,
            row.thread_id,
            row.parent_checkpoint_id,
          )
        }

        yield {
          config: {
            configurable: {
              thread_id: row.thread_id,
              checkpoint_ns: row.checkpoint_ns,
              checkpoint_id: row.checkpoint_id,
            },
          },
          checkpoint,
          metadata: (await this.serde.loadsTyped(
            row.type ?? 'json',
            row.metadata,
          )) as CheckpointMetadata,
          parentConfig: row.parent_checkpoint_id
            ? {
                configurable: {
                  thread_id: row.thread_id,
                  checkpoint_ns: row.checkpoint_ns,
                  checkpoint_id: row.parent_checkpoint_id,
                },
              }
            : undefined,
          pendingWrites,
        }
      }
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ): Promise<RunnableConfig> {
    this.setup()

    if (!config.configurable) {
      throw new Error('Empty configuration supplied.')
    }

    const thread_id = config.configurable?.thread_id
    const checkpoint_ns = config.configurable?.checkpoint_ns ?? ''
    const parent_checkpoint_id = config.configurable?.checkpoint_id

    if (!thread_id) {
      throw new Error(
        `Missing "thread_id" field in passed "config.configurable".`,
      )
    }

    const preparedCheckpoint: Partial<Checkpoint> = copyCheckpoint(checkpoint)

    const [[type1, serializedCheckpoint], [type2, serializedMetadata]]
      = await Promise.all([
        this.serde.dumpsTyped(preparedCheckpoint),
        this.serde.dumpsTyped(metadata),
      ])

    if (type1 !== type2) {
      throw new Error(
        'Failed to serialized checkpoint and metadata to the same type.',
      )
    }

    this.putStmt.run(
      thread_id,
      checkpoint_ns,
      checkpoint.id,
      toBindValue(parent_checkpoint_id),
      type1,
      toBindValue(serializedCheckpoint),
      toBindValue(serializedMetadata),
    )

    return {
      configurable: {
        thread_id,
        checkpoint_ns,
        checkpoint_id: checkpoint.id,
      },
    }
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    this.setup()

    if (!config.configurable) {
      throw new Error('Empty configuration supplied.')
    }

    if (!config.configurable?.thread_id) {
      throw new Error('Missing thread_id field in config.configurable.')
    }

    if (!config.configurable?.checkpoint_id) {
      throw new Error('Missing checkpoint_id field in config.configurable.')
    }

    // 空写入提前返回，避免开启无意义的事务
    if (writes.length === 0)
      return

    const rows = await Promise.all(
      writes.map(async (write, idx) => {
        const [type, serializedWrite] = await this.serde.dumpsTyped(write[1])
        return [
          toBindValue(config.configurable?.thread_id),
          toBindValue(config.configurable?.checkpoint_ns ?? ''),
          toBindValue(config.configurable?.checkpoint_id),
          taskId,
          idx,
          write[0],
          toBindValue(type),
          toBindValue(serializedWrite),
        ]
      }),
    )

    this.db.exec('BEGIN')
    try {
      for (const row of rows) {
        this.putWriteStmt.run(...row)
      }
      this.db.exec('COMMIT')
    }
    catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }

  async deleteThread(threadId: string) {
    this.setup()
    this.db.exec('BEGIN')
    try {
      this.deleteCheckpointsStmt.run(threadId)
      this.deleteWritesStmt.run(threadId)
      this.db.exec('COMMIT')
    }
    catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }

  /**
   * 剪枝：只保留该 thread 下最新的 keepLastN 个 checkpoint（及其 writes），删除更早的。
   * 用 NOT IN 子查询单条 SQL 完成，无需先查后删、无需动态拼 IN 子句。
   * @param threadId - 线程 ID（与 conversation 的 thread_id 一致）
   * @param keepLastN - 保留最近几个 checkpoint，默认 1（仅保留最新状态用于恢复）
   */
  pruneThreadCheckpoints(threadId: string, keepLastN: number = 1): void {
    this.setup()
    if (keepLastN < 1)
      return
    this.db.exec('BEGIN')
    try {
      // writes 先删（外键依赖），再删 checkpoints
      this.pruneWritesStmt.run(threadId, threadId, keepLastN)
      this.pruneCheckpointsStmt.run(threadId, threadId, keepLastN)
      this.db.exec('COMMIT')
    }
    catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }

  /**
   * 清理该 thread 最新 checkpoint 的 pending writes，使 next 变空（收尾为完成态）。
   * 仅删 writes 表中「最新 checkpoint 对应的待应用任务」，不动 checkpoints 表本身，
   * 故 channel_values（messages 历史）原样保留 —— 下一次 stream(null) 不会再继续旧路线，
   * 而是按正常 input 分支处理新消息，且 agent 仍记得之前的对话。
   *
   * 用途：用户主动中止会话（/stop）后清理 abort 残留的 pending 状态。
   * 调用时机须保证该 thread 的 stream 已停止、checkpoint 稳定，避免与 stream 的 writes 竞态。
   * @param threadId 线程 ID（与 conversation 的 thread_id 一致）
   */
  clearPendingWrites(threadId: string): void {
    this.setup()
    this.db.exec('BEGIN')
    try {
      this.clearPendingWritesStmt.run(threadId, threadId)
      this.db.exec('COMMIT')
    }
    catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }

  protected async migratePendingSends(
    checkpoint: Checkpoint,
    threadId: string,
    parentCheckpointId: string,
  ) {
    const { pending_sends } = this.migratePendingSendsStmt
      .get(threadId, parentCheckpointId) as { pending_sends: string }

    const mutableCheckpoint = checkpoint

    // add pending sends to checkpoint
    mutableCheckpoint.channel_values ??= {}
    mutableCheckpoint.channel_values[TASKS] = await Promise.all(
      JSON.parse(pending_sends).map(({ type, value }: PendingSendColumn) =>
        this.serde.loadsTyped(type, value),
      ),
    )

    // add to versions
    mutableCheckpoint.channel_versions[TASKS]
      = Object.keys(checkpoint.channel_versions).length > 0
        ? maxChannelVersion(...Object.values(checkpoint.channel_versions))
        : this.getNextVersion(undefined)
  }
}

export function closeCheckpointer(connString?: string) {
  if (connString) {
    const instance = SqliteSaver.instances.get(connString)
    if (instance) {
      instance.db.close()
      SqliteSaver.instances.delete(connString)
    }
    return
  }

  for (const instance of SqliteSaver.instances.values()) {
    instance.db.close()
  }
  SqliteSaver.instances.clear()
}
