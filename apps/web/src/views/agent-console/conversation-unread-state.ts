import type { AgentConversation } from './types'

const terminalStatuses = new Set(['completed', 'failed', 'cancelled'])

export interface ConversationReadTarget {
  conversationId: string
  runId: string
}

export function getConversationReadTarget(
  conversation: AgentConversation | undefined,
  activeConversationId: string | undefined,
): ConversationReadTarget | undefined {
  if (!conversation
    || conversation.id !== activeConversationId
    || !conversation.unread
    || !conversation.latestRunId
    || !conversation.latestRunStatus
    || !terminalStatuses.has(conversation.latestRunStatus)) {
    return undefined
  }

  return {
    conversationId: conversation.id,
    runId: conversation.latestRunId,
  }
}
