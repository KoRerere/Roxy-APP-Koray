import type { Message, TrimPolicy, Trimmer, TrimSummary } from '../core/interfaces.ts'

function toText(m: Message): string {
  if (m.transcriptItems) {
    return JSON.stringify({ content: m.content, transcriptItems: m.transcriptItems })
  }
  if (typeof m.content === 'string') {
    return m.content
  }
  return JSON.stringify(m.content)
}

function defaultCountTokens(messages: Message[]): number {
  return messages.reduce((n, m) => n + Math.ceil(toText(m).length / 4), 0)
}

function isSafeStart(message: Message): boolean {
  if (message.role !== 'user' || !Array.isArray(message.content)) {
    return message.role === 'user'
  }
  return !message.content.some((block) => block.type === 'tool_result')
}

function hasToolResult(message: Message): boolean {
  return Array.isArray(message.content) && message.content.some((block) => block.type === 'tool_result')
}

function isOrdinaryUser(message: Message): boolean {
  return message.role === 'user' && !hasToolResult(message)
}

function serialize(messages: Message[]): string {
  return messages.map((m) => `${m.role}: ${toText(m)}`).join('\n')
}

/**
 * Codex-style retention: send the complete transcript to the summarizer, but
 * rebuild active context from a bounded set of recent user messages and the
 * current tool turn. Old assistant/tool output is intentionally discarded.
 */
function codexTrim(messages: Message[], policy: TrimPolicy, countTokens: (messages: Message[]) => number) {
  const budget = policy.retainedUserTokens ?? policy.keep
  const userIndexes = messages
    .map((message, index) => (isOrdinaryUser(message) ? index : -1))
    .filter((index) => index >= 0)
  let used = 0
  const retainedIndexes = new Set<number>()
  for (let i = userIndexes.length - 1; i >= 0; i--) {
    const index = userIndexes[i]!
    const tokens = countTokens([messages[index]!])
    if (retainedIndexes.size > 0 && used + tokens > budget) {
      break
    }
    used += tokens
    retainedIndexes.add(index)
  }

  const latestUser = userIndexes.at(-1)
  if (latestUser !== undefined) {
    retainedIndexes.add(latestUser)
  }

  // Keep only the active tool turn at the tail. Older assistant/tool output is
  // deliberately omitted even when the user-message budget has spare room.
  const latest = messages.at(-1)
  if (latest && hasToolResult(latest)) {
    const assistantIndex = messages.length - 2
    if (
      assistantIndex >= 0 &&
      messages[assistantIndex]!.role === 'assistant' &&
      isSafeStart(messages[latestUser ?? 0]!)
    ) {
      retainedIndexes.add(assistantIndex)
      retainedIndexes.add(messages.length - 1)
    }
  }

  const firstKept = [...retainedIndexes].toSorted((a, b) => a - b).find((index) => isSafeStart(messages[index]!))
  const safeKept =
    firstKept === undefined
      ? []
      : messages.filter((_message, index) => retainedIndexes.has(index) && index >= firstKept)
  const keptIndexes = new Set(
    messages
      .map((_message, index) =>
        retainedIndexes.has(index) && firstKept !== undefined && index >= firstKept ? index : -1,
      )
      .filter((index) => index >= 0),
  )
  const removed = messages.filter((_message, index) => !keptIndexes.has(index))
  return {
    kept: safeKept,
    summary: {
      removedCount: removed.length,
      removedTokens: countTokens(removed),
      archivedText: serialize(removed),
      summarizeText: serialize(messages),
    },
  }
}

/**
 * Sliding-window trimmer. Keeps the latest N turns (turns mode) or stays
 * under a token budget (tokens mode). Always preserves the most recent message.
 */
export class SlidingWindowTrimmer implements Trimmer {
  private readonly countTokens: (messages: Message[]) => number

  constructor(countTokens?: (messages: Message[]) => number) {
    this.countTokens = countTokens ?? defaultCountTokens
  }

  trim(messages: Message[], policy: TrimPolicy): { kept: Message[]; summary: TrimSummary } {
    if (messages.length === 0) {
      return { kept: [], summary: { removedCount: 0, removedTokens: 0, archivedText: '', summarizeText: '' } }
    }

    if (policy.mode === 'codex' || policy.retention === 'codex') {
      return codexTrim(messages, policy, this.countTokens)
    }

    let cut: number
    if (policy.mode === 'turns') {
      cut = Math.max(0, messages.length - policy.keep)
    } else {
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

    // Expand the retained window to a complete request boundary. A tool turn
    // is assistant(tool_use) followed by user(tool_result); cutting between
    // those messages creates an invalid provider request.
    while (cut > 0 && !isSafeStart(messages[cut]!)) {
      cut--
    }

    // always preserve the most recent message
    if (cut >= messages.length) {
      cut = messages.length - 1
    }

    const removed = messages.slice(0, cut)
    const kept = messages.slice(cut)
    const archivedText = serialize(removed)
    const summary: TrimSummary = {
      removedCount: removed.length,
      removedTokens: this.countTokens(removed),
      archivedText,
      summarizeText: serialize(messages),
    }
    return { kept, summary }
  }
}
