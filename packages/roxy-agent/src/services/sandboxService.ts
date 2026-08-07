import type { SandboxProfile } from '@/core/sandbox/sandbox-runtime'
import type { Buffer } from 'node:buffer'
import type { ChildProcess } from 'node:child_process'
import { fork } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { env } from '@/config'
import { isLoginRequired } from '@/core/sandbox/script-entry'
import { agentPaths } from '@/core/storage/agentPaths'
import {
  publishTaskMonitorBrowserAttached,
  publishTaskMonitorBrowserEvent,
  publishTaskMonitorBrowserFinished,
} from '@/core/task-monitor'
import { assertAllowedRemoteScriptUrl } from '@/script/remoteScriptPolicy'
import { readScriptPermissions } from '@/security/scriptPermissions'

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
}

export interface StartSandboxScriptRunOptions {
  scriptPath: string
  scriptSha512?: string
  assetSlug?: string
  browserUrl?: string
  browserType?: 'chromium' | 'firefox'
  dirId?: string
  runId?: string
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
  worker: ChildProcess
  finished: Promise<SandboxRunResult>
  stop: () => void
}

const occupiedDirIds = new Set<string>()

function captureChildOutput(
  stream: NodeJS.ReadableStream | null | undefined,
  source: 'stdout' | 'stderr',
  logFilePath: string,
  runId: string,
  onLog?: (event: SandboxLogEvent) => void,
): void {
  if (!stream)
    return

  let pending = ''
  const level = source === 'stderr' ? 'error' : 'info'

  function appendLine(line: string): void {
    if (!line)
      return
    const message = `[sandbox ${source}] ${line}`
    const timestamp = new Date().toISOString()
    try {
      fs.appendFileSync(logFilePath, `[${timestamp}] [${level.toUpperCase()}] ${message}\n`, 'utf-8')
    }
    catch (err: any) {
      console.error(`[sandboxService] Failed to capture ${source}: ${err?.message ?? err}`)
    }
    onLog?.({ level, message, runId })
  }

  stream.setEncoding?.('utf-8')
  stream.on('data', (chunk: string | Buffer) => {
    pending += chunk.toString()
    const lines = pending.split(/\r?\n/)
    pending = lines.pop() ?? ''
    for (const line of lines)
      appendLine(line)
  })
  stream.on('end', () => {
    if (pending)
      appendLine(pending)
    pending = ''
  })
}

