import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { AgentHitlRequest } from './types'
import { createHitlRequestFromAgentEvent, createHitlRequestFromLegacyInterrupt, createLegacyResumeDecisions } from './hitlAdapter'

vi.hoisted(() => {
  vi.stubGlobal('$t', (message: string, values?: Record<string, unknown>) =>
    message.replace(/\{(\w+)\}/g, (_, key: string) => String(values?.[key] ?? `{${key}}`)))
})

describe('clarification HITL adapter', () => {
  beforeAll(() => {
    vi.stubGlobal('$t', (message: string, values?: Record<string, unknown>) =>
      message.replace(/\{(\w+)\}/g, (_, key: string) => String(values?.[key] ?? `{${key}}`)))
  })

  it('submits the entered answer instead of an approval decision', () => {
    // Regression: generic text controls were rendered, but submission always
    // collapsed to approve/reject so ask_user never received the user's text.
    // Fixed by: clarification requests serialize the answer as an answer decision.
    const request: AgentHitlRequest = {
      id: 'clarification-1',
      conversationId: 'conversation-1',
      runId: 'run-1',
      title: '需要您的输入',
      prompt: 'What should the file be named?',
      status: 'pending',
      subjects: [],
      controls: [{ id: 'answer', kind: 'textarea', required: true }],
      values: { answer: null },
      source: {
        kind: 'agent-hitl',
        payload: { requestKind: 'clarification' },
      },
    }

    expect(
      createLegacyResumeDecisions(request, {
        requestId: request.id,
        values: { answer: 'report.csv' },
      }),
    ).toEqual([{ type: 'answer', answer: 'report.csv' }])
  })

  it('keeps multi-question clarification metadata and serializes answers by stable id', () => {
    // Regression: the HITL adapter only retained one generic answer control,
    // so the frontend had no data to navigate across multiple questions.
    // Fixed by: preserve questions on the request and submit an id-keyed answer object.
    const request = createHitlRequestFromAgentEvent('conversation-1', 'run-1', {
      id: 'clarification-questions',
      requestKind: 'clarification',
      title: '需要您的输入',
      prompt: 'Which region should we use?',
      questions: [
        {
          header: 'Region',
          id: 'region',
          question: 'Which region should we use?',
          options: [
            { label: 'US', description: 'Use the United States region.' },
            { label: 'EU', description: 'Use the European region.' },
          ],
        },
        {
          header: 'Mode',
          id: 'mode',
          question: 'Which mode should we use?',
          options: [
            { label: 'Safe', description: 'Prefer conservative defaults.' },
            { label: 'Fast', description: 'Prioritize speed.' },
          ],
        },
      ],
    })

    expect(request?.clarificationQuestions?.map(question => question.id)).toEqual(['region', 'mode'])
    expect(createLegacyResumeDecisions(request!, {
      requestId: request!.id,
      values: { answer: JSON.stringify({ region: 'US', mode: 'Safe' }) },
    })).toEqual([{ type: 'answer', answer: JSON.stringify({ region: 'US', mode: 'Safe' }) }])
  })

  it('preserves apply_patch text and summarizes all target files for approval', () => {
    // Regression: legacy HITL normalized custom-tool string args to an empty object,
    // hiding apply_patch targets and its approval preview from the user.
    // Fixed by: retain free-form args and derive target labels from patch headers.
    const patch = [
      '*** Begin Patch',
      '*** Update File: app/settings.json',
      '@@',
      '-  "theme": "light",',
      '+  "theme": "dark",',
      '*** Add File: docs/new.md',
      '+# New Guide',
      '+This guide is current.',
      '*** Delete File: docs/old.md',
      '*** End Patch',
    ].join('\n')
    const request = createHitlRequestFromLegacyInterrupt('conversation-1', 'run-1', {
      interruptsId: 'approval-1',
      actionRequests: [
        {
          name: 'apply_patch',
          args: patch,
          diff: patch,
        },
      ],
      reviewConfigs: [],
    })

    expect(request?.prompt).toBe('允许 Roxy Agent 更新多个文件 settings.json、new.md、old.md 吗？')
    expect(request?.subjects[0]).toEqual(
      expect.objectContaining({
        name: 'apply_patch',
        input: patch,
        diff: patch,
      }),
    )
    const approvalControl = request?.controls.find(control => control.id === 'approval')
    expect(approvalControl?.kind).toBe('choice')
    if (approvalControl?.kind === 'choice') {
      expect(approvalControl.options).toContainEqual(expect.objectContaining({
        id: 'full-access',
        value: 'full-access',
        legacyDecisionType: 'approve',
      }))
    }
    expect(createLegacyResumeDecisions(request!, {
      requestId: request!.id,
      values: { approval: 'full-access' },
    })).toEqual([{ type: 'approve' }])
  })

  it('summarizes an OpenAI native apply_patch operation', () => {
    const input = { operation: { type: 'delete_file', path: 'archive/old.txt' } }
    const request = createHitlRequestFromLegacyInterrupt('conversation-1', 'run-1', {
      interruptsId: 'approval-2',
      actionRequests: [{ name: 'apply_patch', args: input }],
      reviewConfigs: [],
    })

    expect(request?.prompt).toBe('允许 Roxy Agent 删除文件 archive/old.txt 吗？')
    expect(request?.subjects[0]).toEqual(expect.objectContaining({ name: 'apply_patch', input }))
  })

  it('uses friendly event-list labels for namespaced MCP approvals', () => {
    // Regression: approval prompts exposed the full namespaced MCP tool name,
    // making a profile deletion request unreadable to users.
    // Fixed by: reuse the Agent Console tool label mapping for approval actions.
    const request = createHitlRequestFromLegacyInterrupt('conversation-1', 'run-1', {
      interruptsId: 'approval-3',
      actionRequests: [{
        name: 'mcp_roxybrowser-openapi-mcp__roxy_profile_delete',
        args: { dirId: 'b9472f2dfea9f5fb5b17a6d486923f10' },
      }],
      reviewConfigs: [],
    })

    expect(request?.prompt).toBe('允许 Roxy Agent 删除窗口 b9472f2dfea9f5fb5b17a6d486923f10 吗？')
    expect(request?.subjects[0]?.title).toBe('删除窗口 b9472f2dfea9f5fb5b17a6d486923f10')
  })

  it('uses the shared event-list label mapping for all approval tool names', () => {
    // Regression: approval prompts had their own verb formatter, so browser,
    // filesystem, shell, OpenAPI MCP and unknown MCP tools diverged from the
    // event-list labels users see after execution.
    // Fixed by: derive approval titles from the shared friendlyToolName helper.
    const cases: Array<[string, unknown, string]> = [
      ['mcp_roxybrowser_playwright_chat_1__browser_navigate', { url: 'https://example.com/private?q=1' }, '打开网页 example.com'],
      ['read_file', { path: '/tmp/report.txt' }, '读取文件 report.txt'],
      ['exec_command', { cmd: 'pnpm test\n --filter web' }, '执行命令 pnpm test --filter web'],
      ['mcp_roxybrowser-openapi-mcp__roxy_proxy_delete', { proxyId: 'proxy-1' }, '删除代理 IP proxy-1'],
      ['mcp_custom-server__unknown_tool', { query: 'alpha' }, 'unknown tool alpha'],
    ]

    for (const [name, args, expectedTitle] of cases) {
      const request = createHitlRequestFromLegacyInterrupt('conversation-1', 'run-1', {
        interruptsId: `approval-${name}`,
        actionRequests: [{ name, args }],
        reviewConfigs: [],
      })

      expect(request?.subjects[0]?.title).toBe(expectedTitle)
      expect(request?.prompt).toBe(`允许 Roxy Agent ${expectedTitle} 吗？`)
    }
  })

  it('summarizes profile id arrays instead of rendering their JSON shape', () => {
    const request = createHitlRequestFromLegacyInterrupt('conversation-1', 'run-1', {
      interruptsId: 'approval-4',
      actionRequests: [{
        name: 'mcp_roxybrowser-openapi-mcp__roxy_profile_delete',
        args: ['b9472f2dfea9f5fb5b17a6d486923f10'],
      }],
      reviewConfigs: [],
    })

    expect(request?.prompt).toBe('允许 Roxy Agent 删除窗口 b9472f2dfea9f5fb5b17a6d486923f10 吗？')
  })

  it('uses resolved action titles only in the HITL presentation', () => {
    const input = { dirIds: ['window-1'] }
    const request = createHitlRequestFromAgentEvent('conversation-1', 'run-1', {
      approvalId: 'approval-5',
      actionRequests: [{ name: 'roxy_profile_delete', args: input }],
    }, {
      actionTitles: ['删除窗口 ANB-120'],
    })

    expect(request?.prompt).toBe('允许 Roxy Agent 删除窗口 ANB-120 吗？')
    expect(request?.subjects[0]).toEqual(expect.objectContaining({
      title: '删除窗口 ANB-120',
      name: 'roxy_profile_delete',
      input,
    }))
  })
})
