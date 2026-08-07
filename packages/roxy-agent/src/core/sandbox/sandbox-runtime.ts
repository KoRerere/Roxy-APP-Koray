import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'

export type SandboxProfile = 'debug' | 'release'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

/** 原生 fs 模块映射；权限完全由子进程的 Node permission flags 强制。 */
export function createSandboxFsModules(): {
  fs: Record<string, unknown>
  promises: Record<string, unknown>
} {
  return {
    fs: { ...fs, default: fs, promises: fsPromises },
    promises: { ...fsPromises, default: fsPromises },
  }
}

/**
 * 注入沙箱的 console：拦截脚本日志，落盘 + 转发宿主 console + IPC 事件推送。
 * - log / info 归为 info 级
 * - debug 仅在 debug profile 生效（release profile 下为 no-op）
 */
export interface SandboxConsole {
  log: (message?: unknown, ...args: unknown[]) => void
  info: (message?: unknown, ...args: unknown[]) => void
  warn: (message?: unknown, ...args: unknown[]) => void
  error: (message?: unknown, ...args: unknown[]) => void
  /** Active only in debug profile. */
  debug: (message?: unknown, ...args: unknown[]) => void
}

export interface SandboxRuntimeContext {
  console: SandboxConsole
}

export interface CreateRuntimeContextOptions {
  profile: SandboxProfile
  runId: string
  dirId: string
  outputDir: string
  logsDir: string
  logFilePath?: string
  /** The process logger already writes console output to logFilePath. Avoid appending a duplicate line. */
  processLoggerOwnsLogFile?: boolean
  /** Optional parent IPC sender for log streaming. */
  ipcSend?: (msg: unknown) => void
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string')
    return value
  try {
    return JSON.stringify(value)
  }
  catch {
    return String(value)
  }
}

/** 把 console 风格的可变参数拼成单行文本（字符串原样，其余 JSON 序列化）。 */
function formatArgs(args: unknown[]): string {
  return args.map(safeStringify).join(' ')
}

function formatLogLine(level: LogLevel, message: string): string {
  const ts = new Date().toISOString()
  return `[${ts}] [${level.toUpperCase()}] ${message}`
}

function appendLogFile(filePath: string | undefined, line: string): void {
  if (!filePath)
    return
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.appendFileSync(filePath, `${line}\n`, 'utf-8')
  }
  catch (err: any) {
    console.warn(`[sandbox] Failed to write log file: ${err?.message ?? err}`)
  }
}

export function createRuntimeContext(opts: CreateRuntimeContextOptions): SandboxRuntimeContext {
  const { profile, runId, ipcSend } = opts
  const isDebug = profile === 'debug'

  function emitLog(level: LogLevel, args: unknown[]): void {
    const message = formatArgs(args)
    const output = opts.processLoggerOwnsLogFile ? message : formatLogLine(level, message)
    if (!opts.processLoggerOwnsLogFile)
      appendLogFile(opts.logFilePath, output)
    if (level === 'error') {
      console.error(output)
    }
    else if (level === 'warn') {
      console.warn(output)
    }
    else {
      console.log(output)
    }
    ipcSend?.({ type: 'script_log', level, message, runId })
  }

  // 注入沙箱的 console：log/info → info 级；debug 仅 debug profile 生效。
  const sandboxConsole: SandboxConsole = {
    log: (...args) => emitLog('info', args),
    info: (...args) => emitLog('info', args),
    warn: (...args) => emitLog('warn', args),
    error: (...args) => emitLog('error', args),
    debug: isDebug ? (...args) => emitLog('debug', args) : () => {},
  }

  return { console: sandboxConsole }
}

/**
 * Align the real host-side cwd with the sandbox output directory.
 *
 * Scripts see `process.cwd()` through a sandbox proxy, but host-backed modules
 * such as Playwright resolve relative artifact paths against the real Node cwd.
 * Entering this scope makes `page.screenshot({ path: 'x.png' })` land beside
 * other script artifacts.
 */
export function enterSandboxWorkingDirectory(outputDir: string): () => void {
  const previousCwd = process.cwd()
  process.chdir(outputDir)

  let restored = false
  return () => {
    if (restored)
      return
    restored = true
    process.chdir(previousCwd)
  }
}

export interface SandboxProcessOptions {
  /** 脚本工作目录（宿主真实路径）；脚本侧以 cwd()===workdir/{slug} 为工作目录 */
  outputDir: string
  /** 注入脚本的 env 白名单（不暴露宿主 env；运行所需项原样透传，含真实 outputDir） */
  env: Record<string, string>
  /** 安全退出：先 flush IPC 产物再 exit */
  exit: (code?: number) => void
  /** 脚本路径，仅取 basename 用于脱敏后的 argv，避免泄露本机目录 */
  scriptPath?: string
}

