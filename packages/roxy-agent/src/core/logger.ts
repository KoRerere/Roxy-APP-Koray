import fs from 'node:fs'
import path from 'node:path'
import { agentPaths } from '@/core/storage/agentPaths'

// 日志落在 agent 数据目录 logs/ 下，统一按天分目录：
// logs/{yyyy}/{mm-dd}/agent.log            主 agent 运行日志
// logs/{yyyy}/{mm-dd}/{workerId}.log       worker 运行日志（直接写本地，不再经 IPC 汇聚）
// logs/{yyyy}/{mm-dd}/agent-perfmon.log    主 agent 性能监控
// logs/{yyyy}/{mm-dd}/{workerId}-perfmon.log worker 性能监控
// sandbox：当前脚本的 workdir/{slug}/logs/{yyyy-mm-dd}/{runId}.log（沿用旧布局）
// 保留 7 天。
/**
 * 7 days
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const argv2 = process.argv[2]
const isWorkerMode = argv2 === 'worker'
const isSandbox = argv2 === 'sandbox' || (process.env.ROXY_MODE === 'sandbox' && !isWorkerMode)

const isNormalMode = !isWorkerMode && !isSandbox

const workerId = process.env.ROXY_WORKER_ID || ''
const workerLogFileId = workerId || `pid-${process.pid}`

let LOG_FILE = ''

if (isWorkerMode) {
  LOG_FILE = agentPaths.workerLogFile(workerLogFileId)
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
}
else if (isSandbox) {
  const slug = process.env.SANDBOX_ASSET_SLUG || 'sandbox'
  const runId = process.env.SANDBOX_RUN_ID || `pid-${process.pid}`
  LOG_FILE = process.env.SANDBOX_LOG_FILE || agentPaths.workdirRunLogFile(slug, runId)
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
}
else {
  // 主 agent 按天滚动，当天目录预建
  fs.mkdirSync(agentPaths.runtimeLogDir(), { recursive: true })
}

/** 主 agent 返回当天运行日志文件（跨天自动滚动）；worker/sandbox 返回固定文件。 */
function resolveLogFile(): string {
  return isNormalMode ? agentPaths.agentLogFile() : LOG_FILE
}

/** 主 agent 返回当天性能监控文件；worker 返回固定 perfmon 文件；sandbox 无独立 perfmon。 */
function resolvePerfmonFile(): string {
  if (isNormalMode) {
    return agentPaths.agentPerfmonLogFile()
  }
  if (isWorkerMode) {
    return agentPaths.workerPerfmonLogFile(workerLogFileId)
  }
  return ''
}

/** 递归清理超过 7 天的 .log 文件，并顺手移除空日期目录。 */
function cleanOldLogs(dir: string): void {
  try {
    if (!fs.existsSync(dir))
      return
    const cutoff = Date.now() - MAX_AGE_MS
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const filePath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        cleanOldLogs(filePath)
        try {
          if (fs.readdirSync(filePath).length === 0)
            fs.rmdirSync(filePath)
        }
        catch {
          // ignore
        }
        continue
      }
      if (!entry.isFile() || !entry.name.endsWith('.log'))
        continue
      try {
        if (fs.statSync(filePath).mtime.getTime() < cutoff)
          fs.unlinkSync(filePath)
      }
      catch {
        // ignore
      }
    }
  }
  catch {
    // ignore
  }
}

cleanOldLogs(agentPaths.logsDir)
const cleanupTimer = setInterval(cleanOldLogs, 60 * 60 * 1000, agentPaths.logsDir)
cleanupTimer.unref()

function formatArgs(args: unknown[]): string {
  const parts = args.map((a) => {
    if (typeof a === 'string')
      return a
    try {
      const seen = new WeakSet()
      let result = JSON.stringify(a, (_, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v))
            return '[Circular]'
          seen.add(v)
        }
        return v
      })
      if (result && result.length > 5000)
        result = `${result.slice(0, 5000)}...[truncated]`
      return result ?? String(a)
    }
    catch {
      return String(a)
    }
  })
  return parts.join(' ')
}

function formatLogLine(level: string, body: string): string {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  return `[${timestamp}] [${level.padEnd(5)}] ${body}`
}

let ensuredLogDir = ''
let ensuredPerfmonDir = ''

function writeToFile(line: string): void {
  try {
    const file = resolveLogFile()
    if (isNormalMode) {
      const dir = path.dirname(file)
      if (dir !== ensuredLogDir) {
        fs.mkdirSync(dir, { recursive: true })
        ensuredLogDir = dir
      }
    }
    fs.appendFileSync(file, `${line}\n`, 'utf8')
  }
  catch {}
}

export function writePerfmon(line: string): void {
  if (isSandbox) {
    return
  }

  try {
    const file = resolvePerfmonFile()
    if (isNormalMode) {
      const dir = path.dirname(file)
      if (dir !== ensuredPerfmonDir) {
        fs.mkdirSync(dir, { recursive: true })
        ensuredPerfmonDir = dir
      }
    }
    fs.appendFileSync(file, `${formatLogLine('PERF', line)}\n`, 'utf8')
  }
  catch {}
}

function writeLog(level: string, args: unknown[]): void {
  const body = formatArgs(args)
  writeToFile(formatLogLine(level, body))
}

/**
 * Override console.
 * Worker mode suppresses stdout/stderr to avoid noisy pipe backpressure from concurrent workers.
 * Sandbox mode also suppresses the console copy because its logger already writes the script log;
 * direct stdout/stderr writes from dependencies are captured by sandboxService as a fallback.
 */
const suppressConsoleOutput = isWorkerMode || isSandbox
const _log = suppressConsoleOutput ? () => {} : console.log.bind(console)
const _debug = suppressConsoleOutput ? () => {} : console.debug.bind(console)
const _info = suppressConsoleOutput ? () => {} : console.info.bind(console)
const _warn = suppressConsoleOutput ? () => {} : console.warn.bind(console)
const _error = suppressConsoleOutput ? () => {} : console.error.bind(console)

console.log = (...args: unknown[]) => {
  writeLog('INFO', args)
  _log(...args)
}
console.debug = (...args: unknown[]) => {
  writeLog('DEBUG', args)
  _debug(...args)
}
console.info = (...args: unknown[]) => {
  writeLog('INFO', args)
  _info(...args)
}
console.warn = (...args: unknown[]) => {
  writeLog('WARN', args)
  _warn(...args)
}
console.error = (...args: unknown[]) => {
  writeLog('ERROR', args)
  _error(...args)
}
