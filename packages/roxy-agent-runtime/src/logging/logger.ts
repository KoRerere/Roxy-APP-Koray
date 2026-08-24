import type { ILogger, LogLevel } from '../core/interfaces.ts'
import type { ILogSink } from './sinks.ts'

const LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error']

function levelIndex(l: LogLevel): number {
  return LEVELS.indexOf(l)
}

export interface CreateLoggerOptions {
  level?: LogLevel
  scope?: string
  sinks?: ILogSink[]
}

function makeLogger(minLevel: number, scope: string, sinks: ILogSink[]): ILogger {
  function emit(level: LogLevel, msg: string, meta: Record<string, unknown>): void {
    if (levelIndex(level) < minLevel) {
      return
    }
    for (const sink of sinks) {
      sink.write(level, scope, msg, meta)
    }
  }

  return {
    child(childScope: string): ILogger {
      return makeLogger(minLevel, `${scope}:${childScope}`, sinks)
    },
    trace(msg, meta = {}) {
      emit('trace', msg, meta)
    },
    debug(msg, meta = {}) {
      emit('debug', msg, meta)
    },
    info(msg, meta = {}) {
      emit('info', msg, meta)
    },
    warn(msg, meta = {}) {
      emit('warn', msg, meta)
    },
    error(msg, meta = {}) {
      emit('error', msg, meta)
    },
  }
}

/**
 * Create a root logger. Writes to each supplied sink; defaults to no sinks
 * (silent) when none are provided. Use `createConsoleSink()` for production.
 */
export function createLogger(opts: CreateLoggerOptions = {}): ILogger {
  const minLevel = levelIndex(opts.level ?? 'trace')
  const scope = opts.scope ?? 'app'
  const sinks = opts.sinks ?? []
  return makeLogger(minLevel, scope, sinks)
}
