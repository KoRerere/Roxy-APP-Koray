import type { RunEventHub } from './runEventHub'
import type { Conversation, Message } from '@/database/conversations'
import type { AgentConversationRunEventDTO, AgentRunTerminalStatus } from '@roxy/shared/channel'
import fs from 'node:fs'
import { ChatContextAPI } from '@/database/conversations'
import { runEventHub } from './runEventHub'

interface ConversationRunStateStore {
  finishConversationRun: (conversationId: string, runId: string, status: AgentRunTerminalStatus) => boolean
  startConversationRun: (conversationId: string, runId: string) => boolean
}

interface ConversationRunRecoveryStore extends ConversationRunStateStore {
  getConversations: () => Conversation[]
  getMessagesByConversation: (conversationId: string) => Message[]
  markConversationRead: (conversationId: string, runId: string) => boolean
}

const PROCESS_EXIT_MESSAGE = 'Agent process exited before the run completed.'

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

function findRunMessage(messages: Message[], runId: string): Message | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message.role === 'assistant' && message.metadata?.runId === runId) {
      return message
    }
  }
  return undefined
}

function findTerminalEvent(events: AgentConversationRunEventDTO[]): AgentConversationRunEventDTO | undefined {
  for (let index = events.length - 1; index >= 0; index--) {
    if (terminalStatus(events[index])) {
      return events[index]
    }
  }
  return undefined
}

function isProcessExitCancellation(item: AgentConversationRunEventDTO | undefined): boolean {
  return item?.event.type === 'run_cancelled' && item.event.data.reason === 'process_exit'
}

function appendProcessExitEvent(
  conversation: Conversation,
  message: Message | undefined,
  now: () => number,
): void {
  const events = message?.events ?? []
  const lastEvent = events.at(-1)
  if (
    !message?.file_path
    || !lastEvent
    || lastEvent.conversationId !== conversation.id
    || lastEvent.runId !== conversation.latest_run_id
  ) {
    return
  }

  const item: AgentConversationRunEventDTO = {
    conversationId: conversation.id,
    runId: lastEvent.runId,
    turnId: lastEvent.turnId,
    assistantMessageId: lastEvent.assistantMessageId,
    sequence: lastEvent.sequence + 1,
    timestamp: now(),
    event: {
      type: 'run_cancelled',
      data: {
        reason: 'process_exit',
        message: PROCESS_EXIT_MESSAGE,
      },
    },
  }
  fs.appendFileSync(message.file_path, `${JSON.stringify(item)}\n`, 'utf-8')
}

/**
 * Agent 进程启动时终结上一次进程遗留的 streaming 会话。
 *
 * 这里只补齐运行事件和列表状态，不删除 thread、checkpoint 或会话工作区；用户可以在
 * 同一会话中发起新一轮，并从既有 LangGraph checkpoint 继续。
 */
export function recoverInterruptedConversationRuns(
  store: ConversationRunRecoveryStore = ChatContextAPI,
  now: () => number = Date.now,
): number {
  let recovered = 0
  const conversations = store.getConversations()

  for (const conversation of conversations) {
    const runId = conversation.latest_run_id
    if (conversation.latest_run_status !== 'streaming' || !runId)
      continue

    const message = findRunMessage(store.getMessagesByConversation(conversation.id), runId)
    const existingTerminalEvent = findTerminalEvent(message?.events ?? [])
    const recoveredStatus = existingTerminalEvent ? terminalStatus(existingTerminalEvent)! : 'cancelled'
    const shouldMarkRead = !existingTerminalEvent || isProcessExitCancellation(existingTerminalEvent)

    if (!existingTerminalEvent) {
      try {
        appendProcessExitEvent(conversation, message, now)
      }
      catch (error) {
        console.warn(`[conversation-run-state] Failed to append process-exit event for ${conversation.id}:`, error)
      }
    }

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
