import type { SandboxHostReservation } from './sandboxHostManager'
import type { SandboxProfile } from '@/core/sandbox/sandbox-runtime'
import { RoxyBrowserClient } from '@roxybrowser/openapi'
import { randomUUID } from 'node:crypto'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { env } from '@/config'
import { profileLeaseRegistry } from '@/core/profiles/profileLeaseRegistry'
import { isLoginRequired } from '@/core/sandbox/script-entry'
import { agentPaths } from '@/core/storage/agentPaths'
import {
  publishTaskMonitorBrowserAttached,
  publishTaskMonitorBrowserEvent,
  publishTaskMonitorBrowserFinished,
} from '@/core/task-monitor'
import { assertAllowedRemoteScriptUrl } from '@/script/remoteScriptPolicy'
import { assertSha512 } from '@/security/scriptIntegrity'
import { readScriptPermissions } from '@/security/scriptPermissions'
import { sandboxHostManager } from './sandboxHostManager'

export type SandboxRunStatus = 'done' | 'failed' | 'killed' | 'timeout'

export interface SandboxLogEvent {
  level: string
  message: string
  runId: string
}

export interface SandboxArtifact {
  fileName: string
  localPath: string
  size: number
  /** 相对于 outputDir 的路径（含子目录层级，如 output/a.csv） */
  relPath?: string
  changeType?: SandboxFileChangeType
}

export type SandboxFileChangeType = 'created' | 'modified'
export type SandboxRunOutputType = 'log' | 'kv' | 'table'

export interface SandboxRunOutputOperation {
  action: string
  count: number
  rowCount?: number
}

export interface SandboxRunOutput {
  type: SandboxRunOutputType
  path: string
  changeType?: SandboxFileChangeType
  operations?: SandboxRunOutputOperation[]
}

export interface SandboxRunResult {
  status: SandboxRunStatus
  exitCode: number | null
  returnValue?: string
  artifacts: SandboxArtifact[]
  outputs: SandboxRunOutput[]
  logFilePath?: string
  error?: string
}

export interface StartSandboxScriptRunOptions {
  scriptPath: string
  scriptSha512?: string
  assetSlug?: string
  browserUrl?: string
  browserType?: 'chromium' | 'firefox'
  dirId?: string
  runId?: string
  /** Parent Agent/task execution owner. Defaults to this sandbox run. */
  executionId?: string
  profile?: SandboxProfile
  workspaceDir?: string
  outputDir?: string
  logsDir?: string
  logFilePath?: string
  permissionsFile?: string
  options?: unknown
  signal?: AbortSignal
  onLog?: (event: SandboxLogEvent) => void
  taskMonitor?: {
    taskId: string
    browserId?: string
    label?: string
    input?: Record<string, unknown>
  }
}

export interface StartedSandboxScriptRun {
  runId: string
  browserUrl?: string
  browserType?: 'chromium' | 'firefox'
  dirId?: string
  profile: SandboxProfile
  outputDir: string
  logFilePath?: string
  finished: Promise<SandboxRunResult>
  stop: () => void
}

const sandboxOwners = new Map<string, string>()

export function getOccupiedSandboxDirIds(): string[] {
  return Array.from(sandboxOwners.keys())
}

/** RoxyBrowser 已打开窗口的连接信息（来自 launchInfo） */
export interface BrowserConnection {
  /** 用于自动化的 WebSocket 端点（chromium 为 CDP 端点，firefox 为 WebDriver BiDi 端点） */
  ws: string
  /** 内核类型：'firefox' | 'chromium'（由 launchInfo.marionette_port 推断：有值即 firefox） */
  browserType: 'firefox' | 'chromium'
}

/**
 * 由 launchInfo 的 marionette_port 字段推断浏览器内核类型。
 * chromium 内核该字段为 undefined / 空字符串。任何无法判定的情况都降级为 chromium。
 */
function inferBrowserType(marionettePort: unknown, ws?: string): 'firefox' | 'chromium' {
  return marionettePort !== undefined && marionettePort !== null && String(marionettePort) !== ''
    || Boolean(ws && !ws.includes('/devtools/browser/'))
    ? 'firefox'
    : 'chromium'
}

let roxyBrowserClient: RoxyBrowserClient | undefined

function getRoxyBrowserClient(): RoxyBrowserClient {
  const workspaceId = env.ROXY_WORKSPACE_ID
  if (!workspaceId) {
    throw new Error('ROXY_WORKSPACE_ID is not configured')
  }

  return roxyBrowserClient ??= new RoxyBrowserClient({
    baseUrl: env.ROXY_API_HOST,
    apiKey: env.ROXY_API_KEY,
    workspaceId: Number(workspaceId),
  })
}

