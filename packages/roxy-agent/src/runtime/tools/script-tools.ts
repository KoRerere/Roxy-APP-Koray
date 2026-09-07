import type { RunScriptToolOptions } from './roxy_script_run'
import type { ToolAnnotations, ToolContext, ToolDefinition, ToolHandler, ToolRegistry } from 'roxy-agent-runtime'
import type { z } from 'zod'
import { defineTool } from 'roxy-agent-runtime'
import { checkWindowScope, formatWindowScopeViolation } from '@/core/profiles/profileScheduler'
import { getScriptSelfDescriptionTool } from './roxy_script_describe'
import { createRunScriptTool } from './roxy_script_run'

export type RuntimeScriptToolOptions = Pick<RunScriptToolOptions, 'ephemeral' | 'workspaceDir' | 'fileCollector' | 'taskMonitorTaskId' | 'executionId'> & {
  /** Bind script execution to one browser profile (used by ephemeral workers). */
  allowedDirId?: string
  /** Bind script execution to multiple browser profiles (used by general-purpose agents). */
  allowedDirIds?: readonly string[]
  onBrowserLaunched?: (dirId: string) => void
}

interface ScriptTool<TSchema extends z.ZodType> {
  name: string
  description?: string
  schema: TSchema
  invoke: (input: z.infer<TSchema>, config: Record<string, unknown>) => Promise<unknown>
}

export function createScriptToolInvokeConfig(ctx: ToolContext): Record<string, unknown> {
  return {
    ...(ctx.metadata ?? {}),
    signal: ctx.signal,
    toolCall: { id: ctx.toolUseId },
  }
}

function adaptScriptTool<TSchema extends z.ZodType>(
  tool: ScriptTool<TSchema>,
  annotations?: ToolAnnotations,
): ToolDefinition {
  return defineTool({
    name: tool.name,
    description: tool.description ?? tool.name,
    inputSchema: tool.schema,
    source: 'builtin',
    annotations,
    handler: async (input, ctx) => {
      try {
        const result = await tool.invoke(input, createScriptToolInvokeConfig(ctx))
        return { content: typeof result === 'string' ? result : JSON.stringify(result ?? ''), isError: false }
      }
      catch (error) {
        return { content: error instanceof Error ? error.message : String(error), isError: true }
      }
    },
  })
}

export function runtimeScriptRunOptions(options: RuntimeScriptToolOptions): RunScriptToolOptions {
  return {
    ephemeral: options.ephemeral,
    workspaceDir: options.workspaceDir,
    fileCollector: options.fileCollector,
    taskMonitorTaskId: options.taskMonitorTaskId,
    executionId: options.executionId,
    onBrowserLaunched: options.onBrowserLaunched,
  }
}

/** Register app-specific script tools for the framework-owned runtime agent. */
export function registerRuntimeScriptTools(
  registry: ToolRegistry,
  options: RuntimeScriptToolOptions,
): void {
  const scriptDescription = adaptScriptTool(getScriptSelfDescriptionTool, { readOnlyHint: true, openWorldHint: false })
  registry.add(scriptDescription.descriptor, scriptDescription.handler)
  const runScriptTool = createRunScriptTool(runtimeScriptRunOptions(options))
  const runScript = adaptScriptTool(runScriptTool, {
    readOnlyHint: true,
    openWorldHint: false,
  })
  const allowedDirIds = options.allowedDirIds?.length
    ? new Set(options.allowedDirIds)
    : options.allowedDirId ? new Set([options.allowedDirId]) : undefined
  const runScriptHandler = allowedDirIds
    ? async (input: unknown, ctx: Parameters<ToolHandler>[1]) => {
      const violation = checkWindowScope('roxy_script_run', input, allowedDirIds)
      if (violation) {
        return { content: formatWindowScopeViolation(violation), isError: true }
      }
      return runScript.handler(input, ctx)
    }
    : runScript.handler
  registry.add(runScript.descriptor, runScriptHandler)
}
