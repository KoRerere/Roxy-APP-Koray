import type { AgentRunEvent } from '@roxy/shared/channel'
import { AgentChannelMessageSchema } from '@roxy/shared/channel'
import { describe, expect, it, vi } from 'vitest'
import { RuntimeEventPublisher } from './event-publisher'

describe('runtimeEventPublisher', () => {
  it('uses only the final model call content for run_completed', () => {
    // Regression: done() joined text from every model call, so intermediate
    // tool-loop content was repeated inside the final answer.
    // Fixed by: tracking text per model call and selecting the last call.
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher((event) => events.push(event))

    publisher.handle({ type: 'text', delta: 'intermediate ', callIndex: 0 })
    publisher.handle({ type: 'text', delta: 'answer', callIndex: 1 })
    publisher.handle({ type: 'done', stopReason: 'end_turn' })

    expect(events.at(-1)).toEqual({
      type: 'run_completed',
      data: { finalAnswer: 'answer' },
    })
  })

  it('maps max_tokens termination to run_failed', () => {
    // Regression: max_tokens was published as run_completed, so a truncated
    // tool argument looked like a normal finished run with a dangling tool row.
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher((event) => events.push(event))

    publisher.handle({ type: 'done', stopReason: 'max_tokens' })

    expect(events).toEqual([
      {
        type: 'run_failed',
        data: expect.objectContaining({
          code: 'agent_internal_error',
          message: expect.stringContaining('truncated'),
          retryable: false,
        }),
      },
    ])
  })

  it('does not concatenate a failed stream prefix with replacement output', () => {
    // Regression: a stream retry rolled back the frontend fragment but the
    // publisher still returned failed and replacement text as one answer.
    // Fixed by: clearing the current call buffer when its replacement stream starts.
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher((event) => events.push(event))

    publisher.handle({ type: 'text', delta: 'stale ', callIndex: 0 })
    publisher.markRetryPending()
    publisher.handle({ type: 'text', delta: 'fresh', callIndex: 0 })
    publisher.handle({ type: 'done', stopReason: 'end_turn' })

    expect(publisher.getFinalAnswer()).toBe('fresh')
    expect(events.filter((event) => event.type === 'content_delta').map((event) => event.data.text)).toEqual(['stale ', 'fresh'])
  })

  it('maps all clarification questions to a generic input request', () => {
    // Regression: runtime emitted clarification_pending but the Roxy event
    // adapter ignored it, leaving ask_user parked forever without frontend UI.
    // Fixed by: publishing the complete questions array for the frontend pager.
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher((event) => events.push(event))

    publisher.handle({
      type: 'clarification_pending',
      pending: {
        traceId: 'trace-1',
        request: {
          traceId: 'trace-1',
          questions: [
            {
              header: 'Region',
              id: 'region',
              question: 'Which region should we use?',
              options: [
                { label: 'US', description: 'Use the United States region.' },
                { label: 'EU', description: 'Use the European region.' },
              ],
            },
            {
              header: 'Mode',
              id: 'mode',
              question: 'Which mode should we use?',
              options: [
                { label: 'Safe', description: 'Prefer conservative defaults.' },
                { label: 'Fast', description: 'Prioritize speed.' },
              ],
            },
          ],
        },
        resume: () => {},
      },
    })

    expect(events).toEqual([
      {
        type: 'approval_requested',
        data: expect.objectContaining({
          approvalId: 'trace-1',
          requestKind: 'clarification',
          prompt: 'Which region should we use?',
          questions: expect.arrayContaining([
            expect.objectContaining({ id: 'region' }),
            expect.objectContaining({ id: 'mode' }),
          ]),
        }),
      },
    ])
  })

  it('maps runtime approval fields to the frontend action contract', () => {
    // Regression: runtime ApprovalRequest uses toolName/input, while the
    // frontend legacy adapter reads name/args, so approvals displayed an
    // anonymous action with no arguments or diff.
    // Fixed by: translating the runtime request at the host event boundary.
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher((event) => events.push(event))

    publisher.handle({
      type: 'hitl_pending',
      pending: {
        traceId: 'trace-write',
        request: {
          traceId: 'trace-write',
          toolName: 'apply_patch',
          input: '*** Begin Patch\n*** Add File: report.txt\n+hello\n*** End Patch',
          reason: 'HITL check',
          diff: '--- report.txt\n+++ report.txt\n@@ -0,0 +1 @@\n+hello',
        },
        resume: () => {},
      },
    })

    expect(events).toEqual([
      {
        type: 'approval_requested',
        data: {
          approvalId: 'trace-write',
          actionRequests: [
            {
              name: 'apply_patch',
              args: '*** Begin Patch\n*** Add File: report.txt\n+hello\n*** End Patch',
              diff: '--- report.txt\n+++ report.txt\n@@ -0,0 +1 @@\n+hello',
            },
          ],
          reviewConfigs: [],
        },
      },
    ])
  })

  it('publishes tool calls and ignores stream events after done', () => {
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher((event) => events.push(event), {
      emitDone: false,
    })

    publisher.handle({
      type: 'tool_call',
      callIndex: 0,
      block: {
        type: 'tool_use',
        id: 'spawn-1',
        name: 'spawn_agent',
        input: { agent_type: 'general-purpose', name: 'profile_one', message: '{}' },
      },
    })
    publisher.handle({ type: 'done', stopReason: 'end_turn' })
    publisher.handle({ type: 'text', delta: 'late output', callIndex: 1 })

    expect(events[0]).toEqual({
      type: 'tool_started',
      data: expect.objectContaining({
        toolId: 'spawn-1',
        toolName: 'spawn_agent',
      }),
    })
    expect(events.some((event) => event.type === 'content_delta')).toBe(false)
  })

  it('publishes provider web search calls as a frontend tool lifecycle', () => {
    // Regression: provider-executed web_search calls never entered the canonical
    // frontend event stream, so search and open-page actions were invisible.
    // Fixed by: translating their in-progress/completed states to tool events.
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher(event => events.push(event), {
      agentPath: '/root/researcher',
      emitDone: false,
    })
    const action = {
      type: 'search' as const,
      queries: ['RoxyBrowser pricing', 'ws_call_id=ws_1'],
    }

    publisher.handle({
      type: 'web_search_call',
      callIndex: 0,
      item: { type: 'web_search_call', id: 'ws_1', status: 'in_progress', action },
    })
    publisher.handle({
      type: 'web_search_call',
      callIndex: 0,
      item: { type: 'web_search_call', id: 'ws_1', status: 'completed', action },
    })

    expect(events).toEqual([
      {
        type: 'tool_started',
        data: {
          agentPath: '/root/researcher',
          toolName: 'web_search',
          toolId: 'ws_1',
          input: action,
        },
      },
      {
        type: 'tool_finished',
        data: {
          agentPath: '/root/researcher',
          toolName: 'web_search',
          toolId: 'ws_1',
          output: null,
          status: 'success',
          durationMs: expect.any(Number),
        },
      },
    ])
  })

  it('waits for a streaming web search action before publishing its start event', () => {
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher(event => events.push(event), { emitDone: false })
    const action = {
      type: 'open_page' as const,
      url: 'https://example.com/docs#ws_call_id=ws-delayed',
    }

    publisher.handle({
      type: 'web_search_call',
      callIndex: 0,
      item: { type: 'web_search_call', id: 'ws-delayed', status: 'in_progress' },
    })
    expect(events).toEqual([])

    publisher.handle({
      type: 'web_search_call',
      callIndex: 0,
      item: { type: 'web_search_call', id: 'ws-delayed', status: 'completed', action },
    })

    expect(events).toEqual([
      {
        type: 'tool_started',
        data: expect.objectContaining({
          toolName: 'web_search',
          toolId: 'ws-delayed',
          input: action,
        }),
      },
      {
        type: 'tool_finished',
        data: expect.objectContaining({
          toolName: 'web_search',
          toolId: 'ws-delayed',
          output: null,
          status: 'success',
        }),
      },
    ])
  })

  it.each(['completed', 'failed'] as const)('keeps a %s web search channel event serializable before the run terminal', (status) => {
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher(event => events.push(event), { emitDone: false })

    publisher.handle({
      type: 'web_search_call',
      callIndex: 0,
      item: {
        type: 'web_search_call',
        id: `ws-${status}`,
        status,
        action: { type: 'search', queries: ['RoxyBrowser pricing'] },
      },
    })
    events.push({ type: 'run_completed', data: { finalAnswer: 'done' } })

    const messages = events.map((event, index) => JSON.parse(JSON.stringify({
      id: `message-${index + 1}`,
      type: 'conversation.run.event',
      data: {
        conversationId: 'conversation-1',
        runId: 'run-1',
        turnId: 'turn-1',
        assistantMessageId: 'assistant-1',
        sequence: index + 1,
        timestamp: 1000 + index,
        event,
      },
    })))

    expect(messages.map(message => message.data.sequence)).toEqual([1, 2, 3])
    expect(messages.map(message => message.data.event.type)).toEqual([
      'tool_started',
      'tool_finished',
      'run_completed',
    ])
    expect(messages[1]?.data.event.data.output).toBeNull()
    expect(messages.every(message => AgentChannelMessageSchema.safeParse(message).success)).toBe(true)
  })

  it('publishes find-in-page searches while they are still running', () => {
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher(event => events.push(event), { emitDone: false })
    const action = {
      type: 'find_in_page' as const,
      url: 'https://roxybrowser.cn/faqs#ws_call_id=ws-find',
      pattern: '普通浏览器',
    }

    publisher.handle({
      type: 'web_search_call',
      callIndex: 0,
      item: { type: 'web_search_call', id: 'ws-find', status: 'in_progress', action },
    })
    expect(events).toEqual([
      {
        type: 'tool_started',
        data: expect.objectContaining({
          toolName: 'web_search',
          toolId: 'ws-find',
          input: action,
        }),
      },
    ])

    publisher.handle({
      type: 'web_search_call',
      callIndex: 0,
      item: { type: 'web_search_call', id: 'ws-find', status: 'completed', action },
    })
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({
      type: 'tool_finished',
      data: { toolName: 'web_search', toolId: 'ws-find', status: 'success' },
    })
  })

  it('keeps a web search lifecycle when no action is ever provided', () => {
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher(event => events.push(event), { emitDone: false })

    publisher.handle({
      type: 'web_search_call',
      callIndex: 0,
      item: { type: 'web_search_call', id: 'ws-unknown', status: 'in_progress' },
    })
    publisher.handle({
      type: 'web_search_call',
      callIndex: 0,
      item: { type: 'web_search_call', id: 'ws-unknown', status: 'completed' },
    })

    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      type: 'tool_started',
      data: { toolName: 'web_search', toolId: 'ws-unknown', input: null },
    })
    expect(events[1]).toMatchObject({
      type: 'tool_finished',
      data: { toolName: 'web_search', toolId: 'ws-unknown', output: null, status: 'success' },
    })

    const messages = events.map((event, index) => JSON.parse(JSON.stringify({
      id: `message-unknown-${index + 1}`,
      type: 'conversation.run.event',
      data: {
        conversationId: 'conversation-1',
        runId: 'run-1',
        turnId: 'turn-1',
        assistantMessageId: 'assistant-1',
        sequence: index + 1,
        timestamp: 1000 + index,
        event,
      },
    })))
    expect(messages.every(message => AgentChannelMessageSchema.safeParse(message).success)).toBe(true)
  })

  it('restarts a web search lifecycle when a retry reuses the call id', () => {
    // Regression: retry rollback removed the first tool_started event from the
    // frontend, but the publisher kept its internal start and skipped the replacement.
    // Fixed by: clearing provider-tool lifecycle state when a retry begins.
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher(event => events.push(event), { emitDone: false })
    const item = {
      type: 'web_search_call' as const,
      id: 'ws-retry',
      status: 'in_progress',
      action: { type: 'search', queries: ['retry query'] },
    }

    publisher.handle({ type: 'web_search_call', callIndex: 0, item })
    publisher.markRetryPending()
    publisher.handle({ type: 'web_search_call', callIndex: 0, item })

    expect(events.filter(event => event.type === 'tool_started')).toHaveLength(2)
  })

  it('scopes worker stream events and keeps the final answer in memory', () => {
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher((event) => events.push(event), {
      workerId: 'worker-1',
      emitDone: false,
    })

    publisher.handle({ type: 'thinking', delta: 'checking', callIndex: 0 })
    publisher.handle({
      type: 'tool_call',
      block: {
        type: 'tool_use',
        id: 'tool-1',
        name: 'browser_snapshot',
        input: {},
      },
      callIndex: 0,
    })
    publisher.handle({
      type: 'tool_result',
      result: { toolUseId: 'tool-1', content: 'snapshot', isError: false },
    })
    publisher.handle({ type: 'text', delta: 'done', callIndex: 1 })
    publisher.handle({ type: 'done', stopReason: 'end_turn' })

    expect(events).toEqual(
      expect.arrayContaining([
        {
          type: 'thinking_delta',
          data: expect.objectContaining({ workerId: 'worker-1' }),
        },
        {
          type: 'tool_started',
          data: expect.objectContaining({ workerId: 'worker-1' }),
        },
        {
          type: 'tool_finished',
          data: expect.objectContaining({ workerId: 'worker-1' }),
        },
        {
          type: 'content_delta',
          data: expect.objectContaining({ workerId: 'worker-1', text: 'done' }),
        },
        {
          type: 'thinking_completed',
          data: expect.objectContaining({ workerId: 'worker-1' }),
        },
      ]),
    )
    expect(events.some((event) => event.type === 'run_completed')).toBe(false)
    expect(publisher.getFinalAnswer()).toBe('done')
  })

  it('closes open thinking before an outer error publishes the terminal run event', () => {
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher((event) => events.push(event), {
      emitDone: false,
    })

    publisher.handle({ type: 'thinking', delta: 'checking', callIndex: 0 })
    publisher.finishOpenThinking()

    expect(events).toEqual([
      {
        type: 'thinking_delta',
        data: { id: 'llm-0', thinkingId: 'llm-0', text: 'checking' },
      },
      {
        type: 'thinking_completed',
        data: expect.objectContaining({ id: 'llm-0', thinkingId: 'llm-0' }),
      },
    ])

    publisher.finishOpenThinking()
    expect(events).toHaveLength(2)
  })

  it('publishes the synchronized thinking duration at the model-call boundary', () => {
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher(event => events.push(event), { emitDone: false })

    publisher.handle({ type: 'thinking', delta: 'checking', callIndex: 0 })
    publisher.handle({ type: 'thinking_complete', callIndex: 0 })
    publisher.handle({ type: 'done', stopReason: 'end_turn' })

    const completed = events.filter(event => event.type === 'thinking_completed')
    expect(completed).toHaveLength(1)
    expect(completed[0]?.data).toEqual(expect.objectContaining({
      id: 'llm-0',
      thinkingId: 'llm-0',
      durationMs: expect.any(Number),
    }))
  })

  it('restarts thinking duration when a retry replaces the failed attempt', () => {
    vi.useFakeTimers()
    try {
      const events: AgentRunEvent[] = []
      const publisher = new RuntimeEventPublisher(event => events.push(event), { emitDone: false })

      vi.setSystemTime(1_000)
      publisher.handle({ type: 'thinking', delta: 'stale', callIndex: 0 })
      publisher.markRetryPending()
      vi.setSystemTime(5_000)
      publisher.handle({ type: 'thinking', delta: 'fresh', callIndex: 0 })
      vi.setSystemTime(8_000)
      publisher.handle({ type: 'thinking_complete', callIndex: 0 })

      const completed = events.find(event => event.type === 'thinking_completed')
      expect(completed?.data.durationMs).toBe(3_000)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it.each([
    {
      name: 'create',
      input: '*** Begin Patch\n*** Add File: /tmp/new report.txt\n+hello\n*** End Patch',
      patchType: 'create',
      target: '/tmp/new report.txt',
    },
    {
      name: 'update',
      input: '*** Begin Patch\n*** Update File: src/report.ts\n@@\n-old\n+new\n*** End Patch',
      patchType: 'update',
      target: 'src/report.ts',
    },
    {
      name: 'delete',
      input: '*** Begin Patch\n*** Delete File: C:\\reports\\old.txt\n*** End Patch',
      patchType: 'delete',
      target: 'C:\\reports\\old.txt',
    },
    {
      name: 'mixed',
      input: '*** Begin Patch\n*** Update File: a.txt\n@@\n-old\n+new\n*** Add File: b.txt\n+new\n*** End Patch',
      patchType: 'mixed',
      target: undefined,
    },
  ])('describes $name apply_patch events without resolving their paths', ({ input, patchType, target }) => {
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher(event => events.push(event), { emitDone: false })

    publisher.handle({
      type: 'tool_call',
      callIndex: 0,
      block: { type: 'tool_use', id: 'patch-1', name: 'apply_patch', input },
    })

    expect(events).toEqual([{
      type: 'tool_started',
      data: expect.objectContaining({
        patchType,
        target,
        toolId: 'patch-1',
        toolName: 'apply_patch',
      }),
    }])
  })

  it('publishes the original read_file path as the tool target', () => {
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher(event => events.push(event), { emitDone: false })

    publisher.handle({
      type: 'tool_call',
      callIndex: 0,
      block: {
        type: 'tool_use',
        id: 'read-1',
        name: 'read_file',
        input: { path: 'relative/report.txt', offset: 0, limit: 10 },
      },
    })

    expect(events).toEqual([{
      type: 'tool_started',
      data: expect.objectContaining({
        target: 'relative/report.txt',
        toolId: 'read-1',
        toolName: 'read_file',
      }),
    }])
  })

  it('scopes thinking completion to the agent path and emits it once', () => {
    const events: AgentRunEvent[] = []
    const publisher = new RuntimeEventPublisher(event => events.push(event), {
      agentPath: '/root/profile_one',
      emitDone: false,
    })

    publisher.handle({ type: 'thinking', delta: 'checking', callIndex: 0 })
    publisher.handle({ type: 'done', stopReason: 'end_turn' })

    const thinkingEvents = events.filter((event) => {
      return event.type === 'thinking_delta' || event.type === 'thinking_completed'
    })
    expect(thinkingEvents).toHaveLength(2)
    expect(thinkingEvents).toEqual([
      expect.objectContaining({
        type: 'thinking_delta',
        data: expect.objectContaining({ agentPath: '/root/profile_one' }),
      }),
      expect.objectContaining({
        type: 'thinking_completed',
        data: expect.objectContaining({ agentPath: '/root/profile_one' }),
      }),
    ])
  })
})
