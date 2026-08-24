import { describe, expect, it, vi } from 'vitest'
import { buildTestAgent, chatResponse, endTurnResponse, toolCallResponse } from '../helpers/buildTestAgent.ts'
import type { ChatResponse, ContentBlock, ISessionStore, Message, RolloutEvent } from '../../src/core/interfaces.ts'
import { testToolInputSchema } from '../helpers/toolSchema.ts'

/** An end_turn response reporting the given REAL input token usage. */
function endTurnWithUsage(text: string, inputTokens: number): ChatResponse {
  return {
    ...chatResponse({ role: 'assistant', content: text }, 'end_turn'),
    usage: { inputTokens, outputTokens: 10 },
  }
}

function metadataMessage(label: string): Message {
  return {
    role: 'user',
    content: `<metadata><os>${label}</os></metadata>`,
    visible: false,
    compactionKey: 'metadata',
    compactionOrder: 0,
  }
}

function memoryMessage(): Message {
  return {
    role: 'user',
    content: '<memory-md># Roxy Agent Memory Index</memory-md>',
    visible: false,
    compactionKey: 'memory-md',
    compactionOrder: 1,
  }
}

function recordingStore(events: RolloutEvent[]): ISessionStore {
  return {
    async append(_sessionId, event) {
      events.push(event)
    },
    async read() {
      return []
    },
    async list() {
      return []
    },
    async meta() {
      return null
    },
  }
}

