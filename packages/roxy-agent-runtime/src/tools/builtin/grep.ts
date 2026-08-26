import { readFile, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { z } from 'zod'
import type { BuiltinTool } from './index.ts'
import type { PermissionDeps } from './permissions.ts'
import { readPermissionGuard } from './permissions.ts'
import { MAX_GREP_MATCHES, DEFAULT_GREP_PAGE, DEFAULT_GREP_FILES_PAGE } from './limits.ts'
import { defineTool } from '../schema.ts'

export const grepInputSchema = z.strictObject({
  pattern: z.string().min(1).describe('Literal substring to search for (not a regular expression).'),
  path: z.string().min(1).describe('File or directory to search.'),
  glob: z.string().min(1).optional().describe("Optional filename filter, e.g. '*.ts'."),
  case_insensitive: z.boolean().default(false).describe('Case-insensitive match (default false).'),
  output_mode: z
    .enum(['content', 'files_with_matches'])
    .default('content')
    .describe("'content' shows matching lines; 'files_with_matches' lists only file paths."),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(MAX_GREP_MATCHES)
    .optional()
    .describe('Maximum number of results per call. The default depends on output_mode.'),
  offset: z.number().int().nonnegative().default(0).describe('Number of results to skip (default 0).'),
})

interface MatchRecord {
  filePath: string
  lineNo: number
  line: string
}

interface GrepState {
  matches: MatchRecord[]
  filesWithMatch: string[]
  capped: boolean
}

function globToRegex(pattern: string): RegExp {
  const sentinel = '__ROXY_DOUBLE_STAR__'
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, sentinel)
    .replace(/\*/g, '[^/]*')
    .replace(new RegExp(sentinel, 'g'), '.*')
  return new RegExp(`^${escaped}$`)
}

async function searchFile(
  filePath: string,
  displayPath: string,
  needle: string,
  caseInsensitive: boolean,
  state: GrepState,
): Promise<void> {
  if (state.capped) {
    return
  }
  const text = await readFile(filePath, 'utf8')
  const lines = text.split('\n')
  const fold = caseInsensitive
  const n = fold ? needle.toLowerCase() : needle
  let startedFile = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const matched = fold ? line.toLowerCase().includes(n) : line.includes(n)
    if (!matched) {
      continue
    }
    if (!startedFile) {
      state.filesWithMatch.push(displayPath)
      startedFile = true
    }
    state.matches.push({ filePath: displayPath, lineNo: i + 1, line })
    if (state.matches.length >= MAX_GREP_MATCHES) {
      state.capped = true
      return
    }
  }
}

async function searchDir(
  dir: string,
  base: string,
  needle: string,
  caseInsensitive: boolean,
  globFilter: RegExp | null,
  state: GrepState,
): Promise<void> {
  if (state.capped) {
    return
  }
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (state.capped) {
      return
    }
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await searchDir(full, base, needle, caseInsensitive, globFilter, state)
    } else if (entry.isFile()) {
      if (globFilter && !globFilter.test(entry.name)) {
        continue
      }
      await searchFile(full, relative(base, full), needle, caseInsensitive, state)
    }
  }
}

/** Render content-mode matches grouped by file. */
function renderContentPage(page: MatchRecord[]): string {
  const parts: string[] = []
  let lastFile = ''
  for (const m of page) {
    if (m.filePath !== lastFile) {
      parts.push(m.filePath)
      lastFile = m.filePath
    }
    parts.push(`  ${m.lineNo}: ${m.line}`)
  }
  return parts.join('\n')
}

/** Search file contents by LITERAL substring. Supports max_results + offset pagination. */
export function grepTool(deps: PermissionDeps = {}): BuiltinTool {
  return defineTool({
    name: 'grep',
    description:
      'Search file contents for a LITERAL substring (NOT a regex — special characters like ( ) | . * are matched as-is). Groups results by file as `path:` then `  lineNo: line`. Use case_insensitive for case-fold, glob to filter filenames. Use max_results and offset to paginate when there are many results.',
    inputSchema: grepInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (input, _ctx) => {
      const filesMode = input.output_mode === 'files_with_matches'
      const globFilter = input.glob ? globToRegex(input.glob) : null

      const defaultPage = filesMode ? DEFAULT_GREP_FILES_PAGE : DEFAULT_GREP_PAGE
      const maxResults = input.max_results ?? defaultPage

      const guard = await readPermissionGuard(deps, input.path, 'grep', _ctx)
      if (guard) {
        return guard
      }

      try {
        const info = await stat(input.path)
        const state: GrepState = { matches: [], filesWithMatch: [], capped: false }
        if (info.isFile()) {
          await searchFile(input.path, input.path, input.pattern, input.case_insensitive, state)
        } else {
          await searchDir(input.path, input.path, input.pattern, input.case_insensitive, globFilter, state)
        }

        const parts: string[] = []

        if (filesMode) {
          const allFiles = state.filesWithMatch
          const total = allFiles.length
          const page = allFiles.slice(input.offset, input.offset + maxResults)
          if (page.length > 0) {
            parts.push(page.join('\n'))
          }
          const shown = input.offset + page.length
          if (shown < total || state.capped) {
            const cap = state.capped ? `${MAX_GREP_MATCHES}+` : `${total}`
            parts.push(
              `(Showing ${input.offset + 1}–${shown} of ${cap} files` +
                (shown < total ? `; use offset=${shown} for next page` : '') +
                (state.capped ? `; search capped at ${MAX_GREP_MATCHES} matches` : '') +
                ')',
            )
          }
        } else {
          // content mode: paginate over individual match records
          const allMatches = state.matches
          const total = allMatches.length
          const page = allMatches.slice(input.offset, input.offset + maxResults)
          const rendered = renderContentPage(page)
          if (rendered) {
            parts.push(rendered)
          }
          const shown = input.offset + page.length
          if (shown < total || state.capped) {
            const cap = state.capped ? `${MAX_GREP_MATCHES}+` : `${total}`
            parts.push(
              `(Showing matches ${input.offset + 1}–${shown} of ${cap}` +
                (shown < total ? `; use offset=${shown} for next page` : '') +
                (state.capped ? `; search capped at ${MAX_GREP_MATCHES} matches, narrow your search` : '') +
                ')',
            )
          }
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
