import type { Message, ToolHandlerResult, TrimPolicy, Trimmer, TrimSummary } from '../../src/core/interfaces.ts'

/**
 * MINIMAL reference {@link Trimmer} satisfying the documented contract.
 * Production impl (src/memory/trimmer.ts) must match these behaviors.
 *
 * turns:  keep the last N user/assistant turn-pairs (approx: keep last N
 *         messages), never drop the most recent message.
 * tokens: keep messages from the tail until adding the next would exceed
 *         `keep` tokens; always keep the most recent message.
 *
 * archivedText format (stable, tested): each removed message →
 *   "<role>: <content-as-string>" joined by "\n".
 */
function toText(m: Message): string {
  if (typeof m.content === 'string') {
    return m.content
  }
  return JSON.stringify(m.content)
}

export class MiniTrimmer implements Trimmer {
  constructor(
    private readonly countTokens = (m: Message[]) => m.reduce((n, x) => n + Math.ceil(toText(x).length / 4), 0),
  ) {}

  trim(
    messages: Message[],
    policy: TrimPolicy,
  ): {
    kept: Message[]
    summary: TrimSummary
  } {
    if (messages.length === 0) {
      return {
        kept: [],
        summary: { removedCount: 0, removedTokens: 0, archivedText: '' },
      }
    }
    let cut: number
    if (policy.mode === 'turns') {
      cut = Math.max(0, messages.length - policy.keep)
    } else {
      // tokens: greedily keep the tail under budget, always keep latest
      let tokens = 0
      let keptFrom = messages.length
      for (let i = messages.length - 1; i >= 0; i--) {
        const t = this.countTokens([messages[i]!])
        if (i < messages.length - 1 && tokens + t > policy.keep) {
          break
        }
        tokens += t
        keptFrom = i
      }
      cut = keptFrom
    }
    // never drop the most recent message
    if (cut >= messages.length) {
      cut = messages.length - 1
    }
    const removed = messages.slice(0, cut)
    const kept = messages.slice(cut)
    const archivedText = removed.map((m) => `${m.role}: ${toText(m)}`).join('\n')
    const summary: TrimSummary = {
      removedCount: removed.length,
      removedTokens: this.countTokens(removed),
      archivedText,
    }
    return { kept, summary }
  }
}

export type { ToolHandlerResult }
