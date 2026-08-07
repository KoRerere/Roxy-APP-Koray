import type { FileCollectorStore } from '../fileCollector'
import type { StartedSandboxScriptRun } from '@/services/sandboxService'
import type { StructuredToolInterface } from '@langchain/core/tools'
import type { ParamsSchema } from '@roxy/sandbox'
import type { AgentRunEvent } from '@roxy/shared/channel'
import { tool } from 'langchain'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import fsPromises from 'node:fs/promises'
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

interface RunScriptParam {
  /** 真正执行的脚本入口：canonical 模板引用、官方脚本 slug 或本地脚本绝对路径。 */
  scriptPath: string
  dirId?: string
  debug?: boolean
  /** 脚本入参 params：可为 object 或 JSON string。运行时 typeof 判断后解析，注入子进程供 main(params) 使用。 */
  params?: unknown
}

export interface RunScriptToolOptions {
  workspaceDir?: string
  defaultDirId?: string
  defaultProfile?: 'debug' | 'release'
  /** 完整日志内联到工具结果的最大 UTF-8 字节数。设为 0 可禁用日志内联。 */
  inlineLogMaxBytes?: number
  fileCollector?: FileCollectorStore
  /** 当前 Agent 运行在任务监控 Hub 中的执行 ID。 */
  taskMonitorTaskId?: string
  /** @deprecated 新路径默认使用 agentPaths.workdir(slug)。 */
  scriptOutputDir?: string
  /** @deprecated 新路径默认使用 agentPaths.workdirRunLogFile(slug, runId)。 */
  scriptLogsDir?: string
}

