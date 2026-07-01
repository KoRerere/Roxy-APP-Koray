import type { SandboxProfile } from '@/core/sandbox/sandbox-runtime'
import type { ChildProcess } from 'node:child_process'
import { fork } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { env } from '@/config'

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
}

export interface SandboxRunResult {
  status: SandboxRunStatus
  exitCode: number | null
  artifacts: SandboxArtifact[]
  logFilePath?: string
}

export interface StartSandboxScriptRunOptions {
  scriptPath: string
  cdpUrl?: string
  browserUrl?: string
  browserType?: 'chromium' | 'firefox'
  dirId?: string
  runId?: string
  profile?: SandboxProfile
  workspaceDir?: string
  outputDir?: string
  logsDir?: string
  logFilePath?: string
  options?: unknown
  signal?: AbortSignal
  onLog?: (event: SandboxLogEvent) => void
}

export interface StartedSandboxScriptRun {
  runId: string
  cdpUrl?: string
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

function currentProcessEntryPath(): string | undefined {
  const entry = process.argv[1]
  if (!entry)
    return undefined
  return path.isAbsolute(entry) ? entry : path.resolve(entry)
}

function sandboxPath(): string {
  const explicitPath = env.AGENT_SCRIPT_PATH || env.AGENT_ENTRY_SCRIPT
  if (explicitPath)
    return explicitPath

  if (env.ENV_TYPE === 'development') {
    const entryPath = currentProcessEntryPath()
    if (entryPath)
      return entryPath
  }

  if (env.CHECKPOINT_DIR)
    return path.resolve(env.CHECKPOINT_DIR, '../roxy-agent.mjs')

  throw new Error('AGENT_SCRIPT_PATH or CHECKPOINT_DIR must be set before starting sandbox process')
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
 * RoxyBrowser 仅 Firefox 内核会暴露 marionette_port（供 Selenium/GeckoDriver 使用），
 * chromium 内核该字段为 undefined / 空字符串。任何无法判定的情况都降级为 chromium。
 */
function inferBrowserType(marionettePort: unknown): 'firefox' | 'chromium' {
  return marionettePort !== undefined && marionettePort !== null && String(marionettePort) !== ''
    ? 'firefox'
    : 'chromium'
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
  'events.jsonl',
  'conversation.jsonl',
  'recording_summary.md',
  'refined_script.ts',
  'enhanced_script.ts',
  'raw_skeleton.ts',
  'enhance_session.jsonl',
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

/**
 * 收集脚本产物：IPC 上报清单优先 + 递归扫描兜底，取并集去重。
 * 即使脚本是浮动 Promise、IPC 上报为空或漏报，只要文件真正落盘即可采到。
 * @param outputDir sandbox 工作目录（base）
 * @param reportedPaths IPC 上报的绝对路径列表（可能为空）
 */
async function collectArtifacts(outputDir: string, reportedPaths?: string[]): Promise<SandboxArtifact[]> {
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
    byPath.set(resolved, {
      fileName,
      localPath: resolved,
      size: stat.size,
      relPath: path.relative(base, resolved),
    })
  }

  // 2) 递归扫描兜底（覆盖 IPC 漏报 / 上报时机过早 / 子进程写入）
  const scanned = await scanArtifacts(outputDir)
  for (const [resolved, artifact] of scanned) {
    if (!byPath.has(resolved))
      byPath.set(resolved, artifact)
  }

  return Array.from(byPath.values())
}

export async function startSandboxScriptRun(opts: StartSandboxScriptRunOptions): Promise<StartedSandboxScriptRun> {
  const profile = opts.profile ?? 'release'
  const runId = opts.runId ?? `run_${Date.now()}_${randomUUID().slice(0, 8)}`
  const dirId = opts.dirId
  // browserUrl/browserType：仅当 SUPPORT_FIREFOX 开启并成功获取浏览器类型时才填充，
  // 否则保持 undefined，注入阶段回退到原 CDP_URL 方案。
  let browserUrl = opts.browserUrl
  let browserType: 'chromium' | 'firefox' | undefined = opts.browserType
  let cdpUrl = opts.cdpUrl
  let dirOccupied = false

  // 统一 outputDir：父进程与子进程使用同一路径
  const outputDir = opts.outputDir ?? path.join(env.CHECKPOINT_DIR, 'script-runs', runId, 'workspace')

  if (dirId) {
    if (occupiedDirIds.has(dirId)) {
      throw new Error(`Browser ${dirId} is already running a script`)
    }
    occupiedDirIds.add(dirId)
    dirOccupied = true
  }

  // 准备运行环境：获取 RoxyBrowser 窗口的连接端点。
  // - SUPPORT_FIREFOX 开启：先取浏览器类型（marionette_port 推断），成功则注入
  //   BROWSER_URL（=ws）+ BROWSER_TYPE，脚本走 chromium/firefox .connect(BROWSER_URL)。
  // - 否则（开关关闭，或获取失败，或调用方已直接提供端点）：维持原 CDP_URL 方案。
  if (!browserUrl && !cdpUrl && dirId) {
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

    if (env.SUPPORT_FIREFOX && conn) {
      // feature gate 开启且成功获取类型 → 注入 BROWSER_URL/BROWSER_TYPE
      browserUrl = conn.ws
      browserType = conn.browserType
    }
    else {
      // 开关关闭或获取失败 → 维持原 CDP_URL 方案（ws 端点对 chromium 仍是 CDP 端点）
      cdpUrl = conn.ws
    }
  }

  const modulePath = sandboxPath()
  let worker: ChildProcess
  try {
    worker = fork(modulePath, [opts.scriptPath], {
      env: {
        ...process.env,
        ROXY_MODE: 'sandbox',
        // BROWSER_URL/BROWSER_TYPE 仅在 SUPPORT_FIREFOX 开启且成功获取浏览器类型时注入；
        // 否则注入 CDP_URL，脚本走 chromium.connectOverCDP 兼容路径。
        ...(browserUrl ? { BROWSER_URL: browserUrl, BROWSER_TYPE: browserType ?? 'chromium' } : {}),
        ...(cdpUrl ? { CDP_URL: cdpUrl } : {}),
        SANDBOX_RUN_ID: runId,
        ...(dirId ? { SANDBOX_DIR_ID: dirId } : {}),
        SANDBOX_PROFILE: profile,
        SANDBOX_OUTPUT_DIR: outputDir,
        ...(opts.workspaceDir ? { SANDBOX_WORKSPACE_DIR: opts.workspaceDir } : {}),
        ...(opts.logsDir ? { SANDBOX_LOGS_DIR: opts.logsDir } : {}),
        ...(opts.logFilePath ? { SANDBOX_LOG_FILE: opts.logFilePath } : {}),
        ...(opts.options !== undefined ? { SANDBOX_OPTIONS: JSON.stringify(opts.options) } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      execArgv: ['--experimental-strip-types', '--experimental-vm-modules'],
      execPath: process.execPath,
    })
  }
  catch (err) {
    if (dirOccupied && dirId) {
      occupiedDirIds.delete(dirId)
    }
    throw err
  }

  worker.stdout?.resume()
  worker.stderr?.resume()

  let reportedArtifactPaths: string[] | undefined

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
    const artifacts = status === 'done' ? await collectArtifacts(outputDir, reportedArtifactPaths) : []
    resolveFinished({ status, exitCode, artifacts, logFilePath: opts.logFilePath })
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

    if (msg.type === 'script_artifacts') {
      reportedArtifactPaths = Array.isArray(msg.paths) ? msg.paths : []
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

  worker.on('exit', (code, signal) => {
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
    cdpUrl,
    browserUrl,
    browserType: browserUrl ? browserType : undefined,
    dirId,
    profile,
    outputDir,
    logFilePath: opts.logFilePath,
    worker,
    finished,
    stop: () => worker.kill('SIGTERM'),
  }
}
