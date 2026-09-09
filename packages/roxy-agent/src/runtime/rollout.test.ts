import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'vitest'
import { RoxyRolloutStore } from './rollout'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('RoxyRolloutStore', () => {
  it('uses the product-safe session directory for child rollout files', async () => {
    // Regression: child session IDs contain `:agent:`, but the store wrote the
    // raw ID while agentPaths reads the sanitized directory after reload.
    // Fixed by: applying the shared product session ID normalization on write/read.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-rollout-store-'))
    roots.push(root)
    const store = new RoxyRolloutStore(root)
    const sessionId = 'conversation-1:agent:child-1'

    await store.append(sessionId, {
      type: 'session_start',
      sessionId,
      createdAt: 1,
    })

    assert.equal(
      fs.existsSync(path.join(root, 'conversation-1_agent_child-1', 'rollout.jsonl')),
      true,
    )
    assert.equal(fs.existsSync(path.join(root, sessionId, 'rollout.jsonl')), false)
    assert.equal((await store.read(sessionId))[0]?.type, 'session_start')
  })

  it('supports the product path resolver for future session layout changes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-rollout-store-resolver-'))
    roots.push(root)
    const sessionId = 'conversation-2:agent:child-2'
    const resolver = (id: string) => path.join(root, 'sharded', `${id}.jsonl`)
    const store = new RoxyRolloutStore(root, resolver)

    await store.append(sessionId, { type: 'session_start', sessionId, createdAt: 2 })

    assert.equal(fs.existsSync(path.join(root, 'sharded', `${sessionId}.jsonl`)), true)
    assert.equal((await store.read(sessionId))[0]?.type, 'session_start')
  })

  it('keeps legacy metadata in the raw rollout but excludes it from replay', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-rollout-store-legacy-metadata-'))
    roots.push(root)
    const store = new RoxyRolloutStore(root)
    const sessionId = 'conversation-legacy-metadata'
    const legacyMetadata = {
      role: 'developer' as const,
      content: '<metadata><system-lang>en-US</system-lang><cwd>/old</cwd></metadata>',
      visible: false,
      compactionKey: 'metadata',
      compactionOrder: 0,
    }

    await store.append(sessionId, { type: 'session_start', sessionId, createdAt: 1 })
    await store.append(sessionId, { type: 'user_input', message: legacyMetadata })
    await store.append(sessionId, { type: 'user_input', message: { role: 'user', content: 'continue' } })

    assert.equal((await store.readEvents(sessionId)).filter(event => event.type === 'user_input').length, 2)
    const replayableInputs = (await store.read(sessionId)).filter(event => event.type === 'user_input')
    assert.equal(replayableInputs.length, 1)
    assert.equal(replayableInputs[0]?.message.content, 'continue')
  })
})
