import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { it, vi } from 'vitest'
import { buildSandboxProcess, createRuntimeContext, createSandboxFsModules } from './sandbox-runtime'

it('maps relative fs paths to the run output directory', async () => {
  const outputDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-sandbox-fs-'))
  const written: string[] = []
  const modules = createSandboxFsModules({ outputDir, onWrite: filePath => written.push(filePath) })
  const fsModule = modules.fs as any
  const promisesModule = modules.promises as any
  try {
    await promisesModule.writeFile('result.txt', 'ok', 'utf-8')
    assert.equal(await promisesModule.readFile('result.txt', 'utf-8'), 'ok')
    assert.deepEqual(written, [path.join(outputDir, 'result.txt')])
    assert.equal(fsModule.default, fsModule)
    assert.equal(promisesModule.default, promisesModule)
  }
  finally {
    await fsPromises.rm(outputDir, { recursive: true, force: true })
  }
})

it('exposes SANDBOX_DEBUG through the curated sandbox environment', () => {
  const sandboxProcess = buildSandboxProcess({
    outputDir: '/tmp/roxy-sandbox',
    env: {
      BROWSER_URL: '',
      BROWSER_TYPE: 'chromium',
      SANDBOX_DEBUG: '1',
    },
    exit: () => {},
  })

  assert.equal(sandboxProcess.env.SANDBOX_DEBUG, '1')
  assert.equal(sandboxProcess.env.DEBUG, undefined)
  assert.equal(Object.isFrozen(sandboxProcess.env), true)
})

it('isolates process events and stdout between VM sessions', () => {
  const firstEvents = new EventEmitter()
  const secondEvents = new EventEmitter()
  const firstOutput: string[] = []
  const secondOutput: string[] = []
  const first = buildSandboxProcess({
    outputDir: '/tmp/first',
    env: {},
    events: firstEvents,
    write: (_level, text) => firstOutput.push(text),
    exit: () => {},
  })
  const second = buildSandboxProcess({
    outputDir: '/tmp/second',
    env: {},
    events: secondEvents,
    write: (_level, text) => secondOutput.push(text),
    exit: () => {},
  })
  let firstSignals = 0
  first.on('custom', () => firstSignals++)
  ;(second as any).emit('custom')
  second.stdout.write('second')

  assert.equal(firstSignals, 0)
  assert.deepEqual(firstOutput, [])
  assert.deepEqual(secondOutput, ['second'])
})

it('writes run logs without forwarding through the Host console', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-sandbox-runtime-log-'))
  const logFilePath = path.join(tempDir, 'run.log')
  const sent: unknown[] = []

  try {
    const runtime = createRuntimeContext({
      profile: 'release',
      runId: 'run-1',
      dirId: 'profile-1',
      outputDir: tempDir,
      logsDir: tempDir,
      logFilePath,
      ipcSend: message => sent.push(message),
    })

    runtime.console.log('script progress')

    assert.match(await fsPromises.readFile(logFilePath, 'utf-8'), /script progress/)
    assert.deepEqual(sent, [{
      type: 'script_log',
      level: 'info',
      message: 'script progress',
      runId: 'run-1',
    }])
  }
  finally {
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})

it('writes run log timestamps in the local timezone', async () => {
  // Regression: sandbox run logs used Date.toISOString(), so human-readable log
  // files were pinned to UTC instead of the user's local timezone.
  // Fixed by: sharing the local logger timestamp formatter.
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-sandbox-runtime-log-'))
  const logFilePath = path.join(tempDir, 'run.log')
  const previousTimezone = process.env.TZ
  process.env.TZ = 'Asia/Shanghai'
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-19T08:04:02.000Z'))

  try {
    const runtime = createRuntimeContext({
      profile: 'release',
      runId: 'run-1',
      dirId: 'profile-1',
      outputDir: tempDir,
      logsDir: tempDir,
      logFilePath,
    })

    runtime.console.log('script progress')

    assert.match(await fsPromises.readFile(logFilePath, 'utf-8'), /\[2026-08-19 16:04:02\] \[INFO\] script progress/)
  }
  finally {
    vi.useRealTimers()
    if (previousTimezone === undefined) {
      delete process.env.TZ
    }
    else {
      process.env.TZ = previousTimezone
    }
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})
