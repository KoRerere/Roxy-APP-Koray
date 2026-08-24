import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { z } from 'zod'
import type { BuiltinTool } from './index.ts'
import { applyDiff } from './apply_diff.ts'
import { defineTool } from '../schema.ts'

const BEGIN_PATCH = '*** Begin Patch'
const END_PATCH = '*** End Patch'
const ADD_FILE = '*** Add File: '
const UPDATE_FILE = '*** Update File: '
const DELETE_FILE = '*** Delete File: '
const MOVE_TO = '*** Move to: '
const END_FILE = '*** End of File'

export type ParsedApplyPatchOperation =
  | { type: 'add'; path: string; diff: string }
  | { type: 'update'; path: string; moveTo?: string; diff: string }
  | { type: 'delete'; path: string }

export const applyPatchInputSchema = z.string().min(1)

export type ApplyPatchInput = z.infer<typeof applyPatchInputSchema>

export const APPLY_PATCH_TOOL_DESCRIPTION = `Use the apply_patch tool to add, update, move, or delete files. File paths may be absolute or relative; prefer the exact absolute path when it is available. This tool has no workspace or cwd argument and does not require one.

This is a FREEFORM tool, so pass the patch text directly as the tool input and do not wrap it in JSON, an object, or a shell command. When a user asks you to create or modify files, call apply_patch directly instead of only explaining the patch.

The input must use this V4A patch envelope:
*** Begin Patch
*** Add File: path
+new content
*** Update File: path
*** Move to: new-path
@@ optional context
-old line
+new line
 context line
*** Delete File: path
*** End Patch

Each file action must appear at most once. Add File content lines start with "+". Update File changes use "@@" anchors plus context lines prefixed with a space, removed lines prefixed with "-", and added lines prefixed with "+". Use "*** End of File" after an update section when its context must match the end of the file. Move to is valid only immediately after Update File.`

function sectionHeader(line: string): boolean {
  return line.startsWith(ADD_FILE) || line.startsWith(UPDATE_FILE) || line.startsWith(DELETE_FILE)
}

function parsePath(line: string, prefix: string): string {
  const value = line.slice(prefix.length).trim()
  if (!value) {
    throw new Error(`apply_patch: missing path after ${prefix.trim()}`)
  }
  return value
}

function readSectionBody(lines: string[], start: number): { body: string[]; index: number } {
  const body: string[] = []
  let index = start
  while (index < lines.length - 1 && !sectionHeader(lines[index]!)) {
    if (lines[index] === END_PATCH) {
      break
    }
    body.push(lines[index]!)
    index += 1
  }
  return { body, index }
}

function validateAddBody(path: string, body: string[]): void {
  if (body.length === 0) {
    throw new Error(`apply_patch: Add File has no content: ${path}`)
  }
  for (const line of body) {
    if (!line.startsWith('+')) {
      throw new Error(`apply_patch: invalid Add File line: ${line}`)
    }
  }
}

function validateUpdateBody(path: string, body: string[], moveTo: string | undefined): void {
  if (body.length === 0 && !moveTo) {
    throw new Error(`apply_patch: Update File has no diff: ${path}`)
  }
  const eofMarkers = body.filter((line) => line === END_FILE)
  if (eofMarkers.length > 1 || (eofMarkers.length === 1 && body.at(-1) !== END_FILE)) {
    throw new Error(`apply_patch: ${END_FILE} must appear once at the end of an Update File section`)
  }
  for (const line of body) {
    if (line === '' || line === END_FILE || line === '@@') {
      continue
    }
    if (line.startsWith('@@ ')) {
      if (line.length === 3) {
        throw new Error('apply_patch: update anchor after "@@ " must not be empty')
      }
      continue
    }
    if (!line.startsWith('+') && !line.startsWith('-') && !line.startsWith(' ')) {
      throw new Error(`apply_patch: invalid Update File line: ${line}`)
    }
  }
}

/** Parse the free-form Codex patch envelope into ordered file operations. */
export function parseApplyPatch(input: string): ParsedApplyPatchOperation[] {
  const lines = input.replace(/\r\n/g, '\n').split('\n')
  if (lines.at(-1) === '') {
    lines.pop()
  }
  if (lines[0] !== BEGIN_PATCH || lines.at(-1) !== END_PATCH) {
    throw new Error(`apply_patch: patch must start with "${BEGIN_PATCH}" and end with "${END_PATCH}"`)
  }

  const operations: ParsedApplyPatchOperation[] = []
  const actionPaths = new Set<string>()
  let index = 1
  while (index < lines.length - 1) {
    const header = lines[index]!
    if (header.startsWith(ADD_FILE)) {
      const path = parsePath(header, ADD_FILE)
      if (actionPaths.has(path)) {
        throw new Error(`apply_patch: duplicate file action: ${path}`)
      }
      index += 1
      const result = readSectionBody(lines, index)
      const body = result.body
      index = result.index
      validateAddBody(path, body)
      actionPaths.add(path)
      operations.push({ type: 'add', path, diff: body.join('\n') })
      continue
    }

    if (header.startsWith(UPDATE_FILE)) {
      const path = parsePath(header, UPDATE_FILE)
      if (actionPaths.has(path)) {
        throw new Error(`apply_patch: duplicate file action: ${path}`)
      }
      index += 1
      let moveTo: string | undefined
      if (lines[index]?.startsWith(MOVE_TO)) {
        moveTo = parsePath(lines[index]!, MOVE_TO)
        index += 1
      }
      const result = readSectionBody(lines, index)
      const body = result.body
      index = result.index
      validateUpdateBody(path, body, moveTo)
      actionPaths.add(path)
      operations.push({ type: 'update', path, ...(moveTo ? { moveTo } : {}), diff: body.join('\n') })
      continue
    }

    if (header.startsWith(DELETE_FILE)) {
      const path = parsePath(header, DELETE_FILE)
      if (actionPaths.has(path)) {
        throw new Error(`apply_patch: duplicate file action: ${path}`)
      }
      actionPaths.add(path)
      operations.push({ type: 'delete', path })
      index += 1
      continue
    }

    throw new Error(`apply_patch: invalid operation header: ${header}`)
  }

  if (operations.length === 0) {
    throw new Error('apply_patch: patch contains no file operations')
  }
  return operations
}