// The compaction trigger must use the REAL context size reported by the API
// (`usage.input_tokens` of the most recent call), not the chars/4 heuristic —
// code-heavy histories blow past the heuristic long before it reaches the
// threshold.
describe('compaction trigger uses real usage', () => {
  it('invoke(): checks before every model call inside a tool loop', async () => {
    // Regression: compaction was guarded by firstIteration, so a tool result
    // could push the next request over the threshold and DeepSeek would reject it.
    // Fixed by: checking the context immediately before every model request.
    let calls = 0
    const { agent, memory, registry, provider } = buildTestAgent({
      handler: () => {
        calls++
        return calls === 1
          ? { ...toolCallResponse('tool-1', 'echo', { text: 'x' }), usage: { inputTokens: 5, outputTokens: 1 } }
          : endTurnResponse('done')
      },
      trimPolicy: { mode: 'turns', keep: 1 },
      triggerTokens: 10,
      summarizer: { summarize: async () => 'summary' },
      tokenCounter: (messages) =>
        messages.some(
          (message) =>
            Array.isArray(message.content) &&
            (message.content as ContentBlock[]).some((block) => block.type === 'tool_result'),
        )
          ? 100
          : 0,
    })
    registry.add(
      { name: 'echo', description: 'echo', inputSchema: testToolInputSchema, source: 'builtin' },
      async () => ({
        content: 'large tool result '.repeat(20),
        isError: false,
      }),
    )
    await memory.append(agent.sessionId, { role: 'user', content: 'old context' })
    await memory.append(agent.sessionId, { role: 'assistant', content: 'old answer' })
    const trimSpy = vi.spyOn(memory, 'trim')
    await agent.invoke('start')
    expect(provider.calls).toHaveLength(2)
    expect(trimSpy).toHaveBeenCalledTimes(1)
    const history = await memory.getAll(agent.sessionId)
    expect(
      history.some(
        (m) => m.role === 'user' && Array.isArray(m.content) && m.content.some((b) => b.type === 'tool_result'),
      ),
    ).toBe(true)
  })

  it('stream(): checks before every model call inside a tool loop', async () => {
    // Regression: streamLoop also skipped the check after tool execution.
    // Fixed by: applying the same per-request check to streaming calls.
    let calls = 0
    const { agent, memory, registry, provider } = buildTestAgent({
      handler: () => {
        calls++
        return calls === 1
          ? { ...toolCallResponse('tool-1', 'echo', { text: 'x' }), usage: { inputTokens: 5, outputTokens: 1 } }
          : endTurnResponse('done')
      },
      trimPolicy: { mode: 'turns', keep: 1 },
      triggerTokens: 10,
      summarizer: { summarize: async () => 'summary' },
      tokenCounter: (messages) =>
        messages.some(
          (message) =>
            Array.isArray(message.content) &&
            (message.content as ContentBlock[]).some((block) => block.type === 'tool_result'),
        )
          ? 100
          : 0,
    })
    registry.add(
      { name: 'echo', description: 'echo', inputSchema: testToolInputSchema, source: 'builtin' },
      async () => ({
        content: 'large tool result '.repeat(20),
        isError: false,
      }),
    )
    await memory.append(agent.sessionId, { role: 'user', content: 'old context' })
    await memory.append(agent.sessionId, { role: 'assistant', content: 'old answer' })
    const events = [] as Array<{ type: string; status?: string }>
    for await (const event of agent.stream('start')) {
      events.push(event)
    }
    expect(provider.calls).toHaveLength(2)
    expect(events.filter((event) => event.type === 'context_compacted').map((event) => event.status)).toEqual([
      'started',
      'completed',
    ])
    const history = await memory.getAll(agent.sessionId)
    expect(
      history.some(
        (m, index) =>
          index > 0 &&
          m.role === 'user' &&
          Array.isArray(m.content) &&
          m.content.some((b) => b.type === 'tool_result') &&
          history[index - 1]?.role !== 'assistant',
      ),
    ).toBe(false)
  })

  it('stream(): emits a context_compacted lifecycle event after summarizing', async () => {
    // Regression: compaction was persisted to rollout but never surfaced to
    // the stream consumer, so the frontend could not show the lifecycle row.
    // Fixed by: streamLoop emits context_compacted after the summary is ready.
    const { agent } = buildTestAgent({
      handler: () => endTurnWithUsage('ok', 5000),
      trimPolicy: { mode: 'turns', keep: 1 },
      triggerTokens: 1000,
      summarizer: { summarize: async () => 'summary text' },
    })

    for await (const _ of agent.stream('first')) {
      // Drain the first turn to arm the usage-based trigger.
    }

    const events = [] as Array<{ type: string; status?: string; compactedCount?: number; summary?: string }>
    for await (const event of agent.stream('second')) {
      events.push(event)
    }

    expect(events.find((event) => event.type === 'context_compacted' && event.status === 'started')).toEqual({
      type: 'context_compacted',
      status: 'started',
      compactedCount: 2,
    })
    expect(events.find((event) => event.type === 'context_compacted' && event.status === 'completed')).toEqual({
      type: 'context_compacted',
      status: 'completed',
      compactedCount: 2,
      summary: 'summary text',
    })
  })

  it('stream(): completes the lifecycle when the summarizer returns no text', async () => {
    const { agent } = buildTestAgent({
      handler: () => endTurnWithUsage('ok', 5000),
      trimPolicy: { mode: 'turns', keep: 1 },
      triggerTokens: 1000,
      summarizer: { summarize: async () => '' },
    })

    for await (const _ of agent.stream('first')) {
    }
    const events = [] as Array<{ type: string; status?: string; summary?: string }>
    for await (const event of agent.stream('second')) {
      events.push(event)
    }

    expect(events.filter((event) => event.type === 'context_compacted').map((event) => event.status)).toEqual([
      'started',
      'completed',
    ])
    expect(
      events.find((event) => event.type === 'context_compacted' && event.status === 'completed')?.summary,
    ).toBeUndefined()
  })

  it('invoke(): trims on the next call after usage exceeded triggerTokens', async () => {
    const { agent, memory } = buildTestAgent({
      // Tiny text (heuristic ≈ 0 tokens), but the API reports 5000 real
      // input tokens — only the real signal can arm the trigger.
      handler: () => endTurnWithUsage('ok', 5000),
      trimPolicy: { mode: 'turns', keep: 1 },
      triggerTokens: 1000,
    })
    const trimSpy = vi.spyOn(memory, 'trim')

    await agent.invoke('first')
    // No usage observed before the first call — heuristic says tiny → no trim.
    expect(trimSpy).not.toHaveBeenCalled()

    await agent.invoke('second')
    // Previous call reported 5000 > 1000 → trim fires before the model call.
    expect(trimSpy).toHaveBeenCalledTimes(1)
  })

  it('invoke(): stays on the heuristic when usage is below the threshold', async () => {
    const { agent, memory } = buildTestAgent({
      handler: () => endTurnWithUsage('ok', 50),
      trimPolicy: { mode: 'turns', keep: 1 },
      triggerTokens: 1000,
    })
    const trimSpy = vi.spyOn(memory, 'trim')

    await agent.invoke('first')
    await agent.invoke('second')
    expect(trimSpy).not.toHaveBeenCalled()
  })

  it('stream(): usage from a prior stream call arms the trigger the same way', async () => {
    const { agent, memory } = buildTestAgent({
      handler: () => endTurnWithUsage('ok', 5000),
      trimPolicy: { mode: 'turns', keep: 1 },
      triggerTokens: 1000,
    })
    const trimSpy = vi.spyOn(memory, 'trim')

    for await (const _ of agent.stream('first')) {
      // drain
    }
    expect(trimSpy).not.toHaveBeenCalled()

    for await (const _ of agent.stream('second')) {
      // drain
    }
    expect(trimSpy).toHaveBeenCalledTimes(1)
  })

  it('resets the usage signal after trimming so a stale value cannot re-trigger', async () => {
    let inputTokens = 5000
    const { agent, memory } = buildTestAgent({
      handler: () => {
        // After compaction the context is small again — the API reports so.
        const res = endTurnWithUsage('ok', inputTokens)
        inputTokens = 50
        return res
      },
      trimPolicy: { mode: 'turns', keep: 1 },
      triggerTokens: 1000,
    })
    const trimSpy = vi.spyOn(memory, 'trim')

    await agent.invoke('first') // reports 5000
    await agent.invoke('second') // trims, then reports 50
    await agent.invoke('third') // must NOT trim again off the stale 5000
    expect(trimSpy).toHaveBeenCalledTimes(1)
  })
})

