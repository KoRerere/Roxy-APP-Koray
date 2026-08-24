import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { JsonlSessionStore } from '../../src/memory/session_store.ts'

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'roxy-test-session-'))
}

describe('JsonlSessionStore', () => {
  it('append + read preserves insertion order', async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() })
    await store.append('s1', { type: 'session_start', sessionId: 's1', createdAt: 1 })
    await store.append('s1', { type: 'user_input', message: { role: 'user', content: 'hello' } })
    const events = await store.read('s1')
    expect(events).toHaveLength(2)
    expect(events[0]?.type).toBe('session_start')
    expect(events[1]?.type).toBe('user_input')
  })

  it('read returns [] for an unknown session', async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() })
    expect(await store.read('nope')).toEqual([])
  })

  it('sessions are isolated in separate files', async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() })
    await store.append('s1', { type: 'session_start', sessionId: 's1', createdAt: 1 })
    await store.append('s2', { type: 'session_start', sessionId: 's2', createdAt: 2 })
    expect(await store.read('s1')).toHaveLength(1)
    expect(await store.read('s2')).toHaveLength(1)
  })

  it('list returns sessions newest-first by updatedAt', async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() })
    await store.append('s1', { type: 'session_start', sessionId: 's1', createdAt: 100 })
    await new Promise((r) => setTimeout(r, 5))
    await store.append('s2', { type: 'session_start', sessionId: 's2', createdAt: 200 })
    const list = await store.list()
    expect(list[0]?.sessionId).toBe('s2')
    expect(list[1]?.sessionId).toBe('s1')
  })

  it('meta returns null for unknown session', async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() })
    expect(await store.meta('nope')).toBeNull()
  })

  it('meta returns correct eventCount and timestamps', async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() })
    await store.append('s1', { type: 'session_start', sessionId: 's1', createdAt: 42 })
    await store.append('s1', { type: 'user_input', message: { role: 'user', content: 'hi' } })
    const m = await store.meta('s1')
    expect(m?.sessionId).toBe('s1')
    expect(m?.eventCount).toBe(2)
    expect(m?.createdAt).toBe(42)
  })

  it('persists across new store instances (same dir)', async () => {
    const dir = tmpDir()
    const s1 = new JsonlSessionStore({ dir })
    await s1.append('s1', { type: 'session_start', sessionId: 's1', createdAt: 1 })
    await s1.append('s1', { type: 'user_input', message: { role: 'user', content: 'ping' } })

    const s2 = new JsonlSessionStore({ dir })
    const events = await s2.read('s1')
    expect(events).toHaveLength(2)
    expect(events[1]?.type).toBe('user_input')
  })
})
