import { z } from 'zod'
import { agentPathSchema, ROOT_AGENT_PATH } from '../../core/contracts/agent-manager.ts'
import type { ToolDefinition } from '../../core/interfaces.ts'
import { defineTool } from '../schema.ts'

export const listAgentsInputSchema = z.strictObject({
  path_prefix: agentPathSchema.optional().default(ROOT_AGENT_PATH),
})

/**
 * Read a stable snapshot of the agent tree at or under `path_prefix` (default
 * `/root`). Non-blocking. Does not return the original spawn `message`.
 */
export function listAgentsTool(): ToolDefinition {
  return defineTool({
    name: 'list_agents',
    description:
      'List the status of the agent tree at or under path_prefix (default /root). ' +
      'Returns path, parent, name, agent_type, status, and final report/error per node.',
    inputSchema: listAgentsInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (input, ctx) => {
      if (!ctx.agentManager) {
        return { content: 'list_agents: no agent manager available', isError: true }
      }
      const nodes = ctx.agentManager.list(input.path_prefix)
      return { content: JSON.stringify(nodes, null, 2), isError: false }
    },
  })
}
