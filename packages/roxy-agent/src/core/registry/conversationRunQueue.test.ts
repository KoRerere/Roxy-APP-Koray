import { describe, expect, it, vi } from 'vitest'
import { ConversationRunQueue } from './conversationRunQueue'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

describe('conversation run queue', () => {
  it('waits for the previous run cleanup before starting the next run', async () => {
    const queue = new ConversationRunQueue()
    const first = deferred()
    const second = vi.fn(async () => {})

    const firstCompletion = queue.enqueue('conversation-1', () => first.promise)
    const secondCompletion = queue.enqueue('conversation-1', second)
    await Promise.resolve()

    expect(second).not.toHaveBeenCalled()
    first.resolve()
    await firstCompletion
    await secondCompletion
    expect(second).toHaveBeenCalledOnce()
  })
})
