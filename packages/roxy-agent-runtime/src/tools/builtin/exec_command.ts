import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import type { BuiltinTool } from './index.ts'
import type { CommandPermissions } from './command_permissions.ts'
import { defineTool } from '../schema.ts'
import { buildShellCommand, resolveRequestedShell } from './exec_command_shell.ts'
import { ExecCommandProcessManager, defaultExecCommandProcessManager } from './exec_command_process_manager.ts'
import type { ExecCommandProcessEntry, ExecCommandSnapshot } from './exec_command_process_manager.ts'

const DEFAULT_YIELD_TIME_MS = 10_000
const DEFAULT_MAX_OUTPUT_TOKENS = 10_000
const MIN_YIELD_TIME_MS = 250
const MAX_YIELD_TIME_MS = 30_000
const TOKEN_BYTES = 4

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)))
}

export const execCommandInputSchema = z.strictObject({
  cmd: z
    .string()
    .refine((value) => value.trim().length > 0, 'Command must not be empty.')
    .describe('Shell command to execute.'),
  workdir: z.string().min(1).optional().describe('Working directory (optional).'),
  tty: z.boolean().default(false).describe('Whether to allocate an interactive terminal. Currently unsupported.'),
  yield_time_ms: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_YIELD_TIME_MS)
    .transform((value) => clampInt(value, MIN_YIELD_TIME_MS, MAX_YIELD_TIME_MS))
    .describe('Maximum initial wait before returning output or a session id.'),
  max_output_tokens: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_MAX_OUTPUT_TOKENS)
    .transform((value) => Math.max(1, Math.floor(value)))
    .describe('Approximate output token budget for this result.'),
  shell: z.string().min(1).optional().describe('Optional recognized shell path or name.'),
  login: z.boolean().default(false).describe('Use login shell semantics where supported.'),
})

export interface ExecCommandToolDeps {
  /**
   * Command-level policy. `deny` matches are hard-blocked here (every HITL
   * mode); `allow` matches are honored upstream by the HITL handlers.
   */
  commandPermissions?: CommandPermissions
  processManager?: ExecCommandProcessManager
}

export function estimateTokenCount(value: string): number {
  return Math.ceil(Buffer.byteLength(value, 'utf8') / TOKEN_BYTES)
}

export function truncateOutput(
  output: string,
  maxOutputTokens: number,
): { output: string; originalTokenCount: number } {
  const originalTokenCount = estimateTokenCount(output)
  const budgetBytes = maxOutputTokens * TOKEN_BYTES
  const bytes = Buffer.byteLength(output, 'utf8')
  if (bytes <= budgetBytes) {
    return { output, originalTokenCount }
  }

  const markerBudget = Math.min(120, Math.max(0, budgetBytes))
  const visibleBudget = Math.max(0, budgetBytes - markerBudget)
  const headBytes = Math.floor(visibleBudget / 2)
  const tailBytes = visibleBudget - headBytes
  const buffer = Buffer.from(output, 'utf8')
  const omittedBytes = Math.max(0, bytes - headBytes - tailBytes)
  const head = buffer.subarray(0, headBytes).toString('utf8')
  const tail = tailBytes > 0 ? buffer.subarray(buffer.length - tailBytes).toString('utf8') : ''
  return {
    originalTokenCount,
    output: `Warning: truncated output (original token count: ${originalTokenCount})\n${head}\n...[omitted ${omittedBytes} bytes]...\n${tail}`,
  }
}

export function formatExecCommandResult(args: {
  chunkId?: string
  startedAt: number
  snapshot: ExecCommandSnapshot
  sessionId?: number
  maxOutputTokens: number
}): string {
  const { output, originalTokenCount } = truncateOutput(args.snapshot.output, args.maxOutputTokens)
  const wallTime = ((Date.now() - args.startedAt) / 1000).toFixed(4)
  const lines = [`Chunk ID: ${args.chunkId ?? randomBytes(3).toString('hex')}`, `Wall time: ${wallTime} seconds`]
  if (args.snapshot.closed) {
    lines.push(`Process exited with code ${args.snapshot.exitCode ?? 1}`)
  } else {
    lines.push(`Process running with session ID ${args.sessionId}`)
  }
  lines.push(`Original token count: ${originalTokenCount}`)
  lines.push('Output:')
  lines.push(output)
  return lines.join('\n')
}

