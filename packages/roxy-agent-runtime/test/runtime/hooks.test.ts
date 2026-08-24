import { describe, expect, it } from 'vitest'
import { buildTestAgent, endTurnResponse, toolCallResponse } from '../helpers/buildTestAgent.ts'
import type { InvokeAfterContext, ModelBeforeContext, ToolAfterContext } from '../../src/core/interfaces.ts'
import { testToolInputSchema } from '../helpers/toolSchema.ts'

describe('lifecycle hooks', () => {
  it('invoke.before fires before the first model call', async () => {
    const fired: string[] = []
    const { agent, provider } = buildTestAgent({
      responses: [endTurnResponse('hi')],
      hooks: {
        invoke: {
          before: () => {
            fired.push(`before:${provider.calls.length}`)
          },
        },
      },
    })
    await agent.invoke('test')
    // before fires with 0 model calls so far
    expect(fired[0]).toBe('before:0')
  })

  it('invoke.after carries totalModelCalls and totalToolCalls', async () => {
    let afterCtx: InvokeAfterContext | undefined
    let n = 0
    const { agent, registry } = buildTestAgent({
      handler: () => {
        n++
        if (n === 1) {
          return toolCallResponse('id1', 'echo', {})
        }
        return endTurnResponse('done')
      },
      hooks: {
        invoke: {
          after: (ctx) => {
            afterCtx = ctx
          },
        },
      },
    })
    registry.add(
      { name: 'echo', description: 'echo', inputSchema: testToolInputSchema, source: 'builtin' },
      async () => ({
        content: 'ok',
        isError: false,
      }),
    )
    await agent.invoke('test')
    expect(afterCtx?.totalModelCalls).toBe(2)
    expect(afterCtx?.totalToolCalls).toBe(1)
  })

  it('model.before fires for each model call with callIndex', async () => {
    const contexts: ModelBeforeContext[] = []
    let n = 0
    const { agent, registry } = buildTestAgent({
      handler: () => {
        n++
        if (n === 1) {
          return toolCallResponse('id1', 'echo', {})
        }
        return endTurnResponse('done')
      },
      hooks: { model: { before: (ctx) => contexts.push(ctx) } },
    })
    registry.add(
      { name: 'echo', description: 'echo', inputSchema: testToolInputSchema, source: 'builtin' },
      async () => ({
        content: 'ok',
        isError: false,
      }),
    )
    await agent.invoke('test')
    expect(contexts).toHaveLength(2)
    expect(contexts[0]?.callIndex).toBe(0)
    expect(contexts[1]?.callIndex).toBe(1)
  })

  it('tool.after isError=false for successful tool, true for error tool', async () => {
    const afterCtxs: ToolAfterContext[] = []
    let n = 0
    const { agent, registry } = buildTestAgent({
      handler: () => {
        n++
        if (n === 1) {
          return toolCallResponse('id1', 'ok_tool', {})
        }
        if (n === 2) {
          return toolCallResponse('id2', 'err_tool', {})
        }
        return endTurnResponse('done')
      },
      hooks: { tool: { after: (ctx) => afterCtxs.push(ctx) } },
    })
    registry.add(
      { name: 'ok_tool', description: 'ok', inputSchema: testToolInputSchema, source: 'builtin' },
      async () => ({
        content: 'ok',
        isError: false,
      }),
    )
    registry.add(
      { name: 'err_tool', description: 'err', inputSchema: testToolInputSchema, source: 'builtin' },
      async () => ({
        content: 'fail',
        isError: true,
      }),
    )
    await agent.invoke('test')
    expect(afterCtxs.find((c) => c.toolName === 'ok_tool')?.isError).toBe(false)
    expect(afterCtxs.find((c) => c.toolName === 'err_tool')?.isError).toBe(true)
  })
})
