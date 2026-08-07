import { createAgentPaths } from '@roxy/shared/agent-paths'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { afterEach, it, vi } from 'vitest'

const originalEnvType = process.env.ENV_TYPE

afterEach(() => {
  vi.resetModules()
  if (originalEnvType === undefined)
    delete process.env.ENV_TYPE
  else
    process.env.ENV_TYPE = originalEnvType
})

it('maps session browser output and script workdirs to their owning data roots', () => {
  const home = path.resolve('/tmp/roxy-agent-paths-test')
  const paths = createAgentPaths(home)
  const date = new Date(2026, 6, 15)

  assert.equal(paths.exitStateFile, path.join(home, 'exit_state'))
  assert.equal(paths.tasksDir, path.join(home, 'state', 'tasks'))
  assert.equal(paths.tasksDb, path.join(home, 'state', 'tasks', 'tasks.db'))

  assert.equal(paths.sessionBrowserDir('session/1'), path.join(home, 'sessions', 'session_1', 'browser'))
  assert.equal(paths.sessionBrowserScreenshotsDir('session/1'), path.join(home, 'sessions', 'session_1', 'browser', 'screenshots'))
  assert.equal(paths.sessionBrowserDownloadsDir('session/1'), path.join(home, 'sessions', 'session_1', 'browser', 'downloads'))
  assert.equal(paths.sessionBrowserTracesDir('session/1'), path.join(home, 'sessions', 'session_1', 'browser', 'traces'))
  assert.equal(paths.sessionBrowserSnapshotsDir('session/1'), path.join(home, 'sessions', 'session_1', 'browser', 'snapshots'))

  assert.equal(paths.scriptPermissionsFile('daily/report'), path.join(home, 'library', 'scripts', 'daily_report.permissions.json'))
  assert.equal(paths.workdir('daily/report'), path.join(home, 'workdir', 'daily_report'))
  assert.equal(paths.workdirBrowserDir('daily/report', date), path.join(home, 'workdir', 'daily_report', 'browser', '2026-07-15'))
  assert.equal(paths.workdirRunLogFile('daily/report', 'run/1', date), path.join(home, 'workdir', 'daily_report', 'logs', '2026-07-15', 'run_1.log'))

  assert.equal(paths.runtimeLogDir(date), path.join(home, 'logs', '2026', '07-15'))
  assert.equal(paths.agentLogFile(date), path.join(home, 'logs', '2026', '07-15', 'agent.log'))
  assert.equal(paths.workerLogFile('worker-1', date), path.join(home, 'logs', '2026', '07-15', 'worker-1.log'))
  assert.equal(paths.agentPerfmonLogFile(date), path.join(home, 'logs', '2026', '07-15', 'agent-perfmon.log'))
  assert.equal(paths.workerPerfmonLogFile('worker-1', date), path.join(home, 'logs', '2026', '07-15', 'worker-1-perfmon.log'))
})

it('creates agent paths with production root when ENV_TYPE is production', async () => {
  vi.resetModules()
  process.env.ENV_TYPE = 'production'

  const { agentPaths } = await import('@/core/storage/agentPaths')

  assert.equal(agentPaths.home, path.join(os.homedir(), '.roxy-agent'))
  assert.equal(agentPaths.exitStateFile, path.join(os.homedir(), '.roxy-agent', 'exit_state'))
})

it('creates agent paths with dev root when ENV_TYPE is not production', async () => {
  vi.resetModules()
  process.env.ENV_TYPE = 'development'

  const { agentPaths } = await import('@/core/storage/agentPaths')

  assert.equal(agentPaths.home, path.join(os.homedir(), '.roxy-agent-dev'))
  assert.equal(agentPaths.exitStateFile, path.join(os.homedir(), '.roxy-agent-dev', 'exit_state'))
})
