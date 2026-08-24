import { describe, expect, it } from 'vitest'
import { buildTestAgent, endTurnResponse, toolCallResponse } from '../helpers/buildTestAgent.ts'
import { chatResponse, thinkingBlock, thinkingResponse, toolUse } from '../helpers/makeFakeProvider.ts'
import { StrictHitlHandler } from '../../src/hitl/handler.ts'
import { updatePlanTool } from '../../src/tools/builtin/update_plan.ts'
import type { AgentStreamEvent, ContentBlock, ThinkingBlock } from '../../src/core/interfaces.ts'
import { testToolInputSchema } from '../helpers/toolSchema.ts'

async function collect(
  agent: { stream: (input: string) => AsyncIterable<AgentStreamEvent> },
  input: string,
): Promise<AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = []
  for await (const e of agent.stream(input)) {
    events.push(e)
  }
  return events
}

describe('AgentImpl.stream', () => {
  it('pure text: events are text then done', async () => {
    const { agent } = buildTestAgent({ responses: [endTurnResponse('Hello!')] })
    const events = await collect(agent, 'hi')
    expect(events[0]?.type).toBe('text')
    expect((events[0] as { type: 'text'; delta: string }).delta).toBe('Hello!')
    expect(events.at(-1)?.type).toBe('done')
  })

  it('tool call: events include tool_call → tool_result → done', async () => {
    let n = 0
    const { agent, registry } = buildTestAgent({
      handler: () => {
        n++
        if (n === 1) {
          return toolCallResponse('id1', 'echo', { text: 'x' })
        }
        return endTurnResponse('ok')
      },
    })
    registry.add(
      {
        name: 'echo',
        description: 'echo',
        inputSchema: testToolInputSchema,
        source: 'builtin',
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async (input) => ({
        content: (input as { text: string }).text,
        isError: false,
      }),
    )
    const types = (await collect(agent, 'test')).map((e) => e.type)
    expect(types).toContain('tool_call')
    expect(types).toContain('tool_result')
    expect(types.at(-1)).toBe('done')
  })

  it('text and thinking events identify the model call that produced them', async () => {
    // Regression: all streamed text/thinking deltas looked identical across
    // the tool loop, so hosts merged separate LLM responses into one UI block.
    // Fixed by: every model delta carries the zero-based model call index.
    let modelCalls = 0
    const { agent, registry } = buildTestAgent({
      handler: () => {
        modelCalls++
        if (modelCalls === 1) {
          return chatResponse(
            {
              role: 'assistant',
              content: [thinkingBlock('planning', 'sig_call_0'), toolUse('id1', 'echo', { text: 'x' })],
            },
            'tool_use',
          )
        }
        return endTurnResponse('final')
      },
    })
    registry.add(
      {
        name: 'echo',
        description: 'echo',
        inputSchema: testToolInputSchema,
        source: 'builtin',
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async () => ({
        content: 'ok',
        isError: false,
      }),
    )

    const events = await collect(agent, 'test')
    const thinking = events.find((event) => event.type === 'thinking') as { callIndex?: number } | undefined
    const toolCall = events.find((event) => event.type === 'tool_call') as { callIndex?: number } | undefined
    const finalText = events.find((event) => event.type === 'text') as { callIndex?: number } | undefined

    expect(thinking?.callIndex).toBe(0)
    expect(toolCall?.callIndex).toBe(0)
    expect(finalText?.callIndex).toBe(1)
  })

  it('finishes thinking before the first text delta from the same model call', async () => {
    // Regression: thinking_complete was emitted only after the provider stream ended,
    // so the first text delta reached hosts while the thinking block was still open.
    // Fixed by: close thinking immediately before yielding the first text delta.
    const { agent } = buildTestAgent({ responses: [thinkingResponse('planning', 'sig_text', 'answer')] })

    const types = (await collect(agent, 'test')).map((event) => event.type)

    expect(types).toEqual(['thinking', 'thinking_complete', 'text', 'done'])
  })

  it('update_plan emits the complete todo snapshot without a store', async () => {
    let modelCalls = 0
    const todoTool = updatePlanTool()
    const { agent } = buildTestAgent({
      handler: () => {
        modelCalls++
        if (modelCalls === 1) {
          return toolCallResponse('todo-1', 'update_plan', {
            plan: [{ step: 'Inspect page', status: 'in_progress' }],
          })
        }
        return endTurnResponse('done')
      },
      tools: [todoTool],
    })

    const events = await collect(agent, 'test')
    expect(events).toContainEqual({
      type: 'plan_updated',
      todos: [{ content: 'Inspect page', status: 'in_progress' }],
    })
    expect(events.findIndex((event) => event.type === 'plan_updated')).toBeLessThan(
      events.findIndex((event) => event.type === 'tool_result'),
    )
  })

  it('unknown tool: no tool_result emitted, stream ends after one model call', async () => {
    // Regression: when the model returns stop_reason=tool_use for a tool
    // not in our registry (e.g. provider-internal tools like DeepSeek built-ins),
    // the old code would send a tool_result "tool not found" back, which the
    // provider would reject with a 400 ("tool_result without matching tool_use").
    // Fixed: strip unresolvable tool_use blocks, treat response as end_turn.
    let modelCalls = 0
    const { agent } = buildTestAgent({
      handler: () => {
        modelCalls++
        if (modelCalls === 1) {
          return toolCallResponse('id1', 'provider_internal_tool', {})
        }
        return endTurnResponse('second call should never happen')
      },
    })
    // no registry.add — "provider_internal_tool" is NOT registered

    const events = await collect(agent, 'hi')
    const types = events.map((e) => e.type)

    // No tool_call/tool_result is emitted for unresolvable provider-internal tools.
    expect(types).not.toContain('tool_call')
    expect(types).not.toContain('tool_result')
    // stream still ends cleanly
    expect(types.at(-1)).toBe('done')
    // only one model call — the loop does not retry
    expect(modelCalls).toBe(1)
  })

  it('max_tokens with a partial tool call does not emit a dangling tool event', async () => {
    // Regression: if the provider hit max_tokens while producing a large
    // apply_patch input, the stream emitted tool_call but never executed it,
    // leaving the frontend with a tool row that had no matching result.
    const sessionId = 'max-tokens-partial-tool'
    const { agent, memory } = buildTestAgent({
      sessionId,
      responses: [
        chatResponse(
          {
            role: 'assistant',
            content: [toolUse('patch-1', 'apply_patch', '*** Begin Patch\n*** Add File: script.ts\n+partial')],
            transcriptItems: [
              {
                type: 'tool_call',
                id: 'patch-1',
                callId: 'patch-1',
                name: 'apply_patch',
                arguments: '*** Begin Patch\n*** Add File: script.ts\n+partial',
                toolKind: 'custom',
              },
            ],
          },
          'max_tokens',
        ),
      ],
    })

    const events = await collect(agent, 'write a large file')
    const types = events.map((event) => event.type)

    expect(types).not.toContain('tool_call')
    expect(types).not.toContain('tool_result')
    expect(events.at(-1)).toEqual({ type: 'done', stopReason: 'max_tokens' })

    const history = await memory.getAll(sessionId)
    expect(history.at(-1)?.transcriptItems?.some((item) => item.type === 'tool_call')).toBe(false)
  })

  it('hitl_pending emitted, tool runs after resume(approve)', async () => {
    let n = 0
    const { agent, registry } = buildTestAgent({
      hitl: new StrictHitlHandler(),
      handler: () => {
        n++
        if (n === 1) {
          return toolCallResponse('id1', 'sensitive', {})
        }
        return endTurnResponse('done')
      },
    })
    registry.add(
      {
        name: 'sensitive',
        description: 's',
        inputSchema: testToolInputSchema,
        source: 'builtin',
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      },
      async () => ({ content: 'ran', isError: false }),
    )

    const events: AgentStreamEvent[] = []
    for await (const e of agent.stream('test')) {
      events.push(e)
      if (e.type === 'hitl_pending') {
        agent.resume(e.pending.traceId, { decision: 'approve' })
      }
    }

    const types = events.map((e) => e.type)
    expect(types).toContain('hitl_pending')
    expect(types).toContain('tool_result')
    expect(types.at(-1)).toBe('done')
  })

  it('hitl_pending includes the tool diff preview', async () => {
    // Regression: AgentImpl.stream built PendingApproval directly and skipped
    // ToolDescriptor.previewFn, so write/edit approvals reached the UI without a diff.
    // Fixed by: building the approval request through the shared preview helper.
    let n = 0
    const { agent, registry } = buildTestAgent({
      hitl: new StrictHitlHandler(),
      handler: () => {
        n++
        if (n === 1) {
          return toolCallResponse('write-1', 'preview_write', { path: 'note.txt', content: 'new' })
        }
        return endTurnResponse('done')
      },
    })
    registry.add(
      {
        name: 'preview_write',
        description: 'write with preview',
        inputSchema: testToolInputSchema,
        source: 'builtin',
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
        previewFn: async () => '--- note.txt\n+++ note.txt\n@@ -1 +1 @@\n-old\n+new',
      },
      async () => ({ content: 'ran', isError: false }),
    )

    let pendingDiff: string | undefined
    for await (const event of agent.stream('test')) {
      if (event.type === 'hitl_pending') {
        pendingDiff = event.pending.request.diff
        agent.resume(event.pending.traceId, { decision: 'approve' })
      }
    }

    expect(pendingDiff).toBe('--- note.txt\n+++ note.txt\n@@ -1 +1 @@\n-old\n+new')
  })

  it('normalizes approval preview input through middleware', async () => {
    // Regression: file middleware resolved relative paths only during tool
    // execution, so previewFn read from process.cwd instead of the session workspace.
    // Fixed by: running the middleware's read-only preview transform before HITL.
    let n = 0
    let previewPath: unknown
    const { agent, registry } = buildTestAgent({
      hitl: new StrictHitlHandler(),
      middleware: [
        {
          match: 'preview_write',
          preview: (input) => ({ ...(input as Record<string, unknown>), path: '/session/note.txt' }),
        },
      ],
      handler: () => {
        n++
        if (n === 1) {
          return toolCallResponse('write-1', 'preview_write', { path: 'note.txt' })
        }
        return endTurnResponse('done')
      },
    })
    registry.add(
      {
        name: 'preview_write',
        description: 'write with preview',
        inputSchema: testToolInputSchema,
        source: 'builtin',
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
        previewFn: async (input) => {
          previewPath = (input as Record<string, unknown>).path
          return 'preview diff'
        },
      },
      async () => ({ content: 'ran', isError: false }),
    )

    for await (const event of agent.stream('test')) {
      if (event.type === 'hitl_pending') {
        agent.resume(event.pending.traceId, { decision: 'approve' })
      }
    }

    expect(previewPath).toBe('/session/note.txt')
  })

  it('hitl_pending + reject: tool_result carries rejection feedback', async () => {
    let n = 0
    const { agent, registry } = buildTestAgent({
      hitl: new StrictHitlHandler(),
      handler: () => {
        n++
        if (n === 1) {
          return toolCallResponse('id1', 'sensitive', {})
        }
        return endTurnResponse('done')
      },
    })
    registry.add(
      {
        name: 'sensitive',
        description: 's',
        inputSchema: testToolInputSchema,
        source: 'builtin',
        annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      },
      async () => ({ content: 'ran', isError: false }),
    )

    const events: AgentStreamEvent[] = []
    for await (const e of agent.stream('test')) {
      events.push(e)
      if (e.type === 'hitl_pending') {
        agent.resume(e.pending.traceId, { decision: 'reject', feedback: 'not allowed' })
      }
    }

    const toolResultEvt = events.find((e) => e.type === 'tool_result')
    expect(toolResultEvt).toBeDefined()
    if (toolResultEvt?.type === 'tool_result') {
      expect(toolResultEvt.result.isError).toBe(true)
      expect(toolResultEvt.result.content).toContain('not allowed')
    }
  })

  it('thinking + tool call: emits thinking delta and completion before tool_call', async () => {
    let n = 0
    const { agent, registry } = buildTestAgent({
      handler: () => {
        n++
        if (n === 1) {
          return chatResponse(
            {
              role: 'assistant',
              content: [thinkingBlock('planning the echo', 'sig_T'), toolUse('tu1', 'echo', { text: 'x' })],
            },
            'tool_use',
          )
        }
        return endTurnResponse('ok')
      },
    })
    registry.add(
      { name: 'echo', description: 'echo', inputSchema: testToolInputSchema, source: 'builtin' },
      async (input) => ({
        content: (input as { text: string }).text,
        isError: false,
      }),
    )

    const events = await collect(agent, 'test')
    const types = events.map((e) => e.type)

    // thinking delta is surfaced as a stream event, before tool_call.
    const thinkingEvt = events.find((e) => e.type === 'thinking')
    expect(thinkingEvt).toBeDefined()
    expect((thinkingEvt as { delta?: string }).delta).toBe('planning the echo')
    expect(types.indexOf('thinking')).toBeLessThan(types.indexOf('tool_call'))
    expect(types.indexOf('thinking_complete')).toBeGreaterThan(types.indexOf('thinking'))
    expect(types.indexOf('thinking_complete')).toBeLessThan(types.indexOf('tool_call'))
    expect(types).toContain('tool_result')
    expect(types.at(-1)).toBe('done')
  })

  // Regression: with extended thinking enabled, Anthropic requires the
  // assistant's thinking block (carrying its signature) to be round-tripped
  // back in the request messages on subsequent turns — alongside the matching
  // tool_result — or the next call 400s. The loop must preserve thinking
  // blocks in stored history when the turn uses tools.
  it('thinking + tool call: thinking block (with signature) is round-tripped into the next request', async () => {
    let n = 0
    const { agent, provider, registry } = buildTestAgent({
      handler: () => {
        n++
        if (n === 1) {
          return chatResponse(
            {
              role: 'assistant',
              content: [thinkingBlock('reasoning here', 'sig_ROUNDTRIP'), toolUse('tu1', 'echo', { text: 'x' })],
            },
            'tool_use',
          )
        }
        return endTurnResponse('final')
      },
    })
    registry.add(
      { name: 'echo', description: 'echo', inputSchema: testToolInputSchema, source: 'builtin' },
      async (input) => ({
        content: (input as { text: string }).text,
        isError: false,
      }),
    )

    await collect(agent, 'test')

    // Second model call carries the prior assistant turn, including the
    // signed thinking block, followed by the tool_result user message.
    expect(provider.calls.length).toBeGreaterThanOrEqual(2)
    const secondReqMessages = provider.calls[1].messages
    const assistantTurn = secondReqMessages.find((m) => m.role === 'assistant' && Array.isArray(m.content))
    expect(assistantTurn).toBeDefined()
    const blocks = (assistantTurn!.content as ContentBlock[]).filter((b): b is ThinkingBlock => b.type === 'thinking')
    expect(blocks.length).toBe(1)
    expect(blocks[0].signature).toBe('sig_ROUNDTRIP')
    expect(blocks[0].thinking).toBe('reasoning here')
  })

  it('Roxy transcript items are round-tripped into the next streamed request', async () => {
    // Regression: the stream loop reconstructed canonical content but discarded
    // Responses-only items, so stateless providers lost reasoning/server-tool state.
    // Fixed by: carrying Roxy transcript items onto the stored assistant turn.
    const items = [
      { type: 'web_search_call' as const, id: 'ws_1', status: 'completed' },
      {
        type: 'tool_call' as const,
        id: 'tu1',
        callId: 'tu1',
        name: 'echo',
        arguments: { text: 'x' },
        toolKind: 'function' as const,
      },
    ]
    let n = 0
    const { agent, provider, registry } = buildTestAgent({
      handler: () => {
        n++
        if (n === 1) {
          return {
            ...chatResponse(
              {
                role: 'assistant',
                content: [toolUse('tu1', 'echo', { text: 'x' })],
              },
              'tool_use',
            ),
            items,
          }
        }
        return endTurnResponse('done')
      },
    })
    registry.add(
      { name: 'echo', description: 'echo', inputSchema: testToolInputSchema, source: 'builtin' },
      async () => ({
        content: 'ok',
        isError: false,
      }),
    )

    await collect(agent, 'test')

    const assistantTurn = provider.calls[1]!.messages.find((message) => message.role === 'assistant')
    expect(assistantTurn?.transcriptItems).toEqual(items)
  })

  it('forwards provider web search lifecycle without treating it as a local tool', async () => {
    // Regression: Responses web_search_call items were persisted only on the
    // terminal assistant turn, so hosts received no live server-tool event.
    // Fixed by: forwarding provider-executed web search items through AgentStreamEvent.
    const response = endTurnResponse('done')
    response.items = [
      {
        type: 'web_search_call',
        id: 'ws_1',
        status: 'completed',
        action: { type: 'open_page', url: 'https://example.com/docs' },
        provider: 'openai-responses',
      },
      ...response.items,
    ]
    const { agent } = buildTestAgent({ responses: [response] })

    const events = await collect(agent, 'test')

    expect(events).toContainEqual({
      type: 'web_search_call',
      callIndex: 0,
      item: {
        type: 'web_search_call',
        id: 'ws_1',
        status: 'completed',
        action: { type: 'open_page', url: 'https://example.com/docs' },
        provider: 'openai-responses',
      },
    })
    expect(events.some((event) => event.type === 'tool_call')).toBe(false)
    expect(events.some((event) => event.type === 'tool_result')).toBe(false)
  })
})