interface ResolvedScript {
  scriptPath: string
  assetSlug: string
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

const RUN_SCRIPT_DESCRIPTION = [
  'Run an automation script.',
  'The scriptPath can be an official:<id> or user:<id> script template reference from an @script token, an official script slug, or an absolute local file path.',
  'Canonical template references resolve only within their namespace. Bare numeric ids are invalid. Remote scripts are downloaded from the OSS URL returned by the backend and must pass SHA-512 verification before execution.',
  'The script runs in a forked roxy-agent sandbox child process with browser access over BROWSER_URL.',
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
    'Ask the user to log in first, then retry run_script with the same window.',
  ].join('\n'),
  missingTarget: (scriptName: string) => [
    `Script "${scriptName}" has no target browser window. Stop this run and ask the user which browser profile/window to use for this script.`,
    'You may call roxy_list_browsers to list the available browser profiles in the current workspace for the user to choose, or ask the user directly for the window name/number. After the user confirms, retry run_script with that dirId. Do not guess or pick a window on your own.',
  ].join('\n'),
  missingRequiredParams: (scriptName: string, params: string[]) => [
    '## Script parameters required',
    '',
    `Script "${scriptName}" was not started because these required parameters are missing or empty:`,
    '',
    ...params.map(param => `- \`${param}\``),
    '',
    'Ask the user to provide these values, then retry `run_script`.',
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
  oversizedLog: (size: number, maxBytes: number) => `Log content was not inlined because it is ${size} bytes (inline limit: ${maxBytes} bytes).`,
}

export function createRunId(): string {
  return `run_${timestamp()}_${randomUUID().slice(0, 8)}`
}

function timestamp(): string {
  return `${Math.floor(Date.now() / 1000)}`
}

function resolveRunPaths(runId: string, assetSlug: string): { outputDir: string, logFilePath: string, assetSlug: string } {
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
  if (!stat?.isFile())
    return {}
  if (stat.size === 0 || stat.size > maxBytes)
    return { size: stat.size }

  const content = await fsPromises.readFile(logFilePath, 'utf-8').catch(() => undefined)
  if (content === undefined)
    return { size: stat.size }

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

function formatRunLog(
  snapshot: RunLogSnapshot,
  logFilePath: string,
  options: RunScriptToolOptions,
  includeLogFile: boolean,
): string {
  const maxBytes = resolveInlineLogMaxBytes(options)
  if (snapshot.content) {
    return [
      runScriptMessage.inlineLog(snapshot.content, snapshot.size ?? 0, maxBytes),
      includeLogFile ? formatLogFilePath(logFilePath, options) : '',
    ].filter(Boolean).join('\n\n')
  }

  if (snapshot.size && snapshot.size > 0) {
    return [
      formatLogFilePath(logFilePath, options),
      runScriptMessage.oversizedLog(snapshot.size, maxBytes),
    ].join('\n\n')
  }

  return includeLogFile ? formatLogFilePath(logFilePath, options) : ''
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
  if (files.length === 0)
    return ''

  const created = files.filter(file => file.changeType === 'created')
  const modified = files.filter(file => file.changeType === 'modified')
  const formatGroup = (title: string, group: ChangedRunFile[]): string[] => {
    if (group.length === 0)
      return []
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
  if (!file.operations?.length)
    return ''

  const text = file.operations.map((op) => {
    const details: string[] = []
    if (op.rowCount !== undefined)
      details.push(`${op.rowCount} rows`)
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
  includeLogFile = true,
): string {
  return [
    result,
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

  if (!ossUrl)
    throw new Error(runScriptMessage.officialFieldMissing(trimmed, 'OSS URL'))
  if (!sha512)
    throw new Error(runScriptMessage.officialFieldMissing(trimmed, 'SHA-512'))

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

export function createRunScriptTool(options: RunScriptToolOptions = {}): StructuredToolInterface {
  return tool(
    async (
      input: RunScriptParam,
      _config: any,
    ): Promise<string> => {
      const abortSignal: AbortSignal | undefined = _config?.signal

      if (abortSignal?.aborted) {
        return runScriptMessage.aborted
      }

      const runSpec = input
      const requestedScriptPath = runSpec.scriptPath.trim()

      const dirId = runSpec.dirId?.trim() || options.defaultDirId
      if (!dirId) {
        return runScriptMessage.missingTarget(requestedScriptPath)
      }

      // 解析脚本入参 params：接受 object 或 JSON string。string 解析失败时返回错误，不静默吞掉。
      let explicitOptions: unknown
      if (runSpec.params === undefined || runSpec.params === null) {
        explicitOptions = undefined
      }
      else if (typeof runSpec.params === 'string') {
        const trimmed = runSpec.params.trim()
        if (!trimmed) {
          explicitOptions = undefined
        }
        else {
          try {
            explicitOptions = JSON.parse(trimmed)
          }
          catch (err: any) {
            return runScriptMessage.optionsParseFailed(String(err?.message ?? err))
          }
        }
      }
      else {
        explicitOptions = runSpec.params
      }

      let resolved: ResolvedScript
      try {
        resolved = await resolveProvidedScriptPath(runSpec.scriptPath, abortSignal)
      }
      catch (err: any) {
        return runScriptMessage.resolveFailed(requestedScriptPath, String(err?.message ?? err))
      }

      const { scriptPath, assetSlug, scriptSha512 } = resolved
      const displayName = resolved.displayName ?? requestedScriptPath
      const resolvedOptions = mergeScriptParams(resolved.defaultParams, explicitOptions)
      const missingRequiredParams = resolved.paramsSchema
        ? findMissingRequiredScriptParams(resolved.paramsSchema, resolvedOptions)
        : []
      if (missingRequiredParams.length > 0) {
        return runScriptMessage.missingRequiredParams(displayName, missingRequiredParams)
      }

      console.debug(`[run_script] Running: ${displayName}, path: ${scriptPath}, dirId: ${dirId}`)

      const profile = runSpec.debug ? 'debug' : (options.defaultProfile || 'release')
      const runId = createRunId()
      const { outputDir, logFilePath, assetSlug: resolvedAssetSlug } = resolveRunPaths(runId, assetSlug)

      let aborted = false
      const onAbort = () => {
        aborted = true
      }
      abortSignal?.addEventListener('abort', onAbort, { once: true })

      const writer: ((event: AgentRunEvent) => void) | undefined = (_config as any)?.writer
      const taskMonitorTaskId: string | undefined = options.taskMonitorTaskId
        ?? (_config as any)?.configurable?.taskMonitorTaskId
        ?? (_config as any)?.taskMonitorTaskId
      try {
        await createLogFile(logFilePath)

        const run = await startSandboxScriptRun({
          scriptPath,
          scriptSha512,
          dirId,
          runId,
          assetSlug: resolvedAssetSlug,
          profile,
          outputDir,
          workspaceDir: options.workspaceDir,
          logFilePath,
          options: resolvedOptions,
          signal: abortSignal,
          taskMonitor: taskMonitorTaskId
            ? {
                taskId: taskMonitorTaskId,
                browserId: dirId,
                label: dirId,
                input: { scriptPath: runSpec.scriptPath, dirId, debug: Boolean(runSpec.debug) },
              }
            : undefined,
          onLog: (msg) => {
            writer?.(streamEvents.scriptLog({
              scriptName: displayName,
              level: msg.level,
              message: msg.message,
              toolId: (_config as any)?.toolCall?.id,
              runId: msg.runId,
            }))
          },
        })

        const result = await run.finished
        const changedFiles = collectChangedRunFiles(result, outputDir)
        const logSnapshot = await readRunLogSnapshot(logFilePath, resolveInlineLogMaxBytes(options))
        if (aborted)
          return withRunDetails(runScriptMessage.interrupted(displayName), logFilePath, options, changedFiles, logSnapshot)

        if (isLoginRequired(result.returnValue)) {
          return withRunDetails(
            runScriptMessage.loginRequired(displayName),
            logFilePath,
            options,
            changedFiles,
            logSnapshot,
            profile === 'debug',
          )
        }

        if (result.status === 'done') {
          // release 模式：将产物注册到 fileCollector，轮末统一由 publishCollectedFiles 入库推送
          if (profile === 'release' && options.fileCollector) {
            const recordedRealPaths = new Set<string>()
            for (const a of result.artifacts) {
              if (!shouldPublishRunFile(a.localPath))
                continue

              recordCollectedFile(options.fileCollector, a.localPath, outputDir, resolvedAssetSlug, a.changeType ?? 'created')
              recordedRealPaths.add(path.resolve(a.localPath))
            }
            for (const output of result.outputs) {
              if (!shouldPublishRunOutput(output))
                continue

              if (recordedRealPaths.has(path.resolve(output.path)))
                continue
              recordCollectedFile(options.fileCollector, output.path, outputDir, resolvedAssetSlug, output.changeType ?? 'created')
            }
          }

          return withRunDetails(runScriptMessage.success(displayName), logFilePath, options, changedFiles, logSnapshot, profile === 'debug')
        }
        if (result.status === 'killed')
          return withRunDetails(runScriptMessage.killed(displayName), logFilePath, options, changedFiles, logSnapshot, profile === 'debug')
        if (result.status === 'timeout')
          return withRunDetails(runScriptMessage.timeout(displayName), logFilePath, options, changedFiles, logSnapshot, profile === 'debug')
        return withRunDetails(runScriptMessage.exitCode(displayName, result.exitCode), logFilePath, options, changedFiles, logSnapshot, profile === 'debug')
      }
      catch (err: any) {
        console.error(`[run_script] Failed to run script: ${err?.message ?? String(err)}`)
        writer?.(streamEvents.scriptLog({
          scriptName: displayName,
          level: 'error',
          message: err?.message ?? String(err),
          toolId: (_config as any)?.toolCall?.id,
        }))
        return profile === 'debug'
          ? withLogFile(runScriptMessage.startFailed(displayName, err?.message ?? String(err)), logFilePath, options)
          : runScriptMessage.startFailed(displayName, err?.message ?? String(err))
      }
      finally {
        abortSignal?.removeEventListener('abort', onAbort)
        await resolved?.cleanup?.()
      }
    },
    {
      name: 'run_script',
      // 运行自动化脚本
      description: RUN_SCRIPT_DESCRIPTION,
      schema: z.object({
        // canonical 模板引用、官方脚本 slug 或本地脚本绝对路径。
        scriptPath: z.string().describe('Canonical official:<id> or user:<id> script template reference, official script slug, or absolute local script path'),
        // 脚本在哪个浏览器窗口中执行。
        dirId: z.string().describe('profile dirId (Use roxy_list_browsers). The script will run in the browser of this dirId.'),
        // debug模式中运行脚本，会增加日志，以及html快照输出，方便调试脚本。
        debug: z.boolean().optional().describe('Running the script in debug mode will increase logging and output HTML snapshots, facilitating script debugging.').default(false),
        // 脚本运行参数
        params: z.unknown().optional().describe('Script Run Parameters'),
      }),
    },
  ) as unknown as StructuredToolInterface
}
