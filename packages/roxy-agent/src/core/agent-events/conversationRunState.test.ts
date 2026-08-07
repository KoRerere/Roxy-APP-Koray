import type { Conversation, Message } from '@/database/conversations'
import type { AgentConversationRunEventDTO, AgentRunEvent } from '@roxy/shared/channel'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { installConversationRunStatePersistence, persistConversationRunState, recoverInterruptedConversationRuns } from './conversationRunState'

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

  it('ends interrupted runs before startup without duplicating existing terminal events', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-conversation-recovery-'))
    const interruptedPath = path.join(root, 'interrupted.jsonl')
    const completedPath = path.join(root, 'completed.jsonl')
    const interruptedEvents = [
      runEvent({
        type: 'run_started',
        data: { source: 'user', assistantMessageId: 'assistant-1', startedAt: 100 },
      }),
      runEvent(
        { type: 'content_delta', data: { contentId: 'content-1', text: 'partial' } },
        { sequence: 2, timestamp: 200 },
      ),
    ]
    const completedEvents = [
      runEvent(
        {
          type: 'run_started',
          data: { source: 'user', assistantMessageId: 'assistant-2', startedAt: 100 },
        },
        { conversationId: 'conversation-2', runId: 'run-2', assistantMessageId: 'assistant-2' },
      ),
      runEvent(
        { type: 'run_completed', data: {} },
        {
          conversationId: 'conversation-2',
          runId: 'run-2',
          assistantMessageId: 'assistant-2',
          sequence: 2,
          timestamp: 200,
        },
      ),
    ]
    fs.writeFileSync(interruptedPath, `${interruptedEvents.map(item => JSON.stringify(item)).join('\n')}\n`)
    fs.writeFileSync(completedPath, `${completedEvents.map(item => JSON.stringify(item)).join('\n')}\n`)

    const conversations = [
      conversation('conversation-1', 'run-1', 'streaming'),
      conversation('conversation-2', 'run-2', 'streaming'),
      conversation('conversation-3', 'run-3', 'completed'),
      conversation('conversation-4', 'run-4', 'streaming'),
    ]
    const messagesByConversation: Record<string, Message[]> = {
      'conversation-1': [assistantMessage('conversation-1', 'assistant-1', 'run-1', interruptedPath, interruptedEvents)],
      'conversation-2': [assistantMessage('conversation-2', 'assistant-2', 'run-2', completedPath, completedEvents)],
    }
    const store = {
      ...createStore(),
      getConversations: vi.fn(() => conversations),
      getMessagesByConversation: vi.fn((conversationId: string) => messagesByConversation[conversationId] ?? []),
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

      const recoveredEvents = fs.readFileSync(interruptedPath, 'utf-8')
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as AgentConversationRunEventDTO)
      expect(recoveredEvents.at(-1)).toEqual({
        conversationId: 'conversation-1',
        runId: 'run-1',
        turnId: 'turn-1',
        assistantMessageId: 'assistant-1',
        sequence: 3,
        timestamp: 300,
        event: {
          type: 'run_cancelled',
          data: {
            reason: 'process_exit',
            message: 'Agent process exited before the run completed.',
          },
        },
      })
      expect(fs.readFileSync(completedPath, 'utf-8').trim().split('\n')).toHaveLength(2)
    }
    finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('marks a previously persisted process-exit cancellation as read', () => {
    const events = [
      runEvent({
        type: 'run_started',
        data: { source: 'user', assistantMessageId: 'assistant-1', startedAt: 100 },
      }),
      runEvent(
        {
          type: 'run_cancelled',
          data: { reason: 'process_exit', message: 'Agent process exited before the run completed.' },
        },
        { sequence: 2, timestamp: 200 },
      ),
    ]
    const store = {
      ...createStore(),
      getConversations: vi.fn(() => [conversation('conversation-1', 'run-1', 'streaming')]),
      getMessagesByConversation: vi.fn(() => [
        assistantMessage('conversation-1', 'assistant-1', 'run-1', '', events),
      ]),
    }

    expect(recoverInterruptedConversationRuns(store, () => 300)).toBe(1)
    expect(store.markConversationRead).toHaveBeenCalledWith('conversation-1', 'run-1')
    expect(store.finishConversationRun).toHaveBeenCalledWith('conversation-1', 'run-1', 'cancelled')
  })

  it('recovers from the persisted prefix when the final in-memory block was lost', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-conversation-prefix-recovery-'))
    const eventPath = path.join(root, 'events.jsonl')
    const events = [
      runEvent({
        type: 'run_started',
        data: { source: 'user', assistantMessageId: 'assistant-1', startedAt: 100 },
      }),
    ]
    fs.writeFileSync(eventPath, `${JSON.stringify(events[0])}\n`)
    const store = {
      ...createStore(),
      getConversations: vi.fn(() => [conversation('conversation-1', 'run-1', 'streaming')]),
      getMessagesByConversation: vi.fn(() => [
        assistantMessage('conversation-1', 'assistant-1', 'run-1', eventPath, events),
      ]),
    }

    try {
      expect(recoverInterruptedConversationRuns(store, () => 200)).toBe(1)
      expect(store.markConversationRead).toHaveBeenCalledWith('conversation-1', 'run-1')
      expect(store.finishConversationRun).toHaveBeenCalledWith('conversation-1', 'run-1', 'cancelled')

      const recovered = fs.readFileSync(eventPath, 'utf8')
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as AgentConversationRunEventDTO)
      expect(recovered.map(item => item.sequence)).toEqual([1, 2])
      expect(recovered.at(-1)?.event).toEqual({
        type: 'run_cancelled',
        data: {
          reason: 'process_exit',
          message: 'Agent process exited before the run completed.',
        },
      })
    }
    finally {
      fs.rmSync(root, { recursive: true, force: true })
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

function assistantMessage(
  conversationId: string,
  messageId: string,
  runId: string,
  filePath: string,
  events: AgentConversationRunEventDTO[],
): Message {
  return {
    id: messageId,
    conversation_id: conversationId,
    role: 'assistant',
    content_type: 'file',
    storage_type: 'file',
    file_path: filePath,
    metadata: { runId },
    events,
    created_at: '2026-07-31 00:00:00',
  }
}
