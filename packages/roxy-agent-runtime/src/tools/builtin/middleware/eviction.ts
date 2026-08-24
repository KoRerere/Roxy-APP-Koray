import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ToolMiddleware, ToolResult } from '../../../core/interfaces.ts'
import { createContentPreview } from '../truncate.ts'
import { EVICTION_HEAD_LINES, EVICTION_TAIL_LINES, READ_LIMIT, MAX_TOOL_RESULT_CHARS } from '../limits.ts'

export interface EvictionMiddlewareOptions {
  /** Directory to persist evicted (oversized) tool results into. */
  scratchDir: string
  /** Result content length above which the result is evicted to a file. */
  maxChars?: number
}

/**
 * Tool-result eviction middleware. When a tool result's `content` exceeds
 * `maxChars`, the full content is written to `<scratchDir>/<toolUseId>.txt`
 * and replaced in-context with a small head/tail preview telling the model
 * how to paginate it back via `read_file(offset, limit)`. Keeps `isError`.
 *
 * Runs as a `ToolMiddleware.after` — the runtime invokes it after the tool
 * executes and before the result is appended to conversation history, so the
 * large payload never enters the context. Applies to all tools (no `match`);
 * the threshold is high enough that small-output tools (write/edit/exec_command)
 * never trigger it. `read_file` is NOT excluded: it now has offset/limit, so
 * an evicted read_file result pointing back to a paginated read is productive,
 * not a loop.
 *
 * Scratch files live under an os tmpdir and are NOT cleaned up by the
 * runtime — the OS reaps them. They do not survive process restart, so an
 * evicted preview's "Saved to" path is invalid after a resume.
 */
export function createEvictionMiddleware(opts: EvictionMiddlewareOptions): ToolMiddleware {
  const maxChars = opts.maxChars ?? MAX_TOOL_RESULT_CHARS
  const scratchDir = opts.scratchDir

  return {
    async after(result: ToolResult): Promise<ToolResult> {
      if (typeof result.content !== 'string') {
        return result
      }
      if (result.content.length <= maxChars) {
        return result
      }

      const file = join(scratchDir, `${result.toolUseId}.txt`)
      try {
        await mkdir(dirname(file), { recursive: true })
        await writeFile(file, result.content, 'utf-8')
      } catch {
        // If we can't persist, leave the result as-is rather than dropping
        // it silently — better a large result than a missing one.
        return result
      }

      const { preview } = createContentPreview(result.content, EVICTION_HEAD_LINES, EVICTION_TAIL_LINES)
      const replacement =
        `Tool result too large (${result.content.length} chars). Saved to ${file}.\n` +
        `Use read_file(path="${file}", offset=1, limit=${READ_LIMIT}) to paginate.\n\n` +
        `${preview}`

      return { ...result, content: replacement }
    },
  }
}
