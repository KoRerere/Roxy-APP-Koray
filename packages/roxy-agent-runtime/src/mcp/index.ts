import type { IToolRegistry } from '../core/interfaces.ts'
import { McpServerRegistry } from './registry.ts'

export { McpClient } from './client.ts'
export { McpServerRegistry } from './registry.ts'
export { mcpToolName, mcpToolNamePrefix } from './tool-name.ts'

/**
 * Merge all tools from a loaded {@link McpServerRegistry} into an
 * {@link IToolRegistry}, wiring each tool's handler back to the registry's
 * callTool dispatcher. The caller owns the registry lifecycle.
 */
export async function mergeMcpToolsInto(toolRegistry: IToolRegistry, mcpRegistry: McpServerRegistry): Promise<void> {
  for (const descriptor of mcpRegistry.tools()) {
    const name = descriptor.name
    toolRegistry.add(descriptor, (input, ctx) => mcpRegistry.callTool(name, input, ctx, ctx.toolUseId ?? ctx.traceId))
  }
}
