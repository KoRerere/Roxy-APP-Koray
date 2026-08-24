import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { z } from 'zod'
import type { BuiltinTool } from './index.ts'
import type { PermissionDeps } from './permissions.ts'
import { readPermissionGuard } from './permissions.ts'
import { globToRegex } from './glob_matcher.ts'
import { DEFAULT_GLOB_PAGE, MAX_GLOB_RESULTS } from './limits.ts'
import { defineTool } from '../schema.ts'

export const globInputSchema = z.strictObject({
  pattern: z.string().min(1).describe("Glob pattern, e.g. '**/*.ts'."),
  cwd: z.string().min(1).optional().describe('Base directory to search from (default: process.cwd()).'),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(MAX_GLOB_RESULTS)
    .default(DEFAULT_GLOB_PAGE)
    .describe(`Maximum number of results to return per call (default ${DEFAULT_GLOB_PAGE}).`),
  offset: z.number().int().nonnegative().default(0).describe('Number of results to skip (default 0).'),
})

async function walkDir(dir: string, base: string, re: RegExp): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const results: string[] = []
  for (const entry of entries) {
    const rel = relative(base, join(dir, entry.name))
    if (entry.isDirectory()) {
      results.push(...(await walkDir(join(dir, entry.name), base, re)))
    } else if (re.test(rel)) {
      results.push(rel)
    }
  }
  return results
}

/** Find files matching a glob pattern. Supports max_results + offset pagination. */
export function globTool(deps: PermissionDeps = {}): BuiltinTool {
  return defineTool({
    name: 'glob',
    description:
      'Find files matching a glob pattern. Supports * and ** wildcards. ' +
      'Use max_results (default 50) and offset to paginate when there are many results.',
    inputSchema: globInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (input, _ctx) => {
      const cwd = input.cwd ?? process.cwd()
      const guard = await readPermissionGuard(deps, cwd, 'glob', _ctx)
      if (guard) {
        return guard
      }

      try {
        const re = globToRegex(input.pattern)
        const all = await walkDir(cwd, cwd, re)
        all.sort()

        // Cap total collection to avoid memory blow-up on huge trees
        const hardCapped = all.length > MAX_GLOB_RESULTS
        const total = hardCapped ? MAX_GLOB_RESULTS : all.length
        const page = all.slice(input.offset, input.offset + input.max_results)

        const lines = page.length > 0 ? page.join('\n') : ''
        const parts: string[] = []
        if (lines) {
          parts.push(lines)
        }

        const shown = input.offset + page.length
        // Always show footer when total > page size OR when offset was beyond total
        const needFooter = shown < total || hardCapped || (page.length === 0 && input.offset > 0)
        if (needFooter) {
          const nextOffset = input.offset + input.max_results
          const cap = hardCapped ? `${MAX_GLOB_RESULTS}+` : `${total}`
          const rangeStart = page.length > 0 ? input.offset + 1 : '-'
          const rangeEnd = page.length > 0 ? shown : '-'
          parts.push(
            `(Showing ${rangeStart}–${rangeEnd} of ${cap} results` +
              (shown < total ? `; use offset=${nextOffset} for next page` : '') +
              (hardCapped ? `; search capped at ${MAX_GLOB_RESULTS}, use a more specific pattern` : '') +
              ')',
          )
        }

        return { content: parts.join('\n'), isError: false }
      } catch (err) {
        return {
          content: String(err instanceof Error ? err.message : String(err)),
          isError: true,
        }
      }
    },
  })
}
