import assert from 'node:assert/strict'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { it, vi } from 'vitest'
import { buildSandboxProcess, createRuntimeContext, createSandboxFsModules, enterSandboxWorkingDirectory } from './sandbox-runtime'

it('passes through native fs methods without rewriting them', () => {
  const modules = createSandboxFsModules()
  const fsModule = modules.fs as any
  const promisesModule = modules.promises as any

  assert.equal(fsModule.readFile, fs.readFile)
  assert.equal(fsModule.writeFile, fs.writeFile)
  assert.equal(fsModule.open, fs.open)
  assert.equal(fsModule.default, fs)
  assert.equal(fsModule.promises, fsPromises)
  assert.equal(promisesModule.readFile, fsPromises.readFile)
  assert.equal(promisesModule.writeFile, fsPromises.writeFile)
  assert.equal(promisesModule.open, fsPromises.open)
  assert.equal(promisesModule.default, fsPromises)
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

it('sets the host cwd to the sandbox output dir for relative artifact paths', async () => {
  const originalCwd = process.cwd()
  const outputDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-sandbox-cwd-'))
  const realOutputDir = await fsPromises.realpath(outputDir)
  const restore = enterSandboxWorkingDirectory(outputDir)

  try {
    assert.equal(process.cwd(), realOutputDir)

    await fsPromises.writeFile('relative-screenshot.png', 'png-bytes', 'utf-8')
    assert.equal(
      await fsPromises.readFile(path.join(outputDir, 'relative-screenshot.png'), 'utf-8'),
      'png-bytes',
    )
  }
  finally {
    restore()
    assert.equal(process.cwd(), originalCwd)
    await fsPromises.rm(outputDir, { recursive: true, force: true })
  }
})

it('delegates file ownership to the process logger without appending a duplicate line', async () => {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'roxy-sandbox-runtime-log-'))
  const logFilePath = path.join(tempDir, 'run.log')
  const hostLog = vi.spyOn(console, 'log').mockImplementation(() => {})
  const sent: unknown[] = []

  try {
    const runtime = createRuntimeContext({
      profile: 'release',
      runId: 'run-1',
      dirId: 'profile-1',
      outputDir: tempDir,
      logsDir: tempDir,
      logFilePath,
      processLoggerOwnsLogFile: true,
      ipcSend: message => sent.push(message),
    })

    runtime.console.log('script progress')

    assert.deepEqual(hostLog.mock.calls, [['script progress']])
    await assert.rejects(fsPromises.access(logFilePath))
    assert.deepEqual(sent, [{
      type: 'script_log',
      level: 'info',
      message: 'script progress',
      runId: 'run-1',
    }])
  }
  finally {
    hostLog.mockRestore()
    await fsPromises.rm(tempDir, { recursive: true, force: true })
  }
})
