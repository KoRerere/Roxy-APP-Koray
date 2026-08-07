import type { FileCollectorStore } from '../fileCollector'
import { AIMessage, ToolMessage } from '@langchain/core/messages'
import { createMiddleware, tool } from 'langchain'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

interface FilesystemToolOptions {
  rootDir: string
  fileCollector?: FileCollectorStore
}

interface EditOperation {
  old_string: string
  new_string: string
  replace_all: boolean
}

const FILESYSTEM_OVERRIDE_PROMPT = `## Roxy filesystem overrides

- write_file creates a file or atomically replaces an existing file. Never delete an existing file before rewriting it.
- For focused changes, use edit_file. Pass edits for several sequential, all-or-nothing changes to one file.
- Never use execute, cat, or a heredoc to write source code.
- A tool call from a max_tokens response is incomplete and will not execute. Keep the existing file and retry with a smaller edit.`

const editOperationSchema = z.object({
  old_string: z.string().describe('Exact text to find'),
  new_string: z.string().describe('Replacement text'),
  replace_all: z.boolean().optional().default(false).describe('Replace every occurrence'),
})

const editFileSchema = z.object({
  file_path: z.string().describe('Absolute or workspace-relative path to the file to edit'),
  old_string: z.string().optional().describe('Exact text to find in single-edit mode'),
  new_string: z.string().optional().describe('Replacement text in single-edit mode'),
  replace_all: z.boolean().optional().default(false).describe('Replace every occurrence in single-edit mode'),
  edits: z.array(editOperationSchema).optional().describe('Several edits applied sequentially and atomically'),
})

function resolveFilePath(rootDir: string, filePath: string): string {
  if (filePath.includes('\0'))
    throw new Error('File path cannot contain null bytes')
  return path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(rootDir, filePath)
}

async function atomicWriteText(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })

  const existing = await fs.lstat(filePath).catch(() => null)
  if (existing?.isSymbolicLink())
    throw new Error(`Refusing to write through symlink: ${filePath}`)
  if (existing && !existing.isFile())
    throw new Error(`Path is not a file: ${filePath}`)

  const tempPath = path.join(path.dirname(filePath), `.roxy-write-${process.pid}-${randomUUID()}.tmp`)
  try {
    await fs.writeFile(tempPath, content, {
      encoding: 'utf8',
      mode: existing?.mode,
    })
    await fs.rename(tempPath, filePath)
  }
  finally {
    await fs.rm(tempPath, { force: true }).catch(() => {})
  }
}

function parseEdits(input: z.infer<typeof editFileSchema>): EditOperation[] {
  if (input.edits !== undefined) {
    if (input.old_string !== undefined || input.new_string !== undefined)
      throw new Error('edit_file: provide either edits or top-level old_string/new_string, not both')
    if (input.edits.length === 0)
      throw new Error('edit_file: edits must be a non-empty array')
    return input.edits
  }

  if (input.old_string === undefined)
    throw new Error('edit_file: old_string is required in single-edit mode')
  if (input.new_string === undefined)
    throw new Error('edit_file: new_string is required in single-edit mode')

  return [{
    old_string: input.old_string,
    new_string: input.new_string,
    replace_all: input.replace_all,
  }]
}

function applyEdits(original: string, edits: EditOperation[], filePath: string): { content: string, replacements: number } {
  let content = original
  let replacements = 0

  for (let index = 0; index < edits.length; index++) {
    const edit = edits[index]
    const label = edits.length > 1 ? `edit #${index + 1}: ` : ''
    if (edit.old_string.length === 0)
      throw new Error(`edit_file: ${label}old_string cannot be empty`)

    const count = content.split(edit.old_string).length - 1
    if (count === 0)
      throw new Error(`edit_file: ${label}old_string not found in ${filePath}`)
    if (!edit.replace_all && count > 1) {
      throw new Error(
        `edit_file: ${label}old_string is not unique - found ${count} occurrences in ${filePath} (set replace_all=true to replace all)`,
      )
    }

    content = edit.replace_all
      ? content.split(edit.old_string).join(edit.new_string)
      : content.replace(edit.old_string, edit.new_string)
    replacements += edit.replace_all ? count : 1
  }

  return { content, replacements }
}

