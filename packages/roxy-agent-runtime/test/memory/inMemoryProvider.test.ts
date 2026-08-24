import { describe, expect, it } from 'vitest'
import { InMemoryProvider } from '../../src/memory/memory.ts'
import { SlidingWindowTrimmer } from '../../src/memory/trimmer.ts'

function msg(role: 'user' | 'assistant', text: string) {
  return { role, content: text } as const
}

describe('InMemoryProvider', () => {
  it('counts provider state when trimming Responses history', () => {
    const trimmer = new SlidingWindowTrimmer()
    const result = trimmer.trim(
      [
        {
          role: 'assistant',
          content: 'short',
          transcriptItems: [{ type: 'web_search_call', id: 'ws_long', action: { query: 'x'.repeat(4_000) } }],
        },
        { role: 'user', content: 'keep' },
      ],
      { mode: 'tokens', keep: 100 },
    )
    expect(result.summary.removedCount).toBe(1)
    expect(result.summary.removedTokens).toBeGreaterThan(100)
  })
  it('append + getAll returns messages oldest-first', async () => {
    const p = new InMemoryProvider()
    await p.append('s1', msg('user', 'hello'))
    await p.append('s1', msg('assistant', 'world'))
    const all = await p.getAll('s1')
    expect(all).toHaveLength(2)
    expect(all[0]?.content).toBe('hello')
    expect(all[1]?.content).toBe('world')
  })

  it('getAll returns [] for unknown session', async () => {
    const p = new InMemoryProvider()
    expect(await p.getAll('nope')).toEqual([])
  })

  it('getSince returns the last N messages', async () => {
    const p = new InMemoryProvider()
    for (let i = 0; i < 5; i++) {
      await p.append('s1', msg('user', `m${i}`))
    }
    const tail = await p.getSince('s1', 3)
    expect(tail.map((m) => m.content)).toEqual(['m2', 'm3', 'm4'])
  })

  it('getSince with count >= length returns all', async () => {
    const p = new InMemoryProvider()
    await p.append('s1', msg('user', 'a'))
    await p.append('s1', msg('assistant', 'b'))
    expect(await p.getSince('s1', 10)).toHaveLength(2)
  })

  it('sessions are isolated', async () => {
    const p = new InMemoryProvider()
    await p.append('s1', msg('user', 's1msg'))
    await p.append('s2', msg('user', 's2msg'))
    expect(await p.getAll('s1')).toHaveLength(1)
    expect(await p.getAll('s2')).toHaveLength(1)
    expect((await p.getAll('s1'))[0]?.content).toBe('s1msg')
  })

  it('setSummary / getSummary round-trips', async () => {
    const p = new InMemoryProvider()
    expect(await p.getSummary('s1')).toBeNull()
    await p.setSummary('s1', 'prior context here')
    expect(await p.getSummary('s1')).toBe('prior context here')
  })

  it('clear removes history and summary', async () => {
    const p = new InMemoryProvider()
    await p.append('s1', msg('user', 'hi'))
    await p.setSummary('s1', 'sum')
    await p.clear('s1')
    expect(await p.getAll('s1')).toEqual([])
    expect(await p.getSummary('s1')).toBeNull()
  })

  it('trim delegates to the injected trimmer and removes head messages', async () => {
    const trimmer = new SlidingWindowTrimmer()
    const p = new InMemoryProvider({ trimmer })
    for (const t of ['a', 'b', 'c', 'd']) {
      await p.append('s1', msg('user', t))
    }
    const summary = await p.trim('s1', { mode: 'turns', keep: 2 })
    expect(summary.removedCount).toBe(2)
    const remaining = await p.getAll('s1')
    expect(remaining.map((m) => m.content)).toEqual(['c', 'd'])
  })

  it('does not deduplicate compaction context when trimming removes nothing', async () => {
    // Regression: compaction-key normalization could mutate live history even
    // when the trimmer removed zero messages, leaving rollout replay inconsistent.
    // Fixed by: context restoration only runs after a real compaction.
    const p = new InMemoryProvider()
    await p.append('s1', { ...msg('user', 'old metadata'), compactionKey: 'metadata', compactionOrder: 0 })
    await p.append('s1', { ...msg('user', 'new metadata'), compactionKey: 'metadata', compactionOrder: 0 })

    const summary = await p.trim('s1', { mode: 'turns', keep: 10 })

    expect(summary.removedCount).toBe(0)
    expect((await p.getAll('s1')).map((message) => message.content)).toEqual(['old metadata', 'new metadata'])
  })
})
