import type { AgentConversationRunEventDTO } from '@roxy/shared/channel'
import { AgentChannelMessageSchema } from '@roxy/shared/channel'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RunEventHub } from './runEventHub'

const mocks = vi.hoisted(() => ({ root: '' }))

vi.mock('@/core/storage/agentPaths', () => ({
  agentPaths: {
    sessionTurnEvents: (conversationId: string, messageId: string) => path.join(mocks.root, conversationId, 'turns', `${messageId}.jsonl`),
  },
}))

function readEvents(filePath: string): AgentConversationRunEventDTO[] {
  const content = fs.readFileSync(filePath, 'utf8').trim()
  if (!content) {
    return []
  }
  return content.split('\n').map(line => JSON.parse(line) as AgentConversationRunEventDTO)
}

describe('runEventHub', () => {
  beforeEach(async () => {
    mocks.root = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-run-events-'))
  })

  afterEach(async () => {
    await fsPromises.rm(mocks.root, { recursive: true, force: true })
  })

  it('persists complete events before broadcasting them with a contiguous sequence', () => {
    const hub = new RunEventHub()
    const observed: number[] = []
    const emitted: AgentConversationRunEventDTO[] = []
    hub.subscribe((item) => {
      expect(() => AgentChannelMessageSchema.parse({
        id: `message-${item.sequence}`,
        type: 'conversation.run.event',
        data: item,
      })).not.toThrow()
      const lines = fs.readFileSync(path.join(mocks.root, item.conversationId, 'turns', `${item.assistantMessageId}.jsonl`), 'utf8')
        .trim()
        .split('\n')
      expect(lines).toHaveLength(item.sequence)
      observed.push(item.sequence)
      emitted.push(item)
    })

    const publisher = hub.tryBegin({
      conversationId: 'conversation-1',
      runId: 'run-1',
      turnId: 'turn-1',
      assistantMessageId: 'assistant-1',
      requestId: 'request-1',
      source: 'user',
      startedAt: 100,
    })
    expect(publisher).not.toBeNull()
    publisher?.publish({
      type: 'user_message',
      data: { messageId: 'turn-1', content: 'hello', attachments: [], createdAt: 101 },
    }, 101)
    publisher?.publish({ type: 'run_completed', data: { finalAnswer: 'done' } }, 102)

    expect(observed).toEqual([1, 2, 3])
    expect(emitted[0]).not.toHaveProperty('requestId')
    expect(emitted[0]).not.toHaveProperty('source')
    expect(emitted[0]?.event).toEqual({
      type: 'run_started',
      data: {
        requestId: 'request-1',
        source: 'user',
        assistantMessageId: 'assistant-1',
        startedAt: 100,
      },
    })
    expect(publisher?.publish({ type: 'run_failed', data: { code: 'late', message: 'late', retryable: false } })).toBeNull()
  })

  it('buffers thinking fragments until a following event confirms completion', () => {
    const hub = new RunEventHub()
    const emitted: AgentConversationRunEventDTO[] = []
    hub.subscribe(item => emitted.push(item))
    const publisher = hub.tryBegin({
      conversationId: 'conversation-1',
      runId: 'run-1',
      turnId: 'turn-1',
      assistantMessageId: 'assistant-1',
      source: 'user',
      startedAt: 100,
    })!
    const filePath = publisher.filePath

    publisher.publish({ type: 'thinking_delta', data: { thinkingId: 'thinking-1', text: 'hello ' } }, 101)
    publisher.publish({ type: 'thinking_delta', data: { thinkingId: 'thinking-1', text: 'world' } }, 102)
    expect(readEvents(filePath)).toHaveLength(1)
    expect(hub.getActiveEvents()).toEqual([
      expect.objectContaining({ sequence: 1, startSequence: undefined }),
      expect.objectContaining({
        startSequence: 2,
        sequence: 3,
        event: {
          type: 'thinking_delta',
          data: { thinkingId: 'thinking-1', text: 'hello world' },
        },
      }),
    ])

    publisher.publish({
      type: 'thinking_completed',
      data: { thinkingId: 'thinking-1', startTimestamp: 101, endTimestamp: 103, durationMs: 2 },
    }, 103)
    expect(readEvents(filePath)).toHaveLength(1)

    publisher.publish({ type: 'tool_started', data: { toolName: 'search', toolId: 'tool-1', input: {} } }, 104)

    const persisted = readEvents(filePath)
    expect(persisted.map(item => item.sequence)).toEqual([1, 2, 3, 4])
    expect(persisted.map(item => item.event.type)).toEqual([
      'run_started',
      'thinking_delta',
      'thinking_completed',
      'tool_started',
    ])
    expect(persisted[1]?.event).toEqual({
      type: 'thinking_delta',
      data: { thinkingId: 'thinking-1', text: 'hello world' },
    })
    expect(emitted.map(item => item.sequence)).toEqual([1, 2, 3, 4, 5])
    expect(emitted.filter(item => item.event.type === 'thinking_delta')).toHaveLength(2)
  })

  it('persists streamed content as one record when the run completes', () => {
    const hub = new RunEventHub()
    const publisher = hub.tryBegin({
      conversationId: 'conversation-1',
      runId: 'run-1',
      turnId: 'turn-1',
      assistantMessageId: 'assistant-1',
      source: 'user',
    })!

    publisher.publish({ type: 'content_delta', data: { contentId: 'content-1', text: 'first ' } }, 101)
    publisher.publish({ type: 'content_delta', data: { contentId: 'content-1', text: 'answer' } }, 102)
    expect(readEvents(publisher.filePath)).toHaveLength(1)
    publisher.publish({ type: 'run_completed', data: {} }, 103)

    const persisted = readEvents(publisher.filePath)
    expect(persisted.map(item => item.sequence)).toEqual([1, 2, 3])
    expect(persisted.every(item => item.startSequence === undefined)).toBe(true)
    expect(persisted[1]?.event).toEqual({
      type: 'content_delta',
      data: { contentId: 'content-1', text: 'first answer' },
    })
    expect(persisted[2]?.event.type).toBe('run_completed')
    expect(publisher.getLiveEvents()).toEqual([])
    expect(hub.getActiveEvents()).toEqual([])
  })

  it('creates non-overlapping compacted ranges when worker chunks interleave', () => {
    const hub = new RunEventHub()
    const publisher = hub.tryBegin({
      conversationId: 'conversation-1',
      runId: 'run-1',
      turnId: 'turn-1',
      assistantMessageId: 'assistant-1',
      source: 'user',
    })!

    publisher.publish({ type: 'content_delta', data: { workerId: 'worker-1', contentId: 'content-1', text: 'one ' } }, 101)
    publisher.publish({ type: 'content_delta', data: { workerId: 'worker-2', contentId: 'content-2', text: 'two ' } }, 102)
    publisher.publish({ type: 'content_delta', data: { workerId: 'worker-1', contentId: 'content-1', text: 'continued' } }, 103)
    publisher.publish({ type: 'content_delta', data: { workerId: 'worker-2', contentId: 'content-2', text: 'continued' } }, 104)

    const live = publisher.getLiveEvents()
    expect(live.map(item => [item.startSequence, item.sequence])).toEqual([
      [undefined, 1],
      [2, 3],
      [4, 5],
    ])
    expect(live.slice(1).map(item => item.event)).toEqual([
      {
        type: 'content_delta',
        data: { workerId: 'worker-1', contentId: 'content-1', text: 'one continued' },
      },
      {
        type: 'content_delta',
        data: { workerId: 'worker-2', contentId: 'content-2', text: 'two continued' },
      },
    ])

    const next = publisher.publish({ type: 'worker_completed', data: { workerId: 'worker-1', status: 'success' } }, 105)
    expect(next?.sequence).toBe(6)
  })

  it('keeps incomplete content when the user manually stops during a retry', () => {
    const hub = new RunEventHub()
    const publisher = hub.tryBegin({
      conversationId: 'conversation-1',
      runId: 'run-1',
      turnId: 'turn-1',
      assistantMessageId: 'assistant-1',
      source: 'user',
    })!

    publisher.publish({ type: 'content_delta', data: { contentId: 'content-1', text: 'partial ' } }, 101)
    publisher.publish({ type: 'content_delta', data: { contentId: 'content-1', text: 'answer' } }, 102)
    publisher.publish({ type: 'run_retrying', data: { retryId: 'retry-1', attempt: 1, maxAttempts: 5 } }, 103)
    publisher.publish({ type: 'run_cancelled', data: { reason: 'user' } }, 104)

    const persisted = readEvents(publisher.filePath)
    expect(persisted.map(item => item.event.type)).toEqual([
      'run_started',
      'run_retrying',
      'content_delta',
      'run_cancelled',
    ])
    expect(persisted[2]?.event).toEqual({
      type: 'content_delta',
      data: { contentId: 'content-1', text: 'partial answer' },
    })
    expect(persisted.every(item => item.startSequence === undefined)).toBe(true)
    expect(publisher.getLiveEvents()).toEqual([])
    expect(hub.getActiveEvents()).toEqual([])
  })

  it('rolls back failed-attempt fragments after a network retry produces new content', () => {
    const hub = new RunEventHub()
    const emitted: AgentConversationRunEventDTO[] = []
    hub.subscribe(item => emitted.push(item))
    const publisher = hub.tryBegin({
      conversationId: 'conversation-1',
      runId: 'run-1',
      turnId: 'turn-1',
      assistantMessageId: 'assistant-1',
      source: 'user',
    })!

    publisher.publish({ type: 'content_delta', data: { contentId: 'failed', text: 'stale partial' } }, 101)
    publisher.publish({ type: 'run_retrying', data: { retryId: 'retry-1', attempt: 1, maxAttempts: 5 } }, 102)
    publisher.publish({ type: 'content_delta', data: { contentId: 'success', text: 'fresh ' } }, 103)
    publisher.publish({ type: 'content_delta', data: { contentId: 'success', text: 'answer' } }, 104)
    publisher.publish({ type: 'run_completed', data: {} }, 105)

    const persisted = readEvents(publisher.filePath)
    expect(persisted.map(item => item.sequence)).toEqual([1, 2, 3, 4])
    expect(persisted.some(item => item.event.type === 'content_delta' && item.event.data.contentId === 'failed')).toBe(false)
    expect(persisted.find(item => item.event.type === 'content_delta')?.event).toEqual({
      type: 'content_delta',
      data: { contentId: 'success', text: 'fresh answer' },
    })
    expect(emitted.filter(item => item.event.type === 'content_delta')).toHaveLength(3)
  })

  it('discards the final incomplete attempt when network retries are exhausted', () => {
    const hub = new RunEventHub()
    const publisher = hub.tryBegin({
      conversationId: 'conversation-1',
      runId: 'run-1',
      turnId: 'turn-1',
      assistantMessageId: 'assistant-1',
      source: 'user',
    })!

    publisher.publish({ type: 'thinking_delta', data: { thinkingId: 'failed', text: 'stale' } }, 101)
    publisher.publish({
      type: 'thinking_completed',
      data: { thinkingId: 'failed', startTimestamp: 101, endTimestamp: 102, durationMs: 1 },
    }, 102)
    publisher.publish({
      type: 'run_failed',
      data: { code: 'network_interrupted', message: 'Network connection interrupted', retryable: true },
    }, 103)

    const persisted = readEvents(publisher.filePath)
    expect(persisted.map(item => item.event.type)).toEqual(['run_started', 'run_failed'])
    expect(persisted.map(item => item.sequence)).toEqual([1, 2])
    expect(publisher.getLiveEvents()).toEqual([])
    expect(hub.getActiveEvents()).toEqual([])
  })

  it('isolates retry rollback and buffering between the root run and workers', () => {
    const hub = new RunEventHub()
    const publisher = hub.tryBegin({
      conversationId: 'conversation-1',
      runId: 'run-1',
      turnId: 'turn-1',
      assistantMessageId: 'assistant-1',
      source: 'user',
    })!

    publisher.publish({ type: 'content_delta', data: { contentId: 'root', text: 'root answer' } }, 101)
    publisher.publish({ type: 'content_delta', data: { workerId: 'worker-1', contentId: 'failed', text: 'stale worker answer' } }, 102)
    publisher.publish({ type: 'run_retrying', data: { workerId: 'worker-1', attempt: 1, maxAttempts: 5 } }, 103)
    publisher.publish({ type: 'content_delta', data: { workerId: 'worker-2', contentId: 'worker-2', text: 'second worker' } }, 104)
    publisher.publish({ type: 'content_delta', data: { workerId: 'worker-1', contentId: 'fresh', text: 'fresh worker answer' } }, 105)
    publisher.publish({ type: 'worker_completed', data: { workerId: 'worker-1', status: 'success' } }, 106)
    publisher.publish({ type: 'worker_completed', data: { workerId: 'worker-2', status: 'success' } }, 107)
    publisher.publish({ type: 'run_completed', data: {} }, 108)

    const contentEvents = readEvents(publisher.filePath)
      .flatMap(item => item.event.type === 'content_delta' ? [item.event.data] : [])
    expect(contentEvents).toEqual(expect.arrayContaining([
      { contentId: 'root', text: 'root answer' },
      { workerId: 'worker-1', contentId: 'fresh', text: 'fresh worker answer' },
      { workerId: 'worker-2', contentId: 'worker-2', text: 'second worker' },
    ]))
    expect(contentEvents.some(data => data.contentId === 'failed')).toBe(false)
  })

  it('silently rejects a second start while the conversation is active', () => {
    const hub = new RunEventHub()
    const first = hub.tryBegin({
      conversationId: 'conversation-1',
      runId: 'run-1',
      turnId: 'turn-1',
      assistantMessageId: 'assistant-1',
      source: 'user',
    })
    const second = hub.tryBegin({
      conversationId: 'conversation-1',
      runId: 'run-2',
      turnId: 'turn-2',
      assistantMessageId: 'assistant-2',
      source: 'user',
    })

    expect(first).not.toBeNull()
    expect(second).toBeNull()
    expect(hub.getActive('conversation-1')).toBe(first)
  })
})
