import type { AgentConversationRunEventDTO } from '@roxy/shared/channel'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { agentPaths } from '@/core/storage/agentPaths'
import { env } from '../../config'

/**
 * 对话上下文的管理
 * 用于前端UI/UX的对话数据存储和管理
 * 作为RoxyBrowser的子进程运行，通过环境变量获取userId和workspaceId
 */

// 从环境变量获取基础信息
const userId = env.ROXY_USER_ID
const workspaceId = env.ROXY_WORKSPACE_ID

function utcToLocal(utcStr: string): string {
  const d = new Date(`${utcStr.replace(' ', 'T')}Z`)
  if (Number.isNaN(d.getTime())) {
    return utcStr
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function getDefaultConversationWorkspacePath(conversationId: string): string {
  return agentPaths.sessionDir(conversationId)
}

/** 读取 assistant 消息的 canonical JSONL 事件文件。 */
function readMessageEventFile(filePath: string): { content?: string; events?: AgentConversationRunEventDTO[] } | null {
  if (path.extname(filePath).toLowerCase() !== '.jsonl') {
    return null
  }

  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf-8').toString()
  } catch {
    return null
  }

  const events: AgentConversationRunEventDTO[] = []
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }
    try {
      const item = JSON.parse(line) as AgentConversationRunEventDTO
      if (item && typeof item.sequence === 'number' && item.event?.type) {
        events.push(item)
      }
    } catch {
      return null
    }
  }
  return { content: '', events }
}

/** 删除一条 file 存储消息对应的 canonical JSONL 事件文件。 */
function deleteMessageEventFile(filePath: string): void {
  if (path.extname(filePath).toLowerCase() !== '.jsonl') {
    return
  }
  try {
    fs.rmSync(filePath, { force: true })
  } catch {
    // 忽略删除失败
  }
}

function ensureDirectory(dirPath: string): string {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
  return dirPath
}

// 类型断言：确保 userId 和 workspaceId 不是 undefined
const safeUserId: string = userId as string
const safeWorkspaceId: string = workspaceId as string

// 惰性数据库句柄：模块加载期不打开/创建任何文件，首次真正使用（访问 db.* 或 statements.*）
// 时才初始化。这样 sandbox 子进程在受限文件系统权限下仅 import 本模块（经 modes/agent 等
// 静态依赖被 webpack 打进同一 bundle）不会触发写入 agent 数据根目录而 ERR_ACCESS_DENIED。
let _db: DatabaseSync | undefined
function ensureDb(): DatabaseSync {
  if (_db) {
    return _db
  }
  if (!userId || !workspaceId) {
    throw new Error('Missing required environment variables: ROXY_USER_ID and ROXY_WORKSPACE_ID')
  }
  // 数据库初始化（迁移到 state/legacy/：历史消息正文库，runtime rollout 负责执行态）
  const dbPath = agentPaths.legacyConversationsDb
  // 确保数据库目录存在
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  _db = new DatabaseSync(dbPath)
  // 启用 WAL 模式以提高并发性能
  _db.exec("PRAGMA journal_mode = 'WAL'")
  // 初始化数据库表结构（此时 _db 已赋值，initDatabase 经 db 代理会解析到它）
  initDatabase()
  return _db
}

/** Initialize the conversations database after startup migrations have completed. */
export function initializeDatabase(): void {
  ensureDb()
}

const db: DatabaseSync = new Proxy({} as DatabaseSync, {
  get(_target, prop) {
    const real = ensureDb() as unknown as Record<string | symbol, unknown>
    const value = real[prop]
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value
  },
})

