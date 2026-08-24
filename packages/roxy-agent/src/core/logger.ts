import fs from 'node:fs'
import path from 'node:path'
import { agentPaths } from '@/core/storage/agentPaths'

// Logs are initialized by the process entry point after the runtime mode is known.
// Agent and Sandbox Host process logs roll into the same daily agent log.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type LoggerMode = 'agent' | 'sandbox'

interface LoggerState {
  mode: LoggerMode
  sourceLabel?: string
  cleanupTimer: NodeJS.Timeout
  originals: ConsoleMethods
}

interface ConsoleMethods {
  log: typeof console.log
  debug: typeof console.debug
  info: typeof console.info
  warn: typeof console.warn
  error: typeof console.error
}

let loggerState: LoggerState | undefined
let ensuredLogDir = ''

function captureConsole(): ConsoleMethods {
  return {
    log: console.log,
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  }
}

function cleanOldLogs(dir: string): void {
  try {
    if (!fs.existsSync(dir)) {
      return
    }
    const cutoff = Date.now() - MAX_AGE_MS
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const filePath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        cleanOldLogs(filePath)
        try {
          if (fs.readdirSync(filePath).length === 0) {
            fs.rmdirSync(filePath)
          }
        }
        catch {
          // Ignore cleanup failures.
        }
        continue
      }
      if (!entry.isFile() || !entry.name.endsWith('.log')) {
        continue
      }
      try {
        if (fs.statSync(filePath).mtime.getTime() < cutoff) {
          fs.unlinkSync(filePath)
        }
      }
      catch {
        // Ignore cleanup failures.
      }
    }
  }
  catch {
    // Ignore cleanup failures.
  }
}

function formatArgs(args: unknown[]): string {
  const parts = args.map((value) => {
    if (typeof value === 'string') {
      return value
    }
    try {
      const seen = new WeakSet()
      let result = JSON.stringify(value, (_, nestedValue) => {
        if (typeof nestedValue === 'object' && nestedValue !== null) {
          if (seen.has(nestedValue)) {
            return '[Circular]'
          }
          seen.add(nestedValue)
        }
        return nestedValue
      })
      if (result && result.length > 5000) {
        result = `${result.slice(0, 5000)}...[truncated]`
      }
      return result ?? String(value)
    }
    catch {
      return String(value)
    }
  })
  return parts.join(' ')
}

export function formatLocalLogTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(' ')
}

function formatLogLine(level: string, body: string, sourceLabel?: string): string {
  const timestamp = formatLocalLogTimestamp()
  const source = sourceLabel ? ` [${sourceLabel}]` : ''
  return `[${timestamp}] [${level.padEnd(5)}]${source} ${body}`
}

function resolveLogFile(): string | undefined {
  const state = loggerState
  if (!state) {
    return undefined
  }
  return agentPaths.agentLogFile()
}

function writeToFile(line: string): void {
  const file = resolveLogFile()
  if (!file) {
    return
  }
  try {
    const dir = path.dirname(file)
    if (dir !== ensuredLogDir) {
      fs.mkdirSync(dir, { recursive: true })
      ensuredLogDir = dir
    }
    fs.appendFileSync(file, `${line}\n`, 'utf8')
  }
  catch {
    // Logging must not interrupt application work.
  }
}

function writeLog(level: string, args: unknown[]): void {
  writeToFile(formatLogLine(level, formatArgs(args), loggerState?.sourceLabel))
}

/** Initialize logging after the process mode has been resolved. */
export function initializeLogger(mode: LoggerMode, generation?: string): void {
  if (loggerState) {
    return
  }

  const originals = captureConsole()
  const sourceLabel = mode === 'sandbox' ? `sandbox-host:${generation || `pid-${process.pid}`}` : undefined
  fs.mkdirSync(agentPaths.runtimeLogDir(), { recursive: true })

  cleanOldLogs(agentPaths.logsDir)
  const cleanupTimer = setInterval(cleanOldLogs, 60 * 60 * 1000, agentPaths.logsDir)
  cleanupTimer.unref()
  loggerState = { mode, sourceLabel, cleanupTimer, originals }

  const suppressConsoleOutput = mode === 'sandbox'
  console.log = (...args) => {
    writeLog('INFO', args)
    if (!suppressConsoleOutput) {
      Reflect.apply(originals.log, console, args)
    }
  }
  console.debug = (...args) => {
    writeLog('DEBUG', args)
    if (!suppressConsoleOutput) {
      Reflect.apply(originals.debug, console, args)
    }
  }
  console.info = (...args) => {
    writeLog('INFO', args)
    if (!suppressConsoleOutput) {
      Reflect.apply(originals.info, console, args)
    }
  }
  console.warn = (...args) => {
    writeLog('WARN', args)
    if (!suppressConsoleOutput) {
      Reflect.apply(originals.warn, console, args)
    }
  }
  console.error = (...args) => {
    writeLog('ERROR', args)
    if (!suppressConsoleOutput) {
      Reflect.apply(originals.error, console, args)
    }
  }
}

/** Restore console methods and stop logger-owned timers during process shutdown. */
export function shutdownLogger(): void {
  const state = loggerState
  if (!state) {
    return
  }
  clearInterval(state.cleanupTimer)
  console.log = state.originals.log
  console.debug = state.originals.debug
  console.info = state.originals.info
  console.warn = state.originals.warn
  console.error = state.originals.error
  loggerState = undefined
  ensuredLogDir = ''
}
