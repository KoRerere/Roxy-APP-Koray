import { FakeProvider, chatResponse } from '../../src/provider/fake.ts'
import type { ChatResponse, Message, ThinkingBlock, ToolUseBlock } from '../../src/core/interfaces.ts'

export { FakeProvider, chatResponse }

/** Build a user text message. */
export function userMsg(text: string): Message {
  return { role: 'user', content: text }
}

/** Build an assistant text message. */
export function assistantMsg(text: string): Message {
  return { role: 'assistant', content: text }
}

/** Build a tool_use block. */
export function toolUse(id: string, name: string, input: unknown): ToolUseBlock {
  return { type: 'tool_use', id, name, input }
}

/** Build a thinking block with a signature (for multi-turn round-trip tests). */
export function thinkingBlock(thinking: string, signature: string): ThinkingBlock {
  return { type: 'thinking', thinking, signature }
}

/** Convenience: a ChatResponse that calls a tool. */
export function toolCallResponse(id: string, name: string, input: unknown): ChatResponse {
  return chatResponse(
    {
      role: 'assistant',
      content: [{ type: 'tool_use', id, name, input }],
    },
    'tool_use',
  )
}

/** Convenience: a ChatResponse that ends with text. */
export function endTurnResponse(text: string): ChatResponse {
  return chatResponse({ role: 'assistant', content: text }, 'end_turn')
}

/**
 * Convenience: a ChatResponse whose assistant content is a thinking block
 * (with signature) followed by text. Models how Anthropic returns extended
 * thinking on a turn that also produces a textual answer.
 */
export function thinkingResponse(thinking: string, signature: string, text: string): ChatResponse {
  return chatResponse(
    {
      role: 'assistant',
      content: [
        { type: 'thinking', thinking, signature },
        { type: 'text', text },
      ],
    },
    'end_turn',
  )
}
