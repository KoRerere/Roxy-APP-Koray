import { z } from 'zod'
import type { BuiltinTool } from './index.ts'
import { defineTool } from '../schema.ts'
import { ExecCommandProcessManager, defaultExecCommandProcessManager } from './exec_command_process_manager.ts'
import { waitForExecCommandResult } from './exec_command.ts'

const DEFAULT_POLL_YIELD_MS = 5_000
const DEFAULT_WRITE_YIELD_MS = 250
const DEFAULT_MAX_OUTPUT_TOKENS = 10_000
const MIN_YIELD_TIME_MS = 250
const MAX_YIELD_TIME_MS = 300_000

function clampYieldTime(value: number): number {
  return Math.min(MAX_YIELD_TIME_MS, Math.max(MIN_YIELD_TIME_MS, Math.floor(value)))
}

export const writeStdinInputSchema = z.strictObject({
  session_id: z.number().int().positive().describe('Background exec_command session id.'),
  chars: z.string().optional().describe('Characters to write to stdin. Omit or empty string to poll output.'),
  yield_time_ms: z.number().int().positive().optional().describe('Maximum wait before yielding output.'),
  max_output_tokens: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_MAX_OUTPUT_TOKENS)
    .transform((value) => Math.max(1, Math.floor(value)))
    .describe('Approximate output token budget for this result.'),
})

export interface WriteStdinToolDeps {
  processManager?: ExecCommandProcessManager
}

function errorResult(content: string): { content: string; isError: true } {
  return { content, isError: true }
}

export function writeStdinTool(deps: WriteStdinToolDeps = {}): BuiltinTool {
  const processManager = deps.processManager ?? defaultExecCommandProcessManager
  return defineTool({
    name: 'write_stdin',
    description:
      'Poll output from a background exec_command session. Non-empty stdin writes require tty support and are not yet available for pipe-based sessions.',
    inputSchema: writeStdinInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: true, openWorldHint: false },
    handler: async (input, ctx) => {
      const result = await processManager.withEntry(input.session_id, async (entry) => {
        if (input.chars && input.chars.length > 0) {
          return errorResult('write_stdin: stdin writes require tty support')
        }
        const yieldTimeMs = clampYieldTime(
          input.yield_time_ms ??
            (input.chars && input.chars.length > 0 ? DEFAULT_WRITE_YIELD_MS : DEFAULT_POLL_YIELD_MS),
        )
        return waitForExecCommandResult({
          entry,
          processManager,
          yieldTimeMs,
          maxOutputTokens: input.max_output_tokens,
          signal: ctx.signal,
          toolName: 'write_stdin',
          waitForOutput: true,
        })
      })

      if (!result.ok) {
        return errorResult(
          result.reason === 'busy'
            ? `write_stdin: session ${input.session_id} is busy`
            : `write_stdin: unknown session ${input.session_id}`,
        )
      }
      return result.value
    },
  })
}