function initDatabase() {
  // 对话表
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      thread_id TEXT UNIQUE NOT NULL,
      workspace_path TEXT,
      model TEXT,
      is_active INTEGER DEFAULT 0,
      is_title_set INTEGER DEFAULT 0,
      latest_run_id TEXT,
      latest_run_status TEXT,
      last_read_run_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // 消息表
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL, -- user, assistant, system
      content TEXT, -- 消息内容（对于大内容存储文件路径）
      content_type TEXT DEFAULT 'text', -- text, file
      storage_type TEXT DEFAULT 'inline', -- inline(内联存储), file(文件存储)
      file_path TEXT, -- 当storage_type='file'时，存储文件路径
      metadata TEXT, -- JSON string for additional data
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `)

  // 创建索引以提高查询性能
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_user_workspace ON conversations(user_id, workspace_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_thread_id ON conversations(thread_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `)

  // 文件元信息表：统一管理用户上传和 Agent 产物的本地路径 / OSS URL / 内容 hash。
  // 相同 hash 的多条记录共享同一 local_path 与 oss_url（物理去重、逻辑保留各自 file_id）。
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      file_id        TEXT PRIMARY KEY,
      file_name      TEXT,
      local_path     TEXT,
      oss_url        TEXT,
      upstream_file_id TEXT,
      upstream_file_service TEXT,
      mime_type      TEXT,
      size           INTEGER,
      hash           TEXT,
      source         TEXT DEFAULT 'upload',
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // 上游 Files API 引用与 OSS URL 语义独立；已有数据库按列增量升级。
  try {
    const tableInfo = db.prepare('PRAGMA table_info(files)').all() as unknown as Array<{
      name: string
    }>
    const columns = new Set(tableInfo.map(column => column.name))
    if (!columns.has('upstream_file_id')) {
      db.exec('ALTER TABLE files ADD COLUMN upstream_file_id TEXT')
    }
    if (!columns.has('upstream_file_service')) {
      db.exec('ALTER TABLE files ADD COLUMN upstream_file_service TEXT')
    }
  }
  catch (error) {
    console.warn(`⚠️ Migration check for files upstream fields failed:`, error)
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);
    CREATE INDEX IF NOT EXISTS idx_files_oss_url ON files(oss_url);
    CREATE INDEX IF NOT EXISTS idx_files_upstream_file_id ON files(upstream_file_id);
  `)

  // 数据库迁移：脚本后端同步链路已删除，移除不再使用的远程文件 ID。
  try {
    const tableInfo = db.prepare('PRAGMA table_info(files)').all() as unknown as Array<{
      name: string
    }>
    const hasRemoteFileId = tableInfo.some((col) => col.name === 'remote_file_id')
    if (hasRemoteFileId) {
      db.exec('ALTER TABLE files DROP COLUMN remote_file_id;')
      console.log(`✅ Removed legacy remote_file_id column from files table`)
    }
  } catch (error) {
    console.warn(`⚠️ Migration check for files.remote_file_id failed:`, error)
  }

  // 数据库迁移：普通 chat agent 已统一执行形态，删除历史消息模式字段。
  try {
    const tableInfo = db.prepare('PRAGMA table_info(messages)').all() as unknown as Array<{
      name: string
    }>
    const hasAgentMode = tableInfo.some((col) => col.name === 'agent_mode')

    if (hasAgentMode) {
      db.exec('ALTER TABLE messages DROP COLUMN agent_mode;')
      console.log(`✅ Removed legacy agent_mode column from messages table`)
    }
  } catch (error) {
    console.warn(`⚠️ Migration check for agent_mode failed:`, error)
  }

  // 数据库迁移：为已存在的 conversations 表添加 is_active 字段
  try {
    const tableInfo = db.prepare('PRAGMA table_info(conversations)').all() as unknown as Array<{
      name: string
    }>
    const hasConversationType = tableInfo.some((col) => col.name === 'conversation_type')
    if (hasConversationType) {
      db.exec('ALTER TABLE conversations DROP COLUMN conversation_type;')
      console.log(`✅ Removed legacy conversation_type column from conversations table`)
    }

    const hasWorkspacePath = tableInfo.some((col) => col.name === 'workspace_path')
    if (!hasWorkspacePath) {
      db.exec(`
        ALTER TABLE conversations ADD COLUMN workspace_path TEXT;
      `)
      console.log(`✅ Added workspace_path column to conversations table`)
    }

    const hasIsActive = tableInfo.some((col) => col.name === 'is_active')

    if (!hasIsActive) {
      db.exec(`
        ALTER TABLE conversations ADD COLUMN is_active INTEGER DEFAULT 0;
      `)
      console.log(`✅ Added is_active column to conversations table`)
    }

    const hasIsTask = tableInfo.some((col) => col.name === 'is_task')
    if (hasIsTask) {
      db.exec(`
        ALTER TABLE conversations DROP COLUMN is_task;
      `)
      console.log(`✅ Removed legacy is_task column from conversations table`)
    }

    const hasScheduled = tableInfo.some((col) => col.name === 'scheduled')
    if (hasScheduled) {
      // 删除列前先清理历史遗留的隐藏 scheduled 会话（scheduled=1），否则 drop 列后
      // 它们会出现在用户主会话列表里。本库未开启 foreign_keys pragma，需手动删除消息。
      db.exec(`
        DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE scheduled = 1);
        DELETE FROM conversations WHERE scheduled = 1;
        ALTER TABLE conversations DROP COLUMN scheduled;
      `)
      console.log(`✅ Purged legacy scheduled conversations and removed scheduled column`)
    }

    const runStateColumns = [
      ['latest_run_id', 'TEXT'],
      ['latest_run_status', 'TEXT'],
      ['last_read_run_id', 'TEXT'],
    ] as const
    for (const [column, type] of runStateColumns) {
      if (tableInfo.some((item) => item.name === column)) {
        continue
      }
      db.exec(`ALTER TABLE conversations ADD COLUMN ${column} ${type};`)
      console.log(`✅ Added ${column} column to conversations table`)
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversations_workspace_user_list
        ON conversations(workspace_id, user_id, is_active DESC, created_at DESC, id DESC);
    `)
  } catch (error) {
    // 如果表不存在或其他错误，忽略（表会在上面创建）
    console.warn(`⚠️ Migration check for is_active failed:`, error)
  }

  // 数据库迁移：为已存在的 conversations 表添加 is_title_set 字段
  try {
    const tableInfo = db.prepare('PRAGMA table_info(conversations)').all() as unknown as Array<{
      name: string
    }>
    const hasIsTitleSet = tableInfo.some((col) => col.name === 'is_title_set')

    if (!hasIsTitleSet) {
      db.exec(`
        ALTER TABLE conversations ADD COLUMN is_title_set INTEGER DEFAULT 0;
      `)
      console.log(`✅ Added is_title_set column to conversations table`)
    }
  } catch (error) {
    // 如果表不存在或其他错误，忽略（表会在上面创建）
    console.warn(`⚠️ Migration check for is_title_set failed:`, error)
  }

  // 生图业务已下线；仅删除其专用元数据表，通用 files 表和物理文件保留。
  try {
    db.exec('DROP TABLE IF EXISTS assets_fts; DROP TABLE IF EXISTS assets;')
  } catch (error) {
    console.warn(`⚠️ Failed to remove legacy asset tables:`, error)
  }
}

