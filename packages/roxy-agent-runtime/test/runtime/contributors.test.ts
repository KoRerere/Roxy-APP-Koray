import { describe, expect, it } from 'vitest'
import type { IContextContributor, Message, SystemBlock } from '../../src/core/interfaces.ts'
import { buildTestAgent, endTurnResponse } from '../helpers/buildTestAgent.ts'

describe('context contributors (internal developer messages)', () => {
  it('contributor messages appear as developer input before the real user request', async () => {
    const capturedSystems: SystemBlock[][] = []
    const capturedMessages: Message[][] = []
    const contributor: IContextContributor = {
      async contribute() {
        return [{ name: 'retrieved_memory', content: 'from contributor' }]
      },
    }
    const { agent } = buildTestAgent({
      contributors: [contributor],
      handler: (req) => {
        capturedSystems.push(req.system ?? [])
        capturedMessages.push(req.messages)
        return endTurnResponse('ok')
      },
    })
    await agent.invoke('hello')
    expect(capturedSystems[0]?.some((block) => block.text.includes('from contributor'))).toBe(false)
    expect(capturedMessages[0]).toEqual([
      {
        role: 'developer',
        content:
          '<context_contribution>\n<name>retrieved_memory</name>\n<content>from contributor</content>\n</context_contribution>',
        visible: false,
      },
      { role: 'user', content: 'hello' },
    ])
  })

  it('multiple contributors are inserted in registration order', async () => {
    const capturedMessages: Message[][] = []
    const c1: IContextContributor = {
      async contribute() {
        return [{ name: 'first', content: 'contrib-1' }]
      },
    }
    const c2: IContextContributor = {
      async contribute() {
        return [{ name: 'second', content: 'contrib-2' }]
      },
    }
    const { agent } = buildTestAgent({
      contributors: [c1, c2],
      handler: (req) => {
        capturedMessages.push(req.messages)
        return endTurnResponse('ok')
      },
    })
    await agent.invoke('hello')
    expect(capturedMessages[0]?.map((message) => String(message.content))).toEqual([
      expect.stringContaining('<name>first</name>'),
      expect.stringContaining('<name>second</name>'),
      'hello',
    ])
    expect(capturedMessages[0]?.slice(0, 2).every((message) => message.role === 'developer')).toBe(true)
  })

  it('contribute() throw is swallowed — model call continues normally', async () => {
    let callCount = 0
    const throwingContributor: IContextContributor = {
      async contribute() {
        throw new Error('contributor failed')
      },
    }
    const { agent } = buildTestAgent({
      contributors: [throwingContributor],
      handler: (_req) => {
        callCount++
        return endTurnResponse('ok')
      },
    })
    const result = await agent.invoke('hello')
    expect(callCount).toBeGreaterThan(0)
    expect(result.messages.length).toBeGreaterThan(0)
  })

  it('contributor receives recentMessages window from session history', async () => {
    let receivedMessages: unknown = null
    const capturingContributor: IContextContributor = {
      async contribute(ctx) {
        receivedMessages = ctx.recentMessages
        return []
      },
    }
    const { agent } = buildTestAgent({
      contributors: [capturingContributor],
      responses: [endTurnResponse('ok')],
    })
    await agent.invoke('test message')
    expect(receivedMessages).toEqual([{ role: 'user', content: 'test message' }])
  })
})
