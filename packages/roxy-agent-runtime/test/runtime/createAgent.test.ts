import { describe, expect, it, vi } from 'vitest'
import { AgentRuntime } from '../../src/index.ts'
import { createTestAgentDefinition, endTurnResponse } from '../helpers/buildTestAgent.ts'

describe('AgentRuntime.create', () => {
  it('returns an Agent instance from a complete definition', async () => {
    const agent = await AgentRuntime.create(createTestAgentDefinition())
    expect(agent).toBeDefined()
    expect(typeof agent.id).toBe('string')
    expect(typeof agent.sessionId).toBe('string')
    await agent.dispose()
  })

  it('preserves a host-provided sessionId', async () => {
    const agent = await AgentRuntime.create(createTestAgentDefinition({ sessionId: 'my-session-123' }))
    expect(agent.sessionId).toBe('my-session-123')
    await agent.dispose()
  })

  it('generates a sessionId when the host omits one', async () => {
    const agent = await AgentRuntime.create(createTestAgentDefinition())
    expect(agent.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    await agent.dispose()
  })

  it('uses the provider context window when deriving the default compaction trigger', async () => {
    // Regression: AgentRuntime.create omitted the provider context window, so
    // compaction fell back to the fixed 150000 token trigger.
    // Fixed by: passing provider.contextWindowTokens into the graph unless the host overrides it.
    const definition = createTestAgentDefinition({
      responses: [endTurnResponse('ok')],
      trimPolicy: { mode: 'turns', keep: 1 },
      tokenCounter: () => 180000,
    })
    const trimSpy = vi.spyOn(definition.memory, 'trim')
    const agent = await AgentRuntime.create(definition)
    await definition.memory.append(agent.sessionId, { role: 'user', content: 'old context' })
    await definition.memory.append(agent.sessionId, { role: 'assistant', content: 'old answer' })

    await agent.invoke('go')
    expect(trimSpy).not.toHaveBeenCalled()
    await agent.dispose()
  })
})
