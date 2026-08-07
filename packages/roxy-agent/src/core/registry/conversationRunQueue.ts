interface ConversationRunQueueEntry {
  promise: Promise<void>
}

export class ConversationRunQueue {
  private readonly entries = new Map<string, ConversationRunQueueEntry>()

  async enqueue(conversationId: string, execute: () => Promise<void>): Promise<void> {
    const previous = this.entries.get(conversationId)
    const entry: ConversationRunQueueEntry = {
      promise: Promise.resolve(),
    }

    entry.promise = Promise.resolve(previous?.promise)
      .catch(() => {})
      .then(execute)

    this.entries.set(conversationId, entry)
    return entry.promise.finally(() => {
      if (this.entries.get(conversationId) === entry) {
        this.entries.delete(conversationId)
      }
    })
  }
}
