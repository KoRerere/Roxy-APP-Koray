import type { FileCollectorStore } from '../file-collector-store'
import type { ParamsSchema } from '@/modes/sandbox-api'
import type { StartedSandboxScriptRun } from '@/services/sandboxService'
import type { AgentRunEvent } from '@roxy/shared/channel'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import fsPromises from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { agentOfficialScriptsApi } from '@/api/agentApiClient'
import { streamEvents } from '@/core/agent-events/streamEvents'
import { isLoginRequired, LOGIN_REQUIRED_SCRIPT_RESULT } from '@/core/sandbox/script-entry'
import { agentPaths } from '@/core/storage/agentPaths'
import { extractScriptSelfDescription } from '@/script/scriptMeta'
import {
  extractScriptParamsDefaults,
  findMissingRequiredScriptParams,
  mergeScriptParams,
} from '@/script/scriptParams'
import { startSandboxScriptRun } from '@/services/sandboxService'
import { isAbsoluteLikePath, isHttpScriptUrl, resolveExecutableScriptSource } from './script_source'
import { parseScriptTemplateReference, resolveScriptTemplate } from './script_template_source'

const runScriptItemSchema = z.strictObject({
  scriptPath: z.string()
    .refine(value => value.trim().length > 0, 'scriptPath must not be blank')
    .describe('Canonical official:<id> or user:<id> script template reference, official script slug, or absolute local script path'),
  dirIds: z.array(z.string()
    .refine(value => value.trim().length > 0, 'dirIds must not contain blank values'))
    .min(1, 'dirIds must contain at least one profile')
    .describe('profile dirIds (Use roxy_profile_list). The same script runs in every listed browser window.'),
  debug: z.boolean()
    .default(false)
    .describe('Running the script in debug mode will increase logging and output HTML snapshots, facilitating script debugging.'),
  params: z.unknown().optional().describe('Script Run Parameters'),
})

/** 一次工具调用可提交多个脚本配置，每个配置可使用不同窗口和参数。 */
export const runScriptInputSchema = z.strictObject({
  scripts: z.array(runScriptItemSchema)
    .min(1, 'scripts must contain at least one script run')
    .describe('Independent script run specifications. All items run in parallel.'),
})

type RunScriptParam = z.infer<typeof runScriptItemSchema>
type RunScriptInput = z.infer<typeof runScriptInputSchema>

export interface ScriptRunResult {
  dirId: string
  runId: string
  status: ScriptExecutionStatus
  content: string
}

export interface RunScriptToolOptions {
  /** Run in a disposable temp workspace, used by ephemeral worker agents. */
  ephemeral?: boolean
  workspaceDir?: string
  defaultDirId?: string
  defaultProfile?: 'debug' | 'release'
  /** 完整日志内联到工具结果的最大 UTF-8 字节数。设为 0 可禁用日志内联。 */
  inlineLogMaxBytes?: number
  fileCollector?: FileCollectorStore
  /** 当前 Agent 运行在任务监控 Hub 中的执行 ID。 */
  taskMonitorTaskId?: string
  executionId?: string
  /** @deprecated 新路径默认使用 agentPaths.workdir(slug)。 */
  scriptOutputDir?: string
  /** @deprecated 新路径默认使用 agentPaths.workdirRunLogFile(slug, runId)。 */
  scriptLogsDir?: string
}

interface ResolvedScript {
  scriptPath: string
  assetSlug: string
  sourceKind: 'remote_managed' | 'local_file'
  editable: boolean
  scriptSha512?: string
  displayName?: string
  defaultParams?: Record<string, unknown>
  paramsSchema?: ParamsSchema
  cleanup?: () => Promise<void>
}

interface OfficialScriptDetail {
  slug?: unknown
  ossUrl?: unknown
  oss_url?: unknown
  sha512?: unknown
}

export const DEFAULT_INLINE_SCRIPT_LOG_MAX_BYTES = 8 * 1024

type ScriptExecutionStatus = 'success' | 'failed' | 'interrupted' | 'timeout' | 'login_required' | 'start_failed' | 'killed'

interface ScriptExecutionContext {
  sourceKind: ResolvedScript['sourceKind']
  editable: boolean
  status: ScriptExecutionStatus
}

