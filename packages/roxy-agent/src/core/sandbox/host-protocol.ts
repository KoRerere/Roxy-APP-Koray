import type { ScriptPermissions } from '@/security/scriptPermissions'
import { z } from 'zod'
import { llmSerializableOptionsSchema } from '@/modes/sandbox-api/llm'

export const SANDBOX_HOST_PROTOCOL_VERSION = 1 as const

const nonEmptyString = z.string().min(1)
const generationSchema = nonEmptyString
const runIdSchema = nonEmptyString

export const sandboxRunPhaseSchema = z.enum([
  'run_received',
  'sandbox_execute_start',
  'filesystem_ready',
  'script_loaded',
  'vm_ready',
  'playwright_connect_start',
  'playwright_connect_end',
  'script_entry_start',
  'run_finished',
  'run_failed',
])
export type SandboxRunPhase = z.infer<typeof sandboxRunPhaseSchema>

export const sandboxStorageOperationSchema = z.object({
  action: nonEmptyString,
  count: z.number().int().nonnegative(),
  rowCount: z.number().int().nonnegative().optional(),
})

export const sandboxStorageChangeSchema = z.object({
  type: z.enum(['kv', 'table']),
  path: nonEmptyString,
  name: nonEmptyString,
  operations: z.array(sandboxStorageOperationSchema),
})

export const sandboxRunPayloadSchema = z.object({
  scriptPath: nonEmptyString,
  scriptSha512: z.string().optional(),
  assetSlug: nonEmptyString,
  profile: z.enum(['debug', 'release']),
  dirId: z.string().optional(),
  browserUrl: z.string().url(),
  browserType: z.enum(['chromium', 'firefox']),
  options: z.unknown(),
  permissions: z.object({
    version: z.literal(1),
    fs: z.object({ read: z.array(z.string()) }),
    fetch: z.object({ allow: z.array(z.string()) }),
  }),
  outputDir: nonEmptyString,
  browserOutputDir: nonEmptyString,
  logsDir: nonEmptyString,
  logFilePath: nonEmptyString,
  workspaceDir: z.string().optional(),
})

export interface SandboxRunPayload extends Omit<z.infer<typeof sandboxRunPayloadSchema>, 'permissions'> {
  permissions: ScriptPermissions
}

const baseAgentMessageSchema = z.object({
  protocolVersion: z.literal(SANDBOX_HOST_PROTOCOL_VERSION),
  generation: generationSchema,
})

export const sandboxAgentToHostMessageSchema = z.discriminatedUnion('type', [
  baseAgentMessageSchema.extend({
    type: z.literal('run.start'),
    runId: runIdSchema,
    payload: sandboxRunPayloadSchema,
  }),
  baseAgentMessageSchema.extend({
    type: z.literal('run.abort'),
    runId: runIdSchema,
    reason: z.enum(['user', 'task', 'timeout', 'shutdown']),
  }),
  baseAgentMessageSchema.extend({
    type: z.literal('host.drain'),
    reason: z.enum(['idle', 'max-runs', 'rss', 'upgrade', 'agent-shutdown']),
  }),
  baseAgentMessageSchema.extend({
    type: z.literal('host.shutdown'),
    reason: z.enum(['idle', 'max-runs', 'rss', 'upgrade', 'agent-shutdown', 'unhealthy']),
  }),
  baseAgentMessageSchema.extend({
    type: z.literal('rpc.llm.response'),
    runId: runIdSchema,
    requestId: nonEmptyString,
    ok: z.boolean(),
    value: z.unknown().optional(),
    error: z.string().optional(),
  }),
])

const baseHostMessageSchema = z.object({
  protocolVersion: z.literal(SANDBOX_HOST_PROTOCOL_VERSION),
  generation: generationSchema,
})

export const sandboxHostToAgentMessageSchema = z.discriminatedUnion('type', [
  baseHostMessageSchema.extend({
    type: z.literal('host.ready'),
    pid: z.number().int().positive(),
    startedAt: z.number().int().nonnegative(),
  }),
  baseHostMessageSchema.extend({
    type: z.literal('host.heartbeat'),
    pid: z.number().int().positive(),
    timestamp: z.number().int().nonnegative(),
    activeRuns: z.number().int().nonnegative(),
    memory: z.object({
      rss: z.number().int().nonnegative(),
      heapUsed: z.number().int().nonnegative(),
      external: z.number().int().nonnegative(),
    }),
    eventLoopDelayMs: z.number().nonnegative().optional(),
  }),
  baseHostMessageSchema.extend({
    type: z.literal('run.started'),
    runId: runIdSchema,
  }),
  baseHostMessageSchema.extend({
    type: z.literal('run.log'),
    runId: runIdSchema,
    level: nonEmptyString,
    message: z.string(),
  }),
  baseHostMessageSchema.extend({
    type: z.literal('run.phase'),
    runId: runIdSchema,
    phase: sandboxRunPhaseSchema,
    timestamp: z.number().int().nonnegative(),
  }),
  baseHostMessageSchema.extend({
    type: z.literal('run.finished'),
    runId: runIdSchema,
    result: z.object({
      status: z.enum(['done', 'failed', 'killed', 'timeout']),
      exitCode: z.number().int().nullable(),
      returnValue: z.string().optional(),
      artifactPaths: z.array(z.string()),
      storageChanges: z.array(sandboxStorageChangeSchema),
      error: z.string().optional(),
    }),
  }),
  baseHostMessageSchema.extend({
    type: z.literal('run.diagnostic'),
    runId: z.string().optional(),
    message: z.string(),
  }),
  baseHostMessageSchema.extend({
    type: z.literal('rpc.llm.request'),
    runId: runIdSchema,
    requestId: nonEmptyString,
    request: z.object({
      prompt: z.string(),
      schema: z.unknown().optional(),
      options: llmSerializableOptionsSchema.optional(),
    }),
  }),
  baseHostMessageSchema.extend({
    type: z.literal('host.fatal'),
    message: z.string(),
    stack: z.string().optional(),
  }),
])

export type SandboxAgentToHostMessage = z.infer<typeof sandboxAgentToHostMessageSchema>
export type SandboxHostToAgentMessage = z.infer<typeof sandboxHostToAgentMessageSchema>
export type SandboxHostRunResult = Extract<SandboxHostToAgentMessage, { type: 'run.finished' }>['result']
export type SandboxAgentCommand = SandboxAgentToHostMessage extends infer Message
  ? Message extends SandboxAgentToHostMessage
    ? Omit<Message, 'protocolVersion' | 'generation'>
    : never
  : never
export type SandboxHostEvent = SandboxHostToAgentMessage extends infer Message
  ? Message extends SandboxHostToAgentMessage
    ? Omit<Message, 'protocolVersion' | 'generation'>
    : never
  : never

export function parseSandboxAgentToHostMessage(value: unknown): SandboxAgentToHostMessage {
  return sandboxAgentToHostMessageSchema.parse(value)
}

export function parseSandboxHostToAgentMessage(value: unknown): SandboxHostToAgentMessage {
  return sandboxHostToAgentMessageSchema.parse(value)
}
