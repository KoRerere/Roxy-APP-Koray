import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ToolContext, ToolHandlerResult } from '../../src/core/interfaces.ts'
import { ToolExecutor } from '../../src/tools/executor.ts'
import { ToolRegistry } from '../../src/tools/registry.ts'
import { defineTool } from '../../src/tools/schema.ts'
import { testToolInputSchema } from '../helpers/toolSchema.ts'

function ctx(): ToolContext {
  return { agentId: 'a', traceId: 't', signal: new AbortController().signal }
}

describe('ToolExecutor (production)', () => {
  it('validates input with zod and does not call the handler when input is invalid', async () => {
    // Regression: ToolDescriptor only carried JSON Schema for model description,
    // so invalid model input reached every handler and each tool reimplemented validation.
    // Fixed by: validating the descriptor's Zod schema centrally before dispatch.
    const registry = new ToolRegistry()
    let handlerCalled = false
    registry.add(
      {
        name: 'validated',
        description: 'validated',
        inputSchema: z.strictObject({ name: z.string().min(1) }),
        source: 'builtin',
      },
      async () => {
        handlerCalled = true
        return { content: 'unexpected', isError: false }
      },
    )

    const executor = new ToolExecutor(registry)
    const result = await executor.execute('validated', { name: '', extra: true }, ctx(), 'invalid_call')

    expect(handlerCalled).toBe(false)
    expect(result.isError).toBe(true)
    expect(result.errorKind).toBe('input_invalid')
    expect(result.content).toContain('validated')
  })

  it('passes parsed defaults from the zod schema to the handler', async () => {
    // Regression: handlers received the model's raw unknown input, so schema
    // defaults and transforms were never applied during normal tool execution.
    // Fixed by: dispatching safeParse().data instead of the original input.
    const registry = new ToolRegistry()
    let received: unknown
    registry.add(
      {
        name: 'with_default',
        description: 'with default',
        inputSchema: z.strictObject({ retries: z.number().int().positive().default(3) }),
        source: 'builtin',
      },
      async (input) => {
        received = input
        return { content: 'ok', isError: false }
      },
    )

    const executor = new ToolExecutor(registry)
    const result = await executor.execute('with_default', {}, ctx(), 'default_call')

    expect(result.isError).toBe(false)
    expect(received).toEqual({ retries: 3 })
  })

  it('applies zod transforms exactly once for defineTool handlers', async () => {
    const registry = new ToolRegistry()
    const tool = defineTool({
      name: 'transform_once',
      description: 'transform once',
      inputSchema: z.strictObject({ value: z.number().transform((value) => value + 1) }),
      source: 'builtin',
      handler: async (input) => ({ content: String(input.value), isError: false }),
    })
    registry.add(tool.descriptor, tool.handler)

    const executor = new ToolExecutor(registry)
    const result = await executor.execute('transform_once', { value: 1 }, ctx(), 'transform_call')

    expect(result.content).toBe('2')
  })

  it('passes the concrete toolUseId to the registered handler context', async () => {
    // Regression: ToolHandler only received the turn traceId, so host adapters
    // could not correlate an MCP call with the model's tool_use block.
    // Fixed by: ToolExecutor derives a per-call context containing toolUseId.
    const registry = new ToolRegistry()
    let received: string | undefined
    registry.add(
      { name: 'mcp_tool', description: 'mcp', inputSchema: testToolInputSchema, source: 'mcp' },
      async (_input, context) => {
        received = context.toolUseId
        return { content: 'ok', isError: false }
      },
    )

    const executor = new ToolExecutor(registry)
    await executor.execute('mcp_tool', {}, ctx(), 'block_id_abc')

    expect(received).toBe('block_id_abc')
  })

  it('toolUseId from execute() arg always wins over extra toolUseId returned by handler', async () => {
    // Regression: executor did `return { toolUseId, ...r }`.
    // MCP handlers (App.tsx) return a ToolResult that carries toolUseId: ''
    // (the default, since ToolHandler only takes 2 args and the MCP callTool
    // always populates toolUseId on its return value).
    // The spread `{ toolUseId: block_id, ...r }` was overridden by r.toolUseId = '',
    // producing tool_result.tool_use_id = '' != tool_use.id → provider 400.
    // Fixed by: `{ ...r, toolUseId }` so the execute() arg is last and always wins.
    const registry = new ToolRegistry()
    registry.add(
      { name: 'mcp_tool', description: 'simulated MCP tool', inputSchema: testToolInputSchema, source: 'mcp' },
      async (_input: unknown, _ctx: ToolContext) => {
        // Simulate what App.tsx MCP handler returns: a ToolResult object
        // (structural superset of ToolHandlerResult) with toolUseId: ''.
        const result = { toolUseId: '', content: 'workspace list', isError: false }
        return result as unknown as ToolHandlerResult
      },
    )

    const executor = new ToolExecutor(registry)
    const result = await executor.execute('mcp_tool', {}, ctx(), 'block_id_abc')

    // Must equal the toolUseId passed to execute(), never the empty string from the handler.
    expect(result.toolUseId).toBe('block_id_abc')
  })

  it('stamps toolUseId from execute() arg when handler returns plain ToolHandlerResult', async () => {
    // Sanity: when a handler returns only { content, isError } (no toolUseId
    // field at all), the executor still stamps the correct toolUseId.
    const registry = new ToolRegistry()
    registry.add(
      { name: 'plain', description: 'plain', inputSchema: testToolInputSchema, source: 'builtin' },
      async () => ({
        content: 'ok',
        isError: false,
      }),
    )
    const executor = new ToolExecutor(registry)
    const result = await executor.execute('plain', {}, ctx(), 'call_xyz_999')
    expect(result.toolUseId).toBe('call_xyz_999')
    expect(result.content).toBe('ok')
    expect(result.isError).toBe(false)
  })
})