function scriptPathToAssetSlug(scriptPath: string): string {
  const baseName = path.basename(scriptPath)
  const ext = path.extname(baseName)
  return (ext ? baseName.slice(0, -ext.length) : baseName) || 'script'
}

function isRemoteScriptPath(scriptPath: string): boolean {
  return /^https?:\/\//.test(scriptPath)
}

export async function openBrowserForDirId(dirId: string): Promise<BrowserConnection> {
  const opened = await getRoxyBrowserClient().profiles.open(dirId, { forceOpen: true })
  const data = Array.isArray(opened) ? opened[0] : opened
  const ws = data?.ws
  if (!ws) {
    throw new Error('Browser opened but WebSocket URL was not returned')
  }

  return {
    ws,
    browserType: inferBrowserType(undefined, ws),
  }
}

/**
 * 查询指定分身是否已打开，若已打开则返回其现有连接信息（ws + 浏览器类型），否则返回 null。
 * 用于脚本运行前复用对话中已打开的窗口，避免无谓地 forceOpen 重开。
 * 任何异常都降级为 null（由调用方回退到 openBrowserForDirId 打开）。
 */
export async function getOpenedCdpForDirId(dirId: string): Promise<BrowserConnection | null> {
  try {
    const rows = await getRoxyBrowserClient().profiles.connectionInfo([dirId])
    const matched = rows.find(conn => String(conn.dirId) === String(dirId))
    if (!matched?.ws) {
      return null
    }
    return {
      ws: matched.ws,
      browserType: inferBrowserType(undefined, matched.ws),
    }
  }
  catch {
    return null
  }
}

/** 产物黑名单：元文件不作为产物收集 */
const ARTIFACT_BLACKLIST = new Set([
  'source.ts',
  'script.ts',
  'schema.json',
  'recording.jsonl',
  'meta.json',
])

function isBlacklisted(fileName: string): boolean {
  if (ARTIFACT_BLACKLIST.has(fileName)) {
    return true
  }
  if (fileName.endsWith('.log')) {
    return true
  }
  if (fileName.endsWith('.db') || fileName.endsWith('.db-wal') || fileName.endsWith('.db-shm')) {
    return true
  }
  return false
}

/**
 * 递归扫描 outputDir，收集所有落盘的产物文件（兜底）。
 * 覆盖脚本写入子目录的场景（如 output/x.csv）。
 * @param outputDir sandbox 工作目录（base）
 */
async function scanArtifacts(outputDir: string): Promise<Map<string, SandboxArtifact>> {
  const base = path.resolve(outputDir)
  const found = new Map<string, SandboxArtifact>()

  async function walk(dir: string): Promise<void> {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (!entry.isFile()) {
        continue
      }
      if (isBlacklisted(entry.name)) {
        continue
      }
      const stat = await fsPromises.stat(full).catch(() => null)
      if (!stat?.isFile()) {
        continue
      }

      if (entry.name.endsWith('.log')) {
        continue
      }

      const resolved = path.resolve(full)
      found.set(resolved, {
        fileName: entry.name,
        localPath: resolved,
        size: stat.size,
        relPath: path.relative(base, resolved),
      })
    }
  }

  await walk(base)
  return found
}

function isCurrentRunArtifact(stat: { mtimeMs: number }, startedAtMs?: number): boolean {
  if (startedAtMs === undefined) {
    return true
  }
  // Give the filesystem timestamp a little slack for coarse mtime precision.
  return stat.mtimeMs >= startedAtMs - 1000
}

function resolveChangeType(filePath: string, existingFilePaths?: Set<string>): SandboxFileChangeType {
  return existingFilePaths?.has(path.resolve(filePath)) ? 'modified' : 'created'
}

