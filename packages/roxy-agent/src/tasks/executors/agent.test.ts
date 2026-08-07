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

vi.mock('@/services/templateService', () => ({
  ensureResolvedTemplateSkillInstalled: templateServiceMocks.ensureResolvedTemplateSkillInstalled,
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
})

describe('prepareTaskSkill', () => {
  it('installs the resolved canonical Skill template through the template service', async () => {
    templateServiceMocks.ensureResolvedTemplateSkillInstalled.mockResolvedValue({
      ref: { namespace: 'user', id: 1, value: 'user:1' },
    })

    const prepared = await prepareTaskSkill(createResolvedTemplate())

    assert.deepEqual(prepared, {
      ref: { namespace: 'user', id: 1, value: 'user:1' },
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
        ref: { namespace: 'user', id: 42, value: 'user:42' },
      },
    })

    assert.equal(
      message,
      '[$Research Assistant](user:42) Research this topic. [请使用 [@profile:2](window-a,window-b) 窗口完成这个任务]',
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
        ref: { namespace: 'user', id: 42, value: 'user:42' },
      },
    })

    assert.equal(
      message,
      '[$Research Assistant](user:42) [请使用 [@profile:1](window-a) 窗口完成这个任务]',
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
