import fs from 'node:fs'
import { agentPaths } from '@/core/storage/agentPaths'

/**
 * deepagents 每对话独立的 LangGraph checkpoint 路径：sessions/{conversationId}/checkpoint.db
 * （本阶段 sessions 为扁平布局，见 core/storage/agentPaths 的工厂注释）。
 *
 * node:sqlite 打开文件时不会自动创建父目录，故此处顺带 ensureDir，保证首次写入不报错。
 * 供创建（chat/claw）与删除（deleteCheckpoint）两侧共用，避免路径规则重复。
 */
export function conversationCheckpointPath(conversationId: string): string {
  const p = agentPaths.sessionCheckpointDb(conversationId)
  fs.mkdirSync(agentPaths.sessionDir(conversationId), { recursive: true })
  return p
}
