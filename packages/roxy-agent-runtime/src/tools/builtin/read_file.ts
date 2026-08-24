import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { TextDecoder } from 'node:util'
import { z } from 'zod'
import type { Stats } from 'node:fs'
import type { BuiltinTool } from './index.ts'
import { readPermissionGuard } from './permissions.ts'
import { READ_LIMIT, READ_MAX_BYTES, READ_MAX_LINE_LENGTH, READ_STREAM_MIN_SIZE } from './limits.ts'
import { buildWindow, formatReadOutput, ReadFileError } from './read_file_render.ts'
import { defineTool } from '../schema.ts'

const BINARY_SAMPLE_BYTES = 8_192

export const readFileInputSchema = z.strictObject({
  path: z.string().min(1).describe('Path to read. Relative paths resolve from the current process working directory.'),
  offset: z.number().int().min(1).default(1).describe('1-based first line to return. Defaults to 1.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(READ_LIMIT)
    .optional()
    .describe(`Maximum number of lines to return. Defaults to ${READ_LIMIT}.`),
})

export interface ReadFileToolDeps {
  permissions?: import('./permissions.ts').PathPermissions
  hitl?: import('../../core/interfaces.ts').IHITLHandler
}

export interface ReadInput {
  path: string
  offset: number
  limit: number
}

/**
 * Validate constraints and apply DSH read defaults. Zod enforces the public
 * schema; this helper keeps direct helper tests and future callers honest too.
 */
export function parseReadArgs(
  args: { path: string; offset?: number; limit?: number },
  maxLimit = READ_LIMIT,
): ReadInput {
  if (args.path.trim().length === 0) {
    throw new ReadFileError('path must be a non-empty string')
  }
  const offset = args.offset ?? 1
  const limit = args.limit ?? maxLimit
  if (!Number.isFinite(offset) || !Number.isInteger(offset) || offset < 1) {
    throw new ReadFileError('offset must be a positive integer')
  }
  if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit < 1) {
    throw new ReadFileError('limit must be a positive integer')
  }
  if (limit > maxLimit) {
    throw new ReadFileError(`limit must be less than or equal to ${maxLimit}`)
  }
  return { path: args.path, offset, limit }
}

/**
 * Read a UTF-8 text file with DSH-compatible 1-based pagination.
 *
 * Path access is gated by the optional {@link PathPermissions} layer before any
 * filesystem metadata/content I/O. Successful output is always an XML-like
 * `<path>/<type>/<content>` envelope with numbered lines. Large files stream;
 * invalid UTF-8, binary files, non-regular files, and out-of-range offsets
 * return `isError:true`.
 */
export function read_fileTool(deps: ReadFileToolDeps = {}): BuiltinTool {
  return defineTool({
    name: 'read_file',
    description:
      `Read a UTF-8 text file and return line-numbered content in a <path>/<type>/<content> envelope. ` +
      `Offset is 1-based and defaults to 1. Limit defaults to ${READ_LIMIT} and cannot exceed ${READ_LIMIT}. ` +
      `Large files are streamed; binary files, invalid UTF-8 text, and sensitive paths are rejected.`,
    inputSchema: readFileInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (input, ctx) => {
      const parsed = parseReadArgs(input)

      const guard = await readPermissionGuard(deps, parsed.path, 'read_file', ctx)
      if (guard) {
        return guard
      }

      try {
        const info = await statRegularFile(parsed.path, ctx.signal)
        const chunks =
          info.size >= READ_STREAM_MIN_SIZE
            ? streamWholeText(parsed.path, ctx.signal)
            : [await readWholeText(parsed.path, ctx.signal)]
        const window = await buildWindow(
          chunks,
          {
            offset: parsed.offset,
            limit: parsed.limit,
            maxLineLength: READ_MAX_LINE_LENGTH,
            maxBytes: READ_MAX_BYTES,
          },
          parsed.path,
        )

        return {
          content: formatReadOutput(parsed.path, {
            offset: parsed.offset,
            lines: window.lines,
            totalLines: window.totalLines,
            ...(window.truncatedByBytes ? { truncatedByBytes: true } : {}),
          }),
          isError: false,
        }
      } catch (error) {
        return {
          content: renderReadError(error),
          isError: true,
        }
      }
    },
  })
}

export async function statRegularFile(path: string, signal?: AbortSignal): Promise<Stats> {
  throwIfReadAborted(signal)
  let info: Stats
  try {
    info = await stat(path)
  } catch (error) {
    if (isAbortError(error)) {
      throw new ReadFileError('read aborted')
    }
    if (hasNodeCode(error, 'ENOENT') || hasNodeCode(error, 'ENOTDIR')) {
      throw new ReadFileError(`cannot read "${path}": not found`)
    }
    throw new ReadFileError(`cannot read "${path}": ${errorMessage(error)}`)
  }
  throwIfReadAborted(signal)
  if (!info.isFile()) {
    throw new ReadFileError(`cannot read "${path}": not a regular file`)
  }
  return info
}

export async function readWholeText(path: string, signal?: AbortSignal): Promise<string> {
  throwIfReadAborted(signal)
  let raw: Buffer
  try {
    raw = await readFile(path, signal ? { signal } : {})
  } catch (error) {
    if (isAbortError(error)) {
      throw new ReadFileError('read aborted')
    }
    throw error
  }
  throwIfReadAborted(signal)
  if (raw.subarray(0, BINARY_SAMPLE_BYTES).includes(0)) {
    throw new ReadFileError(`cannot read "${path}": binary file`)
  }
  return decodeUtf8(raw, path)
}

export async function* streamWholeText(path: string, signal?: AbortSignal): AsyncIterable<string> {
  throwIfReadAborted(signal)
  const stream = createReadStream(path, signal ? { signal } : {})
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let sampledBytes = 0

  function scanBinarySample(chunk: Buffer): void {
    if (sampledBytes >= BINARY_SAMPLE_BYTES) {
      return
    }
    const sample = chunk.subarray(0, Math.min(chunk.length, BINARY_SAMPLE_BYTES - sampledBytes))
    if (sample.includes(0)) {
      throw new ReadFileError(`cannot read "${path}": binary file`)
    }
    sampledBytes += sample.length
  }

  try {
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      scanBinarySample(chunk)
      yield decodeUtf8Stream(decoder, chunk, path)
    }
    yield decodeUtf8Stream(decoder, undefined, path)
  } catch (error) {
    if (isAbortError(error)) {
      throw new ReadFileError('read aborted')
    }
    throw error
  }
}

function decodeUtf8(buffer: Uint8Array, path: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error
    }
    throw new ReadFileError(`cannot read "${path}": not a UTF-8 text file`)
  }
}

function decodeUtf8Stream(decoder: TextDecoder, chunk: Uint8Array | undefined, path: string): string {
  try {
    return chunk ? decoder.decode(chunk, { stream: true }) : decoder.decode()
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error
    }
    throw new ReadFileError(`cannot read "${path}": not a UTF-8 text file`)
  }
}

function throwIfReadAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new ReadFileError('read aborted')
  }
}

function renderReadError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function hasNodeCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
