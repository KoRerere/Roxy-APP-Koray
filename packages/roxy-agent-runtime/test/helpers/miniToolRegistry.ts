import type {
  AnthropicTool,
  IToolRegistry,
  ToolContext,
  ToolDescriptor,
  ToolExecutor,
  ToolHandler,
  ToolHandlerResult,
  ToolResult,
} from '../../src/core/interfaces.ts'
import { formatToolInputError, zodToJsonSchema } from '../../src/tools/schema.ts'

/**
 * MINIMAL reference implementation of {@link IToolRegistry} + {@link ToolExecutor}
 * that satisfies the documented contracts.
 *
 * This is NOT the production implementation (that lives in src/tools/**). It
 * exists so contract tests pin the *observed behavior* with runnable code: any
 * future production impl must pass these same assertions. If the production
 * impl and this reference diverge, the contract (in src/core/interfaces.ts) is
 * the source of truth and one of them is wrong.
 */

type Entry = { descriptor: ToolDescriptor; handler: ToolHandler }

export class MiniToolRegistry implements IToolRegistry {
  private tools = new Map<string, Entry>()
  private readonly onWarn?: (msg: string) => void

  constructor(onWarn?: (msg: string) => void) {
    this.onWarn = onWarn
  }

  add(descriptor: ToolDescriptor, handler: ToolHandler): void {
    if (this.tools.has(descriptor.name)) {
      this.onWarn?.(`tool name collision: ${descriptor.name} (overwriting)`)
    }
    this.tools.set(descriptor.name, { descriptor, handler })
  }

  remove(name: string): void {
    this.tools.delete(name)
  }

  resolve(name: string): Entry | undefined {
    return this.tools.get(name)
  }

  all(): ToolDescriptor[] {
    return [...this.tools.values()].map((e) => e.descriptor)
  }

  toAnthropicTools(): AnthropicTool[] {
    return this.all()
      .filter((descriptor) => descriptor.kind !== 'custom')
      .map((d) => ({
        name: d.name,
        description: d.description,
        input_schema: zodToJsonSchema(d.inputSchema),
      }))
  }
}

export class MiniToolExecutor implements ToolExecutor {
  constructor(private readonly registry: IToolRegistry) {}

  async execute(name: string, input: unknown, ctx: ToolContext, toolUseId: string): Promise<ToolResult> {
    const entry = this.registry.resolve(name)
    if (!entry) {
      return { toolUseId, content: `tool not found: ${name}`, isError: true, errorKind: 'not_found' }
    }
    const parsed = await entry.descriptor.inputSchema.safeParseAsync(input)
    if (!parsed.success) {
      return {
        toolUseId,
        content: formatToolInputError(name, parsed.error),
        isError: true,
        errorKind: 'input_invalid',
      }
    }
    try {
      const r: ToolHandlerResult = await entry.handler(parsed.data, ctx)
      return {
        ...r,
        toolUseId,
        ...(r.isError ? { errorKind: r.errorKind ?? 'handler_error' } : {}),
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
