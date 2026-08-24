import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AgentRuntime } from '../../src/index.ts'
import { FakeProvider } from '../../src/provider/fake.ts'
import { createTestAgentDefinition, endTurnResponse, toolCallResponse } from '../helpers/buildTestAgent.ts'

describe('AgentRuntime.structured', () => {
  it('runs the agent, then extracts a typed value from the session history', async () => {
    // Regression: structured output only existed as a low-level provider
    // primitive, so callers had to bypass the agent lifecycle and memory.
    // Fixed by: runtime.structured(schema).invoke(input) composes both phases.
    const definition = createTestAgentDefinition({
      responses: [
        endTurnResponse('The customer is Ada and has 3 active tasks.'),
        toolCallResponse('extract-1', 'extract', { name: 'Ada', activeTasks: 3 }),
      ],
    })
    const provider = definition.provider as FakeProvider
    const runtime = await AgentRuntime.create(definition)

    const result = await runtime
      .structured(z.object({ name: z.string(), activeTasks: z.number() }))
      .invoke('Inspect the customer')

    expect(result).toEqual({ name: 'Ada', activeTasks: 3 })
    expect(provider.calls).toHaveLength(2)
    expect(provider.calls[1]?.toolChoice).toEqual({ type: 'tool', name: 'extract' })
    expect(provider.calls[1]?.messages).toMatchObject([
      { role: 'user', content: 'Inspect the customer' },
      { role: 'assistant' },
    ])
    await runtime.dispose()
  })
})
