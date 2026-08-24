import type { Server } from 'node:http'
import express from 'express'
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createConversation: vi.fn(),
  deleteConversation: vi.fn(),
  getConversation: vi.fn(),
  getConversationDetail: vi.fn(),
  listConversations: vi.fn(),
  markConversationRead: vi.fn(),
  updateConversation: vi.fn(),
}))

vi.mock('@/services/chatService', () => mocks)

const conversation = {
  id: 'conversation-1',
  user_id: 'user-1',
  workspace_id: 'workspace-1',
  title: 'New Chat',
  thread_id: 'thread-1',
  is_active: 1,
  is_title_set: 0,
  latest_run_id: null,
  latest_run_status: null,
  last_read_run_id: null,
  created_at: '2026-07-26 08:00:00',
  updated_at: '2026-07-26 08:01:00',
}

let server: Server | undefined
let baseUrl = ''

beforeEach(async () => {
  vi.resetAllMocks()
  mocks.createConversation.mockReturnValue(conversation)
  mocks.getConversation.mockReturnValue(conversation)
  mocks.getConversationDetail.mockReturnValue({
    ...conversation,
    messages: [
      {
        id: 'message-1',
        conversation_id: conversation.id,
        role: 'user',
        content: 'hello',
        content_type: 'text',
        storage_type: 'inline',
        metadata: {},
        created_at: '2026-07-26 08:00:00',
      },
      {
        id: 'message-2',
        conversation_id: conversation.id,
        role: 'assistant',
        content: 'hi',
        content_type: 'text',
        storage_type: 'inline',
        created_at: '2026-07-26 08:01:00',
      },
    ],
    hasMore: false,
    nextCursor: null,
  })
  mocks.listConversations.mockReturnValue([conversation])
  mocks.markConversationRead.mockReturnValue(conversation)
  mocks.updateConversation.mockReturnValue(true)
  mocks.deleteConversation.mockResolvedValue(true)

  const { default: conversationRoutes } = await import('./conversationRoutes')
  const app = express()
  app.use(express.json())
  app.use('/api', conversationRoutes)
  await new Promise<void>((resolve, reject) => {
    const listeningServer = app.listen(0, '127.0.0.1')
    server = listeningServer
    listeningServer.once('listening', () => {
      const address = listeningServer.address()
      if (!address || typeof address === 'string') {
        reject(new Error('failed to allocate test server port'))
        return
      }
      baseUrl = `http://127.0.0.1:${address.port}`
      resolve()
    })
    listeningServer.once('error', reject)
  })
})

afterEach(async () => {
  if (!server?.listening) {
    server = undefined
    return
  }
  await new Promise<void>((resolve, reject) => {
    server!.close(error => error ? reject(error) : resolve())
  })
  server = undefined
})