export function getOccupiedSandboxDirIds(): string[] {
  return Array.from(occupiedDirIds)
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
function inferBrowserType(marionettePort: unknown): 'firefox' | 'chromium' {
  return marionettePort !== undefined && marionettePort !== null && String(marionettePort) !== ''
    ? 'firefox'
    : 'chromium'
}

function scriptPathToAssetSlug(scriptPath: string): string {
  const baseName = path.basename(scriptPath)
  const ext = path.extname(baseName)
  return (ext ? baseName.slice(0, -ext.length) : baseName) || 'script'
}

function isRemoteScriptPath(scriptPath: string): boolean {
  return /^https?:\/\//.test(scriptPath)
}

/**
 * 从入口 bundle 所在目录向上逐级收集存在的 node_modules 目录。
 * dev 环境下入口（apps/electron/dist-vite/agent.mjs）会 externalize axios 等依赖，
 * Node ESM resolver 需读取这些 node_modules 下的 package.json；权限模型必须放行。
 * 入口 bundle 是受信任代码，放开其依赖树的读取是安全的。
 */
function collectEntryNodeModules(modulePath: string): string[] {
  const found: string[] = []
  let dir = path.dirname(path.resolve(modulePath))
  while (true) {
    const candidate = path.join(dir, 'node_modules')
    if (fs.existsSync(candidate))
      found.push(candidate)
    const parent = path.dirname(dir)
    if (parent === dir)
      break
    dir = parent
  }
  return found
}

function buildSandboxExecArgv(
  modulePath: string,
  scriptPath: string,
  outputDir: string,
  logsDir: string,
  extraReadPaths: string[],
): string[] {
  const readPaths = new Set<string>([
    path.resolve(modulePath),
    path.dirname(path.resolve(modulePath)),
    path.resolve(outputDir),
  ])

  for (const nodeModulesDir of collectEntryNodeModules(modulePath))
    readPaths.add(nodeModulesDir)

  if (!isRemoteScriptPath(scriptPath))
    readPaths.add(path.resolve(scriptPath))
  for (const readPath of extraReadPaths)
    readPaths.add(readPath)

  return [
    '--experimental-strip-types',
    '--experimental-vm-modules',
    // '--permission',
    // ...Array.from(readPaths, p => `--allow-fs-read=${p}`),
    // `--allow-fs-write=${path.resolve(outputDir)}`,
    // `--allow-fs-write=${path.resolve(logsDir)}`,
  ]
}

export async function openBrowserForDirId(dirId: string): Promise<BrowserConnection> {
  const workspaceId = env.ROXY_WORKSPACE_ID
  if (!workspaceId) {
    throw new Error('ROXY_WORKSPACE_ID is not configured')
  }

  const res = await fetch(`${env.ROXY_API_HOST}/browser/open`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'token': env.ROXY_API_KEY!,
    },
    body: JSON.stringify({ workspaceId: Number(workspaceId), dirId, forceOpen: true }),
  })

  if (!res.ok) {
    throw new Error(`Browser open request failed: ${res.status} ${res.statusText}`)
  }

  const json = await res.json() as { code: number, msg?: string, data?: { ws?: string, marionette_port?: unknown } }
  if (json.code !== 0) {
    throw new Error(json.msg || 'Failed to open browser')
  }

  const ws = json.data?.ws
  if (!ws) {
    throw new Error('Browser opened but WebSocket URL was not returned')
  }

  return { ws, browserType: inferBrowserType(json.data?.marionette_port) }
}

/**
 * 查询指定分身是否已打开，若已打开则返回其现有连接信息（ws + 浏览器类型），否则返回 null。
 * 用于脚本运行前复用对话中已打开的窗口，避免无谓地 forceOpen 重开。
 * 任何异常都降级为 null（由调用方回退到 openBrowserForDirId 打开）。
 */
export async function getOpenedCdpForDirId(dirId: string): Promise<BrowserConnection | null> {
  try {
    const res = await fetch(`${env.ROXY_API_HOST}/browser/connection_info?dirIds=${encodeURIComponent(dirId)}`, {
      method: 'GET',
      headers: {
        token: env.ROXY_API_KEY!,
      },
    })

    if (!res.ok)
      return null

    const json = await res.json() as { code: number, data?: Array<{ dirId?: string | number, ws?: string, marionette_port?: unknown }> }
    if (json.code !== 0 || !Array.isArray(json.data))
      return null

    const matched = json.data.find(conn => String(conn.dirId) === String(dirId))
    if (!matched?.ws)
      return null
    return { ws: matched.ws, browserType: inferBrowserType(matched.marionette_port) }
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
  if (ARTIFACT_BLACKLIST.has(fileName))
    return true
  if (fileName.endsWith('.log'))
    return true
  if (fileName.endsWith('.db') || fileName.endsWith('.db-wal') || fileName.endsWith('.db-shm'))
    return true
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
      if (!entry.isFile())
        continue
      if (isBlacklisted(entry.name))
        continue
      const stat = await fsPromises.stat(full).catch(() => null)
      if (!stat?.isFile())
        continue

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
  if (startedAtMs === undefined)
    return true
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
    if (resolved !== base && !resolved.startsWith(base + path.sep))
      continue
    const fileName = path.basename(resolved)
    if (isBlacklisted(fileName))
      continue
    const stat = await fsPromises.stat(resolved).catch(() => null)
    if (!stat?.isFile())
      continue
    if (!isCurrentRunArtifact(stat, startedAtMs))
      continue
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
    if (!stat?.isFile() || !isCurrentRunArtifact(stat, startedAtMs))
      continue
    artifact.changeType = resolveChangeType(resolved, existingFilePaths)
    if (!byPath.has(resolved))
      byPath.set(resolved, artifact)
  }

  return Array.from(byPath.values())
}

