import type { SandboxProfile } from '@/core/sandbox/sandbox-runtime'
import { chromium, firefox } from '@roxybrowser/playwright'
import AdmZip from 'adm-zip'
import buffer from 'node:buffer'
import crypto from 'node:crypto'
import { stripTypeScriptTypes } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import stream from 'node:stream'
import url from 'node:url'
import vm from 'node:vm'
import {
  buildGuardedFsModule,
  buildSandboxProcess,
  createRuntimeContext,
} from '@/core/sandbox/sandbox-runtime'

/** 录制脚本 zip 包内固定入口名（与 recording/scriptArtifact.ts 的 SCRIPT_ENTRY_NAME 保持一致） */
const ZIP_SCRIPT_ENTRY = 'script.ts'

/** 路径（忽略 query/hash）是否以 .zip 结尾 */
function isZipPath(p: string): boolean {
  const clean = p.split('?')[0].split('#')[0]
  return clean.toLowerCase().endsWith('.zip')
}

/** 从 zip buffer 解出固定入口脚本源码 */
function extractScriptFromZip(buf: buffer.Buffer): string {
  const zip = new AdmZip(buf)
  const entry = zip.getEntry(ZIP_SCRIPT_ENTRY)
  if (!entry)
    throw new Error(`Script entry "${ZIP_SCRIPT_ENTRY}" not found in zip`)
  return entry.getData().toString('utf-8')
}

