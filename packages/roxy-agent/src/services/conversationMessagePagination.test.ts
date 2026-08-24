import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { paginateConversationMessages } from './conversationMessagePagination'

interface TestMessage {
  id: string
  role: 'user' | 'assistant'
}

function pair(number: number): TestMessage[] {
  return [
    { id: `user-${number}`, role: 'user' },
    { id: `assistant-${number}`, role: 'assistant' },
  ]
}

describe('conversation message pagination', () => {
  it('loads the newest five pairs and then five older pairs at a time', () => {
    const messages = Array.from({ length: 12 }, (_, index) => pair(index + 1)).flat()

    const newest = paginateConversationMessages(messages, { limit: 5 })
    assert.deepEqual(newest.messages.map(message => message.id), [
      'user-8',
      'assistant-8',
      'user-9',
      'assistant-9',
      'user-10',
      'assistant-10',
      'user-11',
      'assistant-11',
      'user-12',
      'assistant-12',
    ])
    assert.equal(newest.hasMore, true)
    assert.equal(newest.nextCursor, '7')

    const older = paginateConversationMessages(messages, { cursor: newest.nextCursor!, limit: 5 })
    assert.deepEqual(older.messages.map(message => message.id), [
      'user-3',
      'assistant-3',
      'user-4',
      'assistant-4',
      'user-5',
      'assistant-5',
      'user-6',
      'assistant-6',
      'user-7',
      'assistant-7',
    ])
    assert.equal(older.nextCursor, '2')
  })

  it('counts incomplete and unmatched messages as one pair each', () => {
    const messages: TestMessage[] = [
      ...pair(1),
      { id: 'user-2', role: 'user' },
      ...pair(3),
      { id: 'assistant-unmatched', role: 'assistant' },
    ]

    const newest = paginateConversationMessages(messages, { limit: 2 })
    assert.deepEqual(newest.messages.map(message => message.id), [
      'user-3',
      'assistant-3',
      'assistant-unmatched',
    ])
    assert.equal(newest.hasMore, true)

    const oldest = paginateConversationMessages(messages, { cursor: newest.nextCursor!, limit: 5 })
    assert.deepEqual(oldest.messages.map(message => message.id), [
      'user-1',
      'assistant-1',
      'user-2',
    ])
    assert.equal(oldest.hasMore, false)
    assert.equal(oldest.nextCursor, null)
  })

  it('keeps an older-page cursor stable when a new pair is appended', () => {
    const messages = Array.from({ length: 6 }, (_, index) => pair(index + 1)).flat()
    const newest = paginateConversationMessages(messages, { limit: 3 })

    messages.push(...pair(7))
    const older = paginateConversationMessages(messages, { cursor: newest.nextCursor!, limit: 3 })

    assert.deepEqual(older.messages.map(message => message.id), [
      'user-1',
      'assistant-1',
      'user-2',
      'assistant-2',
      'user-3',
      'assistant-3',
    ])
  })
})
