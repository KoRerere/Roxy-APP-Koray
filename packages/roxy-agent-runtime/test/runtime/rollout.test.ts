import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildTestAgent, endTurnResponse, chatResponse } from '../helpers/buildTestAgent.ts'
import { JsonlSessionStore } from '../../src/memory/session_store.ts'
import { InMemoryProvider } from '../../src/memory/memory.ts'
import { replayIntoMemory } from '../../src/memory/replay.ts'
import type { AgentStreamEvent, RolloutEvent } from '../../src/core/interfaces.ts'
import { testToolInputSchema } from '../helpers/toolSchema.ts'

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'roxy-test-rollout-'))
}

/** Collect every stream event from a streamed turn. */
async function streamTurn(agent: { stream(input: string): AsyncIterable<AgentStreamEvent> }, input: string) {
  const events: AgentStreamEvent[] = []
  for await (const e of agent.stream(input)) {
    events.push(e)
  }
  return events
}

describe('agent loop rollout double-write', () => {
  it('replays trailing hidden attachment context after the visible request', async () => {
    const dir = tmpDir()
    const store = new JsonlSessionStore({ dir })
    const { agent } = buildTestAgent({
      sessionId: 'trailing-context-sid',
      sessionStore: store,
      responses: [endTurnResponse('done')],
    })

    await agent.invoke({
      input: [{ role: 'user', content: 'inspect the page' }],
      trailingMessages: [{ role: 'user', content: '[attachment] notes.txt', visible: false }],
    })

    const replayedMemory = new InMemoryProvider()
    await replayIntoMemory(store, replayedMemory, 'trailing-context-sid')
    expect(await replayedMemory.getAll('trailing-context-sid')).toEqual([
      { role: 'user', content: 'inspect the page' },
      { role: 'user', content: '[attachment] notes.txt', visible: false },
      expect.objectContaining({ role: 'assistant' }),
    ])
  })

  it('writes internal and visible turn-start user messages to the rollout and replays both', async () => {
    // Regression: hidden metadata reached the model but was omitted from
    // the append-only rollout, so a resumed session did not have the complete
    // message history used by the original request.
    // Fixed by: persist every turn-start user message with its presentation marker.
    const dir = tmpDir()
    const store = new JsonlSessionStore({ dir })
    const { agent } = buildTestAgent({
      sessionId: 'internal-context-sid',
      sessionStore: store,
      responses: [endTurnResponse('done')],
    })

    await agent.invoke([
      {
        role: 'user',
        content: '<metadata><cwd>/tmp/work</cwd></metadata>',
        visible: false,
        compactionKey: 'metadata',
        compactionOrder: 0,
      },
      { role: 'user', content: 'visible request' },
    ])

    const userInputs = (await store.read('internal-context-sid')).filter(
      (event): event is Extract<RolloutEvent, { type: 'user_input' }> => event.type === 'user_input',
    )
    expect(userInputs.map((event) => event.message)).toEqual([
      {
        role: 'user',
        content: '<metadata><cwd>/tmp/work</cwd></metadata>',
        visible: false,
        compactionKey: 'metadata',
        compactionOrder: 0,
      },
      { role: 'user', content: 'visible request' },
    ])

    const replayedMemory = new InMemoryProvider()
    await replayIntoMemory(store, replayedMemory, 'internal-context-sid')
    expect(await replayedMemory.getAll('internal-context-sid')).toEqual([
      {
        role: 'user',
        content: '<metadata><cwd>/tmp/work</cwd></metadata>',
        visible: false,
        compactionKey: 'metadata',
        compactionOrder: 0,
      },
      { role: 'user', content: 'visible request' },
      expect.objectContaining({ role: 'assistant' }),
    ])
  })

  it('appends user_input + assistant_turn items (+tool_result) events during a tool turn', async () => {
    // Regression: assistant turns were persisted as runtime Message.content plus
    // provider-owned state, duplicating the same model output in two shapes.
    // Fixed by: persisting provider-translated Roxy assistant items as the
    // durable assistant_turn payload and deriving Message content on replay.
    const dir = tmpDir()
    const store = new JsonlSessionStore({ dir })
    let n = 0
    const { agent, registry } = buildTestAgent({
      sessionId: 'rollout-sid',
      sessionStore: store,
      handler: () => {
        n++
        if (n === 1) {
          return chatResponse(
            {
              role: 'assistant',
              content: [
                { type: 'thinking', thinking: 'p', signature: 's' },
                { type: 'tool_use', id: 'tu1', name: 'echo', input: { x: 1 } },
              ],
            },
            'tool_use',
          )
        }
        return endTurnResponse('done')
      },
    })
    registry.add(
      { name: 'echo', description: 'echo', inputSchema: testToolInputSchema, source: 'builtin' },
      async (input) => ({
        content: (input as { x: number }).x.toString(),
        isError: false,
      }),
    )

    await streamTurn(agent, 'hello')

    const events: RolloutEvent[] = await store.read('rollout-sid')
    const types = events.map((e) => e.type)

    expect(events.every((event) => typeof event.ts === 'number')).toBe(true)
    expect(types).toContain('user_input')
    expect(types).toContain('assistant_turn')
    expect(types).toContain('tool_result')

    const turns = events.filter((e) => e.type === 'assistant_turn')
    expect(turns.length).toBe(2)
    const toolTurn = turns[0] as Extract<RolloutEvent, { type: 'assistant_turn' }>
    expect(toolTurn.stopReason).toBe('tool_use')
    expect(toolTurn).not.toHaveProperty('message')
    expect(toolTurn.items).toEqual([
      { type: 'reasoning', id: 's', text: 'p', visibility: 'full' },
      { type: 'tool_call', id: 'tu1', callId: 'tu1', name: 'echo', arguments: { x: 1 }, toolKind: 'function' },
    ])
    const endTurn = turns[1] as Extract<RolloutEvent, { type: 'assistant_turn' }>
    expect(endTurn.stopReason).toBe('end_turn')

    const toolResultEvt = events.find((e) => e.type === 'tool_result') as Extract<RolloutEvent, { type: 'tool_result' }>
    expect(toolResultEvt.result.tool_use_id).toBe('tu1')
  })
})

