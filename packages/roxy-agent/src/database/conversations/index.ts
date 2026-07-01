import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { env } from '../../config'

/**
 * 对话上下文的管理
 * 用于前端UI/UX的对话数据存储和管理
 * 作为RoxyBrowser的子进程运行，通过环境变量获取userId和workspaceId
 */

// 从环境变量获取基础信息
const userId = env.ROXY_USER_ID
const workspaceId = env.ROXY_WORKSPACE_ID

if (!userId || !workspaceId) {
  throw new Error('Missing required environment variables: ROXY_USER_ID and ROXY_WORKSPACE_ID')
}

function utcToLocal(utcStr: string): string {
  const d = new Date(`${utcStr.replace(' ', 'T')}Z`)
  if (Number.isNaN(d.getTime()))
    return utcStr
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * 将后端返回的时间戳（Python isoformat，如 '2026-06-20T10:30:00'、带微秒
 * '...00.123456'、带时区 '...+00:00'/'Z'）归一为与本地 SQLite CURRENT_TIMESTAMP
 * 一致的 UTC 'YYYY-MM-DD HH:MM:SS'（秒级、空格分隔），以便 scripts 列表在 DB 层
 * 按 TEXT 排序时本地记录与后端同步记录可正确比较。无时区后缀的 naive isoformat
 * 按 UTC 解析（不做时区换算）。无法解析则返回 null（调用方用 COALESCE 回退）。
 */
function normalizeTimestamp(iso: string | null | undefined): string | null {
  if (!iso)
    return null
  const hasTz = /z$|[+-]\d{2}:?\d{2}$/i.test(iso)
  const d = new Date(hasTz ? iso : `${iso}Z`)
  if (Number.isNaN(d.getTime()))
    return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

// 类型断言：确保 userId 和 workspaceId 不是 undefined
const safeUserId: string = userId
const safeWorkspaceId: string = workspaceId

// 数据库初始化
const dbPath = path.join(env.CHECKPOINT_DIR, 'conversations.db')
// 确保日志目录存在
if (!fs.existsSync(env.CHECKPOINT_DIR)) {
  fs.mkdirSync(env.CHECKPOINT_DIR, { recursive: true })
}
const db = new DatabaseSync(dbPath)

// 启用 WAL 模式以提高并发性能
db.exec('PRAGMA journal_mode = \'WAL\'')

// 初始化数据库表结构
initDatabase()

function initDatabase() {
  // 对话表
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      workspace_id TEXT NOT NULL,
      title TEXT NOT NULL,
      thread_id TEXT UNIQUE NOT NULL,
      conversation_type TEXT DEFAULT 'automation',
      model TEXT,
      is_active INTEGER DEFAULT 0,
      is_title_set INTEGER DEFAULT 0,
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
      content_type TEXT DEFAULT 'text', -- text, image, file, inline, external
      storage_type TEXT DEFAULT 'inline', -- inline(内联存储), file(文件存储)
      file_path TEXT, -- 当storage_type='file'时，存储文件路径
      agent_mode TEXT DEFAULT 'simple', -- orchestrator(编排模式), simple(简单模式)
      metadata TEXT, -- JSON string for additional data
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `)

  // 会话资产表：记录图片/视频等生成资产的元数据。文件本体仍由 uploads 目录或未来资产服务保存。
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      message_id TEXT,
      batch_id TEXT NOT NULL,
      batch_index INTEGER NOT NULL,
      ordinal_in_batch INTEGER NOT NULL,
      asset_type TEXT NOT NULL DEFAULT 'image',
      file_id TEXT,
      file_name TEXT,
      url TEXT,
      remote_url TEXT,
      mime_type TEXT,
      status TEXT NOT NULL DEFAULT 'success',
      prompt TEXT,
      aspect_ratio TEXT,
      quality TEXT,
      width INTEGER,
      height INTEGER,
      depends_on TEXT NOT NULL DEFAULT '[]',
      search_text TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL
    );
  `)

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
      asset_id UNINDEXED,
      conversation_id UNINDEXED,
      search_text,
      prompt,
      search_terms,
      metadata_text,
      tokenize = 'unicode61'
    );
  `)

  // 创建索引以提高查询性能
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_user_workspace ON conversations(user_id, workspace_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_thread_id ON conversations(thread_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_assets_conversation_type_status_created ON assets(conversation_id, asset_type, status, created_at);
  `)

  // 文件元信息表：统一管理所有文件（用户上传 + 生成）的本地路径 / OSS URL / 内容 hash。
  // 相同 hash 的多条记录共享同一 local_path 与 oss_url（物理去重、逻辑保留各自 file_id）。
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      file_id        TEXT PRIMARY KEY,
      file_name      TEXT,
      local_path     TEXT,
      oss_url        TEXT,
      remote_file_id TEXT,
      mime_type      TEXT,
      size           INTEGER,
      hash           TEXT,
      source         TEXT DEFAULT 'upload',
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);
    CREATE INDEX IF NOT EXISTS idx_files_oss_url ON files(oss_url);
  `)

  // 录制脚本表：持久化录制生成的自动化脚本（file 本体仍由 files 表管理）
  db.exec(`
    CREATE TABLE IF NOT EXISTS scripts (
      id              TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      workspace_id    TEXT NOT NULL,
      name            TEXT NOT NULL,
      description     TEXT,
      conversation_id TEXT,
      recording_id    TEXT,
      file_id         TEXT NOT NULL,
      dir_id          TEXT,
      remote_id       INTEGER,
      options_schema  TEXT,
      source          TEXT DEFAULT 'recording',
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, workspace_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_scripts_user_workspace ON scripts(user_id, workspace_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_scripts_conversation   ON scripts(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_scripts_file           ON scripts(file_id);
  `)

  // 数据库迁移：为已存在的 scripts 表添加 dir_id 字段
  try {
    const tableInfo = db.prepare('PRAGMA table_info(scripts)').all() as unknown as Array<{ name: string }>
    const hasDirId = tableInfo.some(col => col.name === 'dir_id')
    if (!hasDirId) {
      db.exec(`ALTER TABLE scripts ADD COLUMN dir_id TEXT;`)
      console.log(`✅ Added dir_id column to scripts table`)
    }
  }
  catch (error) {
    console.warn(`⚠️ Migration check for scripts.dir_id failed:`, error)
  }

  // 数据库迁移：为已存在的 scripts 表添加 remote_id 字段（后端脚本数字 id，用于级联删除/更新与同步匹配）
  try {
    const tableInfo = db.prepare('PRAGMA table_info(scripts)').all() as unknown as Array<{ name: string }>
    const hasRemoteId = tableInfo.some(col => col.name === 'remote_id')
    if (!hasRemoteId) {
      db.exec(`ALTER TABLE scripts ADD COLUMN remote_id INTEGER;`)
      console.log(`✅ Added remote_id column to scripts table`)
    }
  }
  catch (error) {
    console.warn(`⚠️ Migration check for scripts.remote_id failed:`, error)
  }

  // 数据库迁移：移除已废弃的 scripts.status 字段（旧库可能仍存在该列）
  try {
    const tableInfo = db.prepare('PRAGMA table_info(scripts)').all() as unknown as Array<{ name: string }>
    const hasStatus = tableInfo.some(col => col.name === 'status')
    if (hasStatus) {
      db.exec(`ALTER TABLE scripts DROP COLUMN status;`)
      console.log(`✅ Dropped legacy status column from scripts table`)
    }
  }
  catch (error) {
    console.warn(`⚠️ Migration check for scripts.status failed:`, error)
  }

  // 数据库迁移：为已存在的 scripts 表添加 options_schema 字段（脚本入参 JSON Schema）
  try {
    const tableInfo = db.prepare('PRAGMA table_info(scripts)').all() as unknown as Array<{ name: string }>
    const hasOptionsSchema = tableInfo.some(col => col.name === 'options_schema')
    if (!hasOptionsSchema) {
      db.exec(`ALTER TABLE scripts ADD COLUMN options_schema TEXT;`)
      console.log(`✅ Added options_schema column to scripts table`)
    }
  }
  catch (error) {
    console.warn(`⚠️ Migration check for scripts.options_schema failed:`, error)
  }

  // 数据库迁移：为已存在的 files 表添加 remote_file_id 字段（后端 OSS file_id）
  try {
    const tableInfo = db.prepare('PRAGMA table_info(files)').all() as unknown as Array<{ name: string }>
    const hasRemoteFileId = tableInfo.some(col => col.name === 'remote_file_id')
    if (!hasRemoteFileId) {
      db.exec(`ALTER TABLE files ADD COLUMN remote_file_id TEXT;`)
      console.log(`✅ Added remote_file_id column to files table`)
    }
  }
  catch (error) {
    console.warn(`⚠️ Migration check for files.remote_file_id failed:`, error)
  }

  // 数据库迁移：为已存在的 messages 表添加 agent_mode 字段
  try {
    const tableInfo = db.prepare('PRAGMA table_info(messages)').all() as unknown as Array<{ name: string }>
    const hasAgentMode = tableInfo.some(col => col.name === 'agent_mode')

    if (!hasAgentMode) {
      db.exec(`
        ALTER TABLE messages ADD COLUMN agent_mode TEXT DEFAULT 'simple';
      `)
      console.log(`✅ Added agent_mode column to messages table`)
    }
  }
  catch (error) {
    // 如果表不存在或其他错误，忽略（表会在上面创建）
    console.warn(`⚠️ Migration check for agent_mode failed:`, error)
  }

  // 数据库迁移：为已存在的 conversations 表添加 is_active 字段
  try {
    const tableInfo = db.prepare('PRAGMA table_info(conversations)').all() as unknown as Array<{ name: string }>
    const hasConversationType = tableInfo.some(col => col.name === 'conversation_type')
    if (!hasConversationType) {
      db.exec(`
        ALTER TABLE conversations ADD COLUMN conversation_type TEXT DEFAULT 'automation';
      `)
      console.log(`✅ Added conversation_type column to conversations table`)
    }

    const hasIsActive = tableInfo.some(col => col.name === 'is_active')

    if (!hasIsActive) {
      db.exec(`
        ALTER TABLE conversations ADD COLUMN is_active INTEGER DEFAULT 0;
      `)
      console.log(`✅ Added is_active column to conversations table`)
    }
  }
  catch (error) {
    // 如果表不存在或其他错误，忽略（表会在上面创建）
    console.warn(`⚠️ Migration check for is_active failed:`, error)
  }

  // 数据库迁移：为已存在的 conversations 表添加 is_title_set 字段
  try {
    const tableInfo = db.prepare('PRAGMA table_info(conversations)').all() as unknown as Array<{ name: string }>
    const hasIsTitleSet = tableInfo.some(col => col.name === 'is_title_set')

    if (!hasIsTitleSet) {
      db.exec(`
        ALTER TABLE conversations ADD COLUMN is_title_set INTEGER DEFAULT 0;
      `)
      console.log(`✅ Added is_title_set column to conversations table`)
    }
  }
  catch (error) {
    // 如果表不存在或其他错误，忽略（表会在上面创建）
    console.warn(`⚠️ Migration check for is_title_set failed:`, error)
  }

  // 数据库迁移：为已存在的 assets 表添加 remote_url 字段
  try {
    const tableInfo = db.prepare('PRAGMA table_info(assets)').all() as unknown as Array<{ name: string }>
    const hasRemoteUrl = tableInfo.some(col => col.name === 'remote_url')

    if (!hasRemoteUrl) {
      db.exec(`
        ALTER TABLE assets ADD COLUMN remote_url TEXT;
      `)
      console.log(`✅ Added remote_url column to assets table`)
    }
  }
  catch (error) {
    console.warn(`⚠️ Migration check for assets.remote_url failed:`, error)
  }
}

// 类型定义
export interface Conversation {
  id: string
  user_id: string
  workspace_id: string
  title: string
  thread_id: string
  conversation_type?: 'automation' | 'asset'
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
  is_title_set?: number
  /**
   * 消息数量（查询时动态添加）
   */
  message_count?: number
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  /**
   * 可选，当storage_type='file'时为空
   */
  content?: string
  content_type: 'text' | 'image' | 'file' | 'inline' | 'external'
  storage_type: 'inline' | 'file' /**
                                   * 内联存储或文件存储
                                   */
  file_path?: string /**
                      * 当storage_type='file'时必填
                      */
  agent_mode: 'orchestrator' | 'simple' | 'image' /**
                                                   * orchestrator(编排模式), simple(简单模式), image(生图模式)
                                                   */
  metadata?: any
  created_at: string
}

export type AssetType = 'image' | 'video'
export type AssetStatus = 'generating' | 'success' | 'failed'

export interface ConversationAsset {
  id: string
  conversation_id: string
  message_id?: string | null
  batch_id: string
  batch_index: number
  ordinal_in_batch: number
  asset_type: AssetType
  file_id?: string | null
  file_name?: string | null
  url?: string | null
  remote_url?: string | null
  mime_type?: string | null
  status: AssetStatus
  prompt?: string | null
  aspect_ratio?: string | null
  quality?: string | null
  width?: number | null
  height?: number | null
  depends_on: string[]
  search_text?: string | null
  metadata?: any
  created_at: string
  fts_rank?: number
}

export interface CreateAssetInput {
  id: string
  conversation_id: string
  message_id?: string | null
  batch_id: string
  batch_index: number
  ordinal_in_batch: number
  asset_type?: AssetType
  file_id?: string | null
  file_name?: string | null
  url?: string | null
  remote_url?: string | null
  mime_type?: string | null
  status?: AssetStatus
  prompt?: string | null
  aspect_ratio?: string | null
  quality?: string | null
  width?: number | null
  height?: number | null
  depends_on?: string[]
  search_text?: string | null
  metadata?: any
}

export interface AssetSearchOptions {
  assetType?: AssetType
  status?: AssetStatus
  limit?: number
}

// Prepared statements for better performance
const statements = {
  // Conversation operations
  insertConversation: db.prepare(`
    INSERT INTO conversations (id, user_id, workspace_id, title, thread_id, conversation_type, model, is_active, is_title_set)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  updateConversation: db.prepare(`
    UPDATE conversations SET title = ?, model = ?, conversation_type = COALESCE(?, conversation_type), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),

  updateConversationModel: db.prepare(`
    UPDATE conversations SET model = ?, conversation_type = COALESCE(?, conversation_type), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),

  updateConversationWithTitleSet: db.prepare(`
    UPDATE conversations SET title = ?, model = ?, conversation_type = COALESCE(?, conversation_type), is_title_set = 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
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

  getConversationsByWorkspace: db.prepare(`
    SELECT c.*,
           COUNT(m.id) as message_count
    FROM conversations c
    LEFT JOIN messages m ON c.id = m.conversation_id
    WHERE c.workspace_id = ? AND c.user_id = ?
    GROUP BY c.id
    ORDER BY c.is_active DESC, c.created_at DESC
  `),

  getConversation: db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ? AND workspace_id = ?'),

  getConversationByThreadId: db.prepare('SELECT * FROM conversations WHERE thread_id = ? AND user_id = ? AND workspace_id = ?'),

  // Message operations
  insertMessage: db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, content_type, storage_type, file_path, agent_mode, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getMessagesByConversation: db.prepare(`
    SELECT * FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `),

  deleteMessagesByConversation: db.prepare('DELETE FROM messages WHERE conversation_id = ?'),

  // Asset operations
  insertAsset: db.prepare(`
    INSERT INTO assets (
      id, conversation_id, message_id, batch_id, batch_index, ordinal_in_batch,
      asset_type, file_id, file_name, url, remote_url, mime_type, status, prompt,
      aspect_ratio, quality, width, height, depends_on, search_text, metadata
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  insertAssetFts: db.prepare(`
    INSERT INTO assets_fts (asset_id, conversation_id, search_text, prompt, search_terms, metadata_text)
    VALUES (?, ?, ?, ?, ?, ?)
  `),

  deleteAssetFtsByConversation: db.prepare('DELETE FROM assets_fts WHERE conversation_id = ?'),

  getAssetById: db.prepare('SELECT * FROM assets WHERE id = ? AND conversation_id = ?'),

  updateAssetRemoteUrl: db.prepare(`
    UPDATE assets
    SET remote_url = ?
    WHERE id = ? AND conversation_id = ?
  `),

  getAssetByBatchOrdinal: db.prepare(`
    SELECT * FROM assets
    WHERE conversation_id = ?
      AND batch_index = ?
      AND ordinal_in_batch = ?
      AND asset_type = ?
      AND status = ?
    ORDER BY created_at DESC
    LIMIT 1
  `),

  getAssetKeysByConversation: db.prepare(`
    SELECT file_id, url, remote_url FROM assets
    WHERE conversation_id = ?
  `),

  getLatestAssetBatchIndex: db.prepare(`
    SELECT COALESCE(MAX(batch_index), 0) AS batch_index FROM assets
    WHERE conversation_id = ?
  `),

  deleteAssetsByConversation: db.prepare('DELETE FROM assets WHERE conversation_id = ?'),

  // File operations
  insertFile: db.prepare(`
    INSERT INTO files (file_id, file_name, local_path, oss_url, remote_file_id, mime_type, size, hash, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getFileById: db.prepare('SELECT * FROM files WHERE file_id = ?'),

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

  updateFileRemoteIdById: db.prepare(`
    UPDATE files SET remote_file_id = ?, updated_at = CURRENT_TIMESTAMP WHERE file_id = ?
  `),

  // Script operations
  insertScript: db.prepare(`
    INSERT INTO scripts (id, user_id, workspace_id, name, description, conversation_id, recording_id, file_id, dir_id, source, remote_id, options_schema, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
  `),

  updateScriptDirId: db.prepare(`
    UPDATE scripts SET dir_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),

  listScriptsByWorkspace: db.prepare(`
    SELECT s.*, f.file_name, f.oss_url, f.local_path, f.remote_file_id, f.mime_type, f.size
    FROM scripts s
    LEFT JOIN files f ON s.file_id = f.file_id
    WHERE s.user_id = ? AND s.workspace_id = ?
    ORDER BY s.created_at DESC, s.rowid DESC
    LIMIT ? OFFSET ?
  `),

  getScriptByIdJoinFile: db.prepare(`
    SELECT s.*, f.file_name, f.oss_url, f.local_path, f.remote_file_id, f.mime_type, f.size
    FROM scripts s
    LEFT JOIN files f ON s.file_id = f.file_id
    WHERE s.id = ? AND s.user_id = ? AND s.workspace_id = ?
  `),

  updateScript: db.prepare(`
    UPDATE scripts SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),

  deleteScript: db.prepare(`
    DELETE FROM scripts WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),

  // 回写/纠正后端脚本数字 id（registerScript 同步后回写、sync 命中时回填）
  updateScriptRemoteId: db.prepare(`
    UPDATE scripts SET remote_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),

  getScriptByName: db.prepare(`
    SELECT id FROM scripts WHERE user_id = ? AND workspace_id = ? AND name = ?
  `),

  // 同步专用：按后端 OSS file_id（即本地 files.remote_file_id）定位本地脚本
  getScriptByRemoteFileId: db.prepare(`
    SELECT s.*, f.file_name, f.oss_url, f.local_path, f.remote_file_id, f.mime_type, f.size
    FROM scripts s
    LEFT JOIN files f ON s.file_id = f.file_id
    WHERE f.remote_file_id = ? AND s.user_id = ? AND s.workspace_id = ?
  `),

  // 同步专用：以后端为准直接 SET（name/description/dir_id/source/remote_id/options_schema 直接覆盖；
  // created_at 用 COALESCE 仅在后端有值时纠正，避免后端缺失时把本地时间写成 null）
  updateScriptFromSync: db.prepare(`
    UPDATE scripts SET name = ?, description = ?, dir_id = ?, source = ?, remote_id = ?, options_schema = ?, created_at = COALESCE(?, created_at), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),

}

function stringifyJson(value: any, fallback: string) {
  if (value === undefined || value === null)
    return fallback
  try {
    return JSON.stringify(value)
  }
  catch {
    return fallback
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value)
    return fallback
  try {
    return JSON.parse(value) as T
  }
  catch {
    return fallback
  }
}

function buildAssetSearchText(asset: Partial<CreateAssetInput>) {
  const metadataText = asset.metadata ? stringifyJson(asset.metadata, '') : ''
  const searchTerms = typeof asset.metadata?.searchTerms === 'string'
    ? asset.metadata.searchTerms
    : ''
  return [
    asset.prompt,
    searchTerms,
    'image picture generated asset',
    asset.batch_index === undefined ? '' : `batch ${asset.batch_index}`,
    asset.ordinal_in_batch === undefined ? '' : `ordinal ${asset.ordinal_in_batch} asset ${asset.ordinal_in_batch}`,
    Array.isArray(asset.depends_on) ? asset.depends_on.join(' ') : '',
    asset.aspect_ratio,
    asset.quality,
    asset.file_name,
    asset.file_id,
    metadataText,
  ]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join('\n')
    .toLowerCase()
}

function buildAssetFtsValues(asset: CreateAssetInput, searchText: string, metadataJson: string | null) {
  const metadata = asset.metadata ?? {}
  const searchTerms = typeof metadata.searchTerms === 'string' ? metadata.searchTerms : ''
  return {
    searchText,
    prompt: asset.prompt ?? '',
    searchTerms,
    metadataText: metadataJson ?? '',
  }
}

function normalizeFtsQuery(query: string) {
  const terms = query
    .split(/\s+/)
    .map(term => term.trim())
    .filter(Boolean)
    .map(term => term.replace(/["*^:(){}[\]]/g, ''))
    .filter(term => term.length > 0)
    .slice(0, 24)

  if (terms.length === 0)
    return ''

  return terms.map(term => `"${term}"`).join(' OR ')
}

function mapAssetRow(row: any): ConversationAsset {
  return {
    ...row,
    depends_on: parseJson<string[]>(row.depends_on, []),
    metadata: parseJson<any>(row.metadata, undefined),
    created_at: utcToLocal(row.created_at),
    fts_rank: typeof row.fts_rank === 'number' ? row.fts_rank : undefined,
  } as ConversationAsset
}

function parseSseDataEvents(content: string): any[] {
  const events: any[] = []
  const blocks = content.split(/\r?\n\r?\n/)

  for (const block of blocks) {
    const data = block
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim())
      .join('\n')

    if (!data || data === '[DONE]')
      continue

    try {
      events.push(JSON.parse(data))
    }
    catch {
      // Ignore malformed historical SSE blocks.
    }
  }

  return events
}

// 对话管理
export class ConversationManager {
  static create(conversation: Omit<Conversation, 'created_at' | 'updated_at' | 'user_id' | 'workspace_id' | 'is_active' | 'is_title_set'>): Conversation {
    // 新创建的对话自动设置为活跃状态
    // 使用事务确保原子性：先取消所有对话的活跃状态，再创建新对话并设置为活跃
    try {
      db.exec('BEGIN')
      // 先将所有对话设置为非活跃
      statements.clearAllActive.run(safeUserId, safeWorkspaceId)
      // 创建新对话并设置为活跃
      statements.insertConversation.run(
        conversation.id,
        safeUserId,
        safeWorkspaceId,
        conversation.title,
        conversation.thread_id,
        conversation.conversation_type ?? 'automation',
        conversation.model ?? null,
        1, // is_active 设置为 1（活跃状态）
        0, // is_title_set 设置为 0（未设置）
      )
      db.exec('COMMIT')
    }
    catch (error) {
      db.exec('ROLLBACK')
      throw error
    }

    const result = statements.getConversation.get(conversation.id, safeUserId, safeWorkspaceId)
    if (!result) {
      throw new Error('Failed to create conversation')
    }
    return result as unknown as Conversation
  }

  static update(conversationId: string, updates: Partial<Pick<Conversation, 'title' | 'model' | 'conversation_type'>>): boolean {
    // 如果更新了标题，则使用 updateConversationWithTitleSet 来同时设置 is_title_set = 1
    if (updates.title !== undefined) {
      // 获取当前对话信息，以便在只更新 title 时保持 model 不变
      const currentConversation = ConversationManager.getById(conversationId)
      const modelToUpdate = updates.model !== undefined ? updates.model : (currentConversation?.model || null)

      const result = statements.updateConversationWithTitleSet.run(
        updates.title ?? null as any,
        modelToUpdate ?? null as any,
        updates.conversation_type ?? null as any,
        conversationId,
        safeUserId,
        safeWorkspaceId,
      )
      return result.changes > 0
    }
    else if (updates.model !== undefined) {
      // 只更新 model，不更新标题
      const result = statements.updateConversationModel.run(
        updates.model ?? null as any,
        updates.conversation_type ?? null as any,
        conversationId,
        safeUserId,
        safeWorkspaceId,
      )
      return result.changes > 0
    }
    else if (updates.conversation_type !== undefined) {
      const currentConversation = ConversationManager.getById(conversationId)
      const result = statements.updateConversation.run(
        currentConversation?.title ?? null as any,
        currentConversation?.model ?? null as any,
        updates.conversation_type ?? null as any,
        conversationId,
        safeUserId,
        safeWorkspaceId,
      )
      return result.changes > 0
    }
    return false
  }

  static delete(conversationId: string): boolean {
    try {
      db.exec('BEGIN')
      statements.deleteAssetFtsByConversation.run(conversationId)
      statements.deleteAssetsByConversation.run(conversationId)
      statements.deleteMessagesByConversation.run(conversationId)
      const result = statements.deleteConversation.run(conversationId, safeUserId, safeWorkspaceId)
      db.exec('COMMIT')
      return result.changes > 0
    }
    catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  static getAll(): Conversation[] {
    const rows = statements.getConversationsByWorkspace.all(safeWorkspaceId, safeUserId) as unknown as Conversation[]
    return rows.map(c => ({
      ...c,
      created_at: utcToLocal(c.created_at),
      updated_at: utcToLocal(c.updated_at),
    }))
  }

  static getById(conversationId: string): Conversation | null {
    const result = statements.getConversation.get(conversationId, safeUserId, safeWorkspaceId)
    return result ? (result as unknown as Conversation) : null
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
    }
    catch (error) {
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
      message.content ?? null as any,
      message.content_type,
      message.storage_type,
      message.file_path ?? null as any,
      message.agent_mode || 'simple', // 默认使用 simple 模式
      metadataJson as any,
    )

    // 返回刚插入的消息（包含创建时间）
    const result = db.prepare(`
      SELECT * FROM messages WHERE id = ?
    `).get(message.id) as unknown as Message

    if (result && result.metadata) {
      result.metadata = JSON.parse(result.metadata as string)
    }

    return result
  }

  static getByConversation(conversationId: string): Message[] {
    const messages = statements.getMessagesByConversation.all(conversationId) as unknown as Message[]

    // 处理消息内容和元数据
    return messages.map((msg) => {
      let content = msg.content
      const metadata = msg.metadata ? JSON.parse(msg.metadata as string) : undefined

      // 如果是文件存储，从文件读取内容
      if (msg.storage_type === 'file' && msg.file_path) {
        try {
          content = fs.readFileSync(msg.file_path, 'utf-8')?.toString() ?? null
        }
        catch (error) {
          console.warn(`Failed to read message file: ${msg.file_path}`, error)
          // 读取历史记录失败
          content = 'read history record failed'
        }
      }

      return {
        ...msg,
        content,
        metadata,
        created_at: utcToLocal(msg.created_at),
      }
    })
  }

  static deleteByConversation(conversationId: string): boolean {
    const result = statements.deleteMessagesByConversation.run(conversationId)
    return result.changes > 0
  }
}

// 资产管理
export class AssetManager {
  static add(asset: CreateAssetInput): ConversationAsset {
    const normalizedAsset: Required<Pick<CreateAssetInput, 'asset_type' | 'status' | 'depends_on'>> & CreateAssetInput = {
      ...asset,
      asset_type: asset.asset_type ?? 'image',
      status: asset.status ?? 'success',
      depends_on: asset.depends_on ?? [],
    }
    const metadataJson = normalizedAsset.metadata ? stringifyJson(normalizedAsset.metadata, '{}') : null
    const searchText = normalizedAsset.search_text || buildAssetSearchText(normalizedAsset)

    try {
      db.exec('BEGIN')
      statements.insertAsset.run(
        normalizedAsset.id,
        normalizedAsset.conversation_id,
        normalizedAsset.message_id ?? null as any,
        normalizedAsset.batch_id,
        normalizedAsset.batch_index,
        normalizedAsset.ordinal_in_batch,
        normalizedAsset.asset_type,
        normalizedAsset.file_id ?? null as any,
        normalizedAsset.file_name ?? null as any,
        normalizedAsset.url ?? null as any,
        normalizedAsset.remote_url ?? null as any,
        normalizedAsset.mime_type ?? null as any,
        normalizedAsset.status,
        normalizedAsset.prompt ?? null as any,
        normalizedAsset.aspect_ratio ?? null as any,
        normalizedAsset.quality ?? null as any,
        normalizedAsset.width ?? null as any,
        normalizedAsset.height ?? null as any,
        stringifyJson(normalizedAsset.depends_on, '[]'),
        searchText || null as any,
        metadataJson as any,
      )

      const fts = buildAssetFtsValues(normalizedAsset, searchText, metadataJson)
      statements.insertAssetFts.run(
        normalizedAsset.id,
        normalizedAsset.conversation_id,
        fts.searchText,
        fts.prompt,
        fts.searchTerms,
        fts.metadataText,
      )
      db.exec('COMMIT')
    }
    catch (error) {
      db.exec('ROLLBACK')
      throw error
    }

    const inserted = statements.getAssetById.get(normalizedAsset.id, normalizedAsset.conversation_id)
    if (!inserted) {
      throw new Error('Failed to create asset')
    }
    return mapAssetRow(inserted)
  }

  static getByIds(conversationId: string, assetIds: string[]): ConversationAsset[] {
    const uniqueIds = [...new Set(assetIds.filter(Boolean))]
    if (uniqueIds.length === 0)
      return []

    const placeholders = uniqueIds.map(() => '?').join(', ')
    const rows = db.prepare(`
      SELECT * FROM assets
      WHERE conversation_id = ? AND id IN (${placeholders})
      ORDER BY batch_index ASC, ordinal_in_batch ASC, created_at ASC
    `).all(conversationId, ...uniqueIds)

    return (rows as any[]).map(mapAssetRow)
  }

  static updateRemoteUrl(conversationId: string, assetId: string, remoteUrl: string): boolean {
    const result = statements.updateAssetRemoteUrl.run(remoteUrl, assetId, conversationId)
    return result.changes > 0
  }

  static getByFileIds(conversationId: string, fileIds: string[]): ConversationAsset[] {
    const uniqueFileIds = [...new Set(fileIds.filter(Boolean))]
    if (uniqueFileIds.length === 0)
      return []

    const placeholders = uniqueFileIds.map(() => '?').join(', ')
    const rows = db.prepare(`
      SELECT * FROM assets
      WHERE conversation_id = ? AND file_id IN (${placeholders})
      ORDER BY batch_index ASC, ordinal_in_batch ASC, created_at ASC
    `).all(conversationId, ...uniqueFileIds)

    return (rows as any[]).map(mapAssetRow)
  }

  static getByBatchOrdinal(
    conversationId: string,
    batchIndex: number,
    ordinalInBatch: number,
    options: Pick<AssetSearchOptions, 'assetType' | 'status'> = {},
  ): ConversationAsset | null {
    if (!Number.isInteger(batchIndex) || batchIndex < 1 || !Number.isInteger(ordinalInBatch) || ordinalInBatch < 1)
      return null

    const row = statements.getAssetByBatchOrdinal.get(
      conversationId,
      batchIndex,
      ordinalInBatch,
      options.assetType ?? 'image',
      options.status ?? 'success',
    )

    return row ? mapAssetRow(row) : null
  }

  static getNextBatchIndex(conversationId: string): number {
    const row = statements.getLatestAssetBatchIndex.get(conversationId) as { batch_index?: number } | undefined
    return Number(row?.batch_index || 0) + 1
  }

  static getLatestBatchIndex(conversationId: string): number | null {
    const row = statements.getLatestAssetBatchIndex.get(conversationId) as { batch_index?: number } | undefined
    const batchIndex = Number(row?.batch_index || 0)
    return batchIndex > 0 ? batchIndex : null
  }

  static searchByFts(conversationId: string, query: string, options: AssetSearchOptions = {}): ConversationAsset[] {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 50))
    const ftsQuery = normalizeFtsQuery(query)
    if (!ftsQuery) {
      const rows = db.prepare(`
        SELECT * FROM assets
        WHERE conversation_id = ? AND asset_type = ? AND status = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(
        conversationId,
        options.assetType ?? 'image',
        options.status ?? 'success',
        limit,
      )
      return (rows as any[]).map(mapAssetRow)
    }

    const rows = db.prepare(`
      SELECT a.*, bm25(assets_fts) AS fts_rank
      FROM assets_fts
      JOIN assets a ON a.id = assets_fts.asset_id
      WHERE assets_fts MATCH ?
        AND assets_fts.conversation_id = ?
        AND a.asset_type = ?
        AND a.status = ?
      ORDER BY fts_rank ASC, a.created_at DESC
      LIMIT ?
    `).all(
      ftsQuery,
      conversationId,
      options.assetType ?? 'image',
      options.status ?? 'success',
      limit,
    )

    return (rows as any[]).map(mapAssetRow)
  }

  static backfillFromHistory(conversationId: string): number {
    const existingAssetRows = statements.getAssetKeysByConversation.all(conversationId) as Array<{ file_id?: string, url?: string, remote_url?: string }>
    const existingAssetKeys = new Set(existingAssetRows.flatMap(row => [row.file_id, row.remote_url, row.url].filter((key): key is string => Boolean(key))))
    const messages = statements.getMessagesByConversation.all(conversationId) as unknown as Message[]
    let batchIndex = 0
    let inserted = 0

    for (const message of messages) {
      if (message.role !== 'assistant' || message.storage_type !== 'file' || !message.file_path)
        continue

      let content = ''
      try {
        content = fs.readFileSync(message.file_path, 'utf-8')
      }
      catch {
        continue
      }

      const partialEvents = parseSseDataEvents(content).filter(event => event?.type === 'image_partial' && event?.data?.image)
      if (partialEvents.length === 0)
        continue

      batchIndex += 1
      const metadata = parseJson<any>(message.metadata, undefined)
      const assetOptions = metadata?.assetOptions ?? {}

      for (const [eventIndex, event] of partialEvents.entries()) {
        const image = event.data.image
        const imageUrl = typeof image.url === 'string' ? image.url : ''
        const remoteUrl = typeof image.remoteUrl === 'string'
          ? image.remoteUrl
          : typeof image.fileUrl === 'string'
            ? image.fileUrl
            : /^https?:\/\//i.test(imageUrl)
              ? imageUrl
              : null
        const rawFileId = typeof image.fileId === 'string' ? image.fileId : ''
        const fileId = imageUrl.startsWith('/api/files/') || !remoteUrl ? rawFileId : ''
        const dedupeKey = fileId || remoteUrl || imageUrl
        if (!dedupeKey || existingAssetKeys.has(dedupeKey))
          continue

        const ordinal = Number.isFinite(Number(event.data.index))
          ? Number(event.data.index) + 1
          : eventIndex + 1
        const prompt = typeof image.prompt === 'string' ? image.prompt : ''
        const fileName = typeof image.fileName === 'string' ? image.fileName : fileId || `generated-image-${ordinal}`
        const mimeType = typeof image.mimeType === 'string' ? image.mimeType : 'image/png'

        AssetManager.add({
          id: `asset_${Date.now()}_${randomUUID().slice(0, 8)}`,
          conversation_id: conversationId,
          message_id: message.id,
          batch_id: `legacy_${message.id}`,
          batch_index: batchIndex,
          ordinal_in_batch: ordinal,
          asset_type: 'image',
          file_id: fileId || null,
          file_name: fileName,
          url: imageUrl || remoteUrl,
          remote_url: remoteUrl,
          mime_type: mimeType,
          status: 'success',
          prompt,
          aspect_ratio: typeof assetOptions.aspectRatio === 'string' ? assetOptions.aspectRatio : null,
          quality: typeof assetOptions.quality === 'string' ? assetOptions.quality : null,
          depends_on: [],
          metadata: {
            backfilled: true,
            sourceMessageId: message.id,
            assetOptions,
          },
        })
        existingAssetKeys.add(dedupeKey)
        inserted += 1
      }
    }

    return inserted
  }
}

// ============ 文件元信息（files 表）============

export interface FileRecord {
  file_id: string
  file_name: string | null
  local_path: string | null
  oss_url: string | null
  /** 后端 OSS 文件 ID（/v2/files/upload 返回），与本地 file_id 区分 */
  remote_file_id: string | null
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
  remote_file_id?: string | null
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
    remote_file_id: row.remote_file_id ?? null,
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
      input.file_name ?? null as any,
      input.local_path ?? null as any,
      input.oss_url ?? null as any,
      input.remote_file_id ?? null as any,
      input.mime_type ?? null as any,
      input.size ?? null as any,
      input.hash ?? null as any,
      input.source ?? 'upload',
    )
    const row = statements.getFileById.get(input.file_id)
    if (!row)
      throw new Error('Failed to create file record')
    return mapFileRow(row)
  }

  static getByFileId(fileId: string): FileRecord | null {
    if (!fileId)
      return null
    const row = statements.getFileById.get(fileId)
    return row ? mapFileRow(row) : null
  }

  /** 取同 hash 最早一条（用于复用其本地物理文件路径） */
  static getByHashAny(hash: string): FileRecord | null {
    if (!hash)
      return null
    const row = statements.getFileByHashAny.get(hash)
    return row ? mapFileRow(row) : null
  }

  /** 取同 hash 中最早一条已具备 oss_url 的记录（用于复用 OSS，跳过重复上传） */
  static getByHashWithOss(hash: string): FileRecord | null {
    if (!hash)
      return null
    const row = statements.getFileByHashWithOss.get(hash)
    return row ? mapFileRow(row) : null
  }

  /** 回填同 hash 下所有尚未具备 oss_url 的记录 */
  static setOssByHash(hash: string, ossUrl: string): number {
    if (!hash || !ossUrl)
      return 0
    const result = statements.updateFileOssByHash.run(ossUrl, hash)
    return Number(result.changes)
  }

  static setOssById(fileId: string, ossUrl: string): boolean {
    if (!fileId || !ossUrl)
      return false
    const result = statements.updateFileOssById.run(ossUrl, fileId)
    return Number(result.changes) > 0
  }

  /** 回填后端 OSS file_id（与本地 file_id 区分） */
  static setRemoteFileId(fileId: string, remoteFileId: string): boolean {
    if (!fileId || !remoteFileId)
      return false
    const result = statements.updateFileRemoteIdById.run(remoteFileId, fileId)
    return Number(result.changes) > 0
  }
}

// 导出便捷的组合函数
export const ChatContextAPI = {
  // 对话相关
  createConversation: ConversationManager.create,
  updateConversation: ConversationManager.update,
  deleteConversation: ConversationManager.delete,
  getConversations: ConversationManager.getAll,
  getConversation: ConversationManager.getById,
  getConversationByThreadId: ConversationManager.getByThreadId,
  setActiveConversation: ConversationManager.setActive,
  getActiveConversation: ConversationManager.getActive,

  // 消息相关
  addMessage: MessageManager.add,
  getMessagesByConversation: MessageManager.getByConversation,
  deleteMessagesByConversation: MessageManager.deleteByConversation,

  // 资产相关
  addAsset: AssetManager.add,
  getAssetsByIds: AssetManager.getByIds,
  getAssetsByFileIds: AssetManager.getByFileIds,
  updateAssetRemoteUrl: AssetManager.updateRemoteUrl,
  getAssetByBatchOrdinal: AssetManager.getByBatchOrdinal,
  getLatestAssetBatchIndex: AssetManager.getLatestBatchIndex,
  getNextAssetBatchIndex: AssetManager.getNextBatchIndex,
  searchAssetsByFts: AssetManager.searchByFts,
  backfillAssetsFromHistory: AssetManager.backfillFromHistory,
}

// ============ 录制脚本（scripts 表）============

export interface ScriptRecord {
  id: string
  user_id: string
  workspace_id: string
  name: string
  description: string | null
  conversation_id: string | null
  recording_id: string | null
  file_id: string
  dir_id: string | null
  remote_id: number | null
  options_schema: string | null
  source: string
  created_at: string
  updated_at: string
}

export interface ScriptWithFile extends ScriptRecord {
  file_name: string | null
  oss_url: string | null
  local_path: string | null
  remote_file_id: string | null
  mime_type: string | null
  size: number | null
}

export interface CreateScriptInput {
  name: string
  file_id: string
  conversation_id?: string
  recording_id?: string
  dir_id?: string
  description?: string
  options_schema?: string
  source?: string
}

export interface UpdateScriptInput {
  name?: string
  description?: string
}

/**
 * 后端返回的脚本记录（camelCase，与 roxy-agent-server /v1/user/scripts 的 _serialize 对齐）。
 * 结构兼容 api/scripts.ts 的 ScriptRecordDto，此处本地定义以避免 database 包反向依赖 api 包。
 * `fileId` = 后端 OSS file_id = 本地 files.remote_file_id（同步匹配键）。
 */
export interface BackendScriptDto {
  id: number
  name: string
  description: string | null
  ossUrl: string | null
  fileId: string | null
  source: string
  conversationId: string | null
  recordingId: string | null
  dirId: string | null
  optionsSchema: string | null
  createdAt: string | null
  updatedAt: string | null
}

function mapScriptRow(row: any): ScriptWithFile {
  return {
    id: row.id,
    user_id: row.user_id,
    workspace_id: row.workspace_id,
    name: row.name,
    description: row.description ?? null,
    conversation_id: row.conversation_id ?? null,
    recording_id: row.recording_id ?? null,
    file_id: row.file_id,
    dir_id: row.dir_id ?? null,
    remote_id: row.remote_id != null ? Number(row.remote_id) : null,
    options_schema: row.options_schema ?? null,
    source: row.source ?? 'recording',
    created_at: row.created_at ? utcToLocal(row.created_at) : row.created_at,
    updated_at: row.updated_at ? utcToLocal(row.updated_at) : row.updated_at,
    file_name: row.file_name ?? null,
    oss_url: row.oss_url ?? null,
    local_path: row.local_path ?? null,
    remote_file_id: row.remote_file_id ?? null,
    mime_type: row.mime_type ?? null,
    size: row.size != null ? Number(row.size) : null,
  }
}

function dedupeScriptName(name: string): string {
  if (!statements.getScriptByName.get(safeUserId, safeWorkspaceId, name))
    return name
  let suffix = 2
  while (true) {
    const candidate = `${name} (${suffix})`
    if (!statements.getScriptByName.get(safeUserId, safeWorkspaceId, candidate))
      return candidate
    suffix++
  }
}

export class ScriptStore {
  static create(input: CreateScriptInput): ScriptRecord {
    const id = `scr_${randomUUID()}`
    const safeName = dedupeScriptName(input.name)
    statements.insertScript.run(
      id,
      safeUserId,
      safeWorkspaceId,
      safeName,
      input.description ?? null as any,
      input.conversation_id ?? null as any,
      input.recording_id ?? null as any,
      input.file_id,
      input.dir_id ?? null as any,
      input.source ?? 'recording',
      null, // remote_id：本地创建时尚无后端 id，由 registerScript 同步成功后回写
      input.options_schema ?? null as any, // options_schema：脚本入参 JSON Schema
      null, // created_at：传 null 走 COALESCE → CURRENT_TIMESTAMP 默认
    )
    const row = statements.getScriptByIdJoinFile.get(id, safeUserId, safeWorkspaceId)
    if (!row)
      throw new Error('Failed to create script record')
    return mapScriptRow(row)
  }

  static list(opts?: { limit?: number, offset?: number }): ScriptWithFile[] {
    const limit = opts?.limit ?? 100
    const offset = opts?.offset ?? 0
    const rows = statements.listScriptsByWorkspace.all(safeUserId, safeWorkspaceId, limit, offset)
    return (rows as any[]).map(mapScriptRow)
  }

  static getById(id: string): ScriptWithFile | null {
    const row = statements.getScriptByIdJoinFile.get(id, safeUserId, safeWorkspaceId)
    return row ? mapScriptRow(row) : null
  }

  static update(id: string, patch: UpdateScriptInput): ScriptRecord | null {
    statements.updateScript.run(
      patch.name ?? null as any,
      patch.description ?? null as any,
      id,
      safeUserId,
      safeWorkspaceId,
    )
    const row = statements.getScriptByIdJoinFile.get(id, safeUserId, safeWorkspaceId)
    return row ? mapScriptRow(row) : null
  }

  static updateDirId(id: string, dirId: string): void {
    statements.updateScriptDirId.run(dirId, id, safeUserId, safeWorkspaceId)
  }

  static delete(id: string): boolean {
    const result = statements.deleteScript.run(id, safeUserId, safeWorkspaceId)
    return Number(result.changes) > 0
  }

  /** 回写/纠正本地脚本对应的后端数字 id（registerScript 同步成功后调用）。 */
  static setRemoteId(id: string, remoteId: number): void {
    statements.updateScriptRemoteId.run(remoteId, id, safeUserId, safeWorkspaceId)
  }

  /**
   * 以后端返回为准 upsert 本地脚本记录（同步合并用）。
   * 匹配键：优先 remote_file_id（后端 fileId），其次 name（同工作区内后端 name 唯一）。
   * - 命中：更新 name/description/dir_id/source，并补全 files 表的 oss_url/remote_file_id。
   * - 未命中：插入 files 记录（仅元信息，无 local_path）+ scripts 记录（生成新的 scr_/fid_ id）。
   * 不删除本地独有脚本（保留策略，避免丢失尚未同步到后端的本地脚本）。
   */
  static upsertFromBackend(dto: BackendScriptDto): void {
    const remoteFileId = dto.fileId ?? null
    let existing: any = null
    if (remoteFileId) {
      existing = statements.getScriptByRemoteFileId.get(remoteFileId, safeUserId, safeWorkspaceId)
    }
    if (!existing) {
      const byName = statements.getScriptByName.get(safeUserId, safeWorkspaceId, dto.name) as { id: string } | undefined
      if (byName) {
        existing = statements.getScriptByIdJoinFile.get(byName.id, safeUserId, safeWorkspaceId)
      }
    }

    if (existing) {
      statements.updateScriptFromSync.run(
        dto.name,
        dto.description ?? null as any,
        dto.dirId ?? null as any,
        dto.source || 'recording',
        dto.id, // remote_id：以后端为准回填/纠正
        dto.optionsSchema ?? null as any, // options_schema：以后端为准
        normalizeTimestamp(dto.createdAt), // created_at：后端为准，归一为 UTC 秒级
        existing.id,
        safeUserId,
        safeWorkspaceId,
      )
      const localFileId: string | undefined = existing.file_id
      if (localFileId) {
        if (dto.ossUrl)
          FileRecordStore.setOssById(localFileId, dto.ossUrl)
        if (remoteFileId)
          FileRecordStore.setRemoteFileId(localFileId, remoteFileId)
      }
      return
    }

    // 未命中：插入 files 元信息 + scripts 记录
    const fileId = `fid_${randomUUID()}`
    FileRecordStore.insert({
      file_id: fileId,
      file_name: `${dto.name}.zip`,
      oss_url: dto.ossUrl ?? null,
      remote_file_id: remoteFileId,
      mime_type: 'application/zip',
      source: 'recording',
    })
    statements.insertScript.run(
      `scr_${randomUUID()}`,
      safeUserId,
      safeWorkspaceId,
      dto.name,
      dto.description ?? null as any,
      dto.conversationId ?? null as any,
      dto.recordingId ?? null as any,
      fileId,
      dto.dirId ?? null as any,
      dto.source || 'recording',
      dto.id, // remote_id：存后端数字 id，使首次同步进来的脚本即可级联删除/更新
      dto.optionsSchema ?? null as any, // options_schema：脚本入参 JSON Schema
      normalizeTimestamp(dto.createdAt), // created_at：后端真实创建时刻，归一为 UTC 秒级
    )
  }
}

/**
 * 关闭数据库连接（在应用退出时调用）
 */
export function closeDatabase() {
  db.close()
}