function outputTypeForFile(fileName: string): SandboxRunOutputType | null {
  if (fileName.endsWith('.kv.json'))
    return 'kv'
  if (fileName.endsWith('.csv'))
    return 'table'
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

  for (const change of reportedChanges ?? [])
    add(change.type, change.path, change.operations)

  const logStat = await fsPromises.stat(logFilePath).catch(() => null)
  if (logStat?.isFile())
    add('log', logFilePath)

  const base = path.resolve(outputDir)
  async function walk(dir: string): Promise<void> {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (!entry.isFile())
        continue

      const type = outputTypeForFile(entry.name)
      if (!type)
        continue

      const stat = await fsPromises.stat(full).catch(() => null)
      if (!stat?.isFile() || !isCurrentRunArtifact(stat, startedAtMs))
        continue

      const resolved = path.resolve(full)
      if (resolved === base || !resolved.startsWith(base + path.sep))
        continue
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
    if (stat?.isFile())
      existing.add(resolved)
  }

  async function walk(dir: string): Promise<void> {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (entry.isFile())
        existing.add(path.resolve(full))
    }
  }

  await Promise.all([
    walk(path.resolve(outputDir)),
    addIfFile(logFilePath),
  ])
  return existing
}

async function startSandboxScriptRunInternal(opts: StartSandboxScriptRunOptions): Promise<StartedSandboxScriptRun> {
  if (isRemoteScriptPath(opts.scriptPath))
    assertAllowedRemoteScriptUrl(opts.scriptPath)

  const profile = opts.profile ?? 'release'
  const runId = opts.runId ?? `run_${Date.now()}_${randomUUID().slice(0, 8)}`
  const dirId = opts.dirId
  const startedAtMs = Date.now()
  // browserUrl/browserType：从 RoxyBrowser 窗口连接信息统一填充；调用方也可直接提供。
  let browserUrl = opts.browserUrl
  let browserType: 'chromium' | 'firefox' | undefined = opts.browserType
  let dirOccupied = false

  const requestedAssetSlug = opts.assetSlug ?? scriptPathToAssetSlug(opts.scriptPath)
  // 父子进程共用脚本工作区；table/kv 与其他长期产物均归属 workdir/{slug}。
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
  await fsPromises.mkdir(outputDir, { recursive: true })
  await fsPromises.mkdir(browserOutputDir, { recursive: true })
  await fsPromises.mkdir(logsDir, { recursive: true })
  await fsPromises.mkdir(path.dirname(logFilePath), { recursive: true })
  const existingFilePaths = await collectExistingFilePaths(outputDir, logFilePath)

  if (dirId) {
    if (occupiedDirIds.has(dirId)) {
      throw new Error(`Browser ${dirId} is already running a script`)
    }
    occupiedDirIds.add(dirId)
    dirOccupied = true
  }

  // 准备运行环境：获取 RoxyBrowser 窗口的连接端点。
  // 统一注入 BROWSER_URL（=ws）+ BROWSER_TYPE（chromium/firefox），
  if (!browserUrl && dirId) {
    // 先尝试复用已打开窗口，避免无谓 forceOpen 重开
    let conn: BrowserConnection | null = null
    try {
      conn = await getOpenedCdpForDirId(dirId)
    }
    catch {
      conn = null
    }
    if (!conn) {
      try {
        conn = await openBrowserForDirId(dirId)
      }
      catch (err) {
        occupiedDirIds.delete(dirId)
        throw err
      }
    }

    // 无论 chromium/firefox 都统一注入 BROWSER_URL/BROWSER_TYPE
    browserUrl = conn.ws
    browserType = conn.browserType
  }

  const modulePath = env.AGENT_SCRIPT_PATH
  let worker: ChildProcess
  try {
    worker = fork(modulePath, [opts.scriptPath], {
      env: {
        ...process.env,
        ROXY_MODE: 'sandbox',
        // 统一注入 BROWSER_URL/BROWSER_TYPE chromium/firefox.connect(BROWSER_URL)。
        SANDBOX_RUN_ID: runId,
        SANDBOX_ASSET_SLUG: assetSlug,
        ...(dirId ? { SANDBOX_DIR_ID: dirId } : {}),
        SANDBOX_DEBUG: profile === 'debug' ? '1' : '0',
        SANDBOX_OUTPUT_DIR: outputDir,
        SANDBOX_BROWSER_DIR: browserOutputDir,
        // Playwright Page API uses this root for relative screenshot paths.
        ROXY_PLAYWRIGHT_SCREENSHOTS_DIR: browserOutputDir,
        BROWSER_URL: browserUrl ?? '',
        BROWSER_TYPE: browserType ?? 'chromium',
        ...(opts.workspaceDir ? { SANDBOX_WORKSPACE_DIR: opts.workspaceDir } : {}),
        SANDBOX_LOGS_DIR: logsDir,
        SANDBOX_LOG_FILE: logFilePath,
        SANDBOX_PERMISSIONS: JSON.stringify(permissions),
        ...(opts.options !== undefined ? { SANDBOX_OPTIONS: JSON.stringify(opts.options) } : {}),
        ...(opts.scriptSha512 ? { SANDBOX_SCRIPT_SHA512: opts.scriptSha512 } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      execArgv: buildSandboxExecArgv(modulePath, opts.scriptPath, outputDir, logsDir, permissions.fs.read),
      execPath: process.execPath,
    })
  }
  catch (err) {
    if (dirOccupied && dirId) {
      occupiedDirIds.delete(dirId)
    }
    throw err
  }

  captureChildOutput(worker.stdout, 'stdout', logFilePath, runId, opts.onLog)
  captureChildOutput(worker.stderr, 'stderr', logFilePath, runId, opts.onLog)

  let reportedArtifactPaths: string[] | undefined
  let reportedOutputChanges: SandboxRunOutput[] | undefined
  let reportedReturnValue: string | undefined

  let settled = false
  let resolveFinished!: (result: SandboxRunResult) => void
  const finished = new Promise<SandboxRunResult>((resolve) => {
    resolveFinished = resolve
  })

  async function settle(status: SandboxRunStatus, exitCode: number | null): Promise<void> {
    if (settled)
      return
    settled = true
    if (dirOccupied && dirId) {
      occupiedDirIds.delete(dirId)
    }
    opts.signal?.removeEventListener('abort', onAbort)
    const [artifacts, outputs] = await Promise.all([
      status === 'done' ? collectArtifacts(outputDir, reportedArtifactPaths, startedAtMs, existingFilePaths) : Promise.resolve([]),
      collectRunOutputs(outputDir, logFilePath, startedAtMs, existingFilePaths, reportedOutputChanges),
    ])
    const normalizedStatus = status === 'done' && isLoginRequired(reportedReturnValue)
      ? 'failed'
      : status
    resolveFinished({
      status: normalizedStatus,
      exitCode,
      ...(reportedReturnValue !== undefined ? { returnValue: reportedReturnValue } : {}),
      artifacts,
      outputs,
      logFilePath,
    })
  }

  function onAbort(): void {
    worker.kill('SIGTERM')
  }

  if (opts.signal) {
    if (opts.signal.aborted) {
      worker.kill('SIGTERM')
    }
    else {
      opts.signal.addEventListener('abort', onAbort, { once: true })
    }
  }

  worker.on('message', (msg: any) => {
    if (!msg || typeof msg !== 'object')
      return

    if (msg.type === 'script_result') {
      if (msg.runId === runId && typeof msg.returnValue === 'string') {
        reportedReturnValue = msg.returnValue
      }
    }
    else if (msg.type === 'script_artifacts') {
      reportedArtifactPaths = Array.isArray(msg.paths) ? msg.paths : []
      reportedOutputChanges = Array.isArray(msg.changes)
        ? msg.changes
            .filter((change: any) => (change?.type === 'kv' || change?.type === 'table') && typeof change.path === 'string')
            .map((change: any) => ({
              type: change.type,
              path: change.path,
              operations: Array.isArray(change.operations)
                ? change.operations
                    .filter((op: any) => typeof op?.action === 'string' && typeof op?.count === 'number')
                    .map((op: any) => ({
                      action: op.action,
                      count: op.count,
                      ...(typeof op.rowCount === 'number' ? { rowCount: op.rowCount } : {}),
                    }))
                : undefined,
            }))
        : undefined
    }
    else if (msg.type === 'script_log') {
      opts.onLog?.({
        level: msg.level || 'info',
        message: msg.message,
        runId: msg.runId || runId,
      })
    }
  })

  worker.on('error', (err) => {
    opts.onLog?.({ level: 'error', message: err.message, runId })
    void settle('failed', null)
  })

  // close fires after stdout/stderr have closed, so all fallback output is in the script log before completion.
  worker.on('close', (code, signal) => {
    if (signal === 'SIGKILL') {
      void settle('killed', null)
    }
    else if (code === 124) {
      void settle('timeout', 124)
    }
    else if (code === 0) {
      // script_artifacts 与 exit 走独立通道，exit 可能先于最后一条 IPC message 到达。
      // 让出一个 microtask tick，使已到达的 IPC 消息先 drain 再 settle。
      void Promise.resolve().then(() => settle('done', 0))
    }
    else {
      void settle('failed', code)
    }
  })

  return {
    runId,
    browserUrl,
    browserType: browserUrl ? browserType : undefined,
    dirId,
    profile,
    outputDir,
    logFilePath,
    worker,
    finished,
    stop: () => worker.kill('SIGTERM'),
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
  let browserFinishedPublished = false

  const publishBrowserFinished = (): void => {
    if (browserFinishedPublished) {
      return
    }

    browserFinishedPublished = true
    publishTaskMonitorBrowserFinished({
      taskId: taskMonitor.taskId,
      browserId,
      dirId,
    })
  }

  publishTaskMonitorBrowserAttached({
    taskId: taskMonitor.taskId,
    browserId,
    dirId,
    label: taskMonitor.label ?? dirId ?? browserId,
  })
  publishTaskMonitorBrowserEvent({
    taskId: taskMonitor.taskId,
    browserId,
    dirId,
    stage: 'start',
    toolName: 'run_script',
    input: monitorInput,
    success: true,
    timestamp: monitorStartedAt,
  })

  const publishFailure = (error: unknown): void => {
    const errorMessage = error instanceof Error ? error.message : String(error)
    publishTaskMonitorBrowserEvent({
      taskId: taskMonitor.taskId,
      browserId,
      dirId,
      stage: 'error',
      toolName: 'run_script',
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
    publishTaskMonitorBrowserAttached({
      taskId: taskMonitor.taskId,
      browserId,
      dirId,
      label: taskMonitor.label ?? dirId ?? browserId,
      ws: run.browserUrl,
      browserType: run.browserType,
    })

    const finished = run.finished.then((result) => {
      try {
        const succeeded = result.status === 'done' && !isLoginRequired(result.returnValue)
        const monitorResult = result.returnValue ?? result.status
        publishTaskMonitorBrowserEvent({
          taskId: taskMonitor.taskId,
          browserId,
          dirId,
          stage: succeeded ? 'end' : 'error',
          toolName: 'run_script',
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
