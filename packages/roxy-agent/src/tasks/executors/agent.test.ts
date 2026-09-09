import type { ResolvedTemplate } from '@/services/templateService'
import assert from 'node:assert/strict'
import { beforeEach, describe, it, vi } from 'vitest'
import {
  buildTaskInitialUserMessage,
  collectTaskAssistantMessages,
  prepareTaskSkill,
} from './agent'

const templateServiceMocks = vi.hoisted(() => ({
  ensureResolvedTemplateSkillInstalled: vi.fn(),
}))

const conversationExecutionMocks = vi.hoisted(() => ({
  runConversationTurn: vi.fn(),
  createConversation: vi.fn(),
  addMessage: vi.fn(),
  tryBegin: vi.fn(),
}))

const runtimeMocks = vi.hoisted(() => ({
  createRuntimeChatAgent: vi.fn(),
}))

vi.mock('@/services/templateService', () => ({
  ensureResolvedTemplateSkillInstalled: templateServiceMocks.ensureResolvedTemplateSkillInstalled,
}))

vi.mock('@/services/chatService', () => ({
  generateConversationTitle: vi.fn().mockResolvedValue(''),
  runConversationTurn: conversationExecutionMocks.runConversationTurn,
}))

vi.mock('@/database/conversations', () => ({
  ChatContextAPI: {
    createConversation: conversationExecutionMocks.createConversation,
    addMessage: conversationExecutionMocks.addMessage,
  },
}))

vi.mock('@/core/agent-events/runEventHub', () => ({
  runEventHub: {
    tryBegin: conversationExecutionMocks.tryBegin,
  },
}))

vi.mock('@/runtime', () => ({
  createRuntimeChatAgent: runtimeMocks.createRuntimeChatAgent,
  RuntimeEventPublisher: class {
    handle() {}
    getFinalAnswer() {
      return ''
    }
  },
}))

function createResolvedTemplate(): ResolvedTemplate {
  return {
    ref: { namespace: 'user', id: 1, value: 'user:1' },
    kind: 'skill',
    id: 1,
    workspaceId: 'workspace-1',
    name: 'Task skill',
    metadata: {},
    createdAt: '',
    updatedAt: '',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  conversationExecutionMocks.runConversationTurn.mockResolvedValue({
    status: 'success',
    conversationId: 'task-conversation-1',
    fileIds: [],
    failedFiles: [],
    finalContent: 'completed',
  })
  conversationExecutionMocks.createConversation.mockReturnValue(undefined)
  conversationExecutionMocks.addMessage.mockReturnValue(undefined)
  conversationExecutionMocks.tryBegin.mockReturnValue({
    identity: {
      conversationId: 'task-conversation-1',
      runId: 'task-log-1',
      turnId: 'task-turn-1',
      assistantMessageId: 'task-assistant-1',
    },
    isTerminal: false,
    terminalStatus: undefined,
    publish: vi.fn(),
  })
  runtimeMocks.createRuntimeChatAgent.mockResolvedValue({
    agent: {
      async* stream() {},
    },
    createInput: vi.fn(),
    consumeFiles: vi.fn(() => []),
    destroy: vi.fn(),
  })
})

describe('prepareTaskSkill', () => {
  it('installs the resolved canonical Skill template through the template service', async () => {
    templateServiceMocks.ensureResolvedTemplateSkillInstalled.mockResolvedValue({
      ref: { namespace: 'user', id: 1, value: 'user:1' },
      skillMdPath: '/tmp/agent-skills/installed/task-skill/SKILL.md',
    })

    const prepared = await prepareTaskSkill(createResolvedTemplate())

    assert.deepEqual(prepared, {
      skillMdPath: '/tmp/agent-skills/installed/task-skill/SKILL.md',
    })
    assert.deepEqual(templateServiceMocks.ensureResolvedTemplateSkillInstalled.mock.calls[0]?.[0].ref, {
      namespace: 'user',
      id: 1,
      value: 'user:1',
    })
  })

  it('rejects a non-Skill resolved template before materialization', async () => {
    const template = {
      ...createResolvedTemplate(),
      kind: 'prompt' as const,
    }

    await assert.rejects(
      prepareTaskSkill(template),
      /Template is not a Skill template/,
    )
    assert.equal(templateServiceMocks.ensureResolvedTemplateSkillInstalled.mock.calls.length, 0)
  })
})

