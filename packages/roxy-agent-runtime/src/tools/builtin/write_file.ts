import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import type { BuiltinTool } from './index.ts'
import { computeUnifiedDiff } from './diff_utils.ts'
import { defineTool } from '../schema.ts'

export const writeFileInputSchema = z.strictObject({
  path: z.string().min(1).describe('Absolute or relative path to write.'),
  content: z.string().describe('Text content to write.'),
})

/** Write/create a file. Mutates local state, so annotations require HITL approval. */
export function write_fileTool(): BuiltinTool {
  return defineTool({
    name: 'write_file',
    description: 'Write content to a file, creating parent directories as needed.',
    inputSchema: writeFileInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    previewFn: async (input) => {
      const existing = await readFile(input.path, 'utf8').catch(() => '')
      return computeUnifiedDiff(existing, input.content, input.path) || undefined
    },
    handler: async (input) => {
      try {
        await mkdir(dirname(input.path), { recursive: true })
        await writeFile(input.path, input.content, 'utf8')
        return { content: `Written ${input.content.length} chars to ${input.path}`, isError: false }
      } catch (err) {
        return { content: String(err instanceof Error ? err.message : String(err)), isError: true }
      }
    },
  })
}
