import type { AgentConversationRunEventDTO } from '@roxy/shared/channel'
import type { AgentInput, ChatRequest, Message } from 'roxy-agent-runtime'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runEventHub } from '@/core/agent-events/runEventHub'
import { abortRun } from '@/core/registry/abortRegistry'
import { RoxyRolloutStore } from '../runtime/rollout'
import { completeConversationRunAttachments, startConversationRun } from './chatService'

const mocks = vi.hoisted(() => ({ root: '', createAgent: vi.fn(), requests: [] as ChatRequest[] }))
vi.mock('@/config', () => ({ env: { SYSTEM_LANGUAGE: 'en' } }))
vi.mock('@/runtime', () => ({ createRuntimeChatAgent: mocks.createAgent }))
vi.mock('@/runtime/provider', () => ({ createRuntimeProvider: vi.fn(), getRuntimeModel: vi.fn() }))
vi.mock('@/core/mcp/mcpManager', () => ({ mcpManager: {} }))
vi.mock('@/core/fileManager', () => ({ fileManager: {}, generatedArtifactMimeType: vi.fn() }))
vi.mock('@/core/task-monitor', () => ({ publishTaskMonitorTaskFinished: vi.fn(), publishTaskMonitorTaskStarted: vi.fn() }))
vi.mock('@/script/browserOpsManager', () => ({ browserOpsManager: { ensure: vi.fn(), clearSession: vi.fn() } }))
vi.mock('./skillMarkdownResolver', () => ({ preloadSkillMarkdownLinks: vi.fn(async () => ({ errors: [] })) }))
vi.mock('@/core/storage/agentPaths', () => ({
  agentPaths: {
    sessionDir: (id: string) => path.join(mocks.root, id),
    sessionRollout: (id: string) => path.join(mocks.root, id, 'rollout.jsonl'),
  },
}))
vi.mock('@/database/conversations', () => ({
  FileRecordStore: {},
  ChatContextAPI: {
    getConversation: (id: string) => ({ id, title: 'Existing', is_title_set: 1 }),
    setActiveConversation: vi.fn(),
    addMessage: vi.fn(),
  },
}))
vi.mock('./fileService', async (importOriginal) => {
  const original = await importOriginal<typeof import('./fileService')>()
  return {
    ...original,
    hydrateAttachmentFileUrls: async (attachments: unknown[]) => attachments.length > 0
      ? [{ fileId: 'local-image', fileName: 'image.png', mimeType: 'image/png', upstreamFileId: 'upstream-image' }]
      : [],
    materializeLocalAttachments: async () => ({ remainingLocalAttachments: [], attachments: [] }),
  }
})

let unsubscribe: () => void
let live: AgentConversationRunEventDTO[]
let store: RoxyRolloutStore

beforeEach(() => {
  mocks.root = fs.mkdtempSync(path.join(os.tmpdir(), 'roxy-chat-input-'))
  store = new RoxyRolloutStore(mocks.root)
  mocks.requests = []
  mocks.createAgent.mockReset()
  live = []
  unsubscribe = runEventHub.subscribe(event => live.push(event))
  mocks.createAgent.mockImplementation(async (options) => {
    const runtime = await import('roxy-agent-runtime')
    const agent = await runtime.AgentRuntime.create({
      sessionId: options.conversationId,
      model: 'fake',
      systemPrompt: '',
      memory: new runtime.InMemoryProvider(),
      tools: new runtime.ToolRegistry(),
      provider: new runtime.FakeProvider({ handler: (request) => {
        mocks.requests.push(request)
        return runtime.chatResponse({ role: 'assistant', content: 'done' })
      } }),
      hitl: new runtime.FullAccessHandler(),
      clarification: new runtime.NullClarificationHandler(),
      recorder: new runtime.InMemoryTrajectoryRecorder(),
      logger: runtime.createLogger({ level: 'error' }),
      sessionStore: store,
    })
    return {
      agent,
      createInput: (content: Message['content'], trailingMessages: Message[], metadata: Message['metadata']): AgentInput => ({
        input: [{ role: 'user', content, metadata }],
        trailingMessages,
      }),
      consumeFiles: () => [],
      destroy: () => agent.dispose(),
    }
  })
})

afterEach(() => {
  unsubscribe()
  fs.rmSync(mocks.root, { recursive: true, force: true })
})

describe('received conversation input', () => {
  it('persists before acknowledgment, waits for attachments, and executes each turn once', async () => {
    // Regression: receipt and runtime input were separate messages with mismatched IDs.
    // Fixed by: executing the already persisted input and appending only attachment context.
    const command = { conversationId: 'conversation', turnId: 'turn-1', message: 'inspect', attachmentsPending: true }
    const running = startConversationRun(command, 'request-1')
    await vi.waitFor(() => expect(live[0]?.event.type).toBe('run_started'))
    expect((await store.read('conversation')).map(event => event.type)).toEqual(['user_input'])
    expect(live.map(item => item.event.type)).toEqual(['run_started'])
    expect(mocks.createAgent).not.toHaveBeenCalled()
    await startConversationRun(command, 'duplicate-active')
    completeConversationRunAttachments({ conversationId: 'conversation', turnId: 'turn-1', attachments: [{ fileId: 'local-image' }] })
    await running
    await startConversationRun(command, 'duplicate-complete')
    expect(mocks.createAgent).toHaveBeenCalledTimes(1)
    const inputs = (await store.read('conversation')).filter(event => event.type === 'user_input')
    expect(inputs.filter(event => event.message.visible !== false)).toHaveLength(1)
    expect(mocks.requests).toHaveLength(1)
    expect(mocks.requests[0].messages.filter(message => message.metadata?.turnId === 'turn-1' && message.visible !== false)).toHaveLength(1)
    expect(mocks.requests[0].messages).toContainEqual(expect.objectContaining({
      visible: false,
      content: [{ type: 'file', fileId: 'upstream-image' }],
    }))
    expect(live.at(-1)?.event.type).toBe('run_completed')
    await startConversationRun({ conversationId: 'conversation', turnId: 'turn-2', message: 'inspect' }, 'request-2')
    expect(mocks.createAgent).toHaveBeenCalledTimes(2)
    expect((await store.read('conversation')).filter(event => event.type === 'user_input' && event.message.visible !== false)).toHaveLength(2)
  })

  it('keeps the input when cancelled while waiting for upload', async () => {
    const running = startConversationRun({ conversationId: 'cancelled', turnId: 'turn-1', message: 'keep', attachmentsPending: true }, 'request-1')
    const active = runEventHub.getActive('cancelled')!
    abortRun(active.identity.runId)
    active.publish({ type: 'run_cancelled', data: { reason: 'user' } })
    await running
    expect((await store.read('cancelled')).map(event => event.type)).toEqual(['user_input'])
    expect(mocks.createAgent).not.toHaveBeenCalled()
    expect(runEventHub.getActive('cancelled')).toBeUndefined()
  })

  it('preserves the received input when runtime initialization fails', async () => {
    mocks.createAgent.mockRejectedValue(new Error('initialization failed'))
    await startConversationRun({ conversationId: 'failed', turnId: 'turn-1', message: 'keep' }, 'request-1')
    expect((await store.read('failed')).map(event => event.type)).toEqual(['user_input'])
    expect(live.at(-1)?.event.type).toBe('run_failed')
    expect(runEventHub.getActive('failed')).toBeUndefined()
  })
})
