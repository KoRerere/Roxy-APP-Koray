export interface ConversationMessagePage<T> {
  messages: T[]
  hasMore: boolean
  nextCursor: string | null
}

interface ConversationMessageLike {
  role: string
}

interface ConversationMessagePageOptions {
  cursor?: string
  limit: number
}

/**
 * A pair starts with a user message and may contain the next assistant message.
 * Any message that cannot complete such a pair is treated as a pair of its own.
 */
function messagePairStartIndexes(messages: readonly ConversationMessageLike[]): number[] {
  const starts: number[] = []
  let openUserPair = false

  messages.forEach((message, index) => {
    if (message.role === 'user') {
      starts.push(index)
      openUserPair = true
      return
    }

    if (message.role === 'assistant' && openUserPair) {
      openUserPair = false
      return
    }

    starts.push(index)
    openUserPair = false
  })

  return starts
}

export function paginateConversationMessages<T extends ConversationMessageLike>(
  messages: readonly T[],
  options: ConversationMessagePageOptions,
): ConversationMessagePage<T> {
  const pairStarts = messagePairStartIndexes(messages)
  if (pairStarts.length === 0) {
    return { messages: [], hasMore: false, nextCursor: null }
  }

  const requestedEnd = options.cursor === undefined
    ? pairStarts.length
    : Number.parseInt(options.cursor, 10)
  const endPairIndex = Math.min(pairStarts.length, Math.max(0, requestedEnd))
  const startPairIndex = Math.max(0, endPairIndex - options.limit)
  const startMessageIndex = pairStarts[startPairIndex] ?? messages.length
  const endMessageIndex = pairStarts[endPairIndex] ?? messages.length

  return {
    messages: messages.slice(startMessageIndex, endMessageIndex),
    hasMore: startPairIndex > 0,
    nextCursor: startPairIndex > 0 ? String(startPairIndex) : null,
  }
}
