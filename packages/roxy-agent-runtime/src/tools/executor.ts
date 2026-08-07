import type { IToolRegistry, ToolContext, ToolExecutor as IToolExecutor, ToolResult } from "../core/interfaces.ts";

/**
 * Sandboxed tool executor. Each tool runs inside a try/catch; thrown errors
 * become `ToolResult{ isError: true }` so a single failure never crashes the
 * agent loop. AbortSignal is checked before surfacing handler errors.
 */
export class ToolExecutor implements IToolExecutor {
  constructor(private readonly registry: IToolRegistry) {}

  async execute(name: string, input: unknown, ctx: ToolContext, toolUseId: string): Promise<ToolResult> {
    const entry = this.registry.resolve(name);
    if (!entry) {
      return { toolUseId, content: `tool not found: ${name}`, isError: true };
    }
    try {
      const r = await entry.handler(input, { ...ctx, toolUseId });
      return { ...r, toolUseId };
    } catch (err) {
      if (ctx.signal.aborted) {
        return { toolUseId, content: "aborted", isError: true };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { toolUseId, content: message, isError: true };
    }
  }
}
