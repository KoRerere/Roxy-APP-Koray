import fs from 'node:fs'
import path from 'node:path'

const LOG_DIR = path.join(process.env.CHECKPOINT_DIR ?? process.cwd(), 'logs')
/**
 * 10MB
 */
const MAX_SIZE = 5 * 1024 * 1024
/**
 * 7 days
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

fs.mkdirSync(LOG_DIR, { recursive: true })

function getDateStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function getLogPath(): string {
  return path.join(LOG_DIR, `${getDateStr()}.log`)
}

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

function writeToFile(line: string): void {
  const logPath = getLogPath()
  try {
    fs.appendFileSync(logPath, `${line}\n`, 'utf8')
    const size = fs.statSync(logPath).size
    if (size > MAX_SIZE) {
      const rotatedPath = path.join(LOG_DIR, `${getDateStr()}.2.log`)
      if (fs.existsSync(rotatedPath)) {
        fs.unlinkSync(rotatedPath)
      }
      fs.renameSync(logPath, rotatedPath)
    }
  }
  catch {
    // ignore write errors to avoid infinite recursion
  }
}

function writeLog(level: string, args: unknown[]): void {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const line = `[${timestamp}] [${level.padEnd(5)}] ${formatArgs(args)}`
  writeToFile(line)
}

function cleanOldLogs(): void {
  try {
    const files = fs.readdirSync(LOG_DIR)
    const cutoff = Date.now() - MAX_AGE_MS
    for (const file of files) {
      if (!file.endsWith('.log'))
        continue
      const filePath = path.join(LOG_DIR, file)
      try {
        const mtime = fs.statSync(filePath).mtime.getTime()
        if (mtime < cutoff)
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

// Run cleanup on startup and every hour
cleanOldLogs()
const cleanupTimer = setInterval(cleanOldLogs, 60 * 60 * 1000)
cleanupTimer.unref()

// Override console
const _log = console.log.bind(console)
const _debug = console.debug.bind(console)
const _info = console.info.bind(console)
const _warn = console.warn.bind(console)
const _error = console.error.bind(console)

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