interface SandboxCliArgs {
  scriptPath: string | undefined
  profile: SandboxProfile
  cdpUrl: string | undefined
  browserUrl: string | undefined
  browserType: string
  runId: string
  dirId: string
  outputDir: string
  logsDir: string
  logFilePath: string | undefined
  /** 脚本入参 options（由父进程经 SANDBOX_OPTIONS env 注入，JSON 解析后透传给 main(options)） */
  options: unknown
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
  const checkpointDir = process.env.CHECKPOINT_DIR || os.tmpdir()
  const runId = flags['run-id'] || process.env.SANDBOX_RUN_ID || `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const profile = (flags.profile || process.env.SANDBOX_PROFILE || 'release') as SandboxProfile

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
    if (profile === 'debug' && process.env.SANDBOX_WORKSPACE_DIR)
      return process.env.SANDBOX_WORKSPACE_DIR
    return path.join(checkpointDir, 'logs', runId)
  }

  return {
    scriptPath,
    profile,
    cdpUrl: flags['cdp-url'] || process.env.CDP_URL,
    browserUrl: flags['browser-url'] || process.env.BROWSER_URL,
    browserType: (flags['browser-type'] || process.env.BROWSER_TYPE || 'chromium') as string,
    runId,
    dirId: flags['dir-id'] || process.env.SANDBOX_DIR_ID || '',
    outputDir: flags['output-dir'] || process.env.SANDBOX_OUTPUT_DIR || path.join(checkpointDir, 'sandbox-output', runId),
    logsDir: resolveLogsDir(),
    logFilePath: flags['log-file'] || process.env.SANDBOX_LOG_FILE,
    options,
  }
}

async function loadScript(scriptPath: string): Promise<string> {
  // OSS
  const zipped = isZipPath(scriptPath)
  if (/^https?:\/\//.test(scriptPath)) {
    console.log(`[worker] Fetching script from: ${scriptPath}`)
    const resp = await fetch(scriptPath)
    if (!resp.ok) {
      throw new Error(`Failed to fetch script: ${resp.status} ${resp.statusText}`)
    }
    if (zipped) {
      const src = extractScriptFromZip(buffer.Buffer.from(await resp.arrayBuffer()))
      console.log(`[worker] Script fetched (zip), entry size: ${src.length} bytes`)
      return src
    }
    const src = await resp.text()
    console.log(`[worker] Script fetched, size: ${src.length} bytes`)
    return src
  }

  // Local
  const { readFileSync } = await import('node:fs')
  if (zipped) {
    const src = extractScriptFromZip(readFileSync(scriptPath))
    console.log(`[worker] Script loaded from disk (zip), entry size: ${src.length} bytes`)
    return src
  }
  const src = readFileSync(scriptPath, 'utf-8')
  console.log(`[worker] Script loaded from disk, size: ${src.length} bytes`)
  return src
}

function sendArtifacts(runId: string, paths: string[], onAck?: () => void): void {
  if (process.send && paths.length > 0) {
    process.send({ type: 'script_artifacts', runId, paths }, undefined, undefined, onAck)
  }
  else {
    onAck?.()
  }
}

export async function runSandboxMode(): Promise<() => Promise<void>> {
  const args = parseCliArgs()

  if (!args.scriptPath) {
    console.error('[worker] No script path provided.')
    process.exit(1)
  }

  console.log(`[worker] Sandbox profile: ${args.profile}, runId: ${args.runId}`)
  if (args.browserUrl) {
    console.log(`[worker] BROWSER_URL: ${args.browserUrl} (type=${args.browserType})`)
  }
  if (args.cdpUrl) {
    console.log(`[worker] CDP_URL: ${args.cdpUrl}`)
  }
  if (args.profile === 'debug') {
    console.log(`[worker] Logs dir: ${args.logsDir}`)
  }

  process.on('SIGTERM', () => {
    console.log('[worker] SIGTERM received, exiting with code 124...')
    process.exit(124)
  })

  let tsSource: string
  try {
    tsSource = await loadScript(args.scriptPath)
  }
  catch (err: any) {
    console.error('[worker] Failed to load script:', err.message)
    process.exit(1)
  }

  console.log('[worker] Stripping TypeScript types...')
  const jsSource = stripTypeScriptTypes(tsSource, { mode: 'strip', sourceUrl: args.scriptPath })

  const runtimeCtx = createRuntimeContext({
    profile: args.profile,
    runId: args.runId,
    dirId: args.dirId,
    outputDir: args.outputDir,
    logsDir: args.logsDir,
    logFilePath: args.logFilePath,
    ipcSend: process.send ? process.send.bind(process) : undefined,
  })

  const writtenPaths = new Set<string>()
  let artifactsSent = false
  function flushArtifacts(onAck?: () => void): void {
    if (artifactsSent) {
      onAck?.()
      return
    }
    artifactsSent = true
    sendArtifacts(args.runId, [...writtenPaths], onAck)
  }

  // 统一退出：确保 IPC 产物消息送达后再 exit，防硬 exit 丢消息。
  // 300ms 兜底定时器防 IPC 卡住。所有退出路径统一走此函数。
  let exiting = false
  function flushAndExit(code: number): void {
    if (exiting)
      return
    exiting = true
    const doExit = () => process.exit(code)
    const guard = setTimeout(doExit, 300)
    if ((guard as any).unref)
      (guard as any).unref()
    flushArtifacts(() => {
      clearTimeout(guard)
      process.exit(code)
    })
  }

  process.on('beforeExit', () => {
    flushAndExit(0)
  })

  // 注入沙箱的 process：cwd() 返回真实 workspace 路径（放开外部访问后脚本需用真实路径
  // 定位 workspace 与外部文件），env 白名单含运行所需项（含 SANDBOX_OUTPUT_DIR 真实路径），
  // 不暴露宿主凭据，exit 走 flushAndExit 保产物送达，
  // 危险内部接口（binding/dlopen/mainModule/send/kill 等）no-op 屏蔽。
  const sandboxProcess = buildSandboxProcess({
    outputDir: args.outputDir,
    env: {
      BROWSER_URL: args.browserUrl ?? '',
      BROWSER_TYPE: args.browserType,
      CDP_URL: args.cdpUrl ?? '',
      SANDBOX_RUN_ID: args.runId,
      SANDBOX_DIR_ID: args.dirId,
      SANDBOX_OUTPUT_DIR: args.outputDir,
    },
    exit: (code?: number) => {
      flushAndExit(typeof code === 'number' ? code : 0)
    },
    scriptPath: args.scriptPath,
  })

  if (args.browserUrl) {
    console.log(`[worker] BROWSER_URL injected into sandbox process.env (type=${args.browserType})`)
  }
  else if (args.cdpUrl) {
    console.log('[worker] CDP_URL injected into sandbox process.env')
  }
  else {
    console.log('[worker] No BROWSER_URL/CDP_URL provided — script must handle a missing endpoint')
  }

  // 受守卫的 fs：敏感路径（系统目录/凭据目录）抛 EACCES，其余宿主路径放行；
  // 写操作记录解析后的真实写入路径用于 IPC 上报（外部写入仅记录，不作为可下载产物收集）
  const { guardedFs, guardedFsPromises } = await buildGuardedFsModule(args.outputDir, (p: string) => {
    writtenPaths.add(p)
  })

  const sandboxApis: Record<string, Record<string, unknown>> = {
    'playwright': {
      chromium,
      firefox,
    },
    'path': { ...path },
    'node:path': { ...path },
    'fs': guardedFs,
    'node:fs': guardedFs,
    'fs/promises': guardedFsPromises,
    'node:fs/promises': guardedFsPromises,
    'url': { ...url },
    'node:url': { ...url },
    'crypto': { ...crypto },
    'node:crypto': { ...crypto },
    'buffer': { ...buffer },
    'node:buffer': { ...buffer },
    'stream': { ...stream },
    'node:stream': { ...stream },
  }

  const contextObject = Object.create({
    console: runtimeCtx.console,
    fetch: undefined,
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
    const mod = new vm.SourceTextModule(jsSource, {
      context,
      identifier: args.scriptPath,
    })

    await mod.link(linker)
    await mod.evaluate()
    console.log('[worker] Module evaluated successfully.')

    // 调用脚本的 main(options) 并等待其完成——无超时，长任务跑多久都行，只靠父进程 AbortSignal 回收。
    //
    // 当前脚本契约：`export async function main(options): Promise<void>`，由 sandbox 主动调用并传入
    // 解析后的 options。脚本本身不读取 process.env.SANDBOX_OPTIONS，故 validator 的 env 白名单不变。
    //
    // 兼容回退：旧脚本用 `export const __main = main()` 自启动并返回 promise，此处仍能追踪其完成状态，
    // 保护已生成的旧脚本继续可运行（validator 已不再校验该旧格式，新脚本必须用导出 main 形式）。
    const ns = mod.namespace as any
    const exportedMain = typeof ns.main === 'function' ? ns.main : undefined
    if (exportedMain) {
      const maybePromise = exportedMain(args.options)
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise.catch(() => {})
      }
      console.log('[worker] main(options) completed.')
    }
    else {
      // 旧契约回退：`export const __main = main()`
      const mainPromise = ns.__main
      if (mainPromise && typeof mainPromise.then === 'function') {
        await mainPromise.catch(() => {})
        console.log('[worker] main() completed.')
      }
      else {
        console.error('[worker] Script has no exported main() function and no __main export; nothing to run.')
        flushAndExit(1)
      }
    }

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
    console.error('[worker] Script failed:')
    console.error('  message:', err?.message || String(err))
    if (err?.code)
      console.error('  code:', err.code)
    if (err?.stack)
      console.error('  stack:', err.stack)
    flushAndExit(1)
  }

  return async () => {
    flushAndExit(0)
  }
}
