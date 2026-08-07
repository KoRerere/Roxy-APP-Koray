import assert from 'node:assert/strict'
import test from 'node:test'
import type { AgentConversation } from './types'
import { getConversationReadTarget } from './conversation-unread-state'

function conversation(overrides: Partial<AgentConversation> = {}): AgentConversation {
  return {
    id: 'conversation-1',
    title: 'Conversation',
    updatedAt: '',
    latestRunId: 'run-1',
    latestRunStatus: 'completed',
    runningRunIds: [],
    unread: true,
    ...overrides,
  }
}

test('returns the exact unread terminal run for the active conversation', () => {
  assert.deepEqual(getConversationReadTarget(conversation(), 'conversation-1'), {
    conversationId: 'conversation-1',
    runId: 'run-1',
  })
})

test('does not mark inactive, running, or already-read conversations', () => {
  assert.equal(getConversationReadTarget(conversation(), 'conversation-2'), undefined)
  assert.equal(getConversationReadTarget(conversation({ latestRunStatus: 'streaming' }), 'conversation-1'), undefined)
  assert.equal(getConversationReadTarget(conversation({ unread: false }), 'conversation-1'), undefined)
})
