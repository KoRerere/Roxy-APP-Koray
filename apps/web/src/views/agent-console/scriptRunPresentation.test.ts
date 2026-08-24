import type { AgentConversationRunEventDTO, AgentRunEvent } from '@roxy/shared/channel'
import { describe, expect, it, vi } from 'vitest'
import { resolveScriptRunPresentationEvents } from './scriptRunPresentation'

function runEvent(sequence: number, event: AgentRunEvent): AgentConversationRunEventDTO {
  return {
    conversationId: 'conversation-1',
    runId: 'run-1',
    turnId: 'turn-1',
    assistantMessageId: 'assistant-1',
    sequence,
    timestamp: 1000 + sequence,
    event,
  }
}

function createOptions() {
  return {
    locale: 'zh-CN',
    workspaceId: 10,
    templates: {
      getOfficialTemplate: vi.fn(),
    },
    userTemplates: {
      getUserTemplate: vi.fn(),
    },
  }
}

describe('script run presentation', () => {
  it('resolves one official template for the tool and all repeated log events', async () => {
    const options = createOptions()
    options.templates.getOfficialTemplate.mockResolvedValue({
      data: { name: { zh: '商品采集', en: 'Product collector' } },
    })
    const input = { scriptPath: 'official:141', dirIds: ['dir-1'] }
    const events = [
      runEvent(1, {
        type: 'tool_started',
        data: { toolName: 'roxy_script_run', toolId: 'tool-1', target: 'official:141', input },
      }),
      runEvent(2, {
        type: 'script_output',
        data: { toolId: 'tool-1', scriptName: 'official:141', level: 'info', message: 'started' },
      }),
      runEvent(3, {
        type: 'script_output',
        data: { toolId: 'tool-1', scriptName: 'official:141', level: 'info', message: 'finished' },
      }),
    ]

    const presented = await resolveScriptRunPresentationEvents(events, options)

    expect(presented[0]?.event).toMatchObject({
      type: 'tool_started',
      data: { target: '商品采集', input },
    })
    expect(presented.slice(1).map(item => item.event)).toMatchObject([
      { type: 'script_output', data: { scriptName: '商品采集' } },
      { type: 'script_output', data: { scriptName: '商品采集' } },
    ])
    expect(options.templates.getOfficialTemplate).toHaveBeenCalledTimes(1)
    expect(options.templates.getOfficialTemplate).toHaveBeenCalledWith({ templateIdOrSlug: '141' })
    expect(events[0]?.event).toMatchObject({
      type: 'tool_started',
      data: { target: 'official:141', input },
    })
  })

  it('resolves a user template from input when the tool target is absent', async () => {
    const options = createOptions()
    options.userTemplates.getUserTemplate.mockResolvedValue({ data: { name: '私有脚本' } })

    const [presented] = await resolveScriptRunPresentationEvents([
      runEvent(1, {
        type: 'tool_started',
        data: {
          toolName: 'roxy_script_run',
          toolId: 'tool-user',
          input: { scriptPath: 'user:207' },
        },
      }),
    ], options)

    expect(presented?.event).toMatchObject({
      type: 'tool_started',
      data: {
        target: '私有脚本',
        input: { scriptPath: 'user:207' },
      },
    })
    expect(options.userTemplates.getUserTemplate).toHaveBeenCalledWith({ templateId: 207 })
  })

  it('deduplicates concurrent requests and scopes successful cache entries by workspace and locale', async () => {
    const firstOptions = createOptions()
    firstOptions.templates.getOfficialTemplate.mockResolvedValue({ data: { name: { zh: '中文名称', en: 'English name' } } })
    const event = runEvent(1, {
      type: 'tool_started',
      data: { toolName: 'roxy_script_run', toolId: 'tool-cache', target: 'official:301', input: {} },
    })

    const [first, concurrent] = await Promise.all([
      resolveScriptRunPresentationEvents([event], firstOptions),
      resolveScriptRunPresentationEvents([event], firstOptions),
    ])
    expect(first[0]?.event).toMatchObject({ data: { target: '中文名称' } })
    expect(concurrent[0]?.event).toMatchObject({ data: { target: '中文名称' } })
    expect(firstOptions.templates.getOfficialTemplate).toHaveBeenCalledTimes(1)

    const otherLocaleOptions = {
      ...createOptions(),
      locale: 'en',
    }
    otherLocaleOptions.templates.getOfficialTemplate.mockResolvedValue({ data: { name: { zh: '中文名称', en: 'English name' } } })
    const otherWorkspaceOptions = {
      ...createOptions(),
      workspaceId: 11,
    }
    otherWorkspaceOptions.templates.getOfficialTemplate.mockResolvedValue({ data: { name: { zh: '另一团队名称' } } })

    const [otherLocale, otherWorkspace] = await Promise.all([
      resolveScriptRunPresentationEvents([event], otherLocaleOptions),
      resolveScriptRunPresentationEvents([event], otherWorkspaceOptions),
    ])
    expect(otherLocale[0]?.event).toMatchObject({ data: { target: 'English name' } })
    expect(otherWorkspace[0]?.event).toMatchObject({ data: { target: '另一团队名称' } })
    expect(otherLocaleOptions.templates.getOfficialTemplate).toHaveBeenCalledTimes(1)
    expect(otherWorkspaceOptions.templates.getOfficialTemplate).toHaveBeenCalledTimes(1)
  })

  it('falls back to the template reference after a failure and retries later', async () => {
    const options = createOptions()
    options.templates.getOfficialTemplate
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ data: { name: { zh: '重试成功' } } })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const event = runEvent(1, {
      type: 'tool_started',
      data: { toolName: 'roxy_script_run', toolId: 'tool-retry', target: 'official:401', input: {} },
    })

    const failed = await resolveScriptRunPresentationEvents([event], options)
    const retried = await resolveScriptRunPresentationEvents([event], options)

    expect(failed[0]?.event).toMatchObject({ data: { target: 'official:401' } })
    expect(retried[0]?.event).toMatchObject({ data: { target: '重试成功' } })
    expect(options.templates.getOfficialTemplate).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('does not query malformed or non-canonical script references', async () => {
    const options = createOptions()
    const references = ['official:0141', 'user:0', ' official:141', 'official:141 ', 'local-script']
    const events = references.map((target, index) => runEvent(index + 1, {
      type: 'tool_started',
      data: { toolName: 'roxy_script_run', toolId: `tool-${index}`, target, input: { scriptPath: target } },
    }))

    const presented = await resolveScriptRunPresentationEvents(events, options)

    expect(presented.map(item => item.event)).toEqual(events.map(item => item.event))
    expect(options.templates.getOfficialTemplate).not.toHaveBeenCalled()
    expect(options.userTemplates.getUserTemplate).not.toHaveBeenCalled()
  })
})
