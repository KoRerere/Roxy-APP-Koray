import { describe, expect, it } from 'vitest'
import { DelegateHitlHandler } from '../../src/hitl/handler.ts'
import type { ToolDescriptor } from '../../src/core/interfaces.ts'
import { testToolInputSchema } from '../helpers/toolSchema.ts'

function tool(name: string, sensitive: boolean): ToolDescriptor {
  return {
    name,
    description: name,
    inputSchema: testToolInputSchema,
    source: 'builtin',
    annotations: sensitive
      ? { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
      : { readOnlyHint: true, openWorldHint: false },
  }
}

function mcpTool(name: string, annotations: ToolDescriptor['annotations']): ToolDescriptor {
  return { name, description: name, inputSchema: testToolInputSchema, source: 'mcp', annotations }
}

describe('DelegateHitlHandler', () => {
  it('mode is delegate', () => {
    expect(new DelegateHitlHandler().mode).toBe('delegate')
  })

  it('annotations that indicate destructive behavior require approval regardless of rules', () => {
    const h = new DelegateHitlHandler()
    expect(h.needsApproval(tool('apply_patch', true))).toBe(true)
  })

  it('read-only closed-world tool with no matching rules does NOT require approval', () => {
    const h = new DelegateHitlHandler()
    expect(h.needsApproval(tool('ls', false))).toBe(false)
  })

  it('glob rule sensitive:true marks matched tool as requiring approval', () => {
    const h = new DelegateHitlHandler([{ match: 'apply_*', sensitive: true }])
    expect(h.needsApproval(tool('apply_patch', false))).toBe(true)
    expect(h.needsApproval(tool('apply_template', false))).toBe(true)
  })

  it('glob rule sensitive:false exempts even tools that annotations would gate', () => {
    const h = new DelegateHitlHandler([{ match: 'ls', sensitive: false }])
    // Override: the rule explicitly marks ls as NOT requiring approval
    expect(h.needsApproval(tool('ls', true))).toBe(false)
  })

  it('unmatched read-only closed-world tool is not flagged', () => {
    const h = new DelegateHitlHandler([{ match: 'exec_command', sensitive: true }])
    expect(h.needsApproval(tool('ls', false))).toBe(false)
  })

  it('uses MCP annotations for remote tools', () => {
    // Regression: MCP tools/list annotations were dropped and every MCP tool
    // bypassed HITL even when it advertised destructive or open-world behavior.
    // Fixed by: preserving standard annotations and deriving approval policy from them.
    const h = new DelegateHitlHandler()
    expect(h.needsApproval(mcpTool('mcp_shop__delete_order', { readOnlyHint: false, destructiveHint: true }))).toBe(
      true,
    )
    expect(h.needsApproval(mcpTool('mcp_search__web', { readOnlyHint: true, openWorldHint: true }))).toBe(true)
    expect(h.needsApproval(mcpTool('mcp_notes__list', { readOnlyHint: true, openWorldHint: false }))).toBe(false)
  })

  it('allows MCP tools with no annotations', () => {
    const h = new DelegateHitlHandler()
    expect(h.needsApproval(mcpTool('mcp_unknown__tool', undefined))).toBe(false)
    expect(h.needsApproval(mcpTool('mcp_unknown__empty', {}))).toBe(false)
    expect(h.needsApproval(mcpTool('mcp_unknown__partial', { readOnlyHint: true }))).toBe(true)
    expect(h.needsApproval(mcpTool('mcp_unknown__closed', { destructiveHint: false, openWorldHint: false }))).toBe(
      false,
    )
  })

  it('exact name rule matches only that tool', () => {
    const h = new DelegateHitlHandler([{ match: 'exec_command', sensitive: true }])
    expect(h.needsApproval(tool('exec_command', false))).toBe(true)
    expect(h.needsApproval(tool('exec_command_bg', false))).toBe(false)
  })

  it('resolver-based approval works', async () => {
    const h = new DelegateHitlHandler([], {
      resolver: (req) =>
        req.toolName === 'exec_command' ? { decision: 'reject', feedback: 'no shell' } : { decision: 'approve' },
    })
    const r = await h.requestApproval({ toolName: 'exec_command', input: {}, reason: 'r', traceId: 't' })
    expect(r.decision).toBe('reject')
    expect(r.feedback).toBe('no shell')
  })
})
