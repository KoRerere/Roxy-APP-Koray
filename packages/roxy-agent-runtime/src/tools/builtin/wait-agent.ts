import { z } from 'zod'
import type { ToolDefinition } from '../../core/interfaces.ts'
import { defineTool } from '../schema.ts'

export const waitAgentInputSchema = z.strictObject({
  timeout_ms: z.number().int().positive().optional(),
})

/**
 * Wait for all descendants of the calling agent to reach a terminal state,
 * including descendants created during the wait. `timeout_ms` only bounds this
 * call - it returns the current snapshot without cancelling any agent.
 */
export function waitAgentTool(): ToolDefinition {
  return defineTool({
    name: 'wait_agent',
    description:
      'Wait for all descendant agents to finish, then return their final status and reports. ' +
      'timeout_ms only bounds this call; it never cancels agents. Omit to wait indefinitely.',
    inputSchema: waitAgentInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (input, ctx) => {
      if (!ctx.agentManager || !ctx.agentPath) {
        return { content: 'wait_agent: no agent manager available', isError: true }
      }
      try {
        const result = await ctx.agentManager.wait(ctx.agentPath, input.timeout_ms, ctx.signal)
        return { content: JSON.stringify(result, null, 2), isError: false }
      } catch (err) {
        return {
          content: `wait_agent: ${err instanceof Error ? err.message : String(err)}`,
          isError: true,
        }
      }
    },
  })
}
