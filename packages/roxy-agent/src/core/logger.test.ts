import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ root: '' }))

vi.mock('@/core/storage/agentPaths', () => ({
  agentPaths: {
    logsDir: path.join(state.root, 'logs'),
    runtimeLogDir: () => path.join(state.root, 'logs', '2026', '08-13'),
    agentLogFile: () => path.join(state.root, 'logs', '2026', '08-13', 'agent.log'),
    workerLogFile: (id: string) => path.join(state.root, 'logs', `${id}.log`),
  },
}))

describe('logger lifecycle', () => {
  const originalConsole = {
    log: console.log,
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  }

  afterEach(async () => {
    const logger = await import('./logger')
    logger.shutdownLogger()
    Object.assign(console, originalConsole)
    fs.rmSync(state.root, { recursive: true, force: true })
    vi.resetModules()
  })

  it('does not touch the filesystem or console during module import', async () => {
    state.root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-logger-'))
    const before = { ...originalConsole }
    await import('./logger')
    expect(fs.readdirSync(state.root)).toEqual([])
    expect(console.log).toBe(before.log)
  })

  it('initializes agent logging explicitly and restores console on shutdown', async () => {
    state.root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-logger-'))
    const logger = await import('./logger')
    logger.initializeLogger('agent')
    console.log('hello')
    logger.shutdownLogger()

    expect(fs.existsSync(path.join(state.root, 'logs', '2026', '08-13', 'agent.log'))).toBe(true)
    expect(console.log).toBe(originalConsole.log)
  })

  it('writes sandbox host logs into agent.log with a source label', async () => {
    state.root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-logger-'))
    const logger = await import('./logger')
    logger.initializeLogger('sandbox', 'generation-1')
    console.log('sandbox message')
    logger.shutdownLogger()

    const agentLog = path.join(state.root, 'logs', '2026', '08-13', 'agent.log')
    expect(fs.existsSync(agentLog)).toBe(true)
    expect(fs.readFileSync(agentLog, 'utf-8')).toContain('[sandbox-host:generation-1] sandbox message')
    expect(fs.existsSync(path.join(state.root, 'logs', 'sandbox-host-generation-1.log'))).toBe(false)
  })

  it('writes human-readable log timestamps in the local timezone', async () => {
    // Regression: agent.log used Date.toISOString(), so human-readable log
    // timestamps were always rendered in UTC.
    // Fixed by: formatting log timestamps from local Date fields.
    state.root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-logger-'))
    const previousTimezone = process.env.TZ
    process.env.TZ = 'Asia/Shanghai'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-19T08:04:02.000Z'))
    try {
      const logger = await import('./logger')
      logger.initializeLogger('agent')
      console.log('local time')
      logger.shutdownLogger()

      const agentLog = path.join(state.root, 'logs', '2026', '08-13', 'agent.log')
      expect(fs.readFileSync(agentLog, 'utf-8')).toContain('[2026-08-19 16:04:02] [INFO ] local time')
    }
    finally {
      vi.useRealTimers()
      if (previousTimezone === undefined) {
        delete process.env.TZ
      }
      else {
        process.env.TZ = previousTimezone
      }
    }
  })
})