describe('compaction trigger falls back to provider.countTokens', () => {
  it('uses the provider estimate when no usage has been observed yet', async () => {
    const { agent, memory } = buildTestAgent({
      responses: [endTurnResponse('ok')],
      trimPolicy: { mode: 'turns', keep: 1 },
      triggerTokens: 1000,
    })
    // Pre-seed a history whose ESTIMATE exceeds the threshold (fresh agent,
    // e.g. resumed session — no usage signal yet).
    const big = 'x'.repeat(8000) // ≈ 2000 tokens by the chars/4 heuristic
    await memory.append(agent.sessionId, { role: 'user', content: big })
    await memory.append(agent.sessionId, { role: 'assistant', content: big })
    const trimSpy = vi.spyOn(memory, 'trim')

    await agent.invoke('go')
    expect(trimSpy).toHaveBeenCalledTimes(1)
  })

  it('uses 80% of contextWindowTokens when triggerTokens is omitted', async () => {
    // Regression: the default trigger was a fixed 150000 tokens, so small
    // context windows waited too long before compacting.
    // Fixed by: deriving the trigger from contextWindowTokens at the dsh 80% ratio.
    const { agent, memory } = buildTestAgent({
      responses: [endTurnResponse('ok')],
      trimPolicy: { mode: 'turns', keep: 1 },
      contextWindowTokens: 1000,
      tokenCounter: () => 801,
    })
    await memory.append(agent.sessionId, { role: 'user', content: 'old context' })
    await memory.append(agent.sessionId, { role: 'assistant', content: 'old answer' })
    const trimSpy = vi.spyOn(memory, 'trim')

    await agent.invoke('go')
    expect(trimSpy).toHaveBeenCalledTimes(1)
  })

  it('keeps an explicit triggerTokens threshold ahead of the context-window ratio', async () => {
    // Regression: changing the default trigger could ignore a host-provided
    // absolute threshold and compact earlier than configured.
    // Fixed by: resolving triggerTokens before deriving the dsh 80% fallback.
    const { agent, memory } = buildTestAgent({
      responses: [endTurnResponse('ok')],
      trimPolicy: { mode: 'turns', keep: 1 },
      contextWindowTokens: 1000,
      triggerTokens: 900,
      tokenCounter: () => 850,
    })
    await memory.append(agent.sessionId, { role: 'user', content: 'old context' })
    await memory.append(agent.sessionId, { role: 'assistant', content: 'old answer' })
    const trimSpy = vi.spyOn(memory, 'trim')

    await agent.invoke('go')
    expect(trimSpy).not.toHaveBeenCalled()
  })
})