export type ConversationRunStatus = 'streaming' | 'completed' | 'failed' | 'cancelled'

export interface Conversation {
  id: string
  user_id: string
  workspace_id: string
  title: string
  thread_id: string
  workspace_path?: string | null
  model?: string
  created_at: string
  updated_at: string
  /**
   * 是否为当前活跃对话（同一工作空间内只有一个对话可以处于活跃状态）
   */
  is_active?: number
  /**
   * 标题是否已被设置过（0=未设置，1=已设置）
   */
  is_title_set?: 0 | 1
  latest_run_id: string | null
  latest_run_status: ConversationRunStatus | null
  last_read_run_id: string | null
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  /**
   * 可选，当storage_type='file'时为空
   */
  content?: string
  content_type: 'text' | 'file'
  storage_type: 'inline' | 'file' /**
   * 内联存储或文件存储
   */
  file_path?: string /**
   * 当storage_type='file'时必填
   */
  metadata?: any
  events?: AgentConversationRunEventDTO[]
  created_at: string
}

// Prepared statements for better performance（惰性构建：首次访问 statements.* 时才 prepare，
// 避免在模块加载期打开数据库）
type StatementMap = Record<string, ReturnType<DatabaseSync['prepare']>>
let _statements: StatementMap | undefined
function buildStatements(): StatementMap {
  return {
    // Conversation operations
    insertConversation: db.prepare(`
    INSERT INTO conversations (id, user_id, workspace_id, title, thread_id, workspace_path, model, is_active, is_title_set)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

    updateConversation: db.prepare(`
    UPDATE conversations SET
      title = COALESCE(?, title),
      model = COALESCE(?, model),
      is_title_set = COALESCE(?, is_title_set),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),

    startConversationRun: db.prepare(`
    UPDATE conversations SET
      latest_run_id = ?,
      latest_run_status = 'streaming',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),

    finishConversationRun: db.prepare(`
    UPDATE conversations SET
      latest_run_status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ? AND latest_run_id = ?
  `),

    markConversationRead: db.prepare(`
    UPDATE conversations SET last_read_run_id = ?
    WHERE id = ? AND user_id = ? AND workspace_id = ? AND latest_run_id = ?
  `),

    setActiveConversation: db.prepare(`
    UPDATE conversations 
    SET is_active = CASE 
      WHEN id = ? THEN 1 
      ELSE 0 
    END,
    updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND workspace_id = ?
  `),

    getActiveConversation: db.prepare(`
    SELECT * FROM conversations 
    WHERE user_id = ? AND workspace_id = ? AND is_active = 1
    LIMIT 1
  `),

    clearAllActive: db.prepare(`
    UPDATE conversations 
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND workspace_id = ?
  `),

    deleteConversation: db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ? AND workspace_id = ?'),

    updateConversationWorkspacePath: db.prepare(`
    UPDATE conversations SET workspace_path = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),

    getConversationsByWorkspace: db.prepare(`
    SELECT c.*
    FROM conversations c
    WHERE c.workspace_id = ? AND c.user_id = ?
    ORDER BY c.is_active DESC, c.created_at DESC, c.id DESC
    LIMIT ? OFFSET ?
  `),

    getConversation: db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ? AND workspace_id = ?'),

    getConversationByThreadId: db.prepare('SELECT * FROM conversations WHERE thread_id = ? AND user_id = ? AND workspace_id = ?'),

    // Message operations
    insertMessage: db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, content_type, storage_type, file_path, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),

    getMessagesByConversation: db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC, rowid ASC
  `),

    deleteMessagesByConversation: db.prepare('DELETE FROM messages WHERE conversation_id = ?'),

    // 取某会话所有 file 存储消息的 file_path（用于删除对话时清理 JSONL 事件文件）
    getMessageFilePathsByConversation: db.prepare(
      `SELECT file_path FROM messages WHERE conversation_id = ? AND storage_type = 'file' AND file_path IS NOT NULL`,
    ),

    // 删除对话时清理消息附件所需
    getMessageMetadataByConversation: db.prepare(`SELECT metadata FROM messages WHERE conversation_id = ? AND metadata IS NOT NULL`),
    countFilesByLocalPath: db.prepare(`SELECT COUNT(*) AS n FROM files WHERE local_path = ?`),
    deleteFileByFileId: db.prepare('DELETE FROM files WHERE file_id = ?'),

    // File operations
    insertFile: db.prepare(`
    INSERT INTO files (
      file_id, file_name, local_path, oss_url, upstream_file_id,
      upstream_file_service, mime_type, size, hash, source
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

    getFileById: db.prepare('SELECT * FROM files WHERE file_id = ?'),

    getFileByUpstreamFileId: db.prepare(
      'SELECT * FROM files WHERE upstream_file_id = ? ORDER BY created_at ASC LIMIT 1',
    ),

    getFileByHashAny: db.prepare('SELECT * FROM files WHERE hash = ? ORDER BY created_at ASC LIMIT 1'),

    getFileByHashWithOss: db.prepare(`
    SELECT * FROM files
    WHERE hash = ? AND oss_url IS NOT NULL AND oss_url <> ''
    ORDER BY created_at ASC LIMIT 1
  `),

    updateFileOssByHash: db.prepare(`
    UPDATE files SET oss_url = ?, updated_at = CURRENT_TIMESTAMP
    WHERE hash = ? AND (oss_url IS NULL OR oss_url = '')
  `),

    updateFileOssById: db.prepare(`
    UPDATE files SET oss_url = ?, updated_at = CURRENT_TIMESTAMP WHERE file_id = ?
  `),
  }
}

