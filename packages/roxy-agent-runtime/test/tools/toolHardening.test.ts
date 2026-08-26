import { describe, expect, it } from 'vitest'
import { execCommandTool } from '../../src/tools/builtin/exec_command.ts'
import type { ToolContext } from '../../src/core/interfaces.ts'

const ctx: ToolContext = { agentId: 'a', traceId: 't', signal: new AbortController().signal }

describe('exec_command exit code status', () => {
  it('reports success status for exit 0', async () => {
    const tool = execCommandTool()
    const r = await tool.handler({ cmd: 'true' }, ctx)
    expect(r.isError).toBe(false)
    expect(r.content).toContain('Process exited with code 0')
  })

  it('reports non-zero process exit without marking the tool result as an error', async () => {
    const tool = execCommandTool()
    const r = await tool.handler({ cmd: 'false' }, ctx)
    expect(r.isError).toBe(false)
    expect(r.content).toContain('Process exited with code 1')
  })
})
