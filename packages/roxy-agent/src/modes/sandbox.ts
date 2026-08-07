import type { SandboxProfile } from '@/core/sandbox/sandbox-runtime'
import * as sbRoot from '@roxy/sandbox'
import * as sb2fa from '@roxy/sandbox/2fa'
import * as sbDebug from '@roxy/sandbox/debug'
import * as sbDownload from '@roxy/sandbox/download'
import * as sbHuman from '@roxy/sandbox/human'
import * as sbKv from '@roxy/sandbox/kv'
import * as sbLlm from '@roxy/sandbox/llm'
import * as sbTable from '@roxy/sandbox/table'
import * as sbUtils from '@roxy/sandbox/utils'
import { chromium, firefox } from '@roxybrowser/playwright'
import buffer, { Buffer } from 'node:buffer'
import crypto from 'node:crypto'
import fsPromises from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import path from 'node:path'
import stream from 'node:stream'
import url from 'node:url'
import vm from 'node:vm'
import { buildLlmTransport } from '@/core/sandbox/llmTransport'
import {
  buildSandboxProcess,
  createRuntimeContext,
  createSandboxFsModules,
  enterSandboxWorkingDirectory,
} from '@/core/sandbox/sandbox-runtime'
import { executeSandboxScriptEntry } from '@/core/sandbox/script-entry'
import { agentPaths } from '@/core/storage/agentPaths'
import { assertAllowedRemoteScriptUrl } from '@/script/remoteScriptPolicy'
import { assertSha512 } from '@/security/scriptIntegrity'
import { assertFetchAllowed, parseScriptPermissions } from '@/security/scriptPermissions'

interface SandboxCliArgs {
  scriptPath: string | undefined
  scriptSha512: string | undefined
  profile: SandboxProfile
  browserUrl: string | undefined
  browserType: string
  runId: string
  assetSlug: string
  dirId: string
  outputDir: string
  logsDir: string
  /** workspace 根目录；兼容旧调用。 */
  workspaceDir: string | undefined
  logFilePath: string | undefined
  /** 脚本入参 options（由父进程经 SANDBOX_OPTIONS env 注入，JSON 解析后透传给 main(options)） */
  options: unknown
  permissions: ReturnType<typeof parseScriptPermissions>
}