const roxy_script_run_DESCRIPTION = [
  'Run one or more automation scripts in parallel.',
  'Pass a scripts array of run specifications. Each item has its own scriptPath, dirIds, params, and debug values.',
  'The scriptPath can be an official:<id> or user:<id> script template reference from an @script token, an official script slug, or an absolute local file path.',
  'Canonical template references resolve only within their namespace. Bare numeric ids are invalid. Remote scripts are downloaded from the OSS URL returned by the backend and must pass SHA-512 verification before execution.',
  'The script runs in a session-scoped VM inside the persistent roxy-agent Sandbox Host process with Chromium or Firefox access over BROWSER_URL and BROWSER_TYPE.',
  'The script entry signature is `export async function main(params)`; pass params as an object or JSON string.',
  'If main returns `LoginRequired`, the run fails and the user must login in target website before retrying.',
].join(' ')

const runScriptMessage = {
  aborted: 'Task was interrupted.',
  paramIsEmpty: (name: string) => `Parameter ${name} is empty, please check the parameters.`,
  directUrlNotAllowed: 'Direct script URLs are not allowed. Pass a canonical template reference or official script slug instead.',
  officialFieldMissing: (slug: string, field: string) => `Official script "${slug}" is missing ${field}.`,
  optionsParseFailed: (message: string) => `Failed to parse params as JSON: ${message}. Pass a valid JSON string or an object.`,
  resolveFailed: (scriptName: string, message: string) => `Failed to resolve script "${scriptName}": ${message}`,
  startFailed: (scriptName: string, message: string) => `Script "${scriptName}" failed to start: ${message}`,
  interrupted: (scriptName: string) => `Script "${scriptName}" was interrupted.`,
  success: (scriptName: string) => `Script "${scriptName}" completed successfully`,
  killed: (scriptName: string) => `Script "${scriptName}" failed: force terminated.`,
  timeout: (scriptName: string) => `Script "${scriptName}" failed: timed out.`,
  exitCode: (scriptName: string, code: number | null) => `Script "${scriptName}" failed with exit code ${code}.`,
  loginRequired: (scriptName: string) => [
    `Script "${scriptName}" failed because target website requires login.`,
    `Script return value: \`${LOGIN_REQUIRED_SCRIPT_RESULT}\`.`,
    'Ask the user to log in first, then retry roxy_script_run with the same window or windows.',
  ].join('\n'),
  missingTarget: (scriptName: string) => [
    `Script "${scriptName}" has no target browser window. Stop this run and ask the user which browser profiles/windows to use for this script.`,
    'You may call roxy_profile_list to list the available browser profiles in the current workspace for the user to choose, or ask the user directly for the window names/numbers. After the user confirms, retry roxy_script_run with those dirIds. Do not guess or pick windows on your own.',
  ].join('\n'),
  missingRequiredParams: (scriptName: string, params: string[]) => [
    '## Script parameters required',
    '',
    `Script "${scriptName}" was not started because these required parameters are missing or empty:`,
    '',
    ...params.map(param => `- \`${param}\``),
    '',
    'Ask the user to provide these values, then retry `roxy_script_run`.',
  ].join('\n'),
  logFile: (logPath: string, absolutePath?: string) => [
    '## Log file',
    '',
    `- path: \`${logPath}\``,
    absolutePath ? `- absolutePath: \`${absolutePath}\`` : '',
  ].filter(Boolean).join('\n'),
  inlineLog: (content: string, size: number, maxBytes: number) => [
    '## Log output',
    '',
    `Complete log (${size} bytes; inline limit: ${maxBytes} bytes):`,
    '',
    formatCodeBlock(content),
  ].join('\n'),
  oversizedLog: (size: number, maxBytes: number) => [
    `Log content was not inlined because it is ${size} bytes (inline limit: ${maxBytes} bytes).`,
    'Read this log file only if more detail is needed. Prefer a narrow window with `read_file` using `offset` and `limit`.',
  ].join(' '),
}

export function createRunId(): string {
  return `run_${timestamp()}_${randomUUID().slice(0, 8)}`
}

function timestamp(): string {
  return `${Math.floor(Date.now() / 1000)}`
}

function resolveRunPaths(runId: string, assetSlug: string, ephemeral = false): {
  outputDir: string
  logFilePath: string
  assetSlug: string
  cleanup?: () => Promise<void>
} {
  if (ephemeral) {
    const root = mkdtempSync(path.join(tmpdir(), 'roxy-worker-script-'))
    const outputDir = path.join(root, 'workdir', assetSlug)
    return {
      outputDir,
      logFilePath: path.join(root, 'logs', `${assetSlug}-${runId}.log`),
      assetSlug,
      cleanup: async () => rmSync(root, { recursive: true, force: true }),
    }
  }

  const outputDir = agentPaths.workdir(assetSlug)
  return {
    outputDir,
    logFilePath: agentPaths.workdirRunLogFile(assetSlug, runId),
    assetSlug: path.basename(outputDir),
  }
}

