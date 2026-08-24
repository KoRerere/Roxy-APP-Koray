import type { Conversation } from '@/database/conversations'
import type { AgentConversationRunEventDTO, AgentRunEvent } from '@roxy/shared/channel'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { installConversationRunStatePersistence, persistConversationRunState, recoverInterruptedConversationRuns } from './conversationRunState'

const testState = vi.hoisted(() => ({ root: '' }))

vi.mock('@/core/storage/agentPaths', () => ({
  agentPaths: {
    sessionDir(conversationId: string) {
      return path.join(testState.root, 'sessions', conversationId)
    },
    sessionRollout(conversationId: string) {
      return path.join(testState.root, 'sessions', conversationId, 'rollout.jsonl')
    },
  },
}))

function runEvent(
  event: AgentRunEvent,
  overrides: Partial<AgentConversationRunEventDTO> = {},
): AgentConversationRunEventDTO {
  return {
    conversationId: 'conversation-1',
    runId: 'run-1',
    turnId: 'turn-1',
    assistantMessageId: 'assistant-1',
    sequence: 1,
    timestamp: 100,
    event,
    ...overrides,
  }
}

function createStore() {
  return {
    finishConversationRun: vi.fn(() => true),
    markConversationRead: vi.fn(() => true),
    startConversationRun: vi.fn(() => true),
  }
}

