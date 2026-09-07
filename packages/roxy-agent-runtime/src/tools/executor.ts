import type { IToolRegistry, ToolContext, ToolExecutor as IToolExecutor, ToolResult } from '../core/interfaces.ts'
import { parseToolInput, unwrapDefinedToolHandler } from './schema.ts'

/**
 * Sandboxed tool executor. Each tool runs inside a try/catch; thrown errors
 * become `ToolResult{ isError: true }` so a single failure never crashes the
 * agent loop. AbortSignal is checked before surfacing handler errors.
 */
export class ToolExecutor implements IToolExecutor {
  constructor(private readonly registry: IToolRegistry) {}

  async execute(name: string, input: unknown, ctx: ToolContext, toolUseId: string): Promise<ToolResult> {
    const entry = this.registry.resolve(name)
    if (!entry) {
      return { toolUseId, content: `tool not found: ${name}`, isError: true, errorKind: 'not_found' }
    }

    const parsed = await parseToolInput(entry.descriptor.inputSchema, input, name, entry.descriptor.formatInputError)
    if (!parsed.success) {
      return {
        toolUseId,
        content: parsed.content,
        isError: true,
        errorKind: 'input_invalid',
      }
    }

    try {
      const result = await unwrapDefinedToolHandler(entry.handler)(parsed.data, { ...ctx, toolUseId })
      return {
        ...result,
        toolUseId,
        ...(result.isError ? { errorKind: result.errorKind ?? 'handler_error' } : {}),
      }
    } catch (err) {
      if (ctx.signal.aborted) {
        return { toolUseId, content: 'aborted', isError: true, errorKind: 'aborted' }
      }
      const message = err instanceof Error ? err.message : String(err)
      return { toolUseId, content: message, isError: true, errorKind: 'handler_error' }
    }
  }
}