function errorResult(content: string): { content: string; isError: true } {
  return { content, isError: true }
}

export async function waitForExecCommandResult(args: {
  entry: ExecCommandProcessEntry
  processManager: ExecCommandProcessManager
  yieldTimeMs: number
  maxOutputTokens: number
  signal: AbortSignal
  toolName: 'exec_command' | 'write_stdin'
  waitForOutput?: boolean
}): Promise<{ content: string; isError: boolean }> {
  const abort = async () => {
    await args.processManager.killAndWait(args.entry, 'aborted')
    args.processManager.remove(args.entry.session_id)
    return errorResult(`${args.toolName}: aborted`)
  }

  if (args.signal.aborted) {
    return abort()
  }

  const waitResult = args.waitForOutput
    ? await args.processManager.waitForOutputOrClose(args.entry, args.yieldTimeMs, args.signal)
    : await args.processManager.waitForCloseOrTimeout(args.entry, args.yieldTimeMs, args.signal)
  if (waitResult === 'aborted') {
    return abort()
  }

  const snapshot = args.processManager.snapshot(args.entry)
  if (snapshot.startError) {
    args.processManager.remove(args.entry.session_id)
    return errorResult(`${args.toolName}: failed to start: ${snapshot.startError}`)
  }
  if (snapshot.terminationReason === 'timeout') {
    args.processManager.remove(args.entry.session_id)
    return errorResult(`${args.toolName}: timeout`)
  }

  const content = formatExecCommandResult({
    startedAt: args.entry.startedAt,
    snapshot,
    sessionId: args.entry.session_id,
    maxOutputTokens: args.maxOutputTokens,
  })
  if (snapshot.closed) {
    args.processManager.remove(args.entry.session_id)
  }
  return { content, isError: false }
}

/** Execute a shell command using Codex-style exec_command semantics. Sensitive — requires HITL approval. */
export function execCommandTool(deps: ExecCommandToolDeps = {}): BuiltinTool {
  const processManager = deps.processManager ?? defaultExecCommandProcessManager
  return defineTool({
    name: 'exec_command',
    description:
      'Run a shell command on the host OS. Inputs: cmd, workdir, tty, yield_time_ms, max_output_tokens, shell, login. No sandbox is provided; command permissions and HITL still apply. Sensitive.',
    inputSchema: execCommandInputSchema,
    source: 'builtin',
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    handler: async (input, ctx) => {
      if (input.tty) {
        return errorResult('exec_command: tty is not supported yet')
      }
      const cmd = input.cmd
      if (deps.commandPermissions?.evaluate(cmd, input.shell) === 'deny') {
        return errorResult(`exec_command: command denied by permissions policy: ${cmd}`)
      }

      let shellCommand: { file: string; args: string[]; shell: false }
      try {
        shellCommand = buildShellCommand(resolveRequestedShell(input.shell), cmd, input.login)
      } catch (error) {
        return errorResult(error instanceof Error ? `exec_command: ${error.message}` : `exec_command: ${String(error)}`)
      }

      let entry: ExecCommandProcessEntry
      try {
        entry = processManager.spawn({
          cmd,
          workdir: input.workdir,
          file: shellCommand.file,
          args: shellCommand.args,
          tty: input.tty,
        })
      } catch (error) {
        return errorResult(error instanceof Error ? `exec_command: ${error.message}` : `exec_command: ${String(error)}`)
      }

      return waitForExecCommandResult({
        entry,
        processManager,
        yieldTimeMs: input.yield_time_ms,
        maxOutputTokens: input.max_output_tokens,
        signal: ctx.signal,
        toolName: 'exec_command',
      })
    },
  })
}
