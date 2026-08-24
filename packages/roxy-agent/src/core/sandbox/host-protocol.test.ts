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
