import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { Writable } from 'node:stream'
import { formatLocalLogTimestamp } from '@/core/logger'
export { createSandboxFsModules } from './sandbox-fs'

export type SandboxProfile = 'debug' | 'release'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

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
  /** Optional parent IPC sender for log streaming. */
  ipcSend?: (msg: unknown) => void
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
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
  const ts = formatLocalLogTimestamp()
  return `[${ts}] [${level.toUpperCase()}] ${message}`
}

function appendLogFile(filePath: string | undefined, line: string): void {
  if (!filePath) {
    return
  }
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
    appendLogFile(opts.logFilePath, formatLogLine(level, message))
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

export interface SandboxProcessOptions {
  /** 脚本工作目录（宿主真实路径）；脚本侧以 cwd()===workdir/{slug} 为工作目录 */
  outputDir: string
  /** 注入脚本的 env 白名单（不暴露宿主 env）。 */
  env: Record<string, string>
  /** 安全退出：先 flush IPC 产物再 exit */
  exit: (code?: number) => void
  /** 脚本路径，仅取 basename 用于脱敏后的 argv，避免泄露本机目录 */
  scriptPath?: string
  /** Session-local process events; never register listeners on the Host process. */
  events?: EventEmitter
  /** Safe stdout/stderr sink for the current run. */
  write?: (level: 'info' | 'error', text: string) => void
}

/**
 * 构造注入沙箱的 process 对象：
 * - cwd() 返回真实脚本工作目录 workdir/{slug}
 * - env 只暴露 BROWSER_URL / BROWSER_TYPE / SANDBOX_DEBUG，不暴露宿主凭据
 * - platform/version/pid 等只读透传；stdout/stderr 和事件 API 为 session-local facade
 * - 危险内部接口用 no-op 填充（binding/dlopen/mainModule/send/kill 等），调用静默无效
 * - Proxy get 兜底 undefined：未知内部接口默认不可见，最小化逃逸面
 */
export function buildSandboxProcess(opts: SandboxProcessOptions): NodeJS.Process {
  const { outputDir, env, exit, scriptPath } = opts
  const safeScriptName = (scriptPath ? path.basename(scriptPath) : 'script')
  const events = opts.events ?? new EventEmitter()

  const noop = () => undefined

  /**
   * 暴露给脚本的 env：冻结白名单项，不包含宿主路径或凭据。
   */
  const sandboxEnv: NodeJS.ProcessEnv = Object.freeze({ ...env })

  const createSink = (level: 'info' | 'error'): NodeJS.WriteStream => new Writable({
    write(chunk, _encoding, callback) {
      opts.write?.(level, String(chunk))
      callback()
    },
  }) as NodeJS.WriteStream

  const stdout = createSink('info')
  const stderr = createSink('error')

  // 白名单透传：只读标量与纯观测函数。事件和 stream 使用 session-local facade。
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
    'nextTick',
    'hrtime',
    'hrtime.bigint',
    'memoryUsage',
    'cpuUsage',
    'resourceUsage',
    'uptime',
    'umask',
    'getActiveResourcesInfo',
    'hasUnrefableHandle',
    'allowedNodeEnvironmentFlags',
  ])

  /** 危险项 no-op / 中性默认值：字段仍在（避免探测崩溃），但行为无效。 */
  const overrides: Record<string, unknown> = {
    /**
     * 虚拟产物目录：脚本用 process.cwd() 定位工作目录；Host 真实 cwd 不变化。
     */
    cwd: () => outputDir,
    chdir: noop,
    env: sandboxEnv,
    exit: (code?: number) => exit(code),
    argv: ['node', 'sandbox', safeScriptName],
    execPath: 'node',
    execArgv: [],
    stdout,
    stderr,
    stdin: null,
    on: events.on.bind(events),
    once: events.once.bind(events),
    off: events.off.bind(events),
    addListener: events.addListener.bind(events),
    removeListener: events.removeListener.bind(events),
    removeAllListeners: events.removeAllListeners.bind(events),
    emit: events.emit.bind(events),
    listeners: events.listeners.bind(events),
    listenerCount: events.listenerCount.bind(events),
    rawListeners: events.rawListeners.bind(events),
    eventNames: events.eventNames.bind(events),
    setMaxListeners: events.setMaxListeners.bind(events),
    getMaxListeners: events.getMaxListeners.bind(events),
    emitWarning: noop,
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