/**
 * 构造注入沙箱的 process 对象：
 * - cwd() 返回真实脚本工作目录 workdir/{slug}
 * - env 白名单透传（含 BROWSER_URL/CDP_URL/SANDBOX_* 等运行所需项），不暴露宿主凭据
 * - 安全透传标准 API（platform/version/pid/stdout/nextTick/hrtime/信号事件 等）
 * - 危险内部接口用 no-op 填充（binding/dlopen/mainModule/send/kill 等），调用静默无效
 * - Proxy get 兜底 undefined：未知内部接口默认不可见，最小化逃逸面
 */
export function buildSandboxProcess(opts: SandboxProcessOptions): NodeJS.Process {
  const { outputDir, env, exit, scriptPath } = opts
  const safeScriptName = (scriptPath ? path.basename(scriptPath) : 'script')

  const noop = () => undefined

  /**
   * 暴露给脚本的 env：冻结白名单项。值为真实目录的（如 SANDBOX_OUTPUT_DIR）
   * 保持真实路径——脚本需用它或 process.cwd() 定位产物目录。
   */
  const sandboxEnv: NodeJS.ProcessEnv = Object.freeze({ ...env })

  // 白名单透传：绑定到真实 process 的函数、快照标量/对象。
  const passthrough = new Set<string>([
    'argv0',
    'pid',
    'ppid',
    'platform',
    'arch',
    'machine',
    'version',
    'versions',
    'release',
    'title',
    'stdout',
    'stderr',
    'stdin',
    'nextTick',
    'hrtime',
    'hrtime.bigint',
    'memoryUsage',
    'cpuUsage',
    'resourceUsage',
    'uptime',
    'emitWarning',
    'umask',
    'getActiveResourcesInfo',
    'hasUnrefableHandle',
    'on',
    'once',
    'off',
    'addListener',
    'removeListener',
    'removeAllListeners',
    'emit',
    'listeners',
    'listenerCount',
    'rawListeners',
    'eventNames',
    'setMaxListeners',
    'getMaxListeners',
    'allowedNodeEnvironmentFlags',
  ])

  /** 危险项 no-op / 中性默认值：字段仍在（避免探测崩溃），但行为无效。 */
  const overrides: Record<string, unknown> = {
    /**
     * 真实产物目录：脚本用 process.cwd() 定位工作目录，
     * 相对路径相对此解析，绝对路径访问宿主外部位置（敏感路径由 fs 守卫拦截）。
     */
    cwd: () => outputDir,
    chdir: noop,
    env: sandboxEnv,
    exit: (code?: number) => exit(code),
    argv: ['node', 'sandbox', safeScriptName],
    execPath: 'node',
    execArgv: [],
    // 危险函数：no-op（send/kill 返回语义安全的布尔）
    binding: noop,
    _linkedBinding: noop,
    dlopen: noop,
    _rawDebug: noop,
    send: () => false,
    disconnect: noop,
    kill: () => true,
    // 危险属性：中性默认值
    mainModule: undefined,
    moduleLoadList: [],
    channel: null,
    connected: false,
    _events: undefined,
    _maxListeners: undefined,
    domain: undefined,
  }

  return new Proxy({} as NodeJS.Process, {
    get(_target, prop, _receiver) {
      const key = typeof prop === 'string' ? prop : String(prop)
      if (key in overrides) {
        return overrides[key]
      }
      if (passthrough.has(key)) {
        const value = (process as any)[key]
        return typeof value === 'function' ? value.bind(process) : value
      }
      // 未知内部接口默认不可见
      return undefined
    },
    has(_target, prop) {
      const key = typeof prop === 'string' ? prop : String(prop)
      return key in overrides || passthrough.has(key)
    },
    ownKeys() {
      return [...Object.keys(overrides), ...passthrough]
    },
    getOwnPropertyDescriptor(target, prop) {
      const key = typeof prop === 'string' ? prop : String(prop)
      if (key in overrides || passthrough.has(key)) {
        return { enumerable: true, configurable: true, value: (this.get as any)(target, prop) }
      }
      return undefined
    },
    set() {
      // 沙箱内禁止改写 process（防注入回真实 process）
      return true
    },
    defineProperty() {
      return true
    },
    deleteProperty() {
      return true
    },
  })
}
