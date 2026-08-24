import { z } from 'zod'
import { agentNameSchema } from '../../core/contracts/agent-manager.ts'
import type { SubAgentSpec, ToolDefinition } from '../../core/interfaces.ts'
import { AgentManagerError } from '../../subagent/agent-manager.ts'
import { defineTool } from '../schema.ts'

export const spawnAgentInputSchema = z.strictObject({
  agent_type: z.string().trim().min(1),
  name: agentNameSchema,
  message: z.string().trim().min(1),
  dirIds: z.array(z.string().trim().min(1)).default([]),
})

export interface SpawnAgentToolDeps {
  /** Advertised in the tool description so the model knows which agent_type values are valid. */
  specs: SubAgentSpec[]
}

/**
 * Start an independent subagent in the background and return its path
 * immediately. The child's status and final report are read via `list_agents`
 * and `wait_agent`; this tool never blocks on the child finishing.
 */
export function spawnAgentTool(deps: SpawnAgentToolDeps): ToolDefinition {
  const catalog = deps.specs.map((s) => `- ${s.agentType}: ${s.description}`).join('\n')
  return defineTool({
    name: 'spawn_agent',
    description:
      'Start an independent subagent in the background and return immediately. ' +
      'Use it proactively when work can run in parallel, then continue other work and call wait_agent once to collect results. ' +
      'Provide a complete self-contained message and optionally restrict browser profile ids with dirIds. ' +
      'Available agent_type values:\n' +
      catalog,
    inputSchema: spawnAgentInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    handler: async (input, ctx) => {
      if (!ctx.agentManager || !ctx.agentPath) {
        return {
          content: 'spawn_agent: no agent manager available (this agent has no tree identity)',
          isError: true,
        }
      }
      try {
        const receipt = await ctx.agentManager.spawn({
          parentPath: ctx.agentPath,
          agentType: input.agent_type,
          name: input.name,
          message: input.message,
          dirIds: input.dirIds,
          callerSignal: ctx.signal,
        })
        return { content: JSON.stringify(receipt), isError: false }
      } catch (err) {
        if (err instanceof AgentManagerError) {
          return {
            content: JSON.stringify({
              error: {
                code: err.code,
                message: err.message,
                ...(err.active !== undefined ? { active: err.active } : {}),
                ...(err.limit !== undefined ? { limit: err.limit } : {}),
              },
            }),
            isError: true,
            errorKind: 'handler_error',
          }
        }
        return {
          content: `spawn_agent: ${err instanceof Error ? err.message : String(err)}`,
          isError: true,
          errorKind: 'handler_error',
        }
      }
    },
  })
}