function parseCliArgs(): SandboxCliArgs {
  const rawArgs = process.argv.slice(2)
  const modeArgIdx = rawArgs.indexOf('sandbox')
  const afterMode = modeArgIdx >= 0 ? rawArgs.slice(modeArgIdx + 1) : rawArgs

  const flags: Record<string, string> = {}
  const positional: string[] = []
  for (const arg of afterMode) {
    const m = arg.match(/^--([a-z-]+)=(.+)$/)
    if (m) {
      flags[m[1]] = m[2]
    }
    else if (!arg.startsWith('--')) {
      positional.push(arg)
    }
  }

  const scriptPath = positional[0]
  const runId = flags['run-id'] || process.env.SANDBOX_RUN_ID || `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const assetSlug = flags['asset-slug'] || process.env.SANDBOX_ASSET_SLUG || scriptPathToAssetSlug(scriptPath)
  const profile = (flags.profile || (process.env.SANDBOX_DEBUG === '1' ? 'debug' : 'release')) as SandboxProfile

  // options：脚本入参，由父进程经 SANDBOX_OPTIONS env 注入（JSON 字符串）。空/缺失/解析失败 → {}。
  const rawOptions = process.env.SANDBOX_OPTIONS
  let options: unknown = {}
  if (rawOptions && rawOptions.trim()) {
    try {
      options = JSON.parse(rawOptions)
    }
    catch (err: any) {
      console.warn(`[worker] Failed to parse SANDBOX_OPTIONS, falling back to {}: ${err?.message ?? err}`)
      options = {}
    }
  }

  function resolveLogsDir(): string {
    if (flags['logs-dir'])
      return flags['logs-dir']
    if (process.env.SANDBOX_LOGS_DIR)
      return process.env.SANDBOX_LOGS_DIR
    return path.dirname(resolveLogFilePath())
  }

  function resolveLogFilePath(): string {
    if (flags['log-file'])
      return flags['log-file']
    if (process.env.SANDBOX_LOG_FILE)
      return process.env.SANDBOX_LOG_FILE
    return agentPaths.workdirRunLogFile(assetSlug, runId)
  }

  const outputDir = flags['output-dir'] || process.env.SANDBOX_OUTPUT_DIR || agentPaths.workdir(assetSlug)

  let permissions: ReturnType<typeof parseScriptPermissions>
  try {
    permissions = parseScriptPermissions(JSON.parse(process.env.SANDBOX_PERMISSIONS || '{"version":1,"fs":{"read":[]},"fetch":{"allow":[]}}'))
  }
  catch (error: any) {
    throw new Error(`Invalid SANDBOX_PERMISSIONS: ${error?.message ?? error}`)
  }

  return {
    scriptPath,
    scriptSha512: process.env.SANDBOX_SCRIPT_SHA512 || undefined,
    profile,
    browserUrl: flags['browser-url'] || process.env.BROWSER_URL,
    browserType: (flags['browser-type'] || process.env.BROWSER_TYPE || 'chromium') as string,
    runId,
    assetSlug: path.basename(outputDir),
    dirId: flags['dir-id'] || process.env.SANDBOX_DIR_ID || '',
    outputDir,
    logsDir: resolveLogsDir(),
    workspaceDir: flags['workspace-dir'] || process.env.SANDBOX_WORKSPACE_DIR || undefined,
    logFilePath: resolveLogFilePath(),
    options,
    permissions,
  }
}

function scriptPathToAssetSlug(scriptPath: string | undefined): string {
  if (!scriptPath)
    return 'script'
  const baseName = path.basename(scriptPath)
  const ext = path.extname(baseName)
  return (ext ? baseName.slice(0, -ext.length) : baseName) || 'script'
}

const SCRIPT_BROWSER_OUTPUT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

async function cleanOldScriptBrowserDirs(assetSlug: string): Promise<void> {
  const root = path.dirname(agentPaths.workdirBrowserDir(assetSlug))
  const cutoff = Date.now() - SCRIPT_BROWSER_OUTPUT_MAX_AGE_MS
  const entries = await fsPromises.readdir(root, { withFileTypes: true }).catch(() => [])
  await Promise.all(entries.map(async (entry) => {
    if (!entry.isDirectory())
      return
    const dir = path.join(root, entry.name)
    const stat = await fsPromises.stat(dir).catch(() => null)
    if (stat && stat.mtime.getTime() < cutoff) {
      await fsPromises.rm(dir, { recursive: true, force: true })
    }
  }))
}

async function loadScript(scriptPath: string, expectedSha512?: string): Promise<string> {
  let data: Buffer
  // OSS
  if (/^https?:\/\//.test(scriptPath)) {
    assertAllowedRemoteScriptUrl(scriptPath)
    console.log(`[worker] Fetching script from: ${scriptPath}`)
    const resp = await fetch(scriptPath)
    if (!resp.ok) {
      throw new Error(`Failed to fetch script: ${resp.status} ${resp.statusText}`)
    }
    data = Buffer.from(await resp.arrayBuffer())
    console.log(`[worker] Script fetched, size: ${data.byteLength} bytes`)
  }
  else {
    const { readFileSync } = await import('node:fs')
    data = readFileSync(scriptPath)
    console.log(`[worker] Script loaded from disk, size: ${data.byteLength} bytes`)
  }

  if (expectedSha512) {
    assertSha512(data, expectedSha512)
    console.log('[worker] Script SHA-512 verified')
  }
  return data.toString('utf-8')
}

interface SandboxStorageOperation {
  action: string
  count: number
  rowCount?: number
}

interface SandboxStorageChange {
  type: 'kv' | 'table'
  path: string
  name: string
  operations: SandboxStorageOperation[]
}

interface StorageChangeAccumulator {
  type: 'kv' | 'table'
  path: string
  name: string
  counts: Map<string, number>
  rowCounts: Map<string, number>
}

function sendArtifacts(runId: string, paths: string[], changes: SandboxStorageChange[], onAck?: () => void): void {
  if (process.send && paths.length > 0) {
    process.send({ type: 'script_artifacts', runId, paths, changes }, undefined, undefined, onAck)
  }
  else {
    onAck?.()
  }
}

async function sendScriptResult(runId: string, returnValue: string | void): Promise<void> {
  if (returnValue === undefined || !process.send) {
    return
  }

  await new Promise<void>((resolve) => {
    process.send?.({ type: 'script_result', runId, returnValue }, undefined, undefined, () => resolve())
  })
}

/**
 * 从一个 @roxy/sandbox 子模块的导出里，剔除宿主专用的 `__` 前缀项（如 __setStorageDir /
 * __setLlmTransport），只把公共 API 暴露给脚本。宿主的装配（setStorageDir/setLlmTransport）
 * 已在注入前完成。
 */
function publicExports(mod: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(mod)) {
    if (!k.startsWith('__'))
      out[k] = v
  }
  return out
}

export async function runSandboxMode(): Promise<() => Promise<void>> {
  const args = parseCliArgs()

  if (!args.scriptPath) {
    console.error('[worker] No script path provided.')
    process.exit(1)
  }

  // 浏览器连接端点校验（原先在脚本骨架顶层，现脚本顶层无副作用，统一在运行前判断）。
  if (!args.browserUrl) {
    console.error('[worker] No browser endpoint: set BROWSER_URL before running this script.')
    process.exit(1)
  }

  console.log(`[worker] Sandbox profile: ${args.profile}, runId: ${args.runId}`)
  console.log(`[worker] BROWSER_URL: ${args.browserUrl} (type=${args.browserType})`)

  if (args.profile === 'debug') {
    console.log(`[worker] Logs dir: ${args.logsDir}`)
  }
  await fsPromises.mkdir(args.outputDir, { recursive: true })
  const browserOutputDir = agentPaths.workdirBrowserDir(args.assetSlug)
  await fsPromises.mkdir(browserOutputDir, { recursive: true })
  let restoreHostCwd = (): void => {}

  let tsSource: string
  try {
    tsSource = await loadScript(args.scriptPath, args.scriptSha512)
  }
  catch (err: any) {
    console.error('[worker] Failed to load script:', err.message)
    process.send?.({
      type: 'script_log',
      runId: args.runId,
      level: 'error',
      message: err.message,
    })
    process.exit(1)
  }

  restoreHostCwd = enterSandboxWorkingDirectory(args.outputDir)
  const runtimeCtx = createRuntimeContext({
    profile: args.profile,
    runId: args.runId,
    dirId: args.dirId,
    outputDir: args.outputDir,
    logsDir: args.logsDir,
    logFilePath: args.logFilePath,
    processLoggerOwnsLogFile: true,
    ipcSend: process.send ? process.send.bind(process) : undefined,
  })

  const writtenPaths = new Set<string>()
  const storageChanges = new Map<string, StorageChangeAccumulator>()

  function recordStorageChange(event: {
    type: 'kv' | 'table'
    action: string
    name: string
    path: string
    key?: string
    rowCount?: number
  }): void {
    const resolved = path.resolve(event.path)
    writtenPaths.add(resolved)
    const key = `${event.type}:${resolved}`
    let item = storageChanges.get(key)
    if (!item) {
      item = {
        type: event.type,
        path: resolved,
        name: event.name,
        counts: new Map(),
        rowCounts: new Map(),
      }
      storageChanges.set(key, item)
    }

    item.counts.set(event.action, (item.counts.get(event.action) ?? 0) + 1)
    if (event.rowCount !== undefined)
      item.rowCounts.set(event.action, (item.rowCounts.get(event.action) ?? 0) + event.rowCount)
  }

  function collectStorageChanges(): SandboxStorageChange[] {
    return Array.from(storageChanges.values()).map(item => ({
      type: item.type,
      path: item.path,
      name: item.name,
      operations: Array.from(item.counts.entries()).map(([action, count]) => ({
        action,
        count,
        ...(item.rowCounts.has(action) ? { rowCount: item.rowCounts.get(action)! } : {}),
      })),
    }))
  }

  let artifactsSent = false
  function flushArtifacts(onAck?: () => void): void {
    if (artifactsSent) {
      onAck?.()
      return
    }
    artifactsSent = true
    sendArtifacts(args.runId, [...writtenPaths], collectStorageChanges(), onAck)
  }

  // 统一退出：确保 IPC 产物消息送达后再 exit，防硬 exit 丢消息。
  // 300ms 兜底定时器防 IPC 卡住。所有退出路径统一走此函数。
  let exiting = false
  function disconnectFirefoxBidiLinks(): Promise<void> {
    const disconnectAll = (firefox as { disconnectAll?: () => Promise<void> }).disconnectAll
    if (typeof disconnectAll !== 'function')
      return Promise.resolve()
    return disconnectAll.call(firefox).catch((error: any) => {
      console.warn('[worker] Failed to disconnect Firefox BiDi links:', error?.message ?? error)
    })
  }

  function flushAndExit(code: number): void {
    if (exiting)
      return
    exiting = true
    const doExit = () => process.exit(code)
    const guard = setTimeout(doExit, 2_000)
    if ((guard as any).unref)
      (guard as any).unref()
    void disconnectFirefoxBidiLinks().finally(() => {
      flushArtifacts(() => {
        clearTimeout(guard)
        process.exit(code)
      })
    })
  }

  process.on('SIGTERM', () => {
    console.log('[worker] SIGTERM received, exiting with code 124...')
    flushAndExit(124)
  })

  process.on('beforeExit', () => {
    flushAndExit(0)
  })

  // 注入沙箱的 process：cwd() 返回真实 workdir/{slug} 路径，env 白名单含运行所需项
  // 不暴露宿主凭据，exit 走 flushAndExit 保产物送达，
  // 危险内部接口（binding/dlopen/mainModule/send/kill 等）no-op 屏蔽。
  const sandboxProcess = buildSandboxProcess({
    outputDir: args.outputDir,
    env: {
      BROWSER_URL: args.browserUrl ?? '',
      BROWSER_TYPE: args.browserType,
      SANDBOX_DEBUG: args.profile === 'debug' ? '1' : '0',
      // SANDBOX_RUN_ID: args.runId,
      // SANDBOX_ASSET_SLUG: args.assetSlug,
      // SANDBOX_DIR_ID: args.dirId,
      // SANDBOX_OUTPUT_DIR: args.outputDir,
      // SANDBOX_BROWSER_DIR: browserOutputDir,
    },
    exit: (code?: number) => {
      flushAndExit(typeof code === 'number' ? code : 0)
    },
    scriptPath: args.scriptPath,
  })

  if (args.browserUrl) {
    console.log(`[worker] BROWSER_URL injected into sandbox process.env (type=${args.browserType})`)
  }
  else {
    console.log('[worker] No BROWSER_URL provided — script must handle a missing endpoint')
  }

  // ── 装配 @roxy/sandbox 能力（对脚本以 @roxybrowser/sandbox/* specifier 暴露）──
  // table/kv：指定落盘目录（真实 fs 在宿主侧，写入 workdir/{slug}，随产物收集）。
  // llm：注入 transport（真正的模型调用在宿主，密钥不进沙箱）。
  // debug：提取清洗后的实时 body DOM，在 debug profile 下写入当日日志目录，
  // 并通过 sandbox console.debug 把 HTML 绝对路径返回给 agent。
  // 这些 setup 必须在把导出注入 linker 之前完成，且注入时剔除 __ 前缀的宿主专用项。
  sbTable.__setStorageDir(args.outputDir)
  sbKv.__setStorageDir(args.outputDir)
  sbTable.__setChangeReporter(recordStorageChange)
  sbKv.__setChangeReporter(recordStorageChange)
  sbDownload.__setOutputDir(browserOutputDir)
  sbLlm.__setLlmTransport(buildLlmTransport(args.runId))
  await cleanOldScriptBrowserDirs(args.assetSlug)
  sbDebug.__configureDebug({
    debug: message => runtimeCtx.console.debug(message),
  })
  const sandboxFs = createSandboxFsModules()

  const sandboxApis: Record<string, Record<string, unknown>> = {
    'playwright': {
      chromium,
      firefox,
    },
    'path': { ...path },
    'node:path': { ...path },
    'url': { ...url },
    'node:url': { ...url },
    'crypto': { ...crypto },
    'node:crypto': { ...crypto },
    'buffer': { ...buffer },
    'node:buffer': { ...buffer },
    'stream': { ...stream },
    'node:stream': { ...stream },
    'fs': sandboxFs.fs,
    'node:fs': sandboxFs.fs,
    'fs/promises': sandboxFs.promises,
    'node:fs/promises': sandboxFs.promises,
    // @roxybrowser/sandbox —— 根 specifier：自描述宏（identity，运行期无副作用）
    '@roxybrowser/sandbox': publicExports(sbRoot as Record<string, unknown>),
    // @roxybrowser/sandbox/* —— 面向脚本的 specifier，值来自内部包 @roxy/sandbox/*
    '@roxybrowser/sandbox/utils': publicExports(sbUtils as Record<string, unknown>),
    '@roxybrowser/sandbox/human': publicExports(sbHuman as Record<string, unknown>),
    '@roxybrowser/sandbox/llm': publicExports(sbLlm as Record<string, unknown>),
    '@roxybrowser/sandbox/table': publicExports(sbTable as Record<string, unknown>),
    '@roxybrowser/sandbox/kv': publicExports(sbKv as Record<string, unknown>),
    '@roxybrowser/sandbox/debug': publicExports(sbDebug as Record<string, unknown>),
    '@roxybrowser/sandbox/download': publicExports(sbDownload as Record<string, unknown>),
    '@roxybrowser/sandbox/2fa': publicExports(sb2fa as Record<string, unknown>),
  }

  const restrictedFetch: typeof fetch = async (input, init) => {
    const value = typeof input === 'string' || input instanceof URL ? input : input.url
    assertFetchAllowed(value, args.permissions)
    return globalThis.fetch(input, { ...init, redirect: 'manual' })
  }

  const contextObject = Object.create({
    console: runtimeCtx.console,
    fetch: restrictedFetch,
    XMLHttpRequest: undefined,
    process: sandboxProcess,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,

    Buffer: buffer.Buffer,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    Error,
    TypeError,
    RangeError,
    Promise,
    JSON,
    Math,
    Date,
    parseInt: Number.parseInt,
    parseFloat: Number.parseFloat,
    isNaN: Number.isNaN,
    isFinite: Number.isFinite,
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,
    Object,
    Array,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Symbol,
    RegExp,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    Int8Array,
    Int16Array,
    Int32Array,
    Float32Array,
    Float64Array,
    ArrayBuffer,
    SharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined' ? SharedArrayBuffer : undefined,
    DataView,
  })

  const context = vm.createContext(contextObject)

  const moduleCache = new Map<string, vm.Module>()

  async function linker(specifier: string, _referencingModule: vm.Module): Promise<vm.Module> {
    if (moduleCache.has(specifier)) {
      return moduleCache.get(specifier)!
    }

    if (!(specifier in sandboxApis)) {
      const msg = `[sandbox] Module not allowed: "${specifier}". Allowed: ${Object.keys(sandboxApis).join(', ')}`
      console.error(`[worker] ${msg}`)
      throw new Error(msg)
    }

    const exports = sandboxApis[specifier]
    const exportNames = Object.keys(exports)
    const synth = new vm.SyntheticModule(exportNames, function () {
      for (const name of exportNames) {
        this.setExport(name, exports[name])
      }
    }, { context, identifier: specifier })

    await synth.link(linker)
    moduleCache.set(specifier, synth)
    return synth
  }

  console.log(`[worker] Running: ${args.scriptPath}`)
  try {
    console.log('[worker] Stripping TypeScript types...')
    const jsSource = stripTypeScriptTypes(tsSource, { mode: 'strip', sourceUrl: args.scriptPath })
    const mod = new vm.SourceTextModule(jsSource, {
      context,
      identifier: args.scriptPath,
    })

    await mod.link(linker)
    await mod.evaluate()
    console.log('[worker] Module evaluated successfully.')

    // 调用脚本的 main(options) 并等待其完成——无超时，长任务跑多久都行，只靠父进程 AbortSignal 回收。
    // 脚本契约：`export async function main(options): Promise<string | void>`
    const returnValue = await executeSandboxScriptEntry(mod.namespace as Record<string, unknown>, args.options)
    await sendScriptResult(args.runId, returnValue)

    // main() 完成后才上报产物并启动短收尾兜底。
    // 正常路径：beforeExit / sandboxProcess.exit 会先触发 flushAndExit(0)。
    // 兜底路径：Playwright 悬挂句柄阻止事件循环排空时，此定时器强制退出。
    flushArtifacts()
    const drainGuard = setTimeout(() => {
      console.log('[worker] Drain guard: forcing exit after main() completion')
      flushAndExit(0)
    }, 10_000)
    drainGuard.unref()
  }
  catch (err: any) {
    const message = err?.message || String(err)
    const details = [
      `[sandbox] Script failed: ${message}`,
      err?.code ? `code: ${err.code}` : '',
      err?.stack ? `stack: ${err.stack}` : '',
    ].filter(Boolean).join('\n')
    // Use the injected console so failures reach the per-run log, parent IPC, and host stderr.
    runtimeCtx.console.error(details)
    flushAndExit(1)
  }

  return async () => {
    restoreHostCwd()
    flushAndExit(0)
  }
}