describe('fixed conversation routes', () => {
  it('creates and lists conversations with the roxy-agent-app DTO', async () => {
    const createResponse = await fetch(`${baseUrl}/api/conversations/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    assert.equal(createResponse.status, 201)
    assert.deepEqual(await createResponse.json(), {
      code: 0,
      data: {
        id: 'conversation-1',
        title: 'New Chat',
        status: 'active',
        unread: false,
        createdAt: new Date('2026-07-26T08:00:00').getTime(),
        updatedAt: new Date('2026-07-26T08:01:00').getTime(),
      },
    })

    const listResponse = await fetch(`${baseUrl}/api/conversations/list?limit=10&offset=0`)
    assert.equal(listResponse.status, 200)
    const listed = await listResponse.json() as { data: Array<Record<string, unknown>> }
    assert.equal(listed.data[0]?.id, 'conversation-1')
    assert.equal('workspace_id' in listed.data[0]!, false)
    assert.deepEqual(mocks.listConversations.mock.calls.at(-1), [{ limit: 10, offset: 0 }])
  })

  it('returns nested detail without legacy storage fields', async () => {
    const response = await fetch(`${baseUrl}/api/conversations/detail?conversationId=conversation-1`)
    assert.equal(response.status, 200)
    const payload = await response.json() as {
      data: {
        conversation: { id: string }
        messages: Array<Record<string, unknown>>
        artifacts: unknown[]
        hasMore: boolean
        nextCursor: string | null
      }
    }
    assert.equal(payload.data.conversation.id, 'conversation-1')
    assert.deepEqual(payload.data.messages.map(message => message.content), ['hello', 'hi'])
    assert.equal('conversation_id' in payload.data.messages[0]!, false)
    assert.equal('storage_type' in payload.data.messages[0]!, false)
    assert.deepEqual(payload.data.artifacts, [])
    assert.equal(payload.data.hasMore, false)
    assert.equal(payload.data.nextCursor, null)
    assert.deepEqual(mocks.getConversationDetail.mock.calls.at(-1), [
      'conversation-1',
      { cursor: undefined, limit: 5 },
    ])
  })

  it('passes the message-pair cursor and page size to conversation detail', async () => {
    const response = await fetch(`${baseUrl}/api/conversations/detail?conversationId=conversation-1&limit=5&cursor=10`)
    assert.equal(response.status, 200)
    assert.deepEqual(mocks.getConversationDetail.mock.calls.at(-1), [
      'conversation-1',
      { cursor: '10', limit: 5 },
    ])
  })

  it('updates and deletes conversations through POST actions', async () => {
    let response = await fetch(`${baseUrl}/api/conversations/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: 'conversation-1', title: 'Updated title' }),
    })
    assert.equal(response.status, 200)
    assert.deepEqual(mocks.updateConversation.mock.calls[0], ['conversation-1', { title: 'Updated title' }])

    response = await fetch(`${baseUrl}/api/conversations/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: 'conversation-1' }),
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { code: 0, data: { deleted: true } })
  })

  it('returns persisted unread state and marks only the requested run as read', async () => {
    const unreadConversation = {
      ...conversation,
      latest_run_id: 'run-1',
      latest_run_status: 'completed',
      last_read_run_id: null,
    }
    mocks.listConversations.mockReturnValue([unreadConversation])
    mocks.markConversationRead.mockReturnValue({
      ...unreadConversation,
      last_read_run_id: 'run-1',
    })

    let response = await fetch(`${baseUrl}/api/conversations/list`)
    const payload = await response.json() as { data: Array<Record<string, unknown>> }
    assert.deepEqual(mocks.listConversations.mock.calls.at(-1), [{ limit: 100, offset: 0 }])
    assert.deepEqual(payload.data[0], {
      id: 'conversation-1',
      title: 'New Chat',
      status: 'active',
      latestRunId: 'run-1',
      latestRunStatus: 'completed',
      unread: true,
      createdAt: new Date('2026-07-26T08:00:00').getTime(),
      updatedAt: new Date('2026-07-26T08:01:00').getTime(),
    })

    response = await fetch(`${baseUrl}/api/conversations/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: 'conversation-1', runId: 'run-1' }),
    })
    assert.equal(response.status, 200)
    const markReadPayload = await response.json() as { data: { unread: boolean } }
    assert.deepEqual(mocks.markConversationRead.mock.calls[0], ['conversation-1', 'run-1'])
    assert.equal(markReadPayload.data.unread, false)
  })

  it('marks an explicit create title as final but keeps a temporary update unset', async () => {
    let response = await fetch(`${baseUrl}/api/conversations/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Explicit title' }),
    })
    assert.equal(response.status, 201)
    assert.deepEqual(mocks.updateConversation.mock.calls[0], [
      'conversation-1',
      { title: 'Explicit title', isTitleSet: true },
    ])

    mocks.updateConversation.mockClear()
    response = await fetch(`${baseUrl}/api/conversations/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: 'conversation-1', title: 'Temporary title' }),
    })
    assert.equal(response.status, 200)
    assert.deepEqual(mocks.updateConversation.mock.calls[0], [
      'conversation-1',
      { title: 'Temporary title' },
    ])
  })

  it('validates fixed route inputs and returns stable not-found errors', async () => {
    let response = await fetch(`${baseUrl}/api/conversations/detail`)
    assert.equal(response.status, 400)
    assert.equal((await response.json() as { error: { code: string } }).error.code, 'INVALID_REQUEST')

    mocks.getConversation.mockReturnValue(null)
    response = await fetch(`${baseUrl}/api/conversations/detail?conversationId=missing`)
    assert.equal(response.status, 404)
    assert.equal((await response.json() as { error: { code: string } }).error.code, 'NOT_FOUND')
  })
})