async function collectArtifacts(
  outputDir: string,
  reportedPaths?: string[],
  startedAtMs?: number,
  existingFilePaths?: Set<string>,
): Promise<SandboxArtifact[]> {
  const base = path.resolve(outputDir)
  // 以绝对路径为 key 去重，IPC 与扫描结果合并
  const byPath = new Map<string, SandboxArtifact>()

  // 1) IPC 上报清单（精确，区分脚本主动写入）
  for (const p of reportedPaths ?? []) {
    const resolved = path.resolve(p)
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
      continue
    }
    const fileName = path.basename(resolved)
    if (isBlacklisted(fileName)) {
      continue
    }
    const stat = await fsPromises.stat(resolved).catch(() => null)
    if (!stat?.isFile()) {
      continue
    }
    if (!isCurrentRunArtifact(stat, startedAtMs)) {
      continue
    }
    byPath.set(resolved, {
      fileName,
      localPath: resolved,
      size: stat.size,
      relPath: path.relative(base, resolved),
      changeType: resolveChangeType(resolved, existingFilePaths),
    })
  }

  // 2) 递归扫描兜底（覆盖 IPC 漏报 / 上报时机过早 / 子进程写入）
  const scanned = await scanArtifacts(outputDir)
  for (const [resolved, artifact] of scanned) {
    const stat = await fsPromises.stat(resolved).catch(() => null)
    if (!stat?.isFile() || !isCurrentRunArtifact(stat, startedAtMs)) {
      continue
    }
    artifact.changeType = resolveChangeType(resolved, existingFilePaths)
    if (!byPath.has(resolved)) {
      byPath.set(resolved, artifact)
    }
  }

  return Array.from(byPath.values())
}

function outputTypeForFile(fileName: string): SandboxRunOutputType | null {
  if (fileName.endsWith('.kv.json')) {
    return 'kv'
  }
  if (fileName.endsWith('.csv')) {
    return 'table'
  }
  return null
}

async function collectRunOutputs(
  outputDir: string,
  logFilePath: string,
  startedAtMs?: number,
  existingFilePaths?: Set<string>,
  reportedChanges?: SandboxRunOutput[],
): Promise<SandboxRunOutput[]> {
  const outputs = new Map<string, SandboxRunOutput>()

  const add = (type: SandboxRunOutputType, filePath: string, operations?: SandboxRunOutputOperation[]): void => {
    const resolved = path.resolve(filePath)
    const key = `${type}:${resolved}`
    const previous = outputs.get(key)
    outputs.set(key, {
      type,
      path: resolved,
      changeType: resolveChangeType(resolved, existingFilePaths),
      ...((operations?.length ? operations : previous?.operations)?.length
        ? { operations: operations?.length ? operations : previous!.operations }
        : {}),
    })
  }

  for (const change of reportedChanges ?? []) {
    add(change.type, change.path, change.operations)
  }

  const logStat = await fsPromises.stat(logFilePath).catch(() => null)
  if (logStat?.isFile()) {
    add('log', logFilePath)
  }

  const base = path.resolve(outputDir)
  async function walk(dir: string): Promise<void> {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (!entry.isFile()) {
        continue
      }

      const type = outputTypeForFile(entry.name)
      if (!type) {
        continue
      }

      const stat = await fsPromises.stat(full).catch(() => null)
      if (!stat?.isFile() || !isCurrentRunArtifact(stat, startedAtMs)) {
        continue
      }

      const resolved = path.resolve(full)
      if (resolved === base || !resolved.startsWith(base + path.sep)) {
        continue
      }
      add(type, resolved)
    }
  }

  await walk(base)
  const typeOrder: Record<SandboxRunOutputType, number> = { log: 0, kv: 1, table: 2 }
  return Array.from(outputs.values())
    .sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || a.path.localeCompare(b.path))
}

async function collectExistingFilePaths(outputDir: string, logFilePath: string): Promise<Set<string>> {
  const existing = new Set<string>()

  const addIfFile = async (filePath: string): Promise<void> => {
    const resolved = path.resolve(filePath)
    const stat = await fsPromises.stat(resolved).catch(() => null)
    if (stat?.isFile()) {
      existing.add(resolved)
    }
  }

  async function walk(dir: string): Promise<void> {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (entry.isFile()) {
        existing.add(path.resolve(full))
      }
    }
  }

  await Promise.all([
    walk(path.resolve(outputDir)),
    addIfFile(logFilePath),
  ])
  return existing
}

async function materializeScript(scriptPath: string, scriptSha512: string | undefined, runId: string): Promise<{
  scriptPath: string
  cleanup: () => Promise<void>
}> {
  if (!isRemoteScriptPath(scriptPath)) {
    return { scriptPath: path.resolve(scriptPath), cleanup: async () => {} }
  }

  assertAllowedRemoteScriptUrl(scriptPath)
  const response = await fetch(scriptPath)
  if (!response.ok) {
    throw new Error(`Failed to fetch script: ${response.status} ${response.statusText}`)
  }
  const source = Buffer.from(await response.arrayBuffer())
  if (scriptSha512) {
    assertSha512(source, scriptSha512)
  }
  await fsPromises.mkdir(agentPaths.tmpDir, { recursive: true })
  const tempDir = await fsPromises.mkdtemp(path.join(agentPaths.tmpDir, `sandbox-${runId}-`))
  const localPath = path.join(tempDir, 'source.ts')
  await fsPromises.writeFile(localPath, source)
  return {
    scriptPath: localPath,
    cleanup: () => fsPromises.rm(tempDir, { recursive: true, force: true }),
  }
}