describe('Codex-style compaction retention', () => {
  it('summarizes the full transcript and sends bounded active context', async () => {
    // Regression: the old token trimmer fed only the removed prefix to the
    // summarizer and retained a large mixed tail, causing repeated compactions.
    // Fixed by: Codex retention summarizes the full transcript and keeps only
    // recent user context plus an in-flight tool turn.
    let summarized = ''
    const { agent, provider, memory } = buildTestAgent({
      handler: () => endTurnResponse('done'),
      trimPolicy: { mode: 'codex', keep: 1, retainedUserTokens: 2 },
      triggerTokens: 10,
      tokenCounter: (messages) => (messages.length >= 4 ? 100 : 1),
      summarizer: {
        summarize: async (text) => {
          summarized = text
          return 'memento'
        },
      },
    })
    await memory.append(agent.sessionId, { role: 'user', content: 'old request' })
    await memory.append(agent.sessionId, { role: 'assistant', content: 'old answer' })
    await memory.append(agent.sessionId, { role: 'user', content: 'recent request' })
    await memory.append(agent.sessionId, { role: 'assistant', content: 'recent answer' })

    await agent.invoke('continue')

    expect(summarized).toContain('old answer')
    expect(summarized).toContain('recent answer')
    const activeRequest = provider.calls.at(-1)
    expect(activeRequest?.messages.some((message) => message.content === 'old answer')).toBe(false)
    expect(
      activeRequest?.messages.some(
        (message) => typeof message.content === 'string' && message.content.includes('memento'),
      ),
    ).toBe(true)
  })
})