const statements: StatementMap = new Proxy({} as StatementMap, {
  get(_target, prop) {
    if (!_statements) {
      _statements = buildStatements()
    }
    return _statements[prop as string]
  },
})

// 对话管理
export class ConversationManager {
  static create(
    conversation: Omit<
      Conversation,
      'created_at' | 'updated_at' | 'user_id' | 'workspace_id' | 'is_active' | 'is_title_set' | 'latest_run_id' | 'latest_run_status' | 'last_read_run_id'
    >,
    options: { activate?: boolean; isTitleSet?: boolean } = {},
  ): Conversation {
    const workspacePath = ensureDirectory(conversation.workspace_path || getDefaultConversationWorkspacePath(conversation.id))
    const activate = options.activate !== false

    try {
      db.exec('BEGIN')
      if (activate) {
        statements.clearAllActive.run(safeUserId, safeWorkspaceId)
      }
      statements.insertConversation.run(
        conversation.id,
        safeUserId,
        safeWorkspaceId,
        conversation.title,
        conversation.thread_id,
        workspacePath,
        conversation.model ?? null,
        activate ? 1 : 0,
        options.isTitleSet ? 1 : 0,
      )
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }

    const result = statements.getConversation.get(conversation.id, safeUserId, safeWorkspaceId)
    if (!result) {
      throw new Error('Failed to create conversation')
    }
    return result as unknown as Conversation
  }