describe('conversation run state persistence', () => {
  it('maps start and terminal events to the local conversation store', () => {
    const store = createStore()

    persistConversationRunState(runEvent({
      type: 'run_started',
      data: { source: 'user', assistantMessageId: 'assistant-1', startedAt: 100 },
    }), store)
    persistConversationRunState(runEvent({ type: 'content_delta', data: { contentId: 'content-1', text: 'hello' } }), store)
    persistConversationRunState(runEvent({ type: 'run_completed', data: {} }), store)
    persistConversationRunState(runEvent({
      type: 'run_failed',
      data: { code: 'failed', message: 'failed', retryable: false },
    }), store)
    persistConversationRunState(runEvent({ type: 'run_cancelled', data: { reason: 'user' } }), store)

    expect(store.startConversationRun).toHaveBeenCalledOnce()
    expect(store.finishConversationRun.mock.calls).toEqual([
      ['conversation-1', 'run-1', 'completed'],
      ['conversation-1', 'run-1', 'failed'],
      ['conversation-1', 'run-1', 'cancelled'],
    ])
  })

  it('subscribes to the hub and can be uninstalled', () => {
    let listener: ((item: AgentConversationRunEventDTO) => void) | undefined
    const unsubscribe = vi.fn()
    const hub = {
      subscribe: vi.fn((next: (item: AgentConversationRunEventDTO) => void) => {
        listener = next
        return unsubscribe
      }),
    }
    const store = createStore()
    const uninstall = installConversationRunStatePersistence(hub, store)

    listener?.(runEvent({
      type: 'run_started',
      data: { source: 'user', assistantMessageId: 'assistant-1', startedAt: 100 },
    }))
    expect(store.startConversationRun).toHaveBeenCalledWith('conversation-1', 'run-1')
    listener?.(runEvent({ type: 'run_completed', data: {} }))
    expect(store.finishConversationRun).toHaveBeenCalledWith('conversation-1', 'run-1', 'completed')

    uninstall()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('recovers streaming runs from rollout terminal facts', () => {
    testState.root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-conversation-recovery-'))
    writeRollout('conversation-1', [
      { type: 'session_start', sessionId: 'conversation-1', createdAt: 1 },
      { type: 'user_input', message: { role: 'user', content: 'partial' }, ts: 100 },
      {
        type: 'assistant_turn',
        items: [{ type: 'message', id: 'm1', role: 'assistant', content: [{ type: 'output_text', text: 'partial' }] }],
        stopReason: 'end_turn',
        ts: 200,
      },
    ])
    writeRollout('conversation-2', [
      { type: 'session_start', sessionId: 'conversation-2', createdAt: 1 },
      { type: 'user_input', message: { role: 'user', content: 'done' }, ts: 100 },
      {
        type: 'assistant_turn',
        items: [{ type: 'message', id: 'm2', role: 'assistant', content: [{ type: 'output_text', text: 'done' }] }],
        stopReason: 'end_turn',
        ts: 200,
      },
      { type: 'turn_completed', stopReason: 'end_turn', ts: 300 },
    ])

    const store = {
      ...createStore(),
      getConversations: vi.fn(() => [
        conversation('conversation-1', 'run-1', 'streaming'),
        conversation('conversation-2', 'run-2', 'streaming'),
        conversation('conversation-3', 'run-3', 'completed'),
        conversation('conversation-4', 'run-4', 'streaming'),
      ]),
    }

    try {
      expect(recoverInterruptedConversationRuns(store, () => 300)).toBe(3)
      expect(store.finishConversationRun.mock.calls).toEqual([
        ['conversation-1', 'run-1', 'cancelled'],
        ['conversation-2', 'run-2', 'completed'],
        ['conversation-4', 'run-4', 'cancelled'],
      ])
      expect(store.markConversationRead.mock.calls).toEqual([
        ['conversation-1', 'run-1'],
        ['conversation-4', 'run-4'],
      ])
    }
    finally {
      fs.rmSync(testState.root, { recursive: true, force: true })
    }
  })

  it('marks an aborted rollout turn as read during recovery', () => {
    testState.root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-conversation-abort-recovery-'))
    writeRollout('conversation-1', [
      { type: 'session_start', sessionId: 'conversation-1', createdAt: 1 },
      { type: 'user_input', message: { role: 'user', content: 'stop' }, ts: 100 },
      { type: 'turn_aborted', message: 'Agent stopped: User cancelled', ts: 200 },
    ])
    const store = {
      ...createStore(),
      getConversations: vi.fn(() => [conversation('conversation-1', 'run-1', 'streaming')]),
    }

    try {
      expect(recoverInterruptedConversationRuns(store, () => 300)).toBe(1)
      expect(store.markConversationRead).toHaveBeenCalledWith('conversation-1', 'run-1')
      expect(store.finishConversationRun).toHaveBeenCalledWith('conversation-1', 'run-1', 'cancelled')
    }
    finally {
      fs.rmSync(testState.root, { recursive: true, force: true })
    }
  })

  it('recovers from latest run state when rollout has no terminal boundary', () => {
    testState.root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-conversation-prefix-recovery-'))
    writeRollout('conversation-1', [
      { type: 'session_start', sessionId: 'conversation-1', createdAt: 1 },
      { type: 'user_input', message: { role: 'user', content: 'partial' }, ts: 100 },
    ])
    const store = {
      ...createStore(),
      getConversations: vi.fn(() => [conversation('conversation-1', 'run-1', 'streaming')]),
    }

    try {
      expect(recoverInterruptedConversationRuns(store, () => 200)).toBe(1)
      expect(store.markConversationRead).toHaveBeenCalledWith('conversation-1', 'run-1')
      expect(store.finishConversationRun).toHaveBeenCalledWith('conversation-1', 'run-1', 'cancelled')
    }
    finally {
      fs.rmSync(testState.root, { recursive: true, force: true })
    }
  })
})

function conversation(
  id: string,
  latestRunId: string,
  latestRunStatus: Conversation['latest_run_status'],
): Conversation {
  return {
    id,
    user_id: 'user-1',
    workspace_id: 'workspace-1',
    title: id,
    thread_id: `thread-${id}`,
    created_at: '2026-07-31 00:00:00',
    updated_at: '2026-07-31 00:00:00',
    latest_run_id: latestRunId,
    latest_run_status: latestRunStatus,
    last_read_run_id: null,
  }
}

function writeRollout(conversationId: string, events: unknown[]): void {
  const rolloutPath = path.join(testState.root, 'sessions', conversationId, 'rollout.jsonl')
  fs.mkdirSync(path.dirname(rolloutPath), { recursive: true })
  fs.writeFileSync(rolloutPath, `${events.map(event => JSON.stringify(event)).join('\n')}\n`)
}
