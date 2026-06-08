/**
 * 对话上下文管理系统的类型定义
 * 简化的设计，专注于对话和消息管理
 */

// 对话相关类型
export interface Conversation {
  id: string
  user_id: string
  workspace_id: string
  title: string
  thread_id: string
  conversation_type?: 'automation' | 'asset'
  model?: string
  status: 'active' | 'archived' | 'deleted'
  created_at: string
  updated_at: string
  /**
   * 标题是否已被设置过（0=未设置，1=已设置）
   */
  is_title_set?: number
  message_count?: number
}

export interface CreateConversationInput {
  id: string
  title: string
  thread_id: string
  conversation_type?: 'automation' | 'asset'
  model?: string
}

export interface UpdateConversationInput {
  title?: string
  model?: string
  conversation_type?: 'automation' | 'asset'
}

// 消息相关类型
export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content?: string
  content_type: 'text' | 'image' | 'file' | 'inline' | 'external'
  storage_type: 'inline' | 'file'
  file_path?: string
  /**
   * orchestrator(编排模式), simple(简单模式), image(生图模式)
   */
  agent_mode: 'orchestrator' | 'simple' | 'image'
  metadata?: Record<string, any>
  created_at: string
}

export interface CreateMessageInput {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  content_type?: 'text' | 'image' | 'file' | 'inline' | 'external'
  agent_mode?: 'orchestrator' | 'simple' | 'image' /**
                                                    * orchestrator(编排模式), simple(简单模式), image(生图模式)
                                                    */
  forceFileStorage?: boolean /**
                              * 强制使用文件存储
                              */
  metadata?: Record<string, any>
}

// 资产相关类型
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
  metadata?: Record<string, any>
  created_at: string
  fts_rank?: number
}

// API 响应类型
export interface ConversationWithMessages extends Conversation {
  messages: Message[]
}

export interface ConversationsResponse {
  conversations: Conversation[]
  total: number
}

// 上下文信息类型
export interface ContextInfo {
  userId: string
  workspaceId: string
  dbPath: string
}

// 错误类型
export class ChatContextError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'ChatContextError'
  }
}

// 环境变量类型
export interface RequiredEnvVars {
  ROXY_USER_ID: string
  ROXY_WORKSPACE_ID: string
  ROXY_CHECKPOINT_DIR: string
}
