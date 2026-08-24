import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { JsonlSessionStore } from '../../src/memory/session_store.ts'
import { InMemoryProvider } from '../../src/memory/memory.ts'
import { replayIntoMemory } from '../../src/memory/replay.ts'
import { assistantMessageToItems } from '../../src/transcript/items.ts'
import type { Message, RolloutEvent } from '../../src/core/interfaces.ts'

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'roxy-test-replay-'))
}

async function writeRollout(store: JsonlSessionStore, sessionId: string, events: RolloutEvent[]) {
  for (const e of events) {
    await store.append(sessionId, e)
  }
}

describe('replayIntoMemory', () => {
  it('replays the retained tail from a compaction snapshot', async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() })
    const memory = new InMemoryProvider()
    const sid = 'compaction-snapshot'
    const kept: Message[] = [
      {
        role: 'user',
        content: '<metadata><cwd>/tmp/work</cwd></metadata>',
        visible: false,
        compactionKey: 'metadata',
        compactionOrder: 0,
      },
      {
        role: 'user',
        content: '<memory-md># Roxy Agent Memory Index</memory-md>',
        visible: false,
        compactionKey: 'memory-md',
        compactionOrder: 1,
      },
      { role: 'assistant', content: 'the five pages are complete' },
      { role: 'user', content: 'what did we do?' },
    ]
    await writeRollout(store, sid, [
      { type: 'session_start', sessionId: sid, createdAt: 1 },
      {
        type: 'compaction',
        summary: 'The research task was completed.',
        compactedCount: 7,
        ts: 2,
        keptMessages: kept,
      },
      {
        type: 'assistant_turn',
        items: assistantMessageToItems({ role: 'assistant', content: 'answer' }),
        stopReason: 'end_turn',
      },
    ])

    await replayIntoMemory(store, memory, sid)
    expect(await memory.getAll(sid)).toEqual([
      {
        role: 'developer',
        content: 'Previous conversation summary:\n<summary>\nThe research task was completed.\n</summary>',
        visible: false,
      },
      ...kept,
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'answer' }],
        transcriptItems: assistantMessageToItems({ role: 'assistant', content: 'answer' }),
      },
    ])
  })

  it('reconstructs the retained tail for legacy compaction events', async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() })
    const memory = new InMemoryProvider()
    const sid = 'legacy-compaction'
    await writeRollout(store, sid, [
      { type: 'session_start', sessionId: sid, createdAt: 1 },
      { type: 'user_input', message: { role: 'user', content: 'old' } },
      {
        type: 'assistant_turn',
        items: assistantMessageToItems({ role: 'assistant', content: 'completed research' }),
        stopReason: 'end_turn',
      },
      { type: 'user_input', message: { role: 'user', content: 'recent' } },
      { type: 'compaction', summary: 'summary', compactedCount: 2, ts: 2 },
      {
        type: 'assistant_turn',
        items: assistantMessageToItems({ role: 'assistant', content: 'next' }),
        stopReason: 'end_turn',
      },
    ])

    await replayIntoMemory(store, memory, sid)
    expect(await memory.getAll(sid)).toEqual([
      { role: 'developer', content: 'Previous conversation summary:\n<summary>\nsummary\n</summary>', visible: false },
      { role: 'user', content: 'recent' },
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'next' }],
        transcriptItems: assistantMessageToItems({ role: 'assistant', content: 'next' }),
      },
    ])
  })

  it('returns empty / isNew for an unknown session', async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() })
    const memory = new InMemoryProvider()
    const res = await replayIntoMemory(store, memory, 'ghost')
    expect(res.eventCount).toBe(0)
    expect(res.isNew).toBe(true)
    expect(await memory.getAll('ghost')).toEqual([])
  })

  it('replays user + assistant turns back into memory in order', async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() })
    const memory = new InMemoryProvider()
    const sid = 's1'
    const events: RolloutEvent[] = [
      { type: 'session_start', sessionId: sid, createdAt: 1 },
      { type: 'user_input', message: { role: 'user', content: 'hi' } },
      {
        type: 'assistant_turn',
        items: assistantMessageToItems({ role: 'assistant', content: 'hello' }),
        stopReason: 'end_turn',
      },
      { type: 'user_input', message: { role: 'user', content: 'again' } },
      {
        type: 'assistant_turn',
        items: assistantMessageToItems({ role: 'assistant', content: 'bye' }),
        stopReason: 'end_turn',
      },
    ]
    await writeRollout(store, sid, events)

    const res = await replayIntoMemory(store, memory, sid)
    expect(res.eventCount).toBe(5)
    expect(res.isNew).toBe(false)

    const history: Message[] = await memory.getAll(sid)
    expect(history.map((m) => m.content)).toEqual([
      'hi',
      [{ type: 'text', text: 'hello' }],
      'again',
      [{ type: 'text', text: 'bye' }],
    ])
  })

  it('preserves thinking blocks and tool_result blocks on replay', async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() })
    const memory = new InMemoryProvider()
    const sid = 's2'
    const events: RolloutEvent[] = [
      { type: 'session_start', sessionId: sid, createdAt: 1 },
      { type: 'user_input', message: { role: 'user', content: 'use tool' } },
      {
        type: 'assistant_turn',
        items: assistantMessageToItems({
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'plan', signature: 'sig_T' },
            { type: 'tool_use', id: 'tu1', name: 'echo', input: { x: 1 } },
          ],
        }),
        stopReason: 'tool_use',
      },
      {
        type: 'tool_result',
        result: { type: 'tool_result', tool_use_id: 'tu1', content: 'ok' },
      },
      {
        type: 'assistant_turn',
        items: assistantMessageToItems({ role: 'assistant', content: 'done' }),
        stopReason: 'end_turn',
      },
    ]
    await writeRollout(store, sid, events)

    await replayIntoMemory(store, memory, sid)
    const history: Message[] = await memory.getAll(sid)

    // user, assistant(thinking+tool_use), user(tool_result), assistant
    expect(history).toHaveLength(4)
    expect(history[1]!.content).toEqual([
      { type: 'thinking', thinking: 'plan', signature: 'sig_T' } as never,
      { type: 'tool_use', id: 'tu1', name: 'echo', input: { x: 1 } } as never,
    ])
    expect(history[2]!.content).toEqual([{ type: 'tool_result', tool_use_id: 'tu1', content: 'ok' } as never])
  })

  it('synthesizes interrupted tool_result blocks for incomplete persisted tool_use turns', async () => {
    // Regression: replay could restore an assistant tool_use turn without a matching
    // tool_result, causing DeepSeek/Anthropic-compatible providers to reject the next request.
    // Fixed by: replay closes unresolved tool_use blocks with synthetic interrupted error results.
    const store = new JsonlSessionStore({ dir: tmpDir() })
    const memory = new InMemoryProvider()
    const sid = 'interrupted-tool-use'
    const events: RolloutEvent[] = [
      { type: 'session_start', sessionId: sid, createdAt: 1 },
      { type: 'user_input', message: { role: 'user', content: 'write a file' } },
      {
        type: 'assistant_turn',
        items: assistantMessageToItems({
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will update it.' },
            {
              type: 'tool_use',
              id: 'call_00_qs1Dp55rwzfpyRg0eUHW9843',
              name: 'apply_patch',
              input: '*** Begin Patch\n*** Add File: a.txt\n+content\n*** End Patch',
            },
          ],
        }),
        stopReason: 'tool_use',
      },
      { type: 'user_input', message: { role: 'user', content: 'continue' } },
    ]
    await writeRollout(store, sid, events)

    await replayIntoMemory(store, memory, sid)
    const history: Message[] = await memory.getAll(sid)

    expect(history).toHaveLength(4)
    expect(history[2]).toEqual({
      role: 'user',
      content: [
        expect.objectContaining({
          type: 'tool_result',
          tool_use_id: 'call_00_qs1Dp55rwzfpyRg0eUHW9843',
          is_error: true,
        }),
      ],
    })
    expect(JSON.stringify(history[2]!.content)).toContain('state is unknown')
    expect(JSON.stringify(history[2]!.content)).toContain('Re-check the external state')
    expect(history[3]).toEqual({ role: 'user', content: 'continue' })
  })

  it('ignores session_start (metadata only)', async () => {
    const store = new JsonlSessionStore({ dir: tmpDir() })
    const memory = new InMemoryProvider()
    const sid = 's3'
    await writeRollout(store, sid, [{ type: 'session_start', sessionId: sid, createdAt: 7 }])
    await replayIntoMemory(store, memory, sid)
    // session_start contributes no message but counts as an event.
    expect(await memory.getAll(sid)).toEqual([])
  })
})
