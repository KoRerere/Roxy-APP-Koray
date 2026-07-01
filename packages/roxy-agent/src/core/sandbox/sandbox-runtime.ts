import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { expandTilde, isSensitivePath } from './sensitivePaths'

export type SandboxProfile = 'debug' | 'release'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

/**
 * 注入沙箱的 console：拦截脚本日志，落盘 + 转发宿主 console + IPC SSE 推送。
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
    const line = formatLogLine(level, message)
    appendLogFile(opts.logFilePath, line)
    if (level === 'error') {
      console.error(line)
    }
    else if (level === 'warn') {
      console.warn(line)
    }
    else {
      console.log(line)
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
 * 解析脚本传入的路径为真实绝对路径：
 * - 展开 `~`（脚本访问用户文件，如 ~/Downloads/x）
 * - 相对路径相对 workspace（脚本 process.cwd() 基准）解析
 * - 绝对路径原样保留
 *
 * 注意：此处不再像旧的 confinePath 那样把路径收敛进 workspace——放开外部访问后，
 * 脚本可读写宿主任意非敏感路径。敏感路径拦截由 guardPathArg 负责。
 */
function resolveHostPath(workspaceDir: string, p: string): string {
  return path.resolve(workspaceDir, expandTilde(p))
}

/**
 * 守卫 fs 路径参数：解析为真实绝对路径后做敏感路径黑名单检查。
 * - 命中黑名单（系统目录/凭据目录）：抛 `EACCES`，脚本可 try/catch 感知被拒
 * - 未命中：返回解析后的真实绝对路径，透传给底层真实 fs
 *
 * @returns 解析后的真实绝对路径（字符串）；非字符串/非 file: URL 原样返回
 * @throws EACCES 当路径落入敏感黑名单
 */
function guardPathArg(workspaceDir: string, p: unknown): unknown {
  if (typeof p === 'string') {
    const resolved = resolveHostPath(workspaceDir, p)
    const check = isSensitivePath(resolved)
    if (check.blocked) {
      const err = new Error(`Access denied: "${p}" resolves to a sensitive location (${check.reason}). Read/write of OS-sensitive paths is forbidden.`)
      ;(err as Error & { code?: string }).code = 'EACCES'
      throw err
    }
    return resolved
  }
  if (p instanceof URL && p.protocol === 'file:') {
    return guardPathArg(workspaceDir, url.fileURLToPath(p))
  }
  return p
}

