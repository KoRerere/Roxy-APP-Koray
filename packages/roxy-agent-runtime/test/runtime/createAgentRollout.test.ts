import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AgentRuntime, FakeProvider } from '../../src/index.ts'
import { JsonlSessionStore } from '../../src/memory/session_store.ts'
import { assistantMessageToItems } from '../../src/transcript/items.ts'
import { createTestAgentDefinition, endTurnResponse } from '../helpers/buildTestAgent.ts'
import type {
  ChatRequest,
  ChatStreamChunk,
  ISessionStore,
  RolloutEvent,
  SessionId,
  SessionMeta,
} from '../../src/core/interfaces.ts'

class AbortAwareProvider extends FakeProvider {
  readonly contextWindowTokens = 262144

  async *stream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatStreamChunk> {
    this.calls.push(req)
    yield { type: 'text_delta', text: 'halfway there ' }
    await Promise.resolve()
    signal?.throwIfAborted?.()
    yield { type: 'text_delta', text: 'but never finished' }
  }
}

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'roxy-agent-runtime-rollout-'))
}

describe('AgentRuntime rollout wiring', () => {
  it('a new session writes session_start through the injected store', async () => {
    const dir = tmpDir()
    const store = new JsonlSessionStore({ dir })
    const agent = await AgentRuntime.create(createTestAgentDefinition({ sessionId: 'brand-new', sessionStore: store }))
    await agent.dispose()

    const path = join(dir, 'brand-new.rollout.jsonl')
    expect(existsSync(path)).toBe(true)
    const firstLine = readFileSync(path, 'utf-8').split('\n').filter(Boolean)[0]!
    expect(JSON.parse(firstLine)).toMatchObject({ type: 'session_start', sessionId: 'brand-new' })
  })

  it('a resumed session replays without appending another session_start', async () => {
    const dir = tmpDir()
    const store = new JsonlSessionStore({ dir })
    await store.append('resume-me', { type: 'session_start', sessionId: 'resume-me', createdAt: 1 })
    await store.append('resume-me', { type: 'user_input', message: { role: 'user', content: 'prior' } })
    await store.append('resume-me', {
      type: 'assistant_turn',
      items: assistantMessageToItems({ role: 'assistant', content: 'prior reply' }),
      stopReason: 'end_turn',
    })

    const agent = await AgentRuntime.create(createTestAgentDefinition({ sessionId: 'resume-me', sessionStore: store }))
    await agent.dispose()

    const events = readFileSync(join(dir, 'resume-me.rollout.jsonl'), 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string })
    expect(events.filter((event) => event.type === 'session_start')).toHaveLength(1)
    expect(events).toHaveLength(3)
  })

  it('preserves replayed metadata and appends the current snapshot before the next user message', async () => {
    const dir = tmpDir()
    const store = new JsonlSessionStore({ dir })
    const sessionId = 'metadata-change'
    const previousMetadata =
      '<metadata>\n  <os>macOS 26.5</os>\n  <arch>arm64</arch>\n  <system-lang>zh-CN</system-lang>\n  <timezone>Asia/Shanghai</timezone>\n</metadata>'
    const currentMetadata =
      '<metadata>\n  <os>macOS 26.6</os>\n  <arch>arm64</arch>\n  <system-lang>zh-CN</system-lang>\n  <timezone>Asia/Shanghai</timezone>\n</metadata>'
    await store.append(sessionId, { type: 'session_start', sessionId, createdAt: 1 })
    await store.append(sessionId, {
      type: 'user_input',
      message: { role: 'user', content: previousMetadata, visible: false },
    })
    await store.append(sessionId, { type: 'user_input', message: { role: 'user', content: 'first request' } })
    await store.append(sessionId, {
      type: 'assistant_turn',
      items: assistantMessageToItems({ role: 'assistant', content: 'first reply' }),
      stopReason: 'end_turn',
    })
    await store.append(sessionId, { type: 'turn_completed', stopReason: 'end_turn' })

    const definition = createTestAgentDefinition({
      sessionId,
      sessionStore: store,
      responses: [endTurnResponse('second reply')],
    })
    const provider = definition.provider as FakeProvider
    const agent = await AgentRuntime.create(definition)
    await agent.invoke([
      { role: 'user', content: currentMetadata, visible: false },
      { role: 'user', content: 'second request' },
    ])

    expect(provider.calls[0]?.messages).toEqual([
      { role: 'user', content: previousMetadata, visible: false },
      { role: 'user', content: 'first request' },
      expect.objectContaining({ role: 'assistant' }),
      { role: 'user', content: currentMetadata, visible: false },
      { role: 'user', content: 'second request' },
    ])
    const userInputs = (await store.read(sessionId)).filter(
      (event): event is Extract<RolloutEvent, { type: 'user_input' }> => event.type === 'user_input',
    )
    expect(userInputs.map((event) => event.message)).toEqual([
      { role: 'user', content: previousMetadata, visible: false },
      { role: 'user', content: 'first request' },
      { role: 'user', content: currentMetadata, visible: false },
      { role: 'user', content: 'second request' },
    ])
    await agent.dispose()
  })

  it('skips unchanged keyed context and persists a replacement when its content changes', async () => {
    // Regression: every turn persisted a complete metadata snapshot even when
    // it was identical to the prior turn, inflating the durable transcript.
    // Fixed by: keyed context compares against the latest session snapshot and
    // is appended only for the first turn or a changed value.
    const definition = createTestAgentDefinition({
      sessionId: 'metadata-snapshot-diff',
      responses: [endTurnResponse('first reply'), endTurnResponse('second reply'), endTurnResponse('third reply')],
    })
    const provider = definition.provider as FakeProvider
    const agent = await AgentRuntime.create(definition)
    const firstMetadata = {
      role: 'user' as const,
      content: '<metadata><timezone>UTC</timezone></metadata>',
      visible: false,
      compactionKey: 'metadata',
      compactionOrder: 0,
    }
    const changedMetadata = {
      ...firstMetadata,
      content: '<metadata><timezone>Asia/Shanghai</timezone></metadata>',
    }

    await agent.invoke([firstMetadata, { role: 'user', content: 'first request' }])
    await agent.invoke([firstMetadata, { role: 'user', content: 'second request' }])
    await agent.invoke([changedMetadata, { role: 'user', content: 'third request' }])

    const metadataMessages = (await definition.memory.getAll('metadata-snapshot-diff')).filter(
      (message) => message.compactionKey === 'metadata',
    )
    expect(metadataMessages).toEqual([firstMetadata, changedMetadata])
    expect(provider.calls[1]?.messages.filter((message) => message.compactionKey === 'metadata')).toEqual([
      firstMetadata,
    ])
    expect(provider.calls[2]?.messages.filter((message) => message.compactionKey === 'metadata')).toEqual([
      firstMetadata,
      changedMetadata,
    ])
    await agent.dispose()
  })

  it('writes a terminal event after each completed or aborted turn', async () => {
    // Regression: rollout stopped at the last assistant fragment when a turn
    // ended or was interrupted, so history replay had to guess whether the UI
    // should still show an active run.
    // Fixed by: recording one terminal rollout fact before the caller observes
    // the completed or aborted stream boundary.
    const dir = tmpDir()
    const store = new JsonlSessionStore({ dir })
    const agent = await AgentRuntime.create(
      createTestAgentDefinition({
        sessionId: 'terminal-turns',
        sessionStore: store,
        responses: [endTurnResponse('finished')],
      }),
    )

    await agent.invoke('finish this turn')

    const abort = new AbortController()
    abort.abort('User cancelled')
    for await (const _event of agent.stream('interrupt this turn', abort.signal)) {
      // A cancelled turn emits no done event.
    }
    await agent.dispose()

    const events = readFileSync(join(dir, 'terminal-turns.rollout.jsonl'), 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string })

    expect(events.map((event) => event.type)).toEqual([
      'session_start',
      'user_input',
      'assistant_turn',
      'turn_completed',
      'user_input',
      'turn_aborted',
    ])
  })

  it('persists streamed assistant text before an aborted turn is terminal', async () => {
    // Regression: aborting a stream only wrote turn_aborted, so the partial
    // assistant reply vanished on refresh even though the user had already
    // seen it.
    // Fixed by: replaying the accumulated assistant text into rollout before
    // the terminal abort marker is appended.
    const dir = tmpDir()
    const store = new JsonlSessionStore({ dir })
    const provider = new AbortAwareProvider()
    const definition = {
      ...createTestAgentDefinition({
        sessionId: 'abort-persists-partial',
        sessionStore: store,
      }),
      provider,
    }
    const agent = await AgentRuntime.create(definition)

    const abort = new AbortController()
    const iterator = agent.stream('please keep going', abort.signal)[Symbol.asyncIterator]()
    const first = await iterator.next()
    if (!first.done && first.value.type === 'text') {
      expect(first.value).toEqual({ type: 'text', delta: 'halfway there ', callIndex: 0 })
    }
    abort.abort('User cancelled')
    await expect(iterator.next()).rejects.toThrow()
    await agent.dispose()

    const events = readFileSync(join(dir, 'abort-persists-partial.rollout.jsonl'), 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string; items?: unknown[] })

    expect(events.map((event) => event.type)).toEqual(['session_start', 'user_input', 'assistant_turn', 'turn_aborted'])
    expect(events[2]?.items).toEqual([
      { type: 'message', id: 'msg_0', role: 'assistant', content: [{ type: 'output_text', text: 'halfway there ' }] },
    ])
  })

  it('omitting sessionStore keeps the Agent ephemeral', async () => {
    const agent = await AgentRuntime.create(createTestAgentDefinition({ sessionId: 'ephemeral' }))
    await agent.dispose()
  })

  it('stops the agent when rollout append fails', async () => {
    // Regression: rollout append failures were only logged, so development runs
    // could continue after losing the durable event stream needed for replay.
    // Fixed by: record() rethrows persistence failures and stops the run.
    class FailingSessionStore implements ISessionStore {
      private appends = 0

      async append(_sessionId: SessionId, _event: RolloutEvent): Promise<void> {
        this.appends++
        if (this.appends === 1) {
          return
        }
        throw new Error('disk is read-only')
      }

      async read(_sessionId: SessionId): Promise<RolloutEvent[]> {
        return []
      }

      async list(): Promise<SessionMeta[]> {
        return []
      }

      async meta(_sessionId: SessionId): Promise<SessionMeta | null> {
        return null
      }
    }

    const agent = await AgentRuntime.create(
      createTestAgentDefinition({
        sessionId: 'rollout-fails',
        sessionStore: new FailingSessionStore(),
      }),
    )

    await expect(agent.invoke('hello')).rejects.toThrow('rollout append failed: disk is read-only')
    await agent.dispose()
  })

  it('records diagnostic error facts before a failed terminal event', async () => {
    const dir = tmpDir()
    const store = new JsonlSessionStore({ dir })
    const agent = await AgentRuntime.create(
      createTestAgentDefinition({
        sessionId: 'error-facts',
        sessionStore: store,
        responses: [],
      }),
    )

    await expect(agent.invoke('hello')).rejects.toThrow('FakeProvider: no scripted response')
    const events = await store.read('error-facts')
    const turnError = events.find((event) => event.type === 'turn_error')
    expect(events.map((event) => event.type)).toEqual(['session_start', 'user_input', 'turn_error', 'turn_failed'])
    expect(turnError).toMatchObject({
      type: 'turn_error',
      name: 'Error',
      message: 'FakeProvider: no scripted response for call #1',
      phase: 'turn_failed',
    })
    expect(turnError && 'stack' in turnError && typeof turnError.stack === 'string').toBe(true)
    await agent.dispose()
  })
})
