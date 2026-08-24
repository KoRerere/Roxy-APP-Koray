import type { AgentConversationRunEventDTO } from '@roxy/shared/channel'
import { AgentChannelMessageSchema } from '@roxy/shared/channel'
import { describe, expect, it } from 'vitest'
import { RunEventHub } from './runEventHub'

it('accepts unified fragment ids and keeps thinking completion attached', () => {
  const hub = new RunEventHub()
  const publisher = hub.tryBegin({
    conversationId: 'conversation-unified-id',
    runId: 'run-unified-id',
    turnId: 'turn-unified-id',
    assistantMessageId: 'assistant-unified-id',
    source: 'user',
  })!

  publisher.publish({
    type: 'thinking_delta',
    data: { id: 'llm-0', thinkingId: 'legacy-thinking', text: 'plan' },
  })
  publisher.publish({
    type: 'thinking_completed',
    data: {
      id: 'llm-0',
      thinkingId: 'legacy-thinking',
      startTimestamp: 1,
      endTimestamp: 2,
      durationMs: 1,
    },
  })

  const live = publisher.getLiveEvents()
  const thinking = live.find(item => item.event.type === 'thinking_delta')
  const completed = live.find(item => item.event.type === 'thinking_completed')
  expect(thinking).toBeTruthy()
  expect(completed).toBeTruthy()
  expect(thinking?.startSequence).toBeUndefined()
  expect(completed?.startSequence).toBeUndefined()
  expect(live.filter(item => item.event.type === 'thinking_delta')).toHaveLength(1)
})

describe('runEventHub', () => {
  it('broadcasts schema-valid events without creating per-turn files', () => {
    const hub = new RunEventHub()
    const emitted: AgentConversationRunEventDTO[] = []
    hub.subscribe((item) => {
      expect(() => AgentChannelMessageSchema.parse({
        id: `message-${item.sequence}`,
        type: 'conversation.run.event',
        data: item,
      })).not.toThrow()
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
    expect(publisher).not.toHaveProperty('filePath')

    publisher?.publish({
      type: 'user_message',
      data: { messageId: 'turn-1', content: 'hello', attachments: [], createdAt: 101 },
    }, 101)
    publisher?.publish({ type: 'run_completed', data: { finalAnswer: 'done' } }, 102)

    expect(emitted.map(item => item.sequence)).toEqual([1, 2, 3])
    expect(emitted[0]).not.toHaveProperty('requestId')
    expect(emitted[0]).not.toHaveProperty('source')
    expect(emitted[0]?.event).toEqual({
      type: 'run_started',
      data: {
        agentPath: '/root',
        requestId: 'request-1',
        source: 'user',
        assistantMessageId: 'assistant-1',
        startedAt: 100,
      },
    })
    expect(publisher?.publish({ type: 'run_failed', data: { code: 'late', message: 'late', retryable: false } })).toBeNull()
  })

  it('keeps active fragment replay compact while broadcasting raw increments', () => {
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

    publisher.publish({ type: 'thinking_delta', data: { thinkingId: 'thinking-1', text: 'hello ' } }, 101)
    publisher.publish({ type: 'thinking_delta', data: { thinkingId: 'thinking-1', text: 'world' } }, 102)
    publisher.publish({
      type: 'thinking_completed',
      data: { thinkingId: 'thinking-1', startTimestamp: 101, endTimestamp: 103, durationMs: 2 },
    }, 103)

    expect(hub.getActiveEvents()).toEqual([
      expect.objectContaining({ sequence: 1, startSequence: undefined }),
      expect.objectContaining({
        startSequence: 2,
        sequence: 3,
        event: {
          type: 'thinking_delta',
          data: { agentPath: '/root', thinkingId: 'thinking-1', text: 'hello world' },
        },
      }),
      expect.objectContaining({ sequence: 4, startSequence: undefined }),
    ])
    expect(emitted.map(item => item.sequence)).toEqual([1, 2, 3, 4])
    expect(emitted.filter(item => item.event.type === 'thinking_delta')).toHaveLength(2)
  })

  it('clears active events when the run reaches a terminal state', () => {
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
    expect(hub.getActiveEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        startSequence: 2,
        sequence: 3,
        event: {
          type: 'content_delta',
          data: { agentPath: '/root', contentId: 'content-1', text: 'first answer' },
        },
      }),
    ]))

    publisher.publish({ type: 'run_completed', data: {} }, 103)

    expect(publisher.getLiveEvents()).toEqual([])
    expect(hub.getActiveEvents()).toEqual([])
    expect(hub.getActive('conversation-1')).toBeUndefined()
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
