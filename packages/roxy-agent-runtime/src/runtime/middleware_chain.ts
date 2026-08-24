import type { ToolMiddleware, ToolMiddlewareContext, ToolResult } from '../core/interfaces.ts'

/** Convert a glob string (only `*` wildcard) to a RegExp. */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`)
}

function matches(mw: ToolMiddleware, toolName: string): boolean {
  if (!mw.match) {
    return true
  }
  if (mw.match instanceof RegExp) {
    return mw.match.test(toolName)
  }
  return globToRegex(mw.match).test(toolName)
}

export type BeforeResult = { aborted: false; input: unknown } | { aborted: true; error: Error }

/** Run side-effect-free input normalization used only for approval previews. */
export async function runPreviewMiddleware(
  middlewares: ToolMiddleware[],
  toolName: string,
  input: unknown,
  ctx: ToolMiddlewareContext,
): Promise<BeforeResult> {
  let current = input
  for (const mw of middlewares) {
    if (!matches(mw, toolName) || !mw.preview) {
      continue
    }
    try {
      current = await mw.preview(current, ctx)
    } catch (err) {
      return {
        aborted: true,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }
  return { aborted: false, input: current }
}

/**
 * Run `before()` on each matching middleware in registration order.
 * The first throw aborts the chain and returns `{ aborted: true }`.
 */
export async function runBeforeMiddleware(
  middlewares: ToolMiddleware[],
  toolName: string,
  input: unknown,
  ctx: ToolMiddlewareContext,
): Promise<BeforeResult> {
  let current = input
  for (const mw of middlewares) {
    if (!matches(mw, toolName) || !mw.before) {
      continue
    }
    try {
      current = await mw.before(current, ctx)
    } catch (err) {
      return {
        aborted: true,
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }
  return { aborted: false, input: current }
}

/**
 * Run `after()` on each matching middleware in REVERSE registration order
 * (last-registered = innermost = runs first).
 */
export async function runAfterMiddleware(
  middlewares: ToolMiddleware[],
  toolName: string,
  result: ToolResult,
  ctx: ToolMiddlewareContext,
): Promise<ToolResult> {
  let current = result
  for (const mw of [...middlewares].toReversed()) {
    if (!matches(mw, toolName) || !mw.after) {
      continue
    }
    current = await mw.after(current, ctx)
  }
  return current
}