async function createLogFile(logFilePath: string): Promise<void> {
  await fsPromises.mkdir(path.dirname(logFilePath), { recursive: true })
  await fsPromises.writeFile(logFilePath, '', 'utf-8')
}

function formatLogFilePath(logFilePath: string, options: RunScriptToolOptions): string {
  if (options.ephemeral) {
    return runScriptMessage.logFile('(temporary worker log)')
  }

  const workspaceDir = options.workspaceDir ? path.resolve(options.workspaceDir) : undefined
  const resolved = path.resolve(logFilePath)
  if (workspaceDir && (resolved === workspaceDir || resolved.startsWith(workspaceDir + path.sep))) {
    const relativePath = path.relative(workspaceDir, resolved) || path.basename(resolved)
    return runScriptMessage.logFile(relativePath, resolved)
  }
  return runScriptMessage.logFile(resolved)
}

function withLogFile(result: string, logFilePath: string, options: RunScriptToolOptions): string {
  return `${result}\n\n${formatLogFilePath(logFilePath, options)}`
}

export function formatScriptContext(context: ScriptExecutionContext): string {
  return [
    '## Script context',
    '',
    `- sourceKind: \`${context.sourceKind}\``,
    `- editable: \`${context.editable}\``,
    `- status: \`${context.status}\``,
  ].join('\n')
}

interface RunLogSnapshot {
  size?: number
  content?: string
}

function resolveInlineLogMaxBytes(options: RunScriptToolOptions): number {
  const configured = options.inlineLogMaxBytes
  return typeof configured === 'number' && Number.isFinite(configured) && configured >= 0
    ? Math.floor(configured)
    : DEFAULT_INLINE_SCRIPT_LOG_MAX_BYTES
}

async function readRunLogSnapshot(logFilePath: string, maxBytes: number): Promise<RunLogSnapshot> {
  const stat = await fsPromises.stat(logFilePath).catch(() => null)
  if (!stat?.isFile()) {
    return {}
  }
  if (stat.size === 0 || stat.size > maxBytes) {
    return { size: stat.size }
  }

  const content = await fsPromises.readFile(logFilePath, 'utf-8').catch(() => undefined)
  if (content === undefined) {
    return { size: stat.size }
  }

  const actualSize = Buffer.byteLength(content, 'utf-8')
  return actualSize <= maxBytes
    ? { size: actualSize, content }
    : { size: actualSize }
}

