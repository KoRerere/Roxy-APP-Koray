import fs from 'node:fs'
import path from 'node:path'

const LOG_DIR = path.join(process.env.CHECKPOINT_DIR ?? process.cwd(), 'logs')
/**
 * 5MB
 */
const MAX_SIZE = 5 * 1024 * 1024
/**
 * 7 days
 */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const mode = process.env.ROXY_MODE ?? 'agent'
const isSandbox = mode === 'sandbox'

let LOG_FILE: string
let LOG_BACKUP: string | undefined

if (isSandbox) {
  // Sandbox mode: logs/sandbox/{pid}.log
  const sandboxDir = path.join(LOG_DIR, 'sandbox')
  fs.mkdirSync(sandboxDir, { recursive: true })
  LOG_FILE = path.join(sandboxDir, `${process.pid}.log`)
  // No backup file for sandbox, just overwrite on restart
  if (fs.existsSync(LOG_FILE)) {
    fs.unlinkSync(LOG_FILE)
  }
}
else {
  // Normal mode: logs/{mode}.log + logs/{mode}.2.log
  fs.mkdirSync(LOG_DIR, { recursive: true })
  LOG_FILE = path.join(LOG_DIR, `${mode}.log`)
  LOG_BACKUP = path.join(LOG_DIR, `${mode}.2.log`)
}

function trimBackupIfNeeded(): void {
  if (!LOG_BACKUP)
    return
  try {
    if (!fs.existsSync(LOG_BACKUP))
      return
    if (fs.statSync(LOG_BACKUP).size <= MAX_SIZE)
      return
    const lines = fs.readFileSync(LOG_BACKUP, 'utf8').split('\n').filter(l => l.length > 0)
    const kept = lines.slice(Math.floor(lines.length / 2))
    fs.writeFileSync(LOG_BACKUP, `${kept.join('\n')}\n`, 'utf8')
  }
  catch {
    // ignore
  }
}

// On startup: move current log into backup, start fresh
function rotateOnStartup(): void {
  if (!LOG_BACKUP)
    return
  try {
    if (!fs.existsSync(LOG_FILE))
      return
    const content = fs.readFileSync(LOG_FILE, 'utf8')
    if (content.length > 0) {
      fs.appendFileSync(LOG_BACKUP, content, 'utf8')
      trimBackupIfNeeded()
    }
    fs.writeFileSync(LOG_FILE, '', 'utf8')
  }
  catch {
    // ignore
  }
}

function cleanOldSandboxLogs(): void {
  if (!isSandbox)
    return
  try {
    const sandboxDir = path.join(LOG_DIR, 'sandbox')
    if (!fs.existsSync(sandboxDir))
      return
    const files = fs.readdirSync(sandboxDir)
    const cutoff = Date.now() - MAX_AGE_MS
    for (const file of files) {
      if (!file.endsWith('.log'))
        continue
      const filePath = path.join(sandboxDir, file)
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

if (isSandbox) {
  // Sandbox: clean old logs on startup and every hour
  cleanOldSandboxLogs()
  const cleanupTimer = setInterval(cleanOldSandboxLogs, 60 * 60 * 1000)
  cleanupTimer.unref()
}
else {
  // Normal mode: rotate on startup
  rotateOnStartup()
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
  try {
    fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8')
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