export function createRoxyFilesystemTools(options: FilesystemToolOptions) {
  const writeFileTool = tool(
    async (input) => {
      const resolvedPath = resolveFilePath(options.rootDir, input.file_path)
      await atomicWriteText(resolvedPath, input.content)
      options.fileCollector?.record({
        virtualPath: input.file_path,
        realPath: resolvedPath,
        op: 'write',
        displayName: path.basename(resolvedPath),
      })
      return `Successfully wrote ${input.content.length} characters to '${input.file_path}'`
    },
    {
      name: 'write_file',
      description: [
        'Write complete text content to a file, creating parent directories as needed.',
        'If the file already exists it is replaced atomically; never delete it first.',
        'Do not call this with incomplete content. For small changes to an existing file, use edit_file.',
      ].join(' '),
      schema: z.object({
        file_path: z.string().describe('Absolute or workspace-relative path to write'),
        content: z.string().describe('Complete text content for the file'),
      }),
    },
  )

  const editFileTool = tool(
    async (input) => {
      const resolvedPath = resolveFilePath(options.rootDir, input.file_path)
      const edits = parseEdits(input)
      const original = await fs.readFile(resolvedPath, 'utf8')
      const result = applyEdits(original, edits, input.file_path)
      await atomicWriteText(resolvedPath, result.content)
      options.fileCollector?.record({
        virtualPath: input.file_path,
        realPath: resolvedPath,
        op: 'edit',
        displayName: path.basename(resolvedPath),
      })

      return edits.length > 1
        ? `Applied ${edits.length} edits to '${input.file_path}' (${result.replacements} replacements)`
        : `Successfully replaced ${result.replacements} occurrence(s) in '${input.file_path}'`
    },
    {
      name: 'edit_file',
      description: [
        'Replace exact text in an existing file.',
        'Use old_string/new_string for one change, or edits for several changes to the same file.',
        'Multi-edit operations are sequential and all-or-nothing: if any edit fails, the file remains unchanged.',
        'Read the relevant lines first and keep each replacement as small as practical.',
      ].join(' '),
      schema: editFileSchema,
    },
  )

  return { writeFileTool, editFileTool }
}

function isMaxTokensResponse(response: unknown): response is AIMessage {
  if (!AIMessage.isInstance(response))
    return false
  return response.additional_kwargs?.stop_reason === 'max_tokens'
    || response.response_metadata?.stop_reason === 'max_tokens'
    || response.response_metadata?.finish_reason === 'length'
}

export function createRoxyFilesystemMiddleware(options: FilesystemToolOptions) {
  const { writeFileTool, editFileTool } = createRoxyFilesystemTools(options)
  const tools = [writeFileTool, editFileTool] as const
  const overrides = new Map<string, (typeof tools)[number]>(
    tools.map(candidate => [candidate.name, candidate]),
  )
  const truncatedToolCallIds = new Set<string>()

  return createMiddleware({
    name: 'RoxyFilesystemMiddleware',
    tools,
    wrapModelCall: async (request, handler) => {
      const visibleTools = (request.tools ?? []).filter(
        candidate => typeof candidate.name !== 'string' || !overrides.has(candidate.name),
      )
      const response = await handler({
        ...request,
        tools: [...visibleTools, ...tools],
        systemMessage: request.systemMessage.concat(FILESYSTEM_OVERRIDE_PROMPT),
      })

      if (isMaxTokensResponse(response)) {
        for (const toolCall of response.tool_calls ?? []) {
          if (toolCall.id)
            truncatedToolCallIds.add(toolCall.id)
        }
      }
      return response
    },
    wrapToolCall: async (request, handler) => {
      const toolCallId = request.toolCall.id
      if (toolCallId && truncatedToolCallIds.delete(toolCallId)) {
        return new ToolMessage({
          content: [
            'Tool call was not executed because the model response ended with stop_reason=max_tokens.',
            'Retry with a smaller write or edit. Do not delete the existing file first.',
          ].join(' '),
          status: 'error',
          name: request.toolCall.name,
          tool_call_id: toolCallId,
        })
      }

      const override = overrides.get(request.toolCall.name)
      return override
        ? handler({ ...request, tool: override })
        : handler(request)
    },
  })
}
