import { AIMessageChunk, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages'
import Database from 'better-sqlite3'
import path from 'node:path'
import { TokenUsageChange } from '../../agent/utils/usageAggregator'
import { env } from '../../config'
import { createLLM } from '../../llm'

const dbPath = path.join(env.CHECKPOINT_DIR!, 'checkpoint.db')
const db = new Database(dbPath)

// 启用 WAL 模式以提高并发性能
db.pragma('journal_mode = WAL')

// 初始化数据库表结构
initDatabase()

function initDatabase() {
  // 对话摘要表 - 每个threadId只存储一条最新摘要
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversation_summaries (
      thread_id TEXT PRIMARY KEY,
      summary TEXT NOT NULL, -- 对话摘要内容
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_summaries_updated ON conversation_summaries(last_updated);
  `)

  console.log(`✅ Conversation summaries database initialized: ${dbPath}`)
}

// Prepared statements for better performance
const statements = {
  // 插入或更新摘要（UPSERT）
  upsertSummary: db.prepare(`
    INSERT INTO conversation_summaries (thread_id, summary, last_updated)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(thread_id) DO UPDATE SET
      summary = excluded.summary,
      last_updated = CURRENT_TIMESTAMP
  `),

  // 获取摘要
  getSummary: db.prepare('SELECT * FROM conversation_summaries WHERE thread_id = ?'),

  // 删除摘要
  deleteSummary: db.prepare('DELETE FROM conversation_summaries WHERE thread_id = ?'),

  // 获取所有摘要（按更新时间倒序）
  getAllSummaries: db.prepare('SELECT * FROM conversation_summaries ORDER BY last_updated DESC'),
}

// 类型定义
export interface ConversationSummary {
  thread_id: string
  summary: string
  last_updated: string
  created_at: string
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  metadata?: any
}

// 摘要管理类
export class SummaryManager {
  /**
   * 生成对话摘要
   * @param messages 对话消息列表
   * @param threadId 对话线程ID
   * @returns 生成的摘要内容
   */
  static async generateSummary(messages: any[], threadId: string): Promise<string | undefined> {
    // 如果消息为空，返回默认摘要
    if (!messages || messages.length === 0) {
      return
    }

    let summaryContent = messages

    try {
      // 满足其中条件之一的就开是压缩
      if (SummaryManager.shouldGenerateSummary(summaryContent.length) || SummaryManager.calculateToken(summaryContent)) {
        // 不启用思考模式，生成摘要更快
        const llm = createLLM(false)

        // 构建提示词
        const prompt = `请基于以下对话生成「上下文记忆摘要」，用于下次继续对话与避免重复工具调用。

        要求：
        - 中文，信息密度高，避免空话。
        - 用结构化输出：先给“结论/状态”，再给“任务清单”，最后给“工具缓存”。
        - 必须明确：已完成 / 未完成 / 待确认 的事项及原因。
        - 必须把所有工具调用结果整理成可复用的 JSON（若本次无工具调用则输出空对象）。

        输出格式（严格遵守）：
        1) 主题与目标（1-3句）
        2) 已确定结论/结果（要点列表）
        3) 任务状态（按「已完成 / 未完成 / 待跟进」分组，条目要可执行）
        4) 工具缓存（JSON，仅包含本次对话中通过工具获得的数据；）
        5) 下次对话建议（1-3条：如何直接推进、无需重复问/查什么）

        对话内容：
        ${summaryContent.map(item => `${item.type === 'human' ? 'User' : 'Assistant'}: ${item.content}`).join('\n\n')}
        `

        const stream = await llm.stream([
          new SystemMessage('你是一个专业的对话摘要生成助手，生成简洁有用的摘要。'),
          new HumanMessage(prompt),
        ], {
          callbacks: [new TokenUsageChange()],
        })

        let response = new AIMessageChunk({ content: '' })
        for await (const chunk of stream) {
          response = response.concat(chunk)
        }
        summaryContent = [response]
      }
    }
    catch (error) {
      console.error(`Failed to generate simple summary for thread ${threadId}:`, error)
    }

    SummaryManager.saveSummary(threadId, JSON.stringify(summaryContent))
  }

  static parseSummary(summary: string) {
    try {
      return JSON.parse(summary)
    }
    catch (error) {
      console.error(`Failed to parse summary:`, error)
      return []
    }
  }

  /**
   * 存储或更新对话摘要
   * @param threadId 对话线程ID
   * @param summary 摘要内容
   */
  static saveSummary(threadId: string, summary: string): void {
    try {
      statements.upsertSummary.run(threadId, summary)
      console.log(`✅ Summary saved for thread: ${threadId}`)
    }
    catch (error) {
      console.error(`Failed to save summary for thread ${threadId}:`, error)
      throw error
    }
  }

  /**
   * 获取对话摘要
   * @param threadId 对话线程ID
   * @returns 摘要信息或null
   */
  static getSummary(threadId: string): ConversationSummary | null {
    try {
      return statements.getSummary.get(threadId) as ConversationSummary || null
    }
    catch (error) {
      console.error(`Failed to get summary for thread ${threadId}:`, error)
      return null
    }
  }

  /**
   * 删除对话摘要
   * @param threadId 对话线程ID
   */
  static deleteSummary(threadId: string): boolean {
    try {
      const result = statements.deleteSummary.run(threadId)
      return result.changes > 0
    }
    catch (error) {
      console.error(`Failed to delete summary for thread ${threadId}:`, error)
      return false
    }
  }

  /**
   * 获取所有摘要
   * @returns 所有摘要列表
   */
  static getAllSummaries(): ConversationSummary[] {
    try {
      return statements.getAllSummaries.all() as ConversationSummary[]
    }
    catch (error) {
      console.error('Failed to get all summaries:', error)
      return []
    }
  }

  /**
   * 检查是否需要生成摘要（基于消息数量阈值）
   * @param messageCount 当前消息数量
   * @param threshold 阈值，默认20条消息
   */
  static shouldGenerateSummary(messageCount: number): boolean {
    return messageCount >= env.MAX_MESSAGES_BEFORE_SUMMARY
  }

  static calculateToken(message: any[]) {
    return message.map(item => item.content).join('').length > 25000
  }
}

// 数据库维护函数
export class DatabaseMaintenance {
  /**
   * 清理旧的摘要（保留最近N天的）
   * @param daysToKeep 保留天数，默认30天
   */
  static cleanupOldSummaries(daysToKeep: number = 30): number {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

      const stmt = db.prepare(`
        DELETE FROM conversation_summaries
        WHERE last_updated < ?
      `)

      const result = stmt.run(cutoffDate.toISOString())
      console.log(`🧹 Cleaned up ${result.changes} old summaries older than ${daysToKeep} days`)
      return result.changes
    }
    catch (error) {
      console.error('Failed to cleanup old summaries:', error)
      return 0
    }
  }

  /**
   * 重新构建数据库索引
   */
  static rebuildIndexes(): void {
    try {
      db.exec(`
        REINDEX idx_summaries_updated;
      `)
      console.log('🔧 Database indexes rebuilt')
    }
    catch (error) {
      console.error('Failed to rebuild indexes:', error)
    }
  }
}

// 便捷的维护API
export const DatabaseMaintenanceAPI = {
  cleanupOldSummaries: DatabaseMaintenance.cleanupOldSummaries,
  rebuildIndexes: DatabaseMaintenance.rebuildIndexes,
}

/**
 * 关闭数据库连接（在应用退出时调用）
 */
export function closeDatabase() {
  db.close()
}
