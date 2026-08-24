import { describe, expect, it, vi } from 'vitest'
import type { ToolContext, ToolDescriptor, ToolHandlerResult } from '../../src/core/interfaces.ts'
import { ToolRegistry } from '../../src/tools/registry.ts'
import { MiniToolExecutor, MiniToolRegistry } from '../helpers/miniToolRegistry.ts'
import { testToolInputSchema } from '../helpers/toolSchema.ts'
import { z } from 'zod'

/**
 * CONTRACT tests for the tool registry + executor.
 *
 * These run against the minimal reference impl (test/helpers/miniToolRegistry).
 * The production impl (src/tools/{registry,executor}.ts) MUST satisfy the same
 * observable behavior. When the production impl lands, swap the helper for the
 * real classes in a duplicated suite; these assertions are the gate.
 */

function ctxOf(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    agentId: 'agent-1',
    traceId: 'trace-1',
    signal: new AbortController().signal,
    ...overrides,
  }
}

function desc(name: string, sensitive = false): ToolDescriptor {
  return {
    name,
    description: `${name} tool`,
    inputSchema: testToolInputSchema,
    source: 'builtin',
    annotations: sensitive
      ? { readOnlyHint: false, destructiveHint: true, openWorldHint: true }
      : { readOnlyHint: true, openWorldHint: false },
  }
}

describe('tool registry contract', () => {
  it('adds, resolves, and lists tools', () => {
    const reg = new MiniToolRegistry()
    reg.add(desc('ls'), async () => ({ content: 'x', isError: false }))
    reg.add(desc('grep'), async () => ({ content: 'y', isError: false }))

    expect(reg.resolve('ls')).toBeDefined()
    expect(reg.resolve('nope')).toBeUndefined()
    expect(
      reg
        .all()
        .map((d) => d.name)
        .toSorted(),
    ).toEqual(['grep', 'ls'])
  })

  it('removes a tool', () => {
    const reg = new MiniToolRegistry()
    reg.add(desc('ls'), async () => ({ content: 'x', isError: false }))
    reg.remove('ls')
    expect(reg.resolve('ls')).toBeUndefined()
  })

  it('collides on short name → overwrites + warns', () => {
    const warn = vi.fn()
    const reg = new MiniToolRegistry(warn)
    reg.add(desc('ls'), async () => ({ content: 'first', isError: false }))
    reg.add(desc('ls'), async () => ({ content: 'second', isError: false }))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('collision'))
    expect(reg.all()).toHaveLength(1)
  })

  it('toAnthropicTools projects to { name, description, input_schema }', () => {
    const reg = new MiniToolRegistry()
    reg.add(desc('ls'), async () => ({ content: '', isError: false }))
    const projected = reg.toAnthropicTools()
    expect(projected).toEqual([
      {
        name: 'ls',
        description: 'ls tool',
        input_schema: { type: 'object', properties: {}, additionalProperties: {} },
      },
    ])
    expect(projected[0]).not.toHaveProperty('inputSchema')
  })

  it('does not expose apply_patch to Anthropic providers', () => {
    const reg = new ToolRegistry({ onWarn: vi.fn() })
    reg.add(desc('ls'), async () => ({ content: '', isError: false }))
    reg.add(
      {
        name: 'apply_patch',
        description: 'Apply a V4A patch.',
        kind: 'custom',
        inputSchema: z.string(),
        source: 'builtin',
      },
      async () => ({ content: '', isError: false }),
    )

    expect(reg.toAnthropicTools()).not.toContainEqual(expect.objectContaining({ name: 'apply_patch' }))
  })
})

describe('tool executor contract', () => {
  it('returns isError result for an unknown tool name (never throws)', async () => {
    const reg = new MiniToolRegistry()
    const exe = new MiniToolExecutor(reg)
    const r = await exe.execute('ghost', {}, ctxOf(), 'tu-1')
    expect(r).toEqual({
      toolUseId: 'tu-1',
      content: 'tool not found: ghost',
      isError: true,
      errorKind: 'not_found',
    })
  })

  it('converts a thrown handler error into an isError result', async () => {
    const reg = new MiniToolRegistry()
    reg.add(desc('boom'), async (): Promise<ToolHandlerResult> => {
      throw new Error('kaboom')
    })
    const exe = new MiniToolExecutor(reg)
    const r = await exe.execute('boom', {}, ctxOf(), 'tu-2')
    expect(r.isError).toBe(true)
    expect(r.content).toBe('kaboom')
    expect(r.toolUseId).toBe('tu-2')
    expect(r.errorKind).toBe('handler_error')
  })

  it("passes through a handler's success result, stamped with toolUseId", async () => {
    const reg = new MiniToolRegistry()
    reg.add(desc('ok'), async () => ({ content: 'payload', isError: false }))
    const exe = new MiniToolExecutor(reg)
    const r = await exe.execute('ok', { a: 1 }, ctxOf(), 'tu-3')
    expect(r).toEqual({
      toolUseId: 'tu-3',
      content: 'payload',
      isError: false,
    })
  })

  it("surfaces 'aborted' when the signal is aborted and the handler throws", async () => {
    const ac = new AbortController()
    const reg = new MiniToolRegistry()
    reg.add(desc('slow'), async (): Promise<ToolHandlerResult> => {
      ac.abort()
      throw new Error('interrupted')
    })
    const exe = new MiniToolExecutor(reg)
    const r = await exe.execute('slow', {}, ctxOf({ signal: ac.signal }), 'tu-4')
    expect(r).toEqual({ toolUseId: 'tu-4', content: 'aborted', isError: true, errorKind: 'aborted' })
  })
})
