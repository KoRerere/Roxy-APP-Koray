import { describe, expect, it } from 'vitest'
import { FakeProvider } from '../../src/provider/fake.ts'
import {
  endTurnResponse,
  thinkingBlock,
  thinkingResponse,
  toolCallResponse,
  userMsg,
} from '../helpers/makeFakeProvider.ts'

describe('FakeProvider (deterministic test seam)', () => {
  it('pops scripted responses in FIFO order and records calls', async () => {
    const provider = new FakeProvider({
      responses: [toolCallResponse('t1', 'ls', { path: '.' }), endTurnResponse('done')],
    })

    const req = { model: 'fake', messages: [userMsg('hi')], maxTokens: 1 }
    const first = await provider.invoke(req)
    expect(first.stopReason).toBe('tool_use')

    const second = await provider.invoke(req)
    expect(second.stopReason).toBe('end_turn')

    expect(provider.calls).toHaveLength(2)
  })

  it('rejects when a scripted response is missing', async () => {
    const provider = new FakeProvider()
    await expect(provider.invoke({ model: 'fake', messages: [userMsg('hi')], maxTokens: 1 })).rejects.toThrow(
      /no scripted response/,
    )
  })

  it('supports a handler computed from the request', async () => {
    const provider = new FakeProvider({
      handler: (req, i) => endTurnResponse(`call#${i}: ${typeof req.messages}`),
    })
    const res = await provider.invoke({
      model: 'fake',
      messages: [userMsg('hi')],
      maxTokens: 1,
    })
    expect(res.stopReason).toBe('end_turn')
  })

  it('exposes provider conversion hooks as identity mapping', () => {
    const provider = new FakeProvider()
    const req = { model: 'fake', messages: [userMsg('hi')], maxTokens: 1 }
    const res = endTurnResponse('done')

    expect(provider.toProviderRequest(req)).toBe(req)
    expect(provider.fromProviderResponse(res)).toBe(res)
  })

  it('countTokens approximates ~4 chars/token', async () => {
    const provider = new FakeProvider()
    const tokens = await provider.countTokens([
      { role: 'user', content: '12345678' }, // 8 chars -> 2 tokens
    ])
    expect(tokens).toBe(2)
  })

  it('derives stream chunks from a scripted response', async () => {
    const provider = new FakeProvider({
      responses: [endTurnResponse('hello')],
    })
    const chunks = []
    for await (const c of provider.stream({
      model: 'fake',
      messages: [userMsg('hi')],
      maxTokens: 1,
    })) {
      chunks.push(c)
    }
    expect(chunks.at(0)).toMatchObject({ type: 'text_delta', text: 'hello' })
    expect(chunks.at(-1)).toMatchObject({ type: 'message_stop' })
  })

  it('emits thinking_delta + signed thinking_block for thinking content', async () => {
    const provider = new FakeProvider({
      responses: [thinkingResponse('let me think', 'sig_1', 'answer')],
    })
    const chunks: Array<{ type: string; text?: string; block?: unknown }> = []
    for await (const c of provider.stream({
      model: 'fake',
      messages: [userMsg('hi')],
      maxTokens: 1,
    })) {
      chunks.push(c)
    }

    const thinkingDelta = chunks.find((c) => c.type === 'thinking_delta')
    expect(thinkingDelta?.text).toBe('let me think')

    const block = chunks.find((c) => c.type === 'thinking_block')
    expect(block?.block).toEqual(thinkingBlock('let me think', 'sig_1'))

    // thinking_block precedes text_delta in emission order.
    expect(chunks.indexOf(block!)).toBeLessThan(chunks.findIndex((c) => c.type === 'text_delta'))
    expect(chunks.at(-1)).toMatchObject({ type: 'message_stop' })
  })
})