function resolvePatchPath(supplied: string): string {
  return resolve(supplied)
}

interface FileState {
  existed: boolean
  content?: string
}

async function readState(path: string): Promise<FileState> {
  try {
    return { existed: true, content: await readFile(path, 'utf8') }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      return { existed: false }
    }
    throw error
  }
}

async function restoreFiles(originals: Map<string, FileState>): Promise<void> {
  await Promise.all(
    [...originals].map(async ([path, state]) => {
      if (!state.existed) {
        await rm(path, { force: true })
        return
      }
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, state.content ?? '', 'utf8')
    }),
  )
}

function operationLabel(operation: ParsedApplyPatchOperation): string {
  if (operation.type === 'add') {
    return `A ${operation.path}`
  }
  if (operation.type === 'delete') {
    return `D ${operation.path}`
  }
  return operation.moveTo ? `M ${operation.path} -> ${operation.moveTo}` : `M ${operation.path}`
}

export function normalizeApplyPatchInput(input: ApplyPatchInput): ParsedApplyPatchOperation[] {
  return parseApplyPatch(input)
}

function previewApplyPatch(input: ApplyPatchInput): string {
  return input
}

/** Responses custom apply_patch tool using a free-form Codex patch envelope. */
export function applyPatchTool(): BuiltinTool {
  return defineTool({
    name: 'apply_patch',
    description: APPLY_PATCH_TOOL_DESCRIPTION,
    kind: 'custom',
    inputSchema: applyPatchInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    previewFn: async (input) => previewApplyPatch(input),
    handler: async (input) => {
      try {
        const operations = normalizeApplyPatchInput(input)
        const resolved = await Promise.all(
          operations.map(async (operation) => ({
            operation,
            path: resolvePatchPath(operation.path),
            ...(operation.type === 'update' && operation.moveTo ? { moveTo: resolvePatchPath(operation.moveTo) } : {}),
          })),
        )

        const touchedPaths = new Set<string>()
        for (const item of resolved) {
          touchedPaths.add(item.path)
          if (item.moveTo) {
            touchedPaths.add(item.moveTo)
          }
        }

        const originals = new Map<string, FileState>()
        await Promise.all(
          [...touchedPaths].map(async (path) => {
            originals.set(path, await readState(path))
          }),
        )
        const pending = new Map<string, string | undefined>()
        const currentState = async (path: string): Promise<FileState> => {
          if (pending.has(path)) {
            const content = pending.get(path)
            return content === undefined ? { existed: false } : { existed: true, content }
          }
          return originals.get(path) ?? { existed: false }
        }

        for (const item of resolved) {
          const state = await currentState(item.path)
          if (item.operation.type === 'add') {
            if (state.existed) {
              throw new Error(`apply_patch: file already exists: ${item.operation.path}`)
            }
            pending.set(item.path, applyDiff('', item.operation.diff, 'create'))
            continue
          }
          if (!state.existed) {
            throw new Error(`apply_patch: file not found: ${item.operation.path}`)
          }
          if (item.operation.type === 'delete') {
            pending.set(item.path, undefined)
            continue
          }

          const content = item.operation.diff
            ? applyDiff(state.content ?? '', item.operation.diff)
            : (state.content ?? '')
          if (item.moveTo) {
            const destination = await currentState(item.moveTo)
            if (destination.existed && item.moveTo !== item.path) {
              throw new Error(`apply_patch: move destination already exists: ${item.operation.moveTo}`)
            }
            pending.set(item.path, undefined)
            pending.set(item.moveTo, content)
          } else {
            pending.set(item.path, content)
          }
        }

        try {
          for (const [path, content] of pending) {
            if (content === undefined) {
              await rm(path, { force: true })
            } else {
              await mkdir(dirname(path), { recursive: true })
              await writeFile(path, content, 'utf8')
            }
          }
        } catch (error) {
          await restoreFiles(originals)
          throw error
        }

        return { content: ['Done!', ...operations.map(operationLabel)].join('\n'), isError: false }
      } catch (error) {
        return { content: error instanceof Error ? error.message : String(error), isError: true }
      }
    },
  })
}