// Regression: a resumed session must rebuild in-memory history from its rollout
// so the next turn carries prior context. This is the cross-process resume path.
describe('cross-process session resume', () => {
  it('replaying a saved rollout rebuilds memory with full first-turn exchanges', async () => {
    const dir = tmpDir()
    const store = new JsonlSessionStore({ dir })
    const { agent, registry } = buildTestAgent({
      sessionId: 'resume-sid',
      sessionStore: store,
      handler: () => endTurnResponse('first answer'),
    })
    registry.add(
      { name: 'echo', description: 'echo', inputSchema: testToolInputSchema, source: 'builtin' },
      async () => ({
        content: 'ok',
        isError: false,
      }),
    )

    // First process: one turn.
    await streamTurn(agent, 'first question')

    // Second "process": new memory, same store dir, same sessionId.
    const memory2 = new InMemoryProvider()
    const store2 = new JsonlSessionStore({ dir })
    const replayed = await replayIntoMemory(store2, memory2, 'resume-sid')
    expect(replayed.isNew).toBe(false)
    expect(replayed.eventCount).toBeGreaterThan(0)

    // Rebuilt memory contains the first-turn exchanges (user then assistant),
    // i.e. the durable truth the next process resumes from.
    const rebuilt = await memory2.getAll('resume-sid')
    const toText = (m: { content: string | unknown[] }): string => (typeof m.content === 'string' ? m.content : '')
    expect(rebuilt.map(toText)).toEqual(['first question', ''])
    // assistant turn replays as a block array — verify the text block survives.
    const assistantContent = rebuilt[1]!.content as { type: string; text?: string }[]
    expect(assistantContent[0]).toMatchObject({ type: 'text', text: 'first answer' })
  })

  it('replays Roxy assistant items after JSONL serialization', async () => {
    // Regression: replay depended on provider-owned state stored beside canonical
    // content, so the durable truth was tied to one provider wire shape.
    // Fixed by: persisting Roxy assistant items and deriving memory messages.
    const dir = tmpDir()
    const store = new JsonlSessionStore({ dir })
    const { agent } = buildTestAgent({
      sessionId: 'transcript-items-sid',
      sessionStore: store,
      handler: () =>
        chatResponse(
          {
            role: 'assistant',
            content: [
              { type: 'thinking', thinking: 'plan', signature: 'rs_1' },
              { type: 'text', text: 'answer' },
            ],
          },
          'end_turn',
        ),
    })

    await streamTurn(agent, 'question')

    const memory = new InMemoryProvider()
    await replayIntoMemory(new JsonlSessionStore({ dir }), memory, 'transcript-items-sid')
    const assistant = (await memory.getAll('transcript-items-sid')).find((message) => message.role === 'assistant')
    expect(assistant?.content).toEqual([
      { type: 'thinking', thinking: 'plan', signature: 'rs_1' } as never,
      { type: 'text', text: 'answer' } as never,
    ])
  })
})