describe('buildTaskInitialUserMessage', () => {
  it('prepends the Skill reference and appends the aggregate window reference', async () => {
    const message = buildTaskInitialUserMessage({
      taskName: 'Research task',
      templateName: 'Research Assistant',
      taskLogId: 'task-log-1',
      prompt: 'Research this topic.',
      windows: [
        { id: 1, dirId: 'window-a', windowName: 'Account A' },
        { id: 2, dirId: 'window-b', windowName: 'Account B' },
      ],
      signal: new AbortController().signal,
      skill: {
        skillMdPath: '/tmp/agent-skills/installed/research-assistant/SKILL.md',
      },
    })

    assert.equal(
      message,
      '[$Research Assistant](/tmp/agent-skills/installed/research-assistant/SKILL.md) Research this topic. [请使用 [@profile:2](window-a,window-b) 窗口完成这个任务]',
    )
  })

  it('builds a Skill-only task message when the auxiliary prompt is empty', async () => {
    const message = buildTaskInitialUserMessage({
      taskName: 'Research task',
      templateName: 'Research Assistant',
      taskLogId: 'task-log-empty-prompt',
      prompt: '   ',
      windows: [{ id: 1, dirId: 'window-a' }],
      signal: new AbortController().signal,
      skill: {
        skillMdPath: '/tmp/agent-skills/installed/research-assistant/SKILL.md',
      },
    })

    assert.equal(
      message,
      '[$Research Assistant](/tmp/agent-skills/installed/research-assistant/SKILL.md) [请使用 [@profile:1](window-a) 窗口完成这个任务]',
    )
  })

  it('only appends the window reference for a Prompt task', () => {
    const message = buildTaskInitialUserMessage({
      taskName: 'Prompt task',
      templateName: 'Prompt template',
      taskLogId: 'task-log-2',
      prompt: 'Summarize the account activity.',
      windows: [{ id: 1, dirId: 'window-a' }],
      signal: new AbortController().signal,
    })

    assert.equal(
      message,
      'Summarize the account activity. [请使用 [@profile:1](window-a) 窗口完成这个任务]',
    )
  })

  it('keeps a Prompt task unchanged when it has no associated windows', () => {
    const message = buildTaskInitialUserMessage({
      taskName: 'Prompt task',
      templateName: 'Prompt template',
      taskLogId: 'task-log-3',
      prompt: '  Summarize the report.  ',
      windows: [],
      signal: new AbortController().signal,
    })

    assert.equal(message, 'Summarize the report.')
  })
})

describe('collectTaskAssistantMessages', () => {
  it('keeps each assistant content block as a separate message in stream order', () => {
    const messages = collectTaskAssistantMessages([
      { type: 'content_delta', data: { contentId: 'content-1', text: 'First ' } },
      { type: 'content_delta', data: { contentId: 'content-2', text: 'second' } },
      { type: 'content_delta', data: { contentId: 'content-1', text: 'part. ' } },
      { type: 'thinking_delta', data: { thinkingId: 'thinking-1', text: 'hidden' } },
      { type: 'content_delta', data: { contentId: 'content-2', text: ' block.' } },
    ])

    assert.deepEqual(messages, [
      { contentId: 'content-1', content: 'First part.' },
      { contentId: 'content-2', content: 'second block.' },
    ])
  })
})

describe('executeAgentTask', () => {
  it('delegates the background run to chatService with the same conversation flow', async () => {
    // Regression: scheduled tasks used a second Agent stream loop, so a
    // clarification answer had no interrupt gate to resume the task.
    // Fixed by: routing the task-created conversation through chatService's
    // shared runConversationTurn implementation.
    const result = await (await import('./agent')).executeAgentTask({
      taskName: 'Daily report',
      templateName: 'Prompt template',
      taskLogId: 'task-log-1',
      prompt: 'Summarize the report.',
      windows: [{ id: 1, dirId: 'window-1' }],
      signal: new AbortController().signal,
    })

    assert.equal(result.status, 'success')
    assert.equal(conversationExecutionMocks.runConversationTurn.mock.calls.length, 1)
    const options = conversationExecutionMocks.runConversationTurn.mock.calls[0]?.[0]
    assert.equal(options.activateConversation, false)
    assert.equal(options.persistUserMessage, true)
    assert.deepEqual(options.taskMonitor, {
      taskId: 'task-log-1',
      title: 'Daily report',
      sourceType: 'task',
    })
    assert.deepEqual(options.runtime, {
      executionId: 'task-log-1',
      taskMonitorTaskId: 'task-log-1',
      allowedDirIds: ['window-1'],
    })
    assert.equal(options.artifactSource, 'task')
  })
})
