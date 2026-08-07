import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'vitest'
import { createDeepAgentRuntime } from './backend'

describe('deep agent runtime HITL config', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'roxy-agent-runtime-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('does not require approval for file reads or writes', async () => {
    const runtime = await createDeepAgentRuntime({ workspaceDir: tempDir })
    try {
      assert.equal(runtime.interruptOn.read_file, undefined)
      assert.equal(runtime.interruptOn.write_file, undefined)
      assert.deepEqual(runtime.interruptOn.execute, { allowedDecisions: ['approve', 'reject'] })
    }
    finally {
      await runtime.destroy()
    }
  })
})
