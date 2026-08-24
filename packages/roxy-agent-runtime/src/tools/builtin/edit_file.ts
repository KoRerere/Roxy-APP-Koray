import { readFile, writeFile } from 'node:fs/promises'
import { z } from 'zod'
import type { BuiltinTool } from './index.ts'
import { computeUnifiedDiff } from './diff_utils.ts'
import { defineTool } from '../schema.ts'

const editInputSchema = z.strictObject({
  old_str: z.string().min(1).describe('Exact text to find (must be unique unless replace_all).'),
  new_str: z.string().describe('Replacement text.'),
  replace_all: z.boolean().default(false).describe('Replace every occurrence (default false).'),
})

const editFileObjectSchema = z.strictObject({
  path: z.string().min(1).describe('Path to the file to edit.'),
  old_str: editInputSchema.shape.old_str.optional(),
  new_str: editInputSchema.shape.new_str.optional(),
  replace_all: z.boolean().optional(),
  edits: z.array(editInputSchema).min(1).optional(),
})

export const editFileInputSchema = editFileObjectSchema
  .superRefine((input, ctx) => {
    if (input.edits !== undefined) {
      if (input.old_str !== undefined || input.new_str !== undefined || input.replace_all !== undefined) {
        ctx.addIssue({ code: 'custom', message: "provide either 'edits' or top-level edit fields, not both" })
      }
      return
    }
    if (input.old_str === undefined) {
      ctx.addIssue({ code: 'custom', path: ['old_str'], message: 'old_str is required' })
    }
    if (input.new_str === undefined) {
      ctx.addIssue({ code: 'custom', path: ['new_str'], message: 'new_str is required' })
    }
  })
  .transform((input) => {
    if (input.edits !== undefined) {
      return { path: input.path, edits: input.edits } as const
    }
    return {
      path: input.path,
      old_str: input.old_str!,
      new_str: input.new_str!,
      replace_all: input.replace_all ?? false,
    } as const
  })

type EditFileInput = z.infer<typeof editFileInputSchema>
type Edit = z.infer<typeof editInputSchema>

function normalizeEdits(input: EditFileInput): { edits: Edit[]; multi: boolean } {
  if ('edits' in input && input.edits !== undefined) {
    return { edits: input.edits, multi: true }
  }
  return { edits: [{ old_str: input.old_str, new_str: input.new_str, replace_all: input.replace_all }], multi: false }
}

/** Edit a file via exact old→new string replacement. Sensitive — requires HITL approval. */
export function edit_fileTool(): BuiltinTool {
  return defineTool({
    name: 'edit_file',
    description:
      'Replace exact occurrences of old_str with new_str. By default old_str must be unique; set replace_all:true to replace every occurrence. For several changes to ONE file, pass `edits` (an array of {old_str,new_str,replace_all?}) instead of the top-level pair: edits apply sequentially and atomically. Read the relevant lines before editing so old_str is copied verbatim.',
    inputSchema: editFileInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    previewFn: async (input) => {
      const parsed = normalizeEdits(input)
      try {
        const original = await readFile(input.path, 'utf8')
        let text = original
        for (const edit of parsed.edits) {
          const count = text.split(edit.old_str).length - 1
          if (count === 0 || (!edit.replace_all && count > 1)) {
            return undefined
          }
          text = edit.replace_all
            ? text.split(edit.old_str).join(edit.new_str)
            : text.replace(edit.old_str, edit.new_str)
        }
        return computeUnifiedDiff(original, text, input.path) || undefined
      } catch {
        return undefined
      }
    },
    handler: async (input) => {
      const { edits, multi } = normalizeEdits(input)
      try {
        let text = await readFile(input.path, 'utf8')
        let replacements = 0
        for (let i = 0; i < edits.length; i++) {
          const edit = edits[i]!
          const count = text.split(edit.old_str).length - 1
          const label = multi ? `edit #${i + 1}: ` : ''
          if (count === 0) {
            return { content: `edit_file: ${label}old_str not found in ${input.path}`, isError: true }
          }
          if (!edit.replace_all && count > 1) {
            return {
              content: `edit_file: ${label}old_str is not unique — found ${count} occurrences in ${input.path} (set replace_all:true to replace all)`,
              isError: true,
            }
          }
          text = edit.replace_all
            ? text.split(edit.old_str).join(edit.new_str)
            : text.replace(edit.old_str, edit.new_str)
          replacements += edit.replace_all ? count : 1
        }
        await writeFile(input.path, text, 'utf8')
        return {
          content: multi
            ? `Applied ${edits.length} edits to ${input.path} (${replacements} replacement${replacements === 1 ? '' : 's'})`
            : `Replaced ${replacements} occurrence${replacements === 1 ? '' : 's'} in ${input.path}`,
          isError: false,
        }
      } catch (err) {
        return { content: String(err instanceof Error ? err.message : String(err)), isError: true }
      }
    },
  })
}