  static update(conversationId: string, updates: Partial<Pick<Conversation, 'title' | 'model' | 'is_title_set'>>): boolean {
    if (updates.title === undefined && updates.model === undefined && updates.is_title_set === undefined) {
      return false
    }

    const result = statements.updateConversation.run(
      updates.title ?? (null as any),
      updates.model ?? (null as any),
      updates.is_title_set ?? (null as any),
      conversationId,
      safeUserId,
      safeWorkspaceId,
    )
    return result.changes > 0
  }

  static startRun(conversationId: string, runId: string): boolean {
    const result = statements.startConversationRun.run(runId, conversationId, safeUserId, safeWorkspaceId)
    return result.changes > 0
  }

  static finishRun(conversationId: string, runId: string, status: Exclude<ConversationRunStatus, 'streaming'>): boolean {
    const result = statements.finishConversationRun.run(status, conversationId, safeUserId, safeWorkspaceId, runId)
    return result.changes > 0
  }

  static markRead(conversationId: string, runId: string): boolean {
    const result = statements.markConversationRead.run(runId, conversationId, safeUserId, safeWorkspaceId, runId)
    return result.changes > 0
  }

  static delete(conversationId: string): boolean {
    try {
      db.exec('BEGIN')
      statements.deleteMessagesByConversation.run(conversationId)
      const result = statements.deleteConversation.run(conversationId, safeUserId, safeWorkspaceId)
      db.exec('COMMIT')
      return result.changes > 0
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  /** SQLite treats a negative LIMIT as unbounded for internal full-list consumers. */
  static getAll(): Conversation[] {
    return ConversationManager.getPage(-1, 0)
  }

  static getPage(limit: number, offset: number): Conversation[] {
    const rows = statements.getConversationsByWorkspace.all(safeWorkspaceId, safeUserId, limit, offset) as unknown as Conversation[]
    return ConversationManager.mapRows(rows)
  }

  private static mapRows(rows: Conversation[]): Conversation[] {
    return rows.map((conversation) => ({
      ...conversation,
      created_at: utcToLocal(conversation.created_at),
      updated_at: utcToLocal(conversation.updated_at),
    }))
  }

  static getById(conversationId: string): Conversation | null {
    const result = statements.getConversation.get(conversationId, safeUserId, safeWorkspaceId)
    return result ? (result as unknown as Conversation) : null
  }

  static ensureWorkspace(conversationId: string): string {
    const conversation = ConversationManager.getById(conversationId)
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`)
    }

    const workspacePath = ensureDirectory(conversation.workspace_path || getDefaultConversationWorkspacePath(conversationId))
    if (conversation.workspace_path !== workspacePath) {
      statements.updateConversationWorkspacePath.run(workspacePath, conversationId, safeUserId, safeWorkspaceId)
    }
    return workspacePath
  }

  static getByThreadId(threadId: string): Conversation | null {
    const result = statements.getConversationByThreadId.get(threadId, safeUserId, safeWorkspaceId)
    return result ? (result as unknown as Conversation) : null
  }

  /**
   * 设置指定对话为活跃状态
   * 会自动将同一工作空间内的其他对话设置为非活跃状态
   * @param conversationId 要设置为活跃的对话ID
   * @returns 是否设置成功
   */
  static setActive(conversationId: string): boolean {
    // 先检查对话是否存在
    const conversation = ConversationManager.getById(conversationId)
    if (!conversation) {
      return false
    }

    // 使用事务确保原子性：先取消所有对话的活跃状态，再设置指定对话为活跃
    try {
      db.exec('BEGIN')
      statements.setActiveConversation.run(conversationId, safeUserId, safeWorkspaceId)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }

    return true
  }

  /**
   * 获取当前活跃的对话
   * @returns 当前活跃的对话，如果没有则返回 null
   */
  static getActive(): Conversation | null {
    const result = statements.getActiveConversation.get(safeUserId, safeWorkspaceId)
    return result ? (result as unknown as Conversation) : null
  }
}

// 消息管理
export class MessageManager {
  static add(message: Omit<Message, 'created_at'>): Message {
    const metadataJson = message.metadata ? JSON.stringify(message.metadata) : null

    statements.insertMessage.run(
      message.id,
      message.conversation_id,
      message.role,
      message.content ?? (null as any),
      message.content_type,
      message.storage_type,
      message.file_path ?? (null as any),
      metadataJson as any,
    )

    // 返回刚插入的消息（包含创建时间）
    const result = db
      .prepare(
        `
      SELECT * FROM messages WHERE id = ?
    `,
      )
      .get(message.id) as unknown as Message

    if (result && result.metadata) {
      result.metadata = JSON.parse(result.metadata as string)
    }

    return result
  }

  static getByConversation(conversationId: string): Message[] {
    const messages = statements.getMessagesByConversation.all(conversationId) as unknown as Message[]

    // 处理消息内容和元数据
    const hydratedMessages = messages.map((msg) => {
      let content = msg.content
      const metadata = msg.metadata ? JSON.parse(msg.metadata as string) : undefined

      // assistant 的大消息使用 canonical JSONL 事件文件存储。
      if (msg.storage_type === 'file' && msg.file_path) {
        const fileContent = readMessageEventFile(msg.file_path)
        if (!fileContent) {
          console.warn(`Failed to read message file: ${msg.file_path}`)
        }
        content = fileContent?.content ?? 'read history record failed'
        if (fileContent?.events) {
          msg.events = fileContent.events
        }
      }

      return {
        ...msg,
        content,
        metadata,
        created_at: utcToLocal(msg.created_at),
      }
    })

    return hydratedMessages
  }

  static deleteByConversation(conversationId: string): boolean {
    // 先清理消息事件文件，再删 DB 行，避免留下孤儿文件。
    try {
      const rows = statements.getMessageFilePathsByConversation.all(conversationId) as unknown as Array<{ file_path: string }>
      for (const row of rows) {
        if (row.file_path) {
          deleteMessageEventFile(row.file_path)
        }
      }
    } catch (err: any) {
      console.warn(`清理会话事件文件失败 ${conversationId}:`, err?.message)
    }
    const result = statements.deleteMessagesByConversation.run(conversationId)
    return result.changes > 0
  }
}

// ============ 文件元信息（files 表）============

export interface FileRecord {
  file_id: string
  file_name: string | null
  local_path: string | null
  oss_url: string | null
  upstream_file_id: string | null
  upstream_file_service: string | null
  mime_type: string | null
  size: number | null
  hash: string | null
  source: string
  created_at: string
  updated_at: string
}

export interface CreateFileInput {
  file_id: string
  file_name?: string | null
  local_path?: string | null
  oss_url?: string | null
  upstream_file_id?: string | null
  upstream_file_service?: string | null
  mime_type?: string | null
  size?: number | null
  hash?: string | null
  source?: string
}

function mapFileRow(row: any): FileRecord {
  return {
    file_id: row.file_id,
    file_name: row.file_name ?? null,
    local_path: row.local_path ?? null,
    oss_url: row.oss_url ?? null,
    upstream_file_id: row.upstream_file_id ?? null,
    upstream_file_service: row.upstream_file_service ?? null,
    mime_type: row.mime_type ?? null,
    size: row.size != null ? Number(row.size) : null,
    hash: row.hash ?? null,
    source: row.source ?? 'upload',
    created_at: row.created_at ? utcToLocal(row.created_at) : row.created_at,
    updated_at: row.updated_at ? utcToLocal(row.updated_at) : row.updated_at,
  }
}

/**
 * 文件元信息存储（复用 conversations.db 连接）。
 * 只负责持久化；hash 计算、本地读写、OSS 上传编排由 server 层的 FileManager 完成。
 */
export class FileRecordStore {
  static insert(input: CreateFileInput): FileRecord {
    statements.insertFile.run(
      input.file_id,
      input.file_name ?? (null as any),
      input.local_path ?? (null as any),
      input.oss_url ?? (null as any),
      input.upstream_file_id ?? (null as any),
      input.upstream_file_service ?? (null as any),
      input.mime_type ?? (null as any),
      input.size ?? (null as any),
      input.hash ?? (null as any),
      input.source ?? 'upload',
    )
    const row = statements.getFileById.get(input.file_id)
    if (!row) {
      throw new Error('Failed to create file record')
    }
    return mapFileRow(row)
  }

  static getByFileId(fileId: string): FileRecord | null {
    if (!fileId) {
      return null
    }
    const row = statements.getFileById.get(fileId)
    return row ? mapFileRow(row) : null
  }

  static getByUpstreamFileId(upstreamFileId: string): FileRecord | null {
    if (!upstreamFileId) {
      return null
    }
    const row = statements.getFileByUpstreamFileId.get(upstreamFileId)
    return row ? mapFileRow(row) : null
  }

  /** 收集某对话消息 metadata.attachments 中引用的全部 file_id。 */
  static getConversationFileIds(conversationId: string): string[] {
    const ids = new Set<string>()
    const msgRows = statements.getMessageMetadataByConversation.all(conversationId) as unknown as Array<{ metadata: string }>
    for (const r of msgRows) {
      try {
        const meta = r.metadata ? JSON.parse(r.metadata) : null
        const atts = meta?.attachments
        if (Array.isArray(atts)) {
          for (const a of atts) {
            const fid = a?.fileId ?? a?.file_id
            if (typeof fid === 'string' && fid) {
              ids.add(fid)
            }
          }
        }
      } catch {
        // metadata 解析失败忽略
      }
    }
    return [...ids]
  }

  /**
   * 删除一条 file 记录，并返回其物理路径与「删除后是否已无其它记录引用该物理文件」。
   * 因 files 表按 hash 去重（多条 file_id 共享同一 local_path），只有最后一条引用被删时才可删物理文件。
   */
  static deleteFileRecord(fileId: string): {
    localPath: string | null
    lastRef: boolean
  } {
    const record = FileRecordStore.getByFileId(fileId)
    const localPath = record?.local_path ?? null
    statements.deleteFileByFileId.run(fileId)
    let lastRef = false
    if (localPath) {
      const row = statements.countFilesByLocalPath.get(localPath) as unknown as { n: number } | undefined
      lastRef = !row || Number(row.n) === 0
    }
    return { localPath, lastRef }
  }

  /** 取同 hash 最早一条（用于复用其本地物理文件路径） */
  static getByHashAny(hash: string): FileRecord | null {
    if (!hash) {
      return null
    }
    const row = statements.getFileByHashAny.get(hash)
    return row ? mapFileRow(row) : null
  }

  /** 取同 hash 中最早一条已具备 oss_url 的记录（用于复用 OSS，跳过重复上传） */
  static getByHashWithOss(hash: string): FileRecord | null {
    if (!hash) {
      return null
    }
    const row = statements.getFileByHashWithOss.get(hash)
    return row ? mapFileRow(row) : null
  }

  /** 回填同 hash 下所有尚未具备 oss_url 的记录 */
  static setOssByHash(hash: string, ossUrl: string): number {
    if (!hash || !ossUrl) {
      return 0
    }
    const result = statements.updateFileOssByHash.run(ossUrl, hash)
    return Number(result.changes)
  }

  static setOssById(fileId: string, ossUrl: string): boolean {
    if (!fileId || !ossUrl) {
      return false
    }
    const result = statements.updateFileOssById.run(ossUrl, fileId)
    return Number(result.changes) > 0
  }
}

// 导出便捷的组合函数
export const ChatContextAPI = {
  // 对话相关
  createConversation: ConversationManager.create,
  updateConversation: ConversationManager.update,
  startConversationRun: ConversationManager.startRun,
  finishConversationRun: ConversationManager.finishRun,
  markConversationRead: ConversationManager.markRead,
  deleteConversation: ConversationManager.delete,
  getConversations: ConversationManager.getAll,
  getConversationPage: ConversationManager.getPage,
  getConversation: ConversationManager.getById,
  getConversationByThreadId: ConversationManager.getByThreadId,
  ensureConversationWorkspace: ConversationManager.ensureWorkspace,
  setActiveConversation: ConversationManager.setActive,
  getActiveConversation: ConversationManager.getActive,

  // 消息相关
  addMessage: MessageManager.add,
  getMessagesByConversation: MessageManager.getByConversation,
  deleteMessagesByConversation: MessageManager.deleteByConversation,
}

/**
 * 关闭数据库连接（在应用退出时调用）
 */
export function closeDatabase() {
  // 未初始化则无需关闭，避免经 db 代理反而把数据库打开
  if (_db) {
    _db.close()
    _db = undefined
    _statements = undefined
  }
}
