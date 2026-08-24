import { readdir } from 'node:fs/promises'
import { z } from 'zod'
import type { BuiltinTool } from './index.ts'
import type { PermissionDeps } from './permissions.ts'
import { readPermissionGuard } from './permissions.ts'
import { capEntries } from './truncate.ts'
import { MAX_LS_ENTRIES } from './limits.ts'
import { defineTool } from '../schema.ts'

export const lsInputSchema = z.strictObject({
  path: z.string().min(1).describe('Directory path to list.'),
})

/** List a directory's entries. Read-only, closed-world, path-gated, cap-bounded. */
export function lsTool(deps: PermissionDeps = {}): BuiltinTool {
  return defineTool({
    name: 'ls',
    description: 'List files and subdirectories at a path (capped; use glob for finer control).',
    inputSchema: lsInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (input, ctx) => {
      const guard = await readPermissionGuard(deps, input.path, 'ls', ctx)
      if (guard) {
        return guard
      }
      try {
        const entries = await readdir(input.path, { withFileTypes: true })
        const lines = entries.map((e) => {
          const type = e.isDirectory() ? 'dir' : e.isSymbolicLink() ? 'symlink' : 'file'
          return `${e.name}\t${type}`
        })
        lines.sort()
        const capped = capEntries(
          lines,
          MAX_LS_ENTRIES,
          `(... showing ${MAX_LS_ENTRIES} of ${lines.length}; use glob for finer control)`,
        )
        return { content: capped.join('\n'), isError: false }
      } catch (err) {
        return {
          content: String(err instanceof Error ? err.message : String(err)),
          isError: true,
        }
      }
    },
  })
}
