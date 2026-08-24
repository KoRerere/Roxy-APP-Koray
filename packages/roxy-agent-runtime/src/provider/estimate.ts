import type { Message } from '../core/interfaces.ts'

/**
 * Cheap ~4 chars/token estimate. Used where an EXACT count is not worth a
 * network round-trip: per-iteration hook telemetry, and as the fallback when a
 * provider's real count-tokens endpoint is unavailable or fails. Compaction
 * triggering prefers the REAL `usage.input_tokens` reported by the API (see
 * runtime/agent.ts) over this estimate.
 */
export function estimateTokens(messages: Message[]): number {
  const totalChars = messages.reduce((sum, m) => {
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
    return sum + text.length
  }, 0)
  return Math.ceil(totalChars / 4)
}
