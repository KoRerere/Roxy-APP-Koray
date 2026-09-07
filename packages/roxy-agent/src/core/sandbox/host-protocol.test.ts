import assert from 'node:assert/strict'
import { it } from 'vitest'
import {
  SANDBOX_HOST_PROTOCOL_VERSION,
  parseSandboxAgentToHostMessage,
  parseSandboxHostToAgentMessage,
} from './host-protocol'

it('validates versioned sandbox run messages', () => {
  const message = parseSandboxAgentToHostMessage({
    type: 'run.start',
    protocolVersion: SANDBOX_HOST_PROTOCOL_VERSION,
    generation: 'generation-1',
    runId: 'run-1',
    payload: {
      scriptPath: '/tmp/script.ts',
      assetSlug: 'script',
      profile: 'release',
      browserUrl: 'ws://127.0.0.1/devtools/browser/test',
      browserType: 'chromium',
      options: {},
      permissions: { version: 1, fs: { read: [] }, fetch: { allow: [] } },
      outputDir: '/tmp/output',
      browserOutputDir: '/tmp/output/browser',
      logsDir: '/tmp/output/logs',
      logFilePath: '/tmp/output/logs/run.log',
    },
  })
  assert.equal(message.type, 'run.start')
  assert.equal(message.runId, 'run-1')
})

it('rejects stale protocol versions and malformed terminal messages', () => {
  assert.throws(() => parseSandboxAgentToHostMessage({
    type: 'run.abort',
    protocolVersion: 2,
    generation: 'generation-1',
    runId: 'run-1',
    reason: 'user',
  }))
  assert.throws(() => parseSandboxHostToAgentMessage({
    type: 'run.finished',
    protocolVersion: 1,
    generation: 'generation-1',
    runId: 'run-1',
    result: { status: 'unknown' },
  }))
})

it('validates sandbox phase events and optional event-loop heartbeat diagnostics', () => {
  const message = parseSandboxHostToAgentMessage({
    type: 'run.phase',
    protocolVersion: SANDBOX_HOST_PROTOCOL_VERSION,
    generation: 'generation-1',
    runId: 'run-1',
    phase: 'playwright_connect_start',
    timestamp: 123,
  })
  assert.equal(message.type, 'run.phase')
  assert.equal(message.phase, 'playwright_connect_start')

  const heartbeat = parseSandboxHostToAgentMessage({
    type: 'host.heartbeat',
    protocolVersion: SANDBOX_HOST_PROTOCOL_VERSION,
    generation: 'generation-1',
    pid: 1234,
    timestamp: 123,
    activeRuns: 1,
    memory: { rss: 1, heapUsed: 1, external: 1 },
    eventLoopDelayMs: 42,
  })
  assert.equal(heartbeat.type, 'host.heartbeat')
  assert.equal(heartbeat.eventLoopDelayMs, 42)
})