describe('compaction-retained context', () => {
  it('invoke(): restores the latest metadata and session memory snapshot before recording compaction', async () => {
    // Regression: trimming could discard the startup MEMORY.md snapshot and
    // metadata, so later model calls and replay lost foundational context.
    // Fixed by: latest keyed context is deduplicated, ordered, and restored into keptMessages.
    const rolloutEvents: RolloutEvent[] = []
    const { agent, provider, memory } = buildTestAgent({
      handler: () => endTurnResponse('done'),
      trimPolicy: { mode: 'turns', keep: 1 },
      triggerTokens: 10,
      tokenCounter: (messages) => (messages.length >= 4 ? 100 : 1),
      summarizer: { summarize: async () => 'memento' },
      sessionStore: recordingStore(rolloutEvents),
    })
    await memory.append(agent.sessionId, metadataMessage('old'))
    await memory.append(agent.sessionId, memoryMessage())
    await memory.append(agent.sessionId, { role: 'user', content: 'old request' })
    await memory.append(agent.sessionId, { role: 'assistant', content: 'old answer' })
    const currentMetadata = metadataMessage('current')

    await agent.invoke([currentMetadata, { role: 'user', content: 'continue' }])

    expect(provider.calls[0]?.messages.slice(0, 4).map((message) => message.content)).toEqual([
      expect.stringContaining('<summary>\nmemento\n</summary>'),
      currentMetadata.content,
      memoryMessage().content,
      'continue',
    ])
    expect(provider.calls[0]?.messages.some((message) => message.content === metadataMessage('old').content)).toBe(
      false,
    )
    const compaction = rolloutEvents.find(
      (event): event is Extract<RolloutEvent, { type: 'compaction' }> => event.type === 'compaction',
    )
    expect(compaction?.keptMessages?.slice(0, 3).map((message) => message.content)).toEqual([
      expect.stringContaining('<summary>\nmemento\n</summary>'),
      currentMetadata.content,
      memoryMessage().content,
    ])
  })

  it('stream(): restores compaction context without duplicating retained keys', async () => {
    // Regression: invoke and stream have separate compaction loops, so context
    // restoration could work in one mode while disappearing or duplicating in the other.
    // Fixed by: both loops rely on the same memory trim retention contract.
    const { agent, provider, memory } = buildTestAgent({
      handler: () => endTurnResponse('done'),
      trimPolicy: { mode: 'turns', keep: 1 },
      triggerTokens: 10,
      tokenCounter: (messages) => (messages.length >= 4 ? 100 : 1),
      summarizer: { summarize: async () => 'memento' },
    })
    await memory.append(agent.sessionId, metadataMessage('old'))
    await memory.append(agent.sessionId, memoryMessage())
    await memory.append(agent.sessionId, { role: 'user', content: 'old request' })
    await memory.append(agent.sessionId, { role: 'assistant', content: 'old answer' })
    const currentMetadata = metadataMessage('current')

    for await (const _event of agent.stream([currentMetadata, { role: 'user', content: 'continue' }])) {
      // Drain the stream.
    }

    const request = provider.calls[0]?.messages ?? []
    expect(request.filter((message) => message.compactionKey === 'metadata')).toEqual([currentMetadata])
    expect(request.filter((message) => message.compactionKey === 'memory-md')).toEqual([memoryMessage()])
    expect(request.indexOf(request.find((message) => message.compactionKey === 'metadata')!)).toBeLessThan(
      request.indexOf(request.find((message) => message.compactionKey === 'memory-md')!),
    )
  })

  it('excludes automatic hidden context from the compaction summary and restores it after the summary', async () => {
    // Regression: metadata and startup Skill/memory messages were serialized
    // into the text sent to the summarizer, then could be lost or duplicated.
    // Fixed by: trimming excludes keyed context and re-inserts the latest keyed
    // snapshots after the new summary message.
    const { agent, provider, memory } = buildTestAgent({
      handler: () => endTurnResponse('done'),
      trimPolicy: { mode: 'turns', keep: 1 },
      triggerTokens: 10,
      tokenCounter: (messages) => (messages.length >= 4 ? 100 : 1),
      summarizer: {
        summarize: async (text) => {
          expect(text).not.toContain('<metadata>')
          expect(text).not.toContain('<memory-md>')
          expect(text).not.toContain('<skills_instructions>')
          return 'memento'
        },
      },
    })
    const metadata = metadataMessage('current')
    const memorySnapshot = memoryMessage()
    const skillSnapshot = {
      role: 'user' as const,
      content: '<skills_instructions>catalog</skills_instructions>',
      visible: false,
      compactionKey: 'skill-catalog',
      compactionOrder: 2,
    }
    await memory.append(agent.sessionId, metadata)
    await memory.append(agent.sessionId, memorySnapshot)
    await memory.append(agent.sessionId, skillSnapshot)
    await memory.append(agent.sessionId, { role: 'user', content: 'old request' })
    await memory.append(agent.sessionId, { role: 'assistant', content: 'old answer' })

    await agent.invoke([metadata, { role: 'user', content: 'continue' }])

    expect(provider.calls[0]?.messages.slice(0, 5).map((message) => message.content)).toEqual([
      expect.stringContaining('<summary>\nmemento\n</summary>'),
      metadata.content,
      memorySnapshot.content,
      skillSnapshot.content,
      'continue',
    ])
  })
})
