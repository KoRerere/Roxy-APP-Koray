import type { IMemoryProvider, Message, SessionId, TrimPolicy, TrimSummary, Trimmer } from '../core/interfaces.ts'
import { SlidingWindowTrimmer } from './trimmer.ts'

export function createCompactionSummaryMessage(summary: string): Message {
  return {
    role: 'developer',
    content: `Previous conversation summary:\n<summary>\n${summary}\n</summary>`,
    visible: false,
  }
}

function isSafeConversationStart(message: Message): boolean {
  if (message.role !== 'user') {
    return false
  }
  if (!Array.isArray(message.content)) {
    return true
  }
  return !message.content.some((block) => block.type === 'tool_result')
}

function retainSafeConversationTail(messages: Message[]): Message[] {
  let i = 0
  while (i < messages.length - 1) {
    if (isSafeConversationStart(messages[i]!)) {
      break
    }
    i++
  }
  return i === 0 ? messages : messages.slice(i)
}

function compactionContext(messages: Message[]): Message[] {
  const latest = new Map<string, { index: number; message: Message }>()
  for (let index = 0; index < messages.length; index++) {
    const message = messages[index]!
    if (message.compactionKey) {
      latest.set(message.compactionKey, { index, message })
    }
  }
  return [...latest.values()]
    .toSorted((left, right) => {
      const order = (left.message.compactionOrder ?? 0) - (right.message.compactionOrder ?? 0)
      return order || left.index - right.index
    })
    .map((entry) => entry.message)
}

export interface InMemoryProviderOptions {
  trimmer?: Trimmer
}

/** In-memory per-session history + summary store. v1 default provider. */
export class InMemoryProvider implements IMemoryProvider {
  private readonly histories = new Map<SessionId, Message[]>()
  private readonly summaries = new Map<SessionId, string>()
  private readonly trimmer: Trimmer

  constructor(opts: InMemoryProviderOptions = {}) {
    this.trimmer = opts.trimmer ?? new SlidingWindowTrimmer()
  }

  async append(sessionId: SessionId, msg: Message): Promise<void> {
    const list = this.histories.get(sessionId)
    if (list) {
      list.push(msg)
    } else {
      this.histories.set(sessionId, [msg])
    }
  }

  async getAll(sessionId: SessionId): Promise<Message[]> {
    return [...(this.histories.get(sessionId) ?? [])]
  }

  async getSince(sessionId: SessionId, count: number): Promise<Message[]> {
    const all = this.histories.get(sessionId) ?? []
    return all.slice(-count)
  }

  async trim(sessionId: SessionId, policy: TrimPolicy): Promise<TrimSummary> {
    const messages = this.histories.get(sessionId) ?? []
    const compressibleMessages = messages.filter((message) => !message.compactionKey)
    const { kept: retainedConversation, summary } = this.trimmer.trim(compressibleMessages, policy)
    if (summary.removedCount === 0) {
      this.histories.set(sessionId, messages)
      return summary
    }

    const retainedContext = compactionContext(messages)
    const conversationTail = retainSafeConversationTail(retainedConversation)
    this.histories.set(sessionId, [...retainedContext, ...conversationTail])
    return summary
  }

  async setSummary(sessionId: SessionId, summary: string): Promise<void> {
    this.summaries.set(sessionId, summary)
  }

  async getSummary(sessionId: SessionId): Promise<string | null> {
    return this.summaries.get(sessionId) ?? null
  }

  async prependMessage(sessionId: SessionId, msg: Message): Promise<void> {
    const list = this.histories.get(sessionId)
    if (list) {
      list.unshift(msg)
    } else {
      this.histories.set(sessionId, [msg])
    }
  }

  async clear(sessionId: SessionId): Promise<void> {
    this.histories.delete(sessionId)
    this.summaries.delete(sessionId)
  }
}