function formatCodeBlock(content: string): string {
  const longestFence = Math.max(0, ...Array.from(content.matchAll(/`+/g), match => match[0].length))
  const fence = '`'.repeat(Math.max(3, longestFence + 1))
  const trailingNewline = content.endsWith('\n') ? '' : '\n'
  return `${fence}text\n${content}${trailingNewline}${fence}`
}

export function formatRunLog(
  snapshot: RunLogSnapshot,
  logFilePath: string,
  options: RunScriptToolOptions,
  includeLogFile: boolean,
): string {
  const maxBytes = resolveInlineLogMaxBytes(options)
  if (snapshot.content) {
    return runScriptMessage.inlineLog(snapshot.content, snapshot.size ?? 0, maxBytes)
  }

  if (snapshot.size && snapshot.size > 0) {
    return [
      formatLogFilePath(logFilePath, options),
      runScriptMessage.oversizedLog(snapshot.size, maxBytes),
    ].join('\n\n')
  }

  return includeLogFile ? formatLogFilePath(logFilePath, options) : ''
}

interface RunFailureDetails {
  status: Exclude<ScriptExecutionStatus, 'success'>
  exitCode: number | null
  error?: string
}

function formatFailureMessage(scriptName: string, failure: RunFailureDetails): string {
  const base = failure.status === 'killed'
    ? runScriptMessage.killed(scriptName)
    : failure.status === 'timeout'
      ? runScriptMessage.timeout(scriptName)
      : runScriptMessage.exitCode(scriptName, failure.exitCode)
  const error = failure.error?.trim()
  if (!error) {
    return base
  }

  return [
    base,
    '## Sandbox error',
    '',
    formatCodeBlock(error),
  ].join('\n\n')
}

export function formatRunFailure(
  scriptName: string,
  failure: RunFailureDetails,
  logFilePath: string,
  options: RunScriptToolOptions,
  changedFiles: ChangedRunFile[],
  logSnapshot: RunLogSnapshot,
  scriptContext: { sourceKind: ResolvedScript['sourceKind'], editable: boolean },
  includeLogFile = true,
): string {
  return withRunDetails(
    formatFailureMessage(scriptName, failure),
    logFilePath,
    options,
    changedFiles,
    logSnapshot,
    { ...scriptContext, status: failure.status },
    includeLogFile,
  )
}

interface ChangedRunFile {
  changeType: 'created' | 'modified'
  category: 'artifact' | 'log' | 'kv' | 'table'
  path: string
  displayName: string
  operations?: Array<{ action: string, count: number, rowCount?: number }>
}

function recordCollectedFile(
  fileCollector: FileCollectorStore,
  realPath: string,
  outputDir: string,
  assetSlug: string,
  changeType: 'created' | 'modified' = 'created',
): void {
  const resolved = path.resolve(realPath)
  const base = path.resolve(outputDir)
  const displayName = resolved === base || resolved.startsWith(base + path.sep)
    ? path.relative(base, resolved) || path.basename(resolved)
    : path.basename(resolved)

  fileCollector.record({
    virtualPath: `/workdir/${assetSlug}/${displayName}`,
    realPath: resolved,
    displayName,
    op: changeType === 'modified' ? 'edit' : 'write',
    source: 'roxy_script_run',
  })
}

function isRuntimeLogFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.log'
}

function isKvStateFile(filePath: string): boolean {
  return path.basename(filePath).toLowerCase().endsWith('.kv.json')
}

function shouldDescribeRunFile(filePath: string, type?: string): boolean {
  return type !== 'log' && !isRuntimeLogFile(filePath)
}

function shouldPublishRunFile(filePath: string, type?: string): boolean {
  return shouldDescribeRunFile(filePath, type) && type !== 'kv' && !isKvStateFile(filePath)
}

function shouldPublishRunOutput(output: { type: string, path: string }): boolean {
  return shouldPublishRunFile(output.path, output.type)
}

function displayNameForPath(filePath: string, outputDir: string): string {
  const resolved = path.resolve(filePath)
  const base = path.resolve(outputDir)
  return resolved === base || resolved.startsWith(base + path.sep)
    ? path.relative(base, resolved) || path.basename(resolved)
    : path.basename(resolved)
}

function collectChangedRunFiles(
  result: Awaited<StartedSandboxScriptRun['finished']>,
  outputDir: string,
): ChangedRunFile[] {
  const byPath = new Map<string, ChangedRunFile>()

  for (const artifact of result.artifacts) {
    if (!shouldDescribeRunFile(artifact.localPath)) {
      continue
    }

    const resolved = path.resolve(artifact.localPath)
    byPath.set(resolved, {
      changeType: artifact.changeType ?? 'created',
      category: 'artifact',
      path: resolved,
      displayName: artifact.relPath ?? displayNameForPath(resolved, outputDir),
    })
  }

  for (const output of result.outputs) {
    if (!shouldDescribeRunFile(output.path, output.type)) {
      continue
    }

    const resolved = path.resolve(output.path)
    byPath.set(resolved, {
      changeType: output.changeType ?? byPath.get(resolved)?.changeType ?? 'created',
      category: output.type,
      path: resolved,
      displayName: displayNameForPath(resolved, outputDir),
      operations: output.operations,
    })
  }

  return Array.from(byPath.values())
    .sort((a, b) =>
      a.changeType.localeCompare(b.changeType)
      || a.category.localeCompare(b.category)
      || a.displayName.localeCompare(b.displayName),
    )
}

function formatChangedRunFiles(files: ChangedRunFile[]): string {
  if (files.length === 0) {
    return ''
  }

  const created = files.filter(file => file.changeType === 'created')
  const modified = files.filter(file => file.changeType === 'modified')
  const formatGroup = (title: string, group: ChangedRunFile[]): string[] => {
    if (group.length === 0) {
      return []
    }
    return [
      `### ${title}`,
      ...group.map(file => `- \`${file.category}\` [${file.displayName}](${file.path})${formatOperations(file)}`),
    ]
  }

  return [
    '## Files changed',
    ...formatGroup('Created', created),
    ...formatGroup('Modified', modified),
  ].join('\n')
}

function formatOperations(file: ChangedRunFile): string {
  if (!file.operations?.length) {
    return ''
  }

  const text = file.operations.map((op) => {
    const details: string[] = []
    if (op.rowCount !== undefined) {
      details.push(`${op.rowCount} rows`)
    }
    return `${op.action} x${op.count}${details.length ? ` (${details.join('; ')})` : ''}`
  }).join(', ')

  return ` - ${text}`
}

function withRunDetails(
  result: string,
  logFilePath: string,
  options: RunScriptToolOptions,
  changedFiles: ChangedRunFile[],
  logSnapshot: RunLogSnapshot,
  scriptContext?: ScriptExecutionContext,
  includeLogFile = true,
): string {
  return [
    result,
    scriptContext ? formatScriptContext(scriptContext) : '',
    formatRunLog(logSnapshot, logFilePath, options, includeLogFile),
    formatChangedRunFiles(changedFiles),
  ].filter(Boolean).join('\n\n')
}

async function readScriptParams(scriptPath: string): Promise<{
  paramsSchema: ParamsSchema
  defaultParams: Record<string, unknown>
}> {
  const source = await fsPromises.readFile(scriptPath, 'utf-8')
  const description = extractScriptSelfDescription(source)
  return {
    paramsSchema: description.paramsSchema,
    defaultParams: extractScriptParamsDefaults(description.paramsSchema),
  }
}

async function resolveProvidedScriptPath(scriptPath: string, signal?: AbortSignal): Promise<ResolvedScript> {
  const trimmed = scriptPath.trim()
  if (!trimmed) {
    throw new Error(runScriptMessage.paramIsEmpty('scriptPath'))
  }

  if (isHttpScriptUrl(trimmed)) {
    throw new Error(runScriptMessage.directUrlNotAllowed)
  }

  if (isAbsoluteLikePath(trimmed)) {
    const resolved = await resolveExecutableScriptSource(trimmed, undefined, { signal })
    try {
      const scriptParams = await readScriptParams(resolved.scriptPath)
      return {
        scriptPath: resolved.scriptPath,
        assetSlug: resolved.assetSlug,
        sourceKind: 'local_file',
        editable: true,
        ...scriptParams,
        cleanup: resolved.cleanup,
      }
    }
    catch (error) {
      await resolved.cleanup?.()
      throw error
    }
  }

  const templateRef = parseScriptTemplateReference(scriptPath)
  if (templateRef) {
    const template = await resolveScriptTemplate(templateRef)
    const resolved = await resolveExecutableScriptSource(template.ossUrl, undefined, {
      signal,
      expectedSha512: template.sha512,
      fallbackAssetSlug: template.sourceSlug,
    })

    try {
      const scriptParams = templateRef.namespace === 'official'
        ? await readScriptParams(resolved.scriptPath)
        : {
            paramsSchema: template.paramsSchema,
            defaultParams: template.params ?? {},
          }
      return {
        scriptPath: resolved.scriptPath,
        assetSlug: resolved.assetSlug,
        sourceKind: 'remote_managed',
        editable: false,
        scriptSha512: template.sha512,
        displayName: template.name,
        ...scriptParams,
        cleanup: resolved.cleanup,
      }
    }
    catch (error) {
      await resolved.cleanup?.()
      throw error
    }
  }

  const detail = await agentOfficialScriptsApi.getBySlug(trimmed) as OfficialScriptDetail
  const ossUrl = typeof detail?.ossUrl === 'string' && detail.ossUrl.trim()
    ? detail.ossUrl.trim()
    : typeof detail?.oss_url === 'string' && detail.oss_url.trim()
      ? detail.oss_url.trim()
      : ''
  const sha512 = typeof detail?.sha512 === 'string' ? detail.sha512.trim() : ''

  if (!ossUrl) {
    throw new Error(runScriptMessage.officialFieldMissing(trimmed, 'OSS URL'))
  }
  if (!sha512) {
    throw new Error(runScriptMessage.officialFieldMissing(trimmed, 'SHA-512'))
  }

  const detailSlug = typeof detail?.slug === 'string' && detail.slug.trim() ? detail.slug.trim() : trimmed
  const resolved = await resolveExecutableScriptSource(ossUrl, undefined, {
    signal,
    expectedSha512: sha512,
    fallbackAssetSlug: detailSlug,
  })

  try {
    const scriptParams = await readScriptParams(resolved.scriptPath)
    return {
      scriptPath: resolved.scriptPath,
      assetSlug: resolved.assetSlug,
      sourceKind: 'remote_managed',
      editable: false,
      scriptSha512: sha512,
      ...scriptParams,
      cleanup: resolved.cleanup,
    }
  }
  catch (error) {
    await resolved.cleanup?.()
    throw error
  }
}

export function createRunScriptTool(options: RunScriptToolOptions = {}) {
  return {
    name: 'roxy_script_run',
    description: roxy_script_run_DESCRIPTION,
    schema: runScriptInputSchema,
    invoke: async (
      input: RunScriptInput,
      _config: any,
    ): Promise<string> => {
      const abortSignal: AbortSignal | undefined = _config?.signal

      if (abortSignal?.aborted) {
        return runScriptMessage.aborted
      }

      const writer: ((event: AgentRunEvent) => void) | undefined = (_config as any)?.writer
      const taskMonitorTaskId: string | undefined = options.taskMonitorTaskId
        ?? (_config as any)?.configurable?.taskMonitorTaskId
        ?? (_config as any)?.taskMonitorTaskId

      const groups = await Promise.all(input.scripts.map(runSpec => runScriptSpec(runSpec, {
        abortSignal,
        profile: runSpec.debug ? 'debug' : (options.defaultProfile || 'release'),
        writer,
        toolId: (_config as any)?.toolCall?.id,
        taskMonitorTaskId,
        options,
      })))

      if (groups.length === 1) {
        const group = groups[0]!
        if (group.error) {
          return group.error
        }
        if (group.results.length === 1) {
          return group.results[0]!.content
        }
        return formatBatchRunResults(group.scriptName, group.results)
      }
      return formatBatchRunGroups(groups)
    },
  }
}

export interface ScriptRunGroup {
  scriptName: string
  results: ScriptRunResult[]
  error?: string
}

interface RunScriptSpecContext {
  abortSignal?: AbortSignal
  profile: 'debug' | 'release'
  writer?: (event: AgentRunEvent) => void
  toolId?: string
  taskMonitorTaskId?: string
  options: RunScriptToolOptions
}

function parseRunScriptOptions(value: unknown): { value?: unknown, error?: string } {
  if (value === undefined || value === null) {
    return {}
  }
  if (typeof value !== 'string') {
    return { value }
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return {}
  }
  try {
    return { value: JSON.parse(trimmed) }
  }
  catch (error: any) {
    return { error: runScriptMessage.optionsParseFailed(String(error?.message ?? error)) }
  }
}

async function runScriptSpec(runSpec: RunScriptParam, context: RunScriptSpecContext): Promise<ScriptRunGroup> {
  const requestedScriptPath = runSpec.scriptPath.trim()
  const dirIds = [...new Set(runSpec.dirIds.map(dirId => dirId.trim()).filter(Boolean))]
  if (dirIds.length === 0) {
    return { scriptName: requestedScriptPath || 'script', results: [], error: runScriptMessage.missingTarget(requestedScriptPath) }
  }

  const parsedOptions = parseRunScriptOptions(runSpec.params)
  if (parsedOptions.error) {
    return { scriptName: requestedScriptPath || 'script', results: [], error: parsedOptions.error }
  }

  let resolved: ResolvedScript
  try {
    resolved = await resolveProvidedScriptPath(runSpec.scriptPath, context.abortSignal)
  }
  catch (error: any) {
    return {
      scriptName: requestedScriptPath || 'script',
      results: [],
      error: runScriptMessage.resolveFailed(requestedScriptPath, String(error?.message ?? error)),
    }
  }

  try {
    const displayName = resolved.displayName ?? requestedScriptPath
    const resolvedOptions = mergeScriptParams(resolved.defaultParams, parsedOptions.value)
    const missingRequiredParams = resolved.paramsSchema
      ? findMissingRequiredScriptParams(resolved.paramsSchema, resolvedOptions)
      : []
    if (missingRequiredParams.length > 0) {
      return { scriptName: displayName, results: [], error: runScriptMessage.missingRequiredParams(displayName, missingRequiredParams) }
    }

    const runInputs = dirIds.map(dirId => ({ runId: createRunId(), dirId }))
    const settled = await Promise.allSettled(runInputs.map(({ runId, dirId }) => runScriptInWindow({
      runId,
      dirId,
      scriptPath: resolved.scriptPath,
      scriptSha512: resolved.scriptSha512,
      assetSlug: resolved.assetSlug,
      displayName,
      profile: context.profile,
      resolvedOptions,
      sourceKind: resolved.sourceKind,
      editable: resolved.editable,
      originalScriptPath: runSpec.scriptPath,
      debug: Boolean(runSpec.debug),
      abortSignal: context.abortSignal,
      writer: context.writer,
      toolId: context.toolId,
      taskMonitorTaskId: context.taskMonitorTaskId,
      executionId: context.options.executionId,
      options: context.options,
      fileCollector: context.options.fileCollector,
    })))
    const results = settled.map((entry, index): ScriptRunResult => {
      if (entry.status === 'fulfilled') {
        return entry.value
      }
      const message = entry.reason instanceof Error ? entry.reason.message : String(entry.reason)
      const status: ScriptExecutionStatus = context.abortSignal?.aborted ? 'interrupted' : 'start_failed'
      return {
        dirId: runInputs[index]!.dirId,
        runId: runInputs[index]!.runId,
        status,
        content: status === 'interrupted'
          ? runScriptMessage.interrupted(displayName)
          : runScriptMessage.startFailed(displayName, message),
      }
    })
    return { scriptName: displayName, results }
  }
  finally {
    await resolved.cleanup?.()
  }
}

interface RunScriptInWindowOptions {
  runId: string
  dirId: string
  scriptPath: string
  scriptSha512?: string
  assetSlug: string
  displayName: string
  profile: 'debug' | 'release'
  resolvedOptions: unknown
  sourceKind: ResolvedScript['sourceKind']
  editable: boolean
  originalScriptPath: string
  debug: boolean
  abortSignal?: AbortSignal
  writer?: (event: AgentRunEvent) => void
  toolId?: string
  taskMonitorTaskId?: string
  executionId?: string
  options: RunScriptToolOptions
  fileCollector?: FileCollectorStore
}

async function runScriptInWindow(options: RunScriptInWindowOptions): Promise<ScriptRunResult> {
  const runId = options.runId
  const runPaths = resolveRunPaths(runId, options.assetSlug, options.options.ephemeral)
  const { outputDir, logFilePath, assetSlug } = runPaths
  let aborted = false
  const onAbort = () => {
    aborted = true
  }
  options.abortSignal?.addEventListener('abort', onAbort, { once: true })

  const finish = (status: ScriptExecutionStatus, content: string): ScriptRunResult => ({
    dirId: options.dirId,
    runId,
    status,
    content,
  })

  try {
    console.debug(`[roxy_script_run] Running: ${options.displayName}, path: ${options.scriptPath}, dirId: ${options.dirId}, runId: ${runId}`)
    await createLogFile(logFilePath)

    const run = await startSandboxScriptRun({
      scriptPath: options.scriptPath,
      scriptSha512: options.scriptSha512,
      dirId: options.dirId,
      runId,
      executionId: options.executionId,
      assetSlug,
      profile: options.profile,
      outputDir,
      workspaceDir: options.options.workspaceDir,
      logFilePath,
      options: options.resolvedOptions,
      signal: options.abortSignal,
      taskMonitor: options.taskMonitorTaskId
        ? {
            taskId: options.taskMonitorTaskId,
            browserId: options.dirId,
            label: options.dirId,
            input: { scriptPath: options.originalScriptPath, dirIds: [options.dirId], debug: options.debug },
          }
        : undefined,
      onLog: (msg) => {
        options.writer?.(streamEvents.scriptLog({
          scriptName: options.displayName,
          level: msg.level,
          message: msg.message,
          toolId: options.toolId,
          runId: msg.runId,
          dirId: options.dirId,
        }))
      },
    })

    const result = await run.finished
    const changedFiles = collectChangedRunFiles(result, outputDir)
    const logSnapshot = await readRunLogSnapshot(logFilePath, resolveInlineLogMaxBytes(options.options))
    if (aborted) {
      return finish('interrupted', withRunDetails(
        runScriptMessage.interrupted(options.displayName),
        logFilePath,
        options.options,
        changedFiles,
        logSnapshot,
        { sourceKind: options.sourceKind, editable: options.editable, status: 'interrupted' },
      ))
    }

    if (isLoginRequired(result.returnValue)) {
      return finish('login_required', withRunDetails(
        runScriptMessage.loginRequired(options.displayName),
        logFilePath,
        options.options,
        changedFiles,
        logSnapshot,
        { sourceKind: options.sourceKind, editable: options.editable, status: 'login_required' },
        options.profile === 'debug',
      ))
    }

    if (result.status === 'done') {
      if (options.profile === 'release' && options.fileCollector) {
        const recordedRealPaths = new Set<string>()
        for (const artifact of result.artifacts) {
          if (!shouldPublishRunFile(artifact.localPath)) {
            continue
          }

          recordCollectedFile(options.fileCollector, artifact.localPath, outputDir, assetSlug, artifact.changeType ?? 'created')
          recordedRealPaths.add(path.resolve(artifact.localPath))
        }
        for (const output of result.outputs) {
          if (!shouldPublishRunOutput(output) || recordedRealPaths.has(path.resolve(output.path))) {
            continue
          }
          recordCollectedFile(options.fileCollector, output.path, outputDir, assetSlug, output.changeType ?? 'created')
        }
      }

      return finish('success', withRunDetails(
        runScriptMessage.success(options.displayName),
        logFilePath,
        options.options,
        changedFiles,
        logSnapshot,
        { sourceKind: options.sourceKind, editable: options.editable, status: 'success' },
        options.profile === 'debug',
      ))
    }

    const status: ScriptExecutionStatus = result.status === 'killed' ? 'killed' : result.status === 'timeout' ? 'timeout' : 'failed'
    return finish(status, formatRunFailure(
      options.displayName,
      {
        status,
        exitCode: result.exitCode,
        ...(result.error ? { error: result.error } : {}),
      },
      logFilePath,
      options.options,
      changedFiles,
      logSnapshot,
      { sourceKind: options.sourceKind, editable: options.editable },
      options.profile === 'debug',
    ))
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[roxy_script_run] Failed to run script dirId=${options.dirId} runId=${runId}: ${message}`)
    options.writer?.(streamEvents.scriptLog({
      scriptName: options.displayName,
      level: 'error',
      message,
      toolId: options.toolId,
      dirId: options.dirId,
    }))
    if (options.abortSignal?.aborted) {
      return finish('interrupted', runScriptMessage.interrupted(options.displayName))
    }
    return finish('start_failed', options.profile === 'debug'
      ? withLogFile(
          `${runScriptMessage.startFailed(options.displayName, message)}\n\n${formatScriptContext({ sourceKind: options.sourceKind, editable: options.editable, status: 'start_failed' })}`,
          logFilePath,
          options.options,
        )
      : runScriptMessage.startFailed(options.displayName, message))
  }
  finally {
    options.abortSignal?.removeEventListener('abort', onAbort)
    await runPaths.cleanup?.()
  }
}

export function formatBatchRunResults(scriptName: string, results: ScriptRunResult[]): string {
  const successCount = results.filter(result => result.status === 'success').length
  const interruptedCount = results.filter(result => result.status === 'interrupted').length
  const failedCount = results.length - successCount - interruptedCount
  const overallStatus = interruptedCount > 0
    ? 'interrupted'
    : successCount === results.length
      ? 'success'
      : successCount > 0
        ? 'partial_failure'
        : 'failed'

  return [
    '## Batch script result',
    '',
    `- script: \`${scriptName}\``,
    `- status: \`${overallStatus}\``,
    `- total: ${results.length}`,
    `- success: ${successCount}`,
    `- failed: ${failedCount}`,
    `- interrupted: ${interruptedCount}`,
    '',
    ...results.flatMap(result => [
      `### Window \`${result.dirId}\``,
      `- runId: \`${result.runId}\``,
      `- status: \`${result.status}\``,
      '',
      result.content,
      '',
    ]),
  ].join('\n').trim()
}

export function formatBatchRunGroups(groups: ScriptRunGroup[]): string {
  const successful = groups.flatMap(group => group.results).filter(result => result.status === 'success').length
  const failed = groups.flatMap(group => group.results).filter(result => result.status !== 'success' && result.status !== 'interrupted').length
  const interrupted = groups.flatMap(group => group.results).filter(result => result.status === 'interrupted').length
  const errors = groups.filter(group => group.error).length
  const total = groups.reduce((count, group) => count + Math.max(group.results.length, group.error ? 1 : 0), 0)
  const overallStatus = interrupted > 0
    ? 'interrupted'
    : failed + errors === 0
      ? 'success'
      : successful > 0
        ? 'partial_failure'
        : 'failed'

  return [
    '## Batch script result',
    '',
    `- status: \`${overallStatus}\``,
    `- total: ${total}`,
    `- success: ${successful}`,
    `- failed: ${failed + errors}`,
    `- interrupted: ${interrupted}`,
    '',
    ...groups.flatMap(group => [
      `### Script \`${group.scriptName}\``,
      ...(group.error
        ? [group.error]
        : group.results.map(result => [
            `### Window \`${result.dirId}\``,
            `- runId: \`${result.runId}\``,
            `- status: \`${result.status}\``,
            '',
            result.content,
          ].join('\n'))),
      '',
    ]),
  ].join('\n').trim()
}
