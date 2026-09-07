import { describe, expect, it } from 'vitest'
import { buildTestAgent, chatResponse, endTurnResponse, toolCallResponse } from '../helpers/buildTestAgent.ts'
import { toolUse } from '../helpers/makeFakeProvider.ts'
import { updatePlanTool } from '../../src/tools/builtin/update_plan.ts'
import { StrictHitlHandler } from '../../src/hitl/handler.ts'
import type { ApprovalRequest } from '../../src/core/interfaces.ts'
import { testToolInputSchema } from '../helpers/toolSchema.ts'

describe('AgentImpl.invoke', () => {
  it('persists trailing hidden user messages after the visible request', async () => {
    const { agent, provider, memory } = buildTestAgent({ responses: [endTurnResponse('done')] })

    await agent.invoke({
      input: [{ role: 'user', content: 'inspect the page' }],
      trailingMessages: [{ role: 'user', content: '[attachment] notes.txt', visible: false }],
    })

    expect(provider.calls[0]!.messages).toEqual([
      { role: 'user', content: 'inspect the page' },
      { role: 'user', content: '[attachment] notes.txt', visible: false },
    ])
    expect(await memory.getAll(agent.sessionId)).toEqual([
      { role: 'user', content: 'inspect the page' },
      { role: 'user', content: '[attachment] notes.txt', visible: false },
      expect.objectContaining({ role: 'assistant' }),
    ])
  })

  it('persists hidden leading user messages while keeping their presentation marker', async () => {
    // Regression: AgentInput accepted Message[] but silently discarded every
    // message before the final user message, so the model input and rollout
    // could not be reconstructed completely.
    // Fixed by: append and record every turn-start user message in order.
    const { agent, provider, memory } = buildTestAgent({ responses: [endTurnResponse('done')] })

    await agent.invoke([
      {
        role: 'user',
        content: '<environment_context><os>Darwin</os></environment_context>',
        visible: false,
      },
      { role: 'user', content: 'inspect the page' },
    ])

    expect(provider.calls[0]!.messages).toEqual([
      {
        role: 'user',
        content: '<environment_context><os>Darwin</os></environment_context>',
        visible: false,
      },
      { role: 'user', content: 'inspect the page' },
    ])
    expect(await memory.getAll(agent.sessionId)).toEqual([
      {
        role: 'user',
        content: '<environment_context><os>Darwin</os></environment_context>',
        visible: false,
      },
      { role: 'user', content: 'inspect the page' },
      expect.objectContaining({ role: 'assistant' }),
    ])
  })

  it('pure text response: returns assistant message with no tool turns', async () => {
    const { agent } = buildTestAgent({ responses: [endTurnResponse('Hello!')] })
    const res = await agent.invoke('say hi')
    expect(res.messages).toHaveLength(1)
    expect(res.messages[0]?.role).toBe('assistant')
    expect(res.messages[0]?.content).toBe('Hello!')
  })

  it('continues sampling when the provider reports endTurn=false', async () => {
    // Regression: Responses completed events with end_turn=false were treated
    // as final end_turn responses, so the agent stopped before the follow-up.
    // Fixed by: the runtime keeps the loop alive until endTurn is not false.
    const { agent, provider } = buildTestAgent({
      responses: [{ ...endTurnResponse('first'), endTurn: false }, endTurnResponse('final')],
    })

    const result = await agent.invoke('continue until done')

    expect(provider.calls).toHaveLength(2)
    expect(result.messages.map((message) => message.content)).toEqual(['first', 'final'])
  })

  it('single tool call: model → tool_use → result → end_turn', async () => {
    let callIndex = 0
    const { agent, registry } = buildTestAgent({
      handler: () => {
        callIndex++
        if (callIndex === 1) {
          return toolCallResponse('id1', 'echo', { text: 'ping' })
        }
        return endTurnResponse('done')
      },
    })
    registry.add(
      { name: 'echo', description: 'echo', inputSchema: testToolInputSchema, source: 'builtin' },
      async (input) => ({
        content: `echoed:${(input as { text: string }).text}`,
        isError: false,
      }),
    )
    const res = await agent.invoke('call echo')
    // assistant(tool_use), user(tool_result), assistant(end_turn)
    expect(res.messages).toHaveLength(3)
    expect(res.messages[0]?.role).toBe('assistant')
    expect(res.messages[1]?.role).toBe('user')
    expect(res.messages[2]?.role).toBe('assistant')
  })

  it('ends the turn after one successful returnDirect tool call', async () => {
    // Regression: report-style tools always triggered another model request after
    // their successful result, even when that result was the final visible output.
    // Fixed by: persist the tool result and end the loop when its descriptor opts in.
    let modelCalls = 0
    const { agent, provider, registry } = buildTestAgent({
      handler: () => {
        modelCalls++
        if (modelCalls === 1) {
          return toolCallResponse('report-1', 'task_report', { text: 'accepted' })
        }
        return endTurnResponse('this call must not happen')
      },
    })
    registry.add(
      {
        name: 'task_report',
        description: 'save a task report',
        inputSchema: testToolInputSchema,
        source: 'builtin',
        returnDirect: true,
      },
      async () => ({ content: 'accepted', isError: false }),
    )

    const response = await agent.invoke('report the task result')

    expect(provider.calls).toHaveLength(1)
    expect(response.messages).toHaveLength(2)
    expect(response.messages[0]?.role).toBe('assistant')
    expect(response.messages[1]?.role).toBe('user')
  })

  it('continues after a failed returnDirect tool call so the model can correct it', async () => {
    // Regression: a direct-return marker could end the loop after validation
    // errors, leaving the model no chance to repair the tool arguments.
    // Fixed by: only stop directly after a successful tool result.
    let modelCalls = 0
    const { agent, provider, registry } = buildTestAgent({
      handler: () => {
        modelCalls++
        if (modelCalls === 1) {
          return toolCallResponse('report-1', 'task_report', { text: 'invalid' })
        }
        return endTurnResponse('corrected')
      },
    })
    registry.add(
      {
        name: 'task_report',
        description: 'save a task report',
        inputSchema: testToolInputSchema,
        source: 'builtin',
        returnDirect: true,
      },
      async () => ({ content: 'fix the report input', isError: true }),
    )

    const response = await agent.invoke('report the task result')

    expect(provider.calls).toHaveLength(2)
    expect(response.messages.at(-1)?.content).toBe('corrected')
  })

  it('does not end directly when a response includes multiple tool calls', async () => {
    // Regression: a returnDirect tool could skip sibling tool calls from the
    // same provider response and leave unmatched tool_use blocks in history.
    // Fixed by: direct completion only applies to a single resolved tool call.
    let modelCalls = 0
    const { agent, provider, registry } = buildTestAgent({
      handler: () => {
        modelCalls++
        if (modelCalls === 1) {
          return chatResponse(
            {
              role: 'assistant',
              content: [
                toolUse('report-1', 'task_report', { text: 'accepted' }),
                toolUse('echo-1', 'echo', { text: 'done' }),
              ],
            },
            'tool_use',
          )
        }
        return endTurnResponse('completed')
      },
    })
    registry.add(
      {
        name: 'task_report',
        description: 'save a task report',
        inputSchema: testToolInputSchema,
        source: 'builtin',
        returnDirect: true,
      },
      async () => ({ content: 'accepted', isError: false }),
    )
    registry.add(
      {
        name: 'echo',
        description: 'echo',
        inputSchema: testToolInputSchema,
        source: 'builtin',
      },
      async () => ({ content: 'done', isError: false }),
    )

    const response = await agent.invoke('run both tools')

    expect(provider.calls).toHaveLength(2)
    expect(response.messages.at(-1)?.content).toBe('completed')
  })

  it('does not end directly when a report call accompanies an unresolvable tool', async () => {
    // Regression: after unknown tools were stripped, a sibling returnDirect
    // tool looked like a single-tool response and skipped the repair turn.
    // Fixed by: count the provider's original tool blocks before enabling direct completion.
    let modelCalls = 0
    const { agent, provider, registry } = buildTestAgent({
      handler: () => {
        modelCalls++
        if (modelCalls === 1) {
          return chatResponse(
            {
              role: 'assistant',
              content: [
                toolUse('report-1', 'task_report', { text: 'accepted' }),
                toolUse('unknown-1', 'provider_internal_tool', {}),
              ],
            },
            'tool_use',
          )
        }
        return endTurnResponse('completed')
      },
    })
    registry.add(
      {
        name: 'task_report',
        description: 'save a task report',
        inputSchema: testToolInputSchema,
        source: 'builtin',
        returnDirect: true,
      },
      async () => ({ content: 'accepted', isError: false }),
    )

    const response = await agent.invoke('run the report')

    expect(provider.calls).toHaveLength(2)
    expect(response.messages.at(-1)?.content).toBe('completed')
  })

  it('two sequential tool calls then end_turn', async () => {
    let n = 0
    const { agent, registry } = buildTestAgent({
      handler: () => {
        n++
        if (n === 1) {
          return toolCallResponse('id1', 'echo', { text: 'a' })
        }
        if (n === 2) {
          return toolCallResponse('id2', 'echo', { text: 'b' })
        }
        return endTurnResponse('all done')
      },
    })
    registry.add(
      { name: 'echo', description: 'echo', inputSchema: testToolInputSchema, source: 'builtin' },
      async (input) => ({
        content: (input as { text: string }).text,
        isError: false,
      }),
    )
    const res = await agent.invoke('call echo twice')
    // turn1: assistant(tool_use a), user(tool_result a)
    // turn2: assistant(tool_use b), user(tool_result b)
    // turn3: assistant(end_turn)
    expect(res.messages).toHaveLength(5)
  })

  it('passes the tool diff preview to invoke-mode approval', async () => {
    // Regression: AgentImpl.invoke requested approval without running
    // ToolDescriptor.previewFn, unlike HitlInterceptor.
    // Fixed by: using the same approval-request builder in every execution path.
    let request: ApprovalRequest | undefined
    let n = 0
    const hitl = new StrictHitlHandler(false, {
      resolver: (value) => {
        request = value
        return { decision: 'approve' }
      },
    })
    const { agent, registry } = buildTestAgent({
      hitl,
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
        previewFn: async () => 'preview diff',
      },
      async () => ({ content: 'ran', isError: false }),
    )

    await agent.invoke('test')

    expect(request?.diff).toBe('preview diff')
  })

  it('AbortSignal already aborted: invoke.abort hook fires and invoke completes', async () => {
    const ac = new AbortController()
    let abortFired = false
    const { agent } = buildTestAgent({
      responses: [endTurnResponse('done')],
      hooks: {
        invoke: {
          abort: () => {
            abortFired = true
          },
        },
      },
    })
    ac.abort()
    await agent.invoke('test', ac.signal)
    expect(abortFired).toBe(true)
  })

  it('trajectory has model_thought events', async () => {
    const { agent } = buildTestAgent({ responses: [endTurnResponse('hi')] })
    const res = await agent.invoke('test')
    expect(res.trajectory.some((e) => e.phase === 'model_thought')).toBe(true)
  })

  it('update_plan records its complete snapshot in the trajectory', async () => {
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

    const response = await agent.invoke('test')
    expect(response.trajectory).toContainEqual(
      expect.objectContaining({
        phase: 'plan_updated',
        data: { todos: [{ content: 'Inspect page', status: 'in_progress' }] },
      }),
    )
  })

  it('unknown tool is stripped — loop ends without tool_result (avoids provider 400)', async () => {
    // When the model calls a tool not in the registry (e.g. provider-internal tools
    // like DeepSeek built-ins), we strip the tool_use and treat the response as
    // end_turn rather than sending a tool_result that the provider would reject.
    let n = 0
    const { agent } = buildTestAgent({
      handler: () => {
        n++
        if (n === 1) {
          return toolCallResponse('id1', 'no_such_tool', {})
        }
        return endTurnResponse('done')
      },
    })
    const res = await agent.invoke('call unknown tool')
    // Only ONE model call — no second loop iteration after stripping
    expect(n).toBe(1)
    // No tool_result message in history
    const toolResultMsg = res.messages.find((m) => m.role === 'user' && Array.isArray(m.content))
    expect(toolResultMsg).toBeUndefined()
    // No unresolved tool_use blocks remain in the assistant message
    const assistantMsg = res.messages.find((m) => m.role === 'assistant')
    if (assistantMsg && Array.isArray(assistantMsg.content)) {
      const toolUseBlocks = (assistantMsg.content as Array<{ type: string }>).filter((b) => b.type === 'tool_use')
      expect(toolUseBlocks).toHaveLength(0)
    }
  })

  it('max_tokens with a partial tool call is stripped from history', async () => {
    // Regression: a truncated function_call was stored as assistant(tool_use)
    // with no following tool_result, corrupting the next provider request.
    const { agent } = buildTestAgent({
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

    const res = await agent.invoke('write a large file')
    expect(res.messages).toHaveLength(1)
    const assistantMsg = res.messages[0]
    expect(assistantMsg?.role).toBe('assistant')
    expect(assistantMsg?.transcriptItems?.some((item) => item.type === 'tool_call')).toBe(false)
    expect(
      Array.isArray(assistantMsg?.content) ? assistantMsg.content.some((block) => block.type === 'tool_use') : false,
    ).toBe(false)
    expect(res.messages.some((message) => message.role === 'user' && Array.isArray(message.content))).toBe(false)
  })
})
