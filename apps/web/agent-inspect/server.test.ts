import { describe, expect, it } from 'vitest'
import {
  CURRENT_CHAT_COMPRESSION_THRESHOLD_TOKENS,
  CURRENT_CHAT_COMPRESSION_TRIGGER_RATIO,
  CURRENT_CHAT_CONTEXT_WINDOW_TOKENS,
  describeEvent,
} from './server'
import { buildImportedSessionDetail } from './rolloutFile'

describe('agent inspect event summaries', () => {
  it('summarizes turn_error with name and message', () => {
    expect(describeEvent({
      type: 'turn_error',
      name: 'TypeError',
      message: 'Cannot convert undefined or null to object',
    })).toBe('TypeError: Cannot convert undefined or null to object')
  })

  it('mirrors the current chat compaction fallback defaults', () => {
    expect(CURRENT_CHAT_CONTEXT_WINDOW_TOKENS).toBe(1_000_000)
    expect(CURRENT_CHAT_COMPRESSION_TRIGGER_RATIO).toBe(0.5)
    expect(CURRENT_CHAT_COMPRESSION_THRESHOLD_TOKENS).toBe(500_000)
  })

  it('builds a viewable session detail from dropped rollout text', () => {
    const detail = buildImportedSessionDetail({
      fileName: 'rollout.jsonl',
      size: 128,
      updatedAt: 1_720_000_000_000,
      text: [
        JSON.stringify({ type: 'session_start', sessionId: 'conv-1', ts: 1 }),
        '',
        JSON.stringify({ type: 'user_input', message: { content: '帮我看问题' }, ts: 2 }),
        '{bad json',
      ].join('\n'),
    })

    expect(detail.key).toBe('imported:rollout.jsonl:128:1720000000000')
    expect(detail.rootLabel).toBe('导入文件')
    expect(detail.sessionId).toBe('conv-1')
    expect(detail.eventCount).toBe(2)
    expect(detail.counts).toEqual({ session_start: 1, user_input: 1 })
    expect(detail.events.map(item => item.lineNo)).toEqual([1, 3])
    expect(detail.parseError).toBeTruthy()
  })
})
