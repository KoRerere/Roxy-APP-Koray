import type { RunEventHub } from './runEventHub'
import type { Conversation } from '@/database/conversations'
import type { AgentConversationRunEventDTO, AgentRunTerminalStatus } from '@roxy/shared/channel'
import { ChatContextAPI } from '@/database/conversations'
import { readRolloutEvents } from './rolloutHistory'
import { runEventHub } from './runEventHub'

interface ConversationRunStateStore {
  finishConversationRun: (conversationId: string, runId: string, status: AgentRunTerminalStatus) => boolean
  startConversationRun: (conversationId: string, runId: string) => boolean
}

interface ConversationRunRecoveryStore extends ConversationRunStateStore {
  getConversations: () => Conversation[]
  markConversationRead: (conversationId: string, runId: string) => boolean
}

function terminalStatus(item: AgentConversationRunEventDTO): AgentRunTerminalStatus | undefined {
  if (item.event.type === 'run_completed') {
    return 'completed'
  }

  if (item.event.type === 'run_failed') {
    return 'failed'
  }

  if (item.event.type === 'run_cancelled') {
    return 'cancelled'
  }
  return undefined
}

function latestRolloutTerminalStatus(conversationId: string): AgentRunTerminalStatus | undefined {
  const events = readRolloutEvents(conversationId)
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (event?.type === 'turn_completed') {
      return 'completed'
    }
    if (event?.type === 'turn_aborted') {
      return 'cancelled'
    }
    if (event?.type === 'turn_failed') {
      return 'failed'
    }
    if (event?.type === 'user_input') {
      return undefined
    }
  }
  return undefined
}

/**
 * Agent 进程启动时终结上一次进程遗留的 streaming 会话。
 *
 * 这里只补齐列表状态，不删除 thread、checkpoint、rollout 或会话工作区；用户可以在
 * 同一会话中发起新一轮，并从既有 rollout/checkpoint 继续。
 */
export function recoverInterruptedConversationRuns(
  store: ConversationRunRecoveryStore = ChatContextAPI,
  _now: () => number = Date.now,
): number {
  let recovered = 0
  const conversations = store.getConversations()

  for (const conversation of conversations) {
    const runId = conversation.latest_run_id
    if (conversation.latest_run_status !== 'streaming' || !runId) {
      continue
    }

    const recoveredStatus = latestRolloutTerminalStatus(conversation.id) ?? 'cancelled'
    const shouldMarkRead = recoveredStatus === 'cancelled'

    // 先标记已读再写终态；即使进程在两次写入之间再次退出，下次启动仍会继续恢复。
    if (shouldMarkRead) {
      store.markConversationRead(conversation.id, runId)
    }
    if (!store.finishConversationRun(conversation.id, runId, recoveredStatus)) {
      continue
    }

    recovered++
  }

  return recovered
}

export function persistConversationRunState(
  item: AgentConversationRunEventDTO,
  store: ConversationRunStateStore = ChatContextAPI,
): void {
  if (item.event.type === 'run_started') {
    store.startConversationRun(item.conversationId, item.runId)
    return
  }

  const status = terminalStatus(item)
  if (status) {
    store.finishConversationRun(item.conversationId, item.runId, status)
  }
}

export function installConversationRunStatePersistence(
  hub: Pick<RunEventHub, 'subscribe'> = runEventHub,
  store: ConversationRunStateStore = ChatContextAPI,
): () => void {
  return hub.subscribe((item) => {
    try {
      persistConversationRunState(item, store)
    }
    catch (error) {
      console.warn('[conversation-run-state] Failed to persist run state:', error)
    }
  })
}