export interface SandboxProcessOptions {
  /** workspace 根目录（宿主真实路径）；脚本侧以 cwd()===该路径 为工作目录 */
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
 * - cwd() 返回真实 workspace 路径（放开外部访问后，脚本需用真实路径定位 workspace 与外部文件）
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
   * 暴露给脚本的 env：冻结白名单项。值为真实 outputDir 的（如 SANDBOX_OUTPUT_DIR）
   * 保持真实路径——放开后脚本需用它或 process.cwd() 定位 workspace。
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
     * 真实 workspace 路径：脚本用 process.cwd() 定位工作目录，
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

/**
 * 构建受守卫的 fs 模块（替代旧的 confined fs）。
 *
 * 与旧实现的根本区别：
 * - 旧（confine）：所有路径强制收敛进 workspace，workspace 外不可访问（路径隔离沙箱）
 * - 新（guard）：路径解析为真实绝对路径后仅做敏感黑名单检查，未命中即透传真实 fs
 *   （敏感路径黑名单沙箱，放开外部文件读写）
 *
 * 写操作仍通过 onWrite 上报写入路径（用于 IPC 产物收集）；但外部写入的产物不在
 * collectArtifacts 扫描范围（仅 workspace 内文件作为可下载产物收集）。
 *
 * @param workspaceDir 脚本工作目录（= outputDir），相对路径解析基准
 * @param onWrite 写入成功前回调，参数为解析后的真实写入路径
 */
export async function buildGuardedFsModule(workspaceDir: string, onWrite?: (resolvedPath: string) => void) {
  const fsModule = await import('node:fs')
  const fsPromisesModule = await import('node:fs/promises')

  const guardPathArgLocal = (p: unknown): unknown => guardPathArg(workspaceDir, p)

  /** 写入前兜底创建映射后路径的父目录。 */
  function ensureParentDir(resolvedPath: unknown): void {
    if (typeof resolvedPath !== 'string')
      return
    try {
      fsModule.mkdirSync(path.dirname(resolvedPath), { recursive: true })
    }
    catch {
      // best-effort：真正的失败留给底层 fs 调用抛出
    }
  }

  function wrapFsMethod<T extends (...args: any[]) => any>(
    fn: T,
    pathArgIndexes: number[] = [0],
    isWrite: boolean = false,
  ): T {
    return ((...fnArgs: any[]) => {
      const guardedArgs = fnArgs.map((arg, index) =>
        pathArgIndexes.includes(index) ? guardPathArgLocal(arg) : arg,
      )
      if (isWrite) {
        const firstWriteIdx = pathArgIndexes[0] ?? 0
        const guarded = guardedArgs[firstWriteIdx]
        ensureParentDir(guarded)
        if (onWrite && typeof guarded === 'string') {
          onWrite(guarded)
        }
      }
      return fn(...guardedArgs)
    }) as T
  }

  const guardedFs: Record<string, unknown> = {
    ...fsModule,
    // ── 写类（isWrite=true：触发 onWrite 记录 + ensureParentDir）──
    'writeFile': wrapFsMethod(fsModule.writeFile, [0], true),
    'writeFileSync': wrapFsMethod(fsModule.writeFileSync, [0], true),
    'appendFile': wrapFsMethod(fsModule.appendFile, [0], true),
    'appendFileSync': wrapFsMethod(fsModule.appendFileSync, [0], true),
    'mkdir': wrapFsMethod(fsModule.mkdir),
    'mkdirSync': wrapFsMethod(fsModule.mkdirSync),
    'createWriteStream': wrapFsMethod(fsModule.createWriteStream, [0], true),
    'unlink': wrapFsMethod(fsModule.unlink),
    'unlinkSync': wrapFsMethod(fsModule.unlinkSync),
    'rm': wrapFsMethod(fsModule.rm),
    'rmSync': wrapFsMethod(fsModule.rmSync),
    'rename': wrapFsMethod(fsModule.rename, [0, 1]),
    'renameSync': wrapFsMethod(fsModule.renameSync, [0, 1]),
    'copyFile': wrapFsMethod(fsModule.copyFile, [0, 1]),
    'copyFileSync': wrapFsMethod(fsModule.copyFileSync, [0, 1]),
    'truncate': wrapFsMethod(fsModule.truncate, [0], true),
    'truncateSync': wrapFsMethod(fsModule.truncateSync, [0], true),
    'open': wrapFsMethod(fsModule.open, [0], true),
    'openSync': wrapFsMethod(fsModule.openSync, [0], true),
    // ── 读类（路径守卫：敏感路径抛 EACCES，其余透传真实 fs）──
    'readFile': wrapFsMethod(fsModule.readFile, [0]),
    'readFileSync': wrapFsMethod(fsModule.readFileSync, [0]),
    'readdir': wrapFsMethod(fsModule.readdir, [0]),
    'readdirSync': wrapFsMethod(fsModule.readdirSync, [0]),
    'stat': wrapFsMethod(fsModule.stat, [0]),
    'statSync': wrapFsMethod(fsModule.statSync, [0]),
    'lstat': wrapFsMethod(fsModule.lstat, [0]),
    'lstatSync': wrapFsMethod(fsModule.lstatSync, [0]),
    'fstat': fsModule.fstat,
    'fstatSync': fsModule.fstatSync,
    'existsSync': wrapFsMethod(fsModule.existsSync, [0]),
    'access': wrapFsMethod(fsModule.access, [0]),
    'accessSync': wrapFsMethod(fsModule.accessSync, [0]),
    'createReadStream': wrapFsMethod(fsModule.createReadStream, [0]),
    // realpath：入参守卫（敏感路径抛 EACCES），返回值保留真实路径（不再映射回虚拟根）
    'realpath': wrapFsMethod(fsModule.realpath, [0]),
    'realpathSync': wrapFsMethod(fsModule.realpathSync, [0]),
    'realpath.native': fsModule.realpath?.native
      ? wrapFsMethod(fsModule.realpath.native, [0])
      : undefined,
    'realpathSync.native': fsModule.realpathSync?.native
      ? wrapFsMethod(fsModule.realpathSync.native, [0])
      : undefined,
  }

  const guardedFsPromises: Record<string, unknown> = {
    ...fsPromisesModule,
    writeFile: wrapFsMethod(fsPromisesModule.writeFile, [0], true),
    appendFile: wrapFsMethod(fsPromisesModule.appendFile, [0], true),
    mkdir: wrapFsMethod(fsPromisesModule.mkdir),
    unlink: wrapFsMethod(fsPromisesModule.unlink),
    rm: wrapFsMethod(fsPromisesModule.rm),
    rename: wrapFsMethod(fsPromisesModule.rename, [0, 1]),
    copyFile: wrapFsMethod(fsPromisesModule.copyFile, [0, 1]),
    truncate: wrapFsMethod(fsPromisesModule.truncate, [0], true),
    open: wrapFsMethod(fsPromisesModule.open, [0], true),
    readFile: wrapFsMethod(fsPromisesModule.readFile, [0]),
    readdir: wrapFsMethod(fsPromisesModule.readdir, [0]),
    stat: wrapFsMethod(fsPromisesModule.stat, [0]),
    lstat: wrapFsMethod(fsPromisesModule.lstat, [0]),
    access: wrapFsMethod(fsPromisesModule.access, [0]),
    cp: wrapFsMethod(fsPromisesModule.cp, [0, 1]),
    /**
     * promises.realpath：入参守卫，返回真实路径
     */
    realpath: (async (...args: any[]) => {
      if (args[0] !== undefined)
        args[0] = guardPathArgLocal(args[0])
      return (fsPromisesModule.realpath as (...a: any[]) => Promise<string>)(...args)
    }) as any,
  }

  return { guardedFs, guardedFsPromises }
}

export async function buildPlaywrightModule() {
  return (await import(/* webpackMode: "eager" */ '@roxybrowser/playwright-mcp')) as unknown as Record<string, unknown>
}