async function startSandboxScriptRunInternal(opts: StartSandboxScriptRunOptions): Promise<StartedSandboxScriptRun> {
  const profile = opts.profile ?? 'release'
  const runId = opts.runId ?? `run_${Date.now()}_${randomUUID().slice(0, 8)}`
  const executionId = opts.executionId ?? `sandbox:${runId}`
  const dirId = opts.dirId
  const startedAtMs = Date.now()
  let browserUrl = opts.browserUrl
  let browserType: 'chromium' | 'firefox' = opts.browserType ?? 'chromium'
  let dirOccupied = false
  let releaseBrowserOperation: (() => void) | undefined

  const requestedAssetSlug = opts.assetSlug ?? scriptPathToAssetSlug(opts.scriptPath)
  const outputDir = opts.outputDir ?? agentPaths.workdir(requestedAssetSlug)
  const assetSlug = path.basename(outputDir)
  const browserOutputDir = path.join(
    outputDir,
    path.relative(agentPaths.workdir(requestedAssetSlug), agentPaths.workdirBrowserDir(requestedAssetSlug)),
  )
  const logFilePath = opts.logFilePath ?? agentPaths.workdirRunLogFile(assetSlug, runId)
  const logsDir = opts.logsDir ?? path.dirname(logFilePath)
  const permissionsFile = opts.permissionsFile ?? agentPaths.scriptPermissionsFile(requestedAssetSlug)
  const permissions = await readScriptPermissions(permissionsFile)
  const materialized = await materializeScript(opts.scriptPath, opts.scriptSha512, runId)
  let reservation: SandboxHostReservation | undefined

  try {
    await Promise.all([
      fsPromises.mkdir(outputDir, { recursive: true }),
      fsPromises.mkdir(browserOutputDir, { recursive: true }),
      fsPromises.mkdir(logsDir, { recursive: true }),
      fsPromises.mkdir(path.dirname(logFilePath), { recursive: true }),
    ])
    const existingFilePaths = await collectExistingFilePaths(outputDir, logFilePath)
    reservation = await sandboxHostManager.reserve(opts.signal)

    if (dirId) {
      profileLeaseRegistry.acquire({ executionId, runId, sourceType: 'sandbox' }, [dirId])
      releaseBrowserOperation = await profileLeaseRegistry.acquireOperation(dirId)
      sandboxOwners.set(dirId, executionId)
      dirOccupied = true
    }

    if (!browserUrl && dirId) {
      const conn = await getOpenedCdpForDirId(dirId) ?? await openBrowserForDirId(dirId)
      browserUrl = conn.ws
      browserType = conn.browserType
    }
    if (!browserUrl) {
      throw new Error('Sandbox run requires a browser WebSocket endpoint')
    }

    const hostRun = await reservation.start(runId, {
      scriptPath: materialized.scriptPath,
      ...(opts.scriptSha512 ? { scriptSha512: opts.scriptSha512 } : {}),
      assetSlug,
      profile,
      ...(dirId ? { dirId } : {}),
      browserUrl,
      browserType,
      options: opts.options ?? {},
      permissions,
      outputDir,
      browserOutputDir,
      logsDir,
      logFilePath,
      ...(opts.workspaceDir ? { workspaceDir: opts.workspaceDir } : {}),
    }, { onLog: opts.onLog })

    const finished = hostRun.finished.then(async (hostResult): Promise<SandboxRunResult> => {
      const reportedChanges: SandboxRunOutput[] = hostResult.storageChanges.map(change => ({
        type: change.type,
        path: change.path,
        operations: change.operations,
      }))
      const [artifacts, outputs] = await Promise.all([
        hostResult.status === 'done'
          ? collectArtifacts(outputDir, hostResult.artifactPaths, startedAtMs, existingFilePaths)
          : Promise.resolve([]),
        collectRunOutputs(outputDir, logFilePath, startedAtMs, existingFilePaths, reportedChanges),
      ])
      const status = hostResult.status === 'done' && isLoginRequired(hostResult.returnValue)
        ? 'failed'
        : hostResult.status
      return {
        status,
        exitCode: hostResult.exitCode,
        ...(hostResult.returnValue !== undefined ? { returnValue: hostResult.returnValue } : {}),
        artifacts,
        outputs,
        logFilePath,
        ...(hostResult.error !== undefined ? { error: hostResult.error } : {}),
      }
    }).finally(async () => {
      if (dirOccupied && dirId) {
        releaseBrowserOperation?.()
        sandboxOwners.delete(dirId)
        if (opts.executionId === undefined) {
          profileLeaseRegistry.release(executionId)
        }
      }
      await materialized.cleanup()
    })

    return {
      runId,
      browserUrl,
      browserType,
      dirId,
      profile,
      outputDir,
      logFilePath,
      finished,
      stop: () => hostRun.stop('user'),
    }
  }
  catch (error) {
    reservation?.release()
    if (dirOccupied && dirId) {
      releaseBrowserOperation?.()
      sandboxOwners.delete(dirId)
      if (opts.executionId === undefined) {
        profileLeaseRegistry.release(executionId)
      }
    }
    await materialized.cleanup()
    throw error
  }
}

