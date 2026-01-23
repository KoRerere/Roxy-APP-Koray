import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
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

// 数据库初始化
const dbPath = path.join(env.CHECKPOINT_DIR!, 'conversations.db')
const db = new Database(dbPath)

// 启用 WAL 模式以提高并发性能
db.pragma('journal_mode = WAL')

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

  // 创建索引以提高查询性能
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_conversations_user_workspace ON conversations(user_id, workspace_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_thread_id ON conversations(thread_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `)

  // 数据库迁移：为已存在的 messages 表添加 agent_mode 字段
  try {
    const tableInfo = db.prepare('PRAGMA table_info(messages)').all() as Array<{ name: string }>
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
    const tableInfo = db.prepare('PRAGMA table_info(conversations)').all() as Array<{ name: string }>
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
    const tableInfo = db.prepare('PRAGMA table_info(conversations)').all() as Array<{ name: string }>
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

  console.log(`✅ Chat context database initialized: ${dbPath}`)
  console.log(`📋 Initialized for user: ${userId}, workspace: ${workspaceId}`)
}

// 类型定义
export interface Conversation {
  id: string
  user_id: string
  workspace_id: string
  title: string
  thread_id: string
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
  agent_mode: 'orchestrator' | 'simple' /**
                                         * orchestrator(编排模式), simple(简单模式)
                                         */
  metadata?: any
  created_at: string
}

// Prepared statements for better performance
const statements = {
  // Conversation operations
  insertConversation: db.prepare(`
    INSERT INTO conversations (id, user_id, workspace_id, title, thread_id, model, is_active, is_title_set)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),

  updateConversation: db.prepare(`
    UPDATE conversations SET title = ?, model = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),

  updateConversationModel: db.prepare(`
    UPDATE conversations SET model = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `),

  updateConversationWithTitleSet: db.prepare(`
    UPDATE conversations SET title = ?, model = ?, is_title_set = 1, updated_at = CURRENT_TIMESTAMP
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
    ORDER BY c.updated_at DESC
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

}

// 对话管理
export class ConversationManager {
  static create(conversation: Omit<Conversation, 'created_at' | 'updated_at' | 'user_id' | 'workspace_id' | 'is_active' | 'is_title_set'>): Conversation {
    // 新创建的对话自动设置为活跃状态
    // 使用事务确保原子性：先取消所有对话的活跃状态，再创建新对话并设置为活跃
    const transaction = db.transaction(() => {
      // 先将所有对话设置为非活跃
      statements.clearAllActive.run(userId, workspaceId)
      // 创建新对话并设置为活跃
      statements.insertConversation.run(
        conversation.id,
        userId,
        workspaceId,
        conversation.title,
        conversation.thread_id,
        conversation.model || null,
        1, // is_active 设置为 1（活跃状态）
        0, // is_title_set 设置为 0（未设置）
      )
    })
    transaction()

    const result = statements.getConversation.get(conversation.id, userId, workspaceId)
    if (!result) {
      throw new Error('Failed to create conversation')
    }
    return result as Conversation
  }

  static update(conversationId: string, updates: Partial<Pick<Conversation, 'title' | 'model'>>): boolean {
    // 如果更新了标题，则使用 updateConversationWithTitleSet 来同时设置 is_title_set = 1
    if (updates.title !== undefined) {
      // 获取当前对话信息，以便在只更新 title 时保持 model 不变
      const currentConversation = ConversationManager.getById(conversationId)
      const modelToUpdate = updates.model !== undefined ? updates.model : (currentConversation?.model || null)
      
      const result = statements.updateConversationWithTitleSet.run(
        updates.title || null,
        modelToUpdate,
        conversationId,
        userId,
        workspaceId,
      )
      return result.changes > 0
    }
    else if (updates.model !== undefined) {
      // 只更新 model，不更新标题
      const result = statements.updateConversationModel.run(
        updates.model || null,
        conversationId,
        userId,
        workspaceId,
      )
      return result.changes > 0
    }
    return false
  }

  static delete(conversationId: string): boolean {
    const result = statements.deleteConversation.run(conversationId, userId, workspaceId)
    return result.changes > 0
  }

  static getAll(): Conversation[] {
    return statements.getConversationsByWorkspace.all(workspaceId, userId) as Conversation[]
  }

  static getById(conversationId: string): Conversation | null {
    return statements.getConversation.get(conversationId, userId, workspaceId) as Conversation || null
  }

  static getByThreadId(threadId: string): Conversation | null {
    return statements.getConversationByThreadId.get(threadId, userId, workspaceId) as Conversation || null
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
    const transaction = db.transaction(() => {
      statements.setActiveConversation.run(conversationId, userId, workspaceId)
    })
    transaction()

    return true
  }

  /**
   * 获取当前活跃的对话
   * @returns 当前活跃的对话，如果没有则返回 null
   */
  static getActive(): Conversation | null {
    return statements.getActiveConversation.get(userId, workspaceId) as Conversation || null
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
      message.content,
      message.content_type,
      message.storage_type,
      message.file_path,
      message.agent_mode || 'simple', // 默认使用 simple 模式
      metadataJson,
    )

    // 返回刚插入的消息（包含创建时间）
    const result = db.prepare(`
      SELECT * FROM messages WHERE id = ?
    `).get(message.id) as Message

    if (result && result.metadata) {
      result.metadata = JSON.parse(result.metadata)
    }

    return result
  }

  static getByConversation(conversationId: string): Message[] {
    const messages = statements.getMessagesByConversation.all(conversationId) as Message[]

    // 处理消息内容和元数据
    return messages.map((msg) => {
      let content = msg.content
      const metadata = msg.metadata ? JSON.parse(msg.metadata) : undefined

      // 如果是文件存储，从文件读取内容
      if (msg.storage_type === 'file' && msg.file_path) {
        try {
          content = fs.readFileSync(msg.file_path, 'utf-8')?.toString()
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
      }
    })
  }

  static deleteByConversation(conversationId: string): boolean {
    const result = statements.deleteMessagesByConversation.run(conversationId)
    return result.changes > 0
  }
}

// 清理任务
export class CleanupManager {
  // 目前没有需要清理的任务
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

  /**
   * 获取当前上下文信息
   */
  getCurrentContext: () => ({
    userId,
    workspaceId,
    dbPath,
  }),
}

/**
 * 关闭数据库连接（在应用退出时调用）
 */
export function closeDatabase() {
  db.close()
}
