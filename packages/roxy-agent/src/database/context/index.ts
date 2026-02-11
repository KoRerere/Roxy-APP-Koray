import type { BaseMessage } from '@langchain/core/messages'
import { AIMessageChunk, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { TokenUsageChange } from '../../agent/utils/usageAggregator'
import { env } from '../../config'
import { createLLM } from '../../llm'

const dbPath = path.join(env.CHECKPOINT_DIR!, 'checkpoint.db')
const db = new DatabaseSync(dbPath)

// 启用 WAL 模式以提高并发性能
db.exec('PRAGMA journal_mode = WAL')

// 初始化数据库表结构
db.exec(`
  CREATE TABLE IF NOT EXISTS conversation_contexts (
    thread_id TEXT PRIMARY KEY,
    messages TEXT NOT NULL,
    allowed_skills TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`)

// 创建索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_contexts_updated ON conversation_contexts(last_updated);
`)

console.log(`✅ Conversation contexts database initialized: ${dbPath}`)

/**
 * 类型定义
 */
export interface ConversationContext {
  thread_id: string
  /** JSON 字符串，存储序列化后的消息数组 */
  messages: string
  /** JSON 字符串，存储技能名称数组 */
  allowed_skills: string | null
  /** 输入token数量 */
  input_tokens: number
  /** 输出token数量 */
  output_tokens: number
  last_updated: string
  created_at: string
}

// 上下文数据接口（用于业务逻辑）
export interface ContextData {
  messages: BaseMessage[]
  /** 技能名称数组 */
  allowedSkills: string[]
  /** 输入token数量 */
  inputTokens?: number
  /** 输出token数量 */
  outputTokens?: number
}

// Prepared statements for better performance
const statements = {
  // 插入或更新上下文（UPSERT）
  upsertContext: db.prepare(`
    INSERT INTO conversation_contexts (thread_id, messages, allowed_skills, input_tokens, output_tokens, last_updated)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(thread_id) DO UPDATE SET
      messages = excluded.messages,
      allowed_skills = excluded.allowed_skills,
      input_tokens = excluded.input_tokens,
      output_tokens = excluded.output_tokens,
      last_updated = CURRENT_TIMESTAMP
  `),

  // 获取上下文
  getContext: db.prepare('SELECT * FROM conversation_contexts WHERE thread_id = ?'),

  // 删除上下文
  deleteContext: db.prepare('DELETE FROM conversation_contexts WHERE thread_id = ?'),

  // 获取所有上下文（按更新时间倒序）
  getAllContexts: db.prepare('SELECT * FROM conversation_contexts ORDER BY last_updated DESC'),
}

// 上下文管理类
export class ContextManager {
  /**
   * 更新对话上下文（生成摘要并保存）
   * @param messages 对话消息列表
   * @param threadId 对话线程ID
   * @param allowedSkills 当前允许的技能名称列表
   * @param inputTokens 输入token数量（累计）
   * @param outputTokens 输出token数量（累计）
   */
  static async updateContext(
    _messages: BaseMessage[],
    threadId: string,
    allowedSkills: string[] = [],
    inputTokens: number = 0,
    outputTokens: number = 0,
  ): Promise<void> {
    // 获取历史上下文，用于保留已加载的技能
    const existingContext = this.getContext(threadId)
    const existingAllowedSkills = existingContext?.allowedSkills || []

    // 如果传入的 allowedSkills 为空数组，保留历史记录中的技能
    // 只有当传入非空数组时，才更新 allowedSkills
    const finalAllowedSkills = allowedSkills.length > 0 ? allowedSkills : existingAllowedSkills

    // 如果消息为空，直接保存空上下文
    if (!_messages || _messages.length === 0) {
      this.saveContext(threadId, { messages: [], allowedSkills: finalAllowedSkills, inputTokens, outputTokens })
      return
    }

    let finalMessages = _messages
    const messages = _messages

    try {
      // 满足其中条件之一的就开始压缩
      if (this.shouldGenerateSummary(messages.length)) {
        // 不启用思考模式，生成摘要更快
        const llm = createLLM(false)
        if (!llm) {
          throw new Error('Failed to create LLM instance')
        }

        // 构建提示词
        const prompt = `请基于以下对话生成「上下文记忆摘要」，用于下次继续对话与避免重复工具调用。

        要求：
        - 中文，信息密度高，避免空话。
        - 用结构化输出：先给"结论/状态"，再给"任务清单"，最后给"工具缓存"。
        - 必须明确：已完成 / 未完成 / 待确认 的事项及原因。
        - 必须把所有工具调用结果整理成可复用的 JSON（若本次无工具调用则输出空对象）。

        输出格式（严格遵守）：
        1) 主题与目标（1-3句）
        2) 已确定结论/结果（要点列表）
        3) 任务状态（按「已完成 / 未完成 / 待跟进」分组，条目要可执行）
        4) 工具缓存（JSON，仅包含本次对话中通过工具获得的数据；）
        5) 下次对话建议（1-3条：如何直接推进、无需重复问/查什么）

        对话内容：
        ${messages.map((item) => {
          const role = item.type === 'human' ? 'User' : 'Assistant'
          const content = typeof item.content === 'string' ? item.content : JSON.stringify(item.content)
          return `${role}: ${content}`
        }).join('\n\n')}
        `

        const stream = await llm.stream([
          new SystemMessage('你是一个专业的对话摘要生成助手，生成简洁有用的摘要。'),
          new HumanMessage(prompt),
        ], {
          callbacks: [new TokenUsageChange()],
        })

        let summaryMessage = new AIMessageChunk({ content: '' })
        for await (const chunk of stream) {
          summaryMessage = summaryMessage.concat(chunk)
        }

        finalMessages = [summaryMessage]
      }
    }
    catch (error) {
      console.error(`Failed to generate summary for thread ${threadId}:`, error)
      // 即使生成摘要失败，也保存原始消息
    }

    // 保存上下文（包含消息、技能列表和token使用量）
    this.saveContext(threadId, {
      messages: finalMessages,
      allowedSkills: finalAllowedSkills,
      inputTokens,
      outputTokens,
    })
  }

  /**
   * 保存对话上下文
   * @param threadId 对话线程ID
   * @param contextData 上下文数据（消息、技能列表和token使用量）
   */
  static saveContext(threadId: string, contextData: ContextData): void {
    try {
      const messagesJson = JSON.stringify(contextData.messages)
      const allowedSkillsJson = JSON.stringify(contextData.allowedSkills || [])
      const inputTokens = contextData.inputTokens ?? 0
      const outputTokens = contextData.outputTokens ?? 0

      statements.upsertContext.run(threadId, messagesJson, allowedSkillsJson, inputTokens, outputTokens)

      console.log(`✅ Context saved for thread: ${threadId} (skills: ${contextData.allowedSkills?.length || 0}, tokens: ${inputTokens} input, ${outputTokens} output)`)
    }
    catch (error) {
      console.error(`Failed to save context for thread ${threadId}:`, error)
      throw error
    }
  }

  /**
   * 获取对话上下文
   * @param threadId 对话线程ID
   * @returns 上下文数据或null
   */
  static getContext(threadId: string): ContextData | null {
    try {
      const result = statements.getContext.get(threadId) as ConversationContext | undefined

      if (!result) {
        return null
      }

      const messages = result.messages ? JSON.parse(result.messages) : []
      const allowedSkills = result.allowed_skills
        ? JSON.parse(result.allowed_skills)
        : []

      return {
        messages,
        allowedSkills,
        inputTokens: result.input_tokens ?? 0,
        outputTokens: result.output_tokens ?? 0,
      }
    }
    catch (error) {
      console.error(`Failed to get context for thread ${threadId}:`, error)
      return null
    }
  }

  /**
   * 获取对话上下文（兼容旧接口，已废弃）
   * @deprecated 请使用 getContext 方法
   * @param threadId 对话线程ID
   * @returns 上下文信息或null
   */
  static getSummary(threadId: string): ConversationContext | null {
    try {
      const result = statements.getContext.get(threadId) as ConversationContext | undefined
      return result || null
    }
    catch (error) {
      console.error(`Failed to get summary for thread ${threadId}:`, error)
      return null
    }
  }

  /**
   * 生成对话摘要并更新上下文（兼容旧接口，已废弃）
   * @deprecated 请使用 updateContext 方法
   */
  static async generateSummary(
    messages: BaseMessage[],
    threadId: string,
    allowedSkills: string[] = [],
    inputTokens: number = 0,
    outputTokens: number = 0,
  ): Promise<void> {
    return this.updateContext(messages, threadId, allowedSkills, inputTokens, outputTokens)
  }

  /**
   * 删除对话上下文
   * @param threadId 对话线程ID
   */
  static deleteContext(threadId: string): boolean {
    try {
      const result = statements.deleteContext.run(threadId)
      return result.changes > 0
    }
    catch (error) {
      console.error(`Failed to delete context for thread ${threadId}:`, error)
      return false
    }
  }

  /**
   * 获取所有上下文（按更新时间倒序）
   * @returns 所有上下文列表
   */
  static getAllContexts(): ConversationContext[] {
    try {
      return statements.getAllContexts.all() as unknown as ConversationContext[]
    }
    catch (error) {
      console.error('Failed to get all contexts:', error)
      return []
    }
  }

  /**
   * 检查是否需要生成摘要（基于消息数量阈值）
   * @param messageCount 当前消息数量
   */
  static shouldGenerateSummary(messageCount: number): boolean {
    return messageCount >= env.MAX_MESSAGES_BEFORE_SUMMARY
  }

  /**
   * 检查是否需要生成摘要（基于消息内容长度）
   * @param messages 消息数组
   */
  static calculateToken(messages: BaseMessage[]): boolean {
    const totalLength = messages
      .map((msg) => {
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
        return content
      })
      .join('')
      .length

    return totalLength > 25000
  }
}

// 数据库维护函数
export class DatabaseMaintenance {
  /**
   * 清理旧的上下文（保留最近N天的）
   * @param daysToKeep 保留天数，默认30天
   */
  static cleanupOldContexts(daysToKeep: number = 30): number {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

      const stmt = db.prepare(`
        DELETE FROM conversation_contexts
        WHERE last_updated < ?
      `)

      const result = stmt.run(cutoffDate.toISOString())
      const changes = Number(result.changes)
      console.log(`🧹 Cleaned up ${changes} old contexts older than ${daysToKeep} days`)
      return changes
    }
    catch (error) {
      console.error('Failed to cleanup old contexts:', error)
      return 0
    }
  }

  /**
   * 重新构建数据库索引
   */
  static rebuildIndexes(): void {
    try {
      db.exec('REINDEX idx_contexts_updated')
      console.log('🔧 Database indexes rebuilt')
    }
    catch (error) {
      console.error('Failed to rebuild indexes:', error)
    }
  }
}

// 便捷的维护API
export const DatabaseMaintenanceAPI = {
  cleanupOldContexts: DatabaseMaintenance.cleanupOldContexts,
  rebuildIndexes: DatabaseMaintenance.rebuildIndexes,
}

/**
 * 关闭数据库连接（在应用退出时调用）
 */
export function closeDatabase(): void {
  db.close()
}
