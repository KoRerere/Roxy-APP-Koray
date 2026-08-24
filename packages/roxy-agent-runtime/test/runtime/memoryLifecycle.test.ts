import { describe, expect, it } from 'vitest'
import type { MemoryCompactionContext, MemoryTurnEndContext, RoxyPlugin } from '../../src/core/interfaces.ts'
import { AgentRuntime } from '../../src/index.ts'
import { createTestAgentDefinition, endTurnResponse } from '../helpers/buildTestAgent.ts'

describe('memory lifecycle plugins', () => {
  it('calls onTurnEnd with the produced messages for the turn', async () => {
    // Regression: long-term memory plugins only had fire-and-forget metric
    // hooks, which did not expose the messages needed to ingest a completed
    // turn. Fixed by: a first-class awaited memory lifecycle.
    const turns: MemoryTurnEndContext[] = []
    const plugin: RoxyPlugin = {
      name: 'memory',
      setup(api) {
        api.addMemoryLifecycle({
          async onTurnEnd(ctx) {
            turns.push(ctx)
          },
        })
      },
    }
    const agent = await AgentRuntime.create(
      createTestAgentDefinition({
        plugins: [plugin],
        sessionId: 'memory-turn',
        handler: () => endTurnResponse('remember this'),
      }),
    )

    const response = await agent.invoke('hello')

    expect(turns).toHaveLength(1)
    expect(turns[0]!.sessionId).toBe('memory-turn')
    expect(turns[0]!.input).toBe('hello')
    expect(turns[0]!.producedMessages).toEqual(response.messages)
    expect(turns[0]!.producedMessages[0]!.role).toBe('assistant')
    expect(turns[0]!.stopReason).toBe('end_turn')
  })

  it('calls onCompaction with archived messages and summary when trim summarizes history', async () => {
    // Regression: compaction only wrote a rollout event, so external memory
    // systems had no rich lifecycle event for ingesting context leaving the
    // short-term window. Fixed by: onCompaction receives archived messages.
    const compactions: MemoryCompactionContext[] = []
    const plugin: RoxyPlugin = {
      name: 'memory',
      setup(api) {
        api.addMemoryLifecycle({
          async onCompaction(ctx) {
            compactions.push(ctx)
          },
        })
      },
    }
    const agent = await AgentRuntime.create(
      createTestAgentDefinition({
        plugins: [plugin],
        sessionId: 'memory-compact',
        trimPolicy: { mode: 'turns', keep: 1 },
        triggerTokens: 1,
        summarizer: { summarize: async () => 'summary text' },
        handler: () => endTurnResponse('after trim'),
      }),
    )

    await agent.invoke('first')
    await agent.invoke('second')

    expect(compactions).toHaveLength(1)
    expect(compactions[0]!.sessionId).toBe('memory-compact')
    expect(compactions[0]!.archivedMessages.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(compactions[0]!.summary).toBe('summary text')
    expect(compactions[0]!.removedCount).toBe(2)
  })
})
