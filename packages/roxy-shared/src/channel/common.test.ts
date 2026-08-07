import { describe, expect, it } from 'vitest'
import { AgentChannelMessageIdSchema } from './common'

describe('channel common schemas', () => {
  it('validates non-empty channel message IDs', () => {
    expect(AgentChannelMessageIdSchema.safeParse('message-1').success).toBe(true)
    expect(AgentChannelMessageIdSchema.safeParse('').success).toBe(false)
    expect(AgentChannelMessageIdSchema.safeParse(1).success).toBe(false)
  })
})