export async function startSandboxScriptRun(opts: StartSandboxScriptRunOptions): Promise<StartedSandboxScriptRun> {
  const taskMonitor = opts.taskMonitor
  if (!taskMonitor) {
    return startSandboxScriptRunInternal(opts)
  }

  const runId = opts.runId ?? `run_${Date.now()}_${randomUUID().slice(0, 8)}`
  const profile = opts.profile ?? 'release'
  const dirId = opts.dirId
  const browserId = taskMonitor.browserId ?? dirId ?? runId
  const monitorInput = taskMonitor.input ?? {
    scriptPath: opts.scriptPath,
    ...(dirId ? { dirId } : {}),
    runId,
    profile,
  }
  const monitorStartedAt = Date.now()
  let browserAttached = false
  let browserFinishedPublished = false

  const publishBrowserFinished = (): void => {
    if (!browserAttached || browserFinishedPublished) {
      return
    }

    browserFinishedPublished = true
    publishTaskMonitorBrowserFinished({
      taskId: taskMonitor.taskId,
      browserId,
      dirId,
    })
  }

  const publishFailure = (error: unknown): void => {
    if (!browserAttached) {
      return
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    publishTaskMonitorBrowserEvent({
      taskId: taskMonitor.taskId,
      browserId,
      dirId,
      stage: 'error',
      toolName: 'roxy_script_run',
      input: monitorInput,
      result: errorMessage,
      success: false,
      errorMessage,
      durationMs: Date.now() - monitorStartedAt,
      timestamp: Date.now(),
    })
  }

  try {
    const run = await startSandboxScriptRunInternal({ ...opts, runId })
    if (run.browserUrl) {
      browserAttached = true
      publishTaskMonitorBrowserAttached({
        taskId: taskMonitor.taskId,
        browserId,
        dirId,
        label: taskMonitor.label ?? dirId ?? browserId,
        ws: run.browserUrl,
        browserType: run.browserType,
      })
      publishTaskMonitorBrowserEvent({
        taskId: taskMonitor.taskId,
        browserId,
        dirId,
        stage: 'start',
        toolName: 'roxy_script_run',
        input: monitorInput,
        success: true,
        timestamp: monitorStartedAt,
      })
    }

    const finished = run.finished.then((result) => {
      try {
        if (!browserAttached) {
          return result
        }

        const succeeded = result.status === 'done' && !isLoginRequired(result.returnValue)
        const monitorResult = result.returnValue ?? result.error ?? result.status
        publishTaskMonitorBrowserEvent({
          taskId: taskMonitor.taskId,
          browserId,
          dirId,
          stage: succeeded ? 'end' : 'error',
          toolName: 'roxy_script_run',
          input: monitorInput,
          result: monitorResult,
          success: succeeded,
          errorMessage: succeeded ? undefined : monitorResult,
          durationMs: Date.now() - monitorStartedAt,
          timestamp: Date.now(),
        })
      }
      finally {
        publishBrowserFinished()
      }
      return result
    }, (error) => {
      try {
        publishFailure(error)
      }
      finally {
        publishBrowserFinished()
      }
      throw error
    })

    return { ...run, finished }
  }
  catch (error) {
    try {
      publishFailure(error)
    }
    finally {
      publishBrowserFinished()
    }
    throw error
  }
}
